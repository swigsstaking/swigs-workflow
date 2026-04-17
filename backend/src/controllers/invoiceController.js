import { createHash } from 'crypto';
import Invoice from '../models/Invoice.js';
import Event from '../models/Event.js';
import Quote from '../models/Quote.js';
import Settings from '../models/Settings.js';
import { historyService } from '../services/historyService.js';
import { generateInvoicePDF } from '../services/pdf.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import { decrypt } from '../utils/crypto.js';
import { roundTo5ct, isFullyPaid, computeLineDiscount } from '../utils/currency.js';
import { verifyProjectOwnership, getUserProjectIds, assertOwnership } from '../utils/project.js';
import { INVOICE_STATUSES } from '../utils/constants.js';
import { parsePagination } from '../utils/pagination.js';

import { eventBus } from '../services/eventBus.service.js';
import { publishToLexa } from '../services/lexaWebhook.service.js';

/** Safe non-blocking event publish (logs errors instead of swallowing) */
const safePublish = (event, payload) => {
  try { eventBus.publish(event, payload); } catch (err) { console.error('[EventBus] publish failed:', event, err.message); }
};

const ALLOWED_INVOICE_STATUSES = INVOICE_STATUSES;

// @desc    Get invoices for a project
// @route   GET /api/projects/:projectId/invoices
export const getInvoices = async (req, res, next) => {
  try {
    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    const { status } = req.query;

    let query = { project: req.params.projectId };

    if (status && ALLOWED_INVOICE_STATUSES.includes(status)) {
      query.status = status;
    }

    const invoices = await Invoice.find(query).sort('-createdAt');

    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all invoices (global)
// @route   GET /api/invoices
export const getAllInvoices = async (req, res, next) => {
  try {
    const { status } = req.query;

    // Pagination
    const { page, limit, skip } = parsePagination(req.query);

    // Filter by user's projects
    const projectIds = await getUserProjectIds(req.user?._id);

    let query = {};
    if (projectIds) {
      query.project = { $in: projectIds };
    }
    if (status) {
      const statuses = status.split(',').filter(s => ALLOWED_INVOICE_STATUSES.includes(s));
      if (statuses.length === 1) query.status = statuses[0];
      else if (statuses.length > 1) query.status = { $in: statuses };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('project', 'name client')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    const denied = assertOwnership(req, res, invoice);
    if (denied) return;

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice from events and/or quotes, or custom lines
// @route   POST /api/projects/:projectId/invoices
export const createInvoice = async (req, res, next) => {
  // Tracks compensatory rollback state (no replica set — manual rollback on failure)
  let invoice = null;
  let billedEventIds = [];
  const updatedQuoteIds = [];

  try {
    const {
      invoiceType = 'standard',
      eventIds = [],
      quoteIds = [],
      quotePartials = {}, // { quoteId: { type: 'percent'|'amount', value: number } }
      customLines = [],
      notes,
      dueDate,
      issueDate,
      skipReminders,
      discountType,
      discountValue
    } = req.body;

    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);
    const vatRate = settings.invoicing.defaultVatRate;

    // Calculate issue date (allow custom date for past invoices)
    // Append T12:00:00 to date-only strings to avoid UTC midnight → previous day in CET/CEST
    const finalIssueDate = issueDate
      ? new Date(issueDate.length === 10 ? issueDate + 'T12:00:00' : issueDate)
      : new Date();

    // Calculate due date based on issue date
    const finalDueDate = dueDate ? new Date(dueDate) : new Date(
      finalIssueDate.getTime() + settings.invoicing.defaultPaymentTerms * 24 * 60 * 60 * 1000
    );

    // Generate invoice number (atomic via Counter — race-condition safe)
    const number = await Invoice.generateNumber();

    // Handle CUSTOM invoice type
    if (invoiceType === 'custom') {
      // Validate custom lines
      if (!customLines || customLines.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Ajoutez au moins une ligne à la facture'
        });
      }

      // Calculate totals from custom lines
      const processedLines = customLines.map(line => {
        const discount = computeLineDiscount(line);
        const lineVatRate = line.vatRate != null ? line.vatRate : null;
        return {
          description: line.description,
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice,
          discountType: line.discountType || undefined,
          discountValue: line.discountValue || undefined,
          discount,
          vatRate: lineVatRate,
          total: Math.max(0, (line.quantity || 1) * line.unitPrice - discount)
        };
      });

      const subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);

      // Calculate discount
      let discountAmt = 0;
      if (discountType && discountValue > 0) {
        discountAmt = discountType === 'percentage'
          ? subtotal * (discountValue / 100)
          : Math.min(discountValue, subtotal);
      }

      const netTotal = subtotal - discountAmt;

      // LTVA art. 25: Per-line VAT if any line has a custom rate, else global rate
      const hasPerLineVat = processedLines.some(l => l.vatRate != null);
      let vatAmount;
      let vatBreakdown = [];

      if (hasPerLineVat) {
        // Group lines by VAT rate and compute per-rate breakdown
        const discountRatio = subtotal > 0 ? (subtotal - discountAmt) / subtotal : 0;
        const vatMap = new Map();
        for (const line of processedLines) {
          const rate = line.vatRate != null ? line.vatRate : vatRate;
          const adjustedBase = line.total * discountRatio;
          if (!vatMap.has(rate)) vatMap.set(rate, { base: 0, amount: 0 });
          const entry = vatMap.get(rate);
          entry.base += adjustedBase;
          entry.amount += adjustedBase * (rate / 100);
        }
        vatBreakdown = [...vatMap.entries()]
          .map(([rate, { base, amount }]) => ({
            rate,
            base: Math.round(base * 100) / 100,
            amount: Math.round(amount * 100) / 100
          }))
          .sort((a, b) => b.rate - a.rate);
        vatAmount = vatBreakdown.reduce((sum, v) => sum + v.amount, 0);
      } else {
        vatAmount = netTotal * (vatRate / 100);
        if (vatRate > 0) {
          vatBreakdown = [{ rate: vatRate, base: Math.round(netTotal * 100) / 100, amount: Math.round(vatAmount * 100) / 100 }];
        }
      }

      const total = roundTo5ct(netTotal + vatAmount);

      // Create custom invoice
      invoice = await Invoice.create({
        project: req.params.projectId,
        number,
        invoiceType: 'custom',
        events: [],
        quotes: [],
        customLines: processedLines,
        subtotal,
        discountType: discountType || undefined,
        discountValue: discountValue || undefined,
        discountAmount: discountAmt,
        vatRate,
        vatAmount,
        vatBreakdown,
        total,
        issueDate: finalIssueDate,
        dueDate: finalDueDate,
        notes,
        skipReminders: !!skipReminders
      });

      // Log history
      await historyService.invoiceCreated(project._id, number, total);

      // Publish to Hub Event Bus for cross-app automations
      safePublish('invoice.created', {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        projectId: project._id.toString(),
        projectName: project.name,
        total: invoice.total,
        client: project.client,
        hubUserId: req.user?.hubUserId || null
      });

      // Publish to Lexa bridge (fire-and-forget, HMAC signed)
      publishToLexa('invoice.created', req.user?.hubUserId || null, {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        clientName: typeof project.client === 'object' ? (project.client?.name || project.client?.company || '') : (project.client || ''),
        total: invoice.total,
        amountHt: invoice.subtotal,
        amountTva: invoice.vatAmount,
        tvaRate: invoice.vatRate,
        dueDate: invoice.dueDate,
        description: project.name,
      }, req.user?._id || null).catch(() => { /* silent fire-and-forget */ });

      return res.status(201).json({ success: true, data: invoice });
    }

    // Handle STANDARD invoice type (existing logic)
    // Get events (if any)
    const events = eventIds.length > 0
      ? await Event.find({
          _id: { $in: eventIds },
          project: req.params.projectId,
          billed: false
        })
      : [];

    // Get quotes (if any) - signed or partially invoiced quotes can be invoiced
    const quotes = quoteIds.length > 0
      ? await Quote.find({
          _id: { $in: quoteIds },
          project: req.params.projectId,
          status: { $in: ['signed', 'partial'] }
        })
      : [];

    // Validate that we have at least one item
    if (events.length === 0 && quotes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sélectionnez au moins un événement ou un devis'
      });
    }

    // Calculate totals from events
    let subtotal = 0;
    const eventSnapshots = events.map(event => {
      let amount = 0;
      if (event.type === 'hours') {
        amount = event.hours * event.hourlyRate;
      } else if (event.type === 'expense') {
        amount = event.amount;
      }
      subtotal += amount;

      return {
        eventId: event._id,
        description: event.description,
        type: event.type,
        hours: event.hours,
        hourlyRate: event.hourlyRate,
        amount,
        date: event.date
      };
    });

    // Calculate totals from quotes with partial + DISCOUNT support
    let totalQuoteDiscount = 0;
    const quoteSnapshots = quotes.map(quote => {
      const partial = quotePartials[quote._id.toString()];
      const quoteDiscount = quote.discountAmount || 0;
      const quoteNet = quote.subtotal - quoteDiscount; // Net = after discount
      let invoiceNetAmount = quoteNet; // Default: full net amount
      let isPartial = false;

      // Calculate partial amount if specified (based on net amount)
      if (partial && partial.value > 0) {
        if (partial.type === 'percent') {
          invoiceNetAmount = quoteNet * (partial.value / 100);
        } else {
          invoiceNetAmount = Math.min(partial.value, quoteNet);
        }
        isPartial = invoiceNetAmount < quoteNet;
      }

      // Check remaining amount (based on net, tracking net amounts)
      const remainingNet = quoteNet - (quote.invoicedAmount || 0);
      if (invoiceNetAmount > remainingNet) {
        invoiceNetAmount = remainingNet;
      }

      // Prorate the discount based on how much of the quote is being invoiced
      const invoiceRatio = quoteNet > 0 ? invoiceNetAmount / quoteNet : 0;
      const proRatedDiscount = quoteDiscount * invoiceRatio;
      totalQuoteDiscount += proRatedDiscount;

      // Add pre-discount amount to invoice subtotal (for transparent breakdown)
      subtotal += invoiceNetAmount + proRatedDiscount;

      return {
        quoteId: quote._id,
        number: quote.number,
        lines: quote.lines.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountType: line.discountType || undefined,
          discountValue: line.discountValue || undefined,
          discount: line.discount || 0,
          total: line.total
        })),
        subtotal: quote.subtotal,
        invoicedAmount: invoiceNetAmount, // Net amount invoiced (for tracking)
        isPartial,
        signedAt: quote.signedAt
      };
    });

    // Apply quote discounts — VAT calculated on net (after discount)
    const discountAmount = Math.round(totalQuoteDiscount * 100) / 100;
    const netAmount = subtotal - discountAmount;
    const vatAmount = netAmount * (vatRate / 100);
    const total = roundTo5ct(netAmount + vatAmount);

    // LTVA art. 25: vatBreakdown (single rate for standard invoices)
    const vatBreakdown = vatRate > 0
      ? [{ rate: vatRate, base: Math.round(netAmount * 100) / 100, amount: Math.round(vatAmount * 100) / 100 }]
      : [];

    // Step 1: Create the invoice document
    invoice = await Invoice.create({
      project: req.params.projectId,
      number,
      invoiceType: 'standard',
      events: eventSnapshots,
      quotes: quoteSnapshots,
      customLines: [],
      subtotal,
      discountType: discountAmount > 0 ? 'fixed' : undefined,
      discountValue: discountAmount > 0 ? discountAmount : undefined,
      discountAmount,
      vatRate,
      vatAmount,
      vatBreakdown,
      total,
      issueDate: finalIssueDate,
      dueDate: finalDueDate,
      notes,
      skipReminders: !!skipReminders
    });

    // Step 2: Mark events as billed (compensatory rollback: unbill on error)
    if (eventIds.length > 0) {
      await Event.updateMany(
        { _id: { $in: eventIds } },
        { billed: true, invoice: invoice._id }
      );
      billedEventIds = eventIds;
    }

    // Step 3: Update quotes with partial payment tracking (compensatory rollback on error)
    for (const quote of quotes) {
      const snapshot = quoteSnapshots.find(qs => qs.quoteId.toString() === quote._id.toString());
      const newInvoicedAmount = (quote.invoicedAmount || 0) + snapshot.invoicedAmount;
      const quoteNetAmount = quote.subtotal - (quote.discountAmount || 0);
      const isFullyInvoiced = newInvoicedAmount >= quoteNetAmount;

      await Quote.findByIdAndUpdate(quote._id, {
        $set: {
          status: isFullyInvoiced ? 'invoiced' : 'partial',
          invoicedAmount: newInvoicedAmount,
          invoice: isFullyInvoiced ? invoice._id : quote.invoice, // Only set main invoice ref if fully invoiced
          invoicedAt: isFullyInvoiced ? new Date() : quote.invoicedAt
        },
        $push: {
          invoices: {
            invoice: invoice._id,
            amount: snapshot.invoicedAmount,
            invoicedAt: new Date()
          }
        }
      });

      updatedQuoteIds.push({ id: quote._id, previousStatus: quote.status, previousInvoicedAmount: quote.invoicedAmount || 0, previousInvoice: quote.invoice });
    }

    // Log history
    await historyService.invoiceCreated(project._id, number, total);

    // Publish to Hub Event Bus for cross-app automations
    safePublish('invoice.created', {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.number,
      projectId: project._id.toString(),
      projectName: project.name,
      total: invoice.total,
      client: project.client,
      hubUserId: req.user?.hubUserId || null
    });

    // Publish to Lexa bridge (fire-and-forget, HMAC signed)
    publishToLexa('invoice.created', req.user?.hubUserId || null, {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.number,
      clientName: typeof project.client === 'object' ? (project.client?.name || project.client?.company || '') : (project.client || ''),
      total: invoice.total,
      amountHt: invoice.subtotal,
      amountTva: invoice.vatAmount,
      tvaRate: invoice.vatRate,
      dueDate: invoice.dueDate,
      description: project.name,
    }, req.user?._id || null).catch(() => { /* silent fire-and-forget */ });

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    // Compensatory rollback: undo side effects if invoice was already created
    if (invoice) {
      try {
        // Rollback step 2: unbill events
        if (billedEventIds.length > 0) {
          await Event.updateMany(
            { _id: { $in: billedEventIds } },
            { billed: false, invoice: null }
          );
        }

        // Rollback step 3: restore quote states
        for (const q of updatedQuoteIds) {
          await Quote.findByIdAndUpdate(q.id, {
            $set: {
              status: q.previousStatus,
              invoicedAmount: q.previousInvoicedAmount,
              invoice: q.previousInvoice,
              invoicedAt: null
            },
            $pull: { invoices: { invoice: invoice._id } }
          });
        }

        // Rollback step 1: delete the invoice
        await Invoice.findByIdAndDelete(invoice._id);
      } catch (rollbackErr) {
        console.error('Invoice creation rollback failed:', rollbackErr.message, {
          invoiceId: invoice._id,
          billedEventIds,
          updatedQuoteIds
        });
      }
    }

    next(error);
  }
};

// @desc    Get edit data for a standard draft invoice
// @route   GET /api/invoices/:id/edit-data
export const getInvoiceEditData = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Seules les factures en brouillon peuvent être modifiées' });
    }
    if (invoice.invoiceType !== 'standard') {
      return res.status(400).json({ success: false, error: 'Cette route est réservée aux factures standard' });
    }

    const projectId = invoice.project._id;

    // Current snapshot IDs
    const currentEventIds = (invoice.events || []).map(e => e.eventId).filter(Boolean);
    const currentQuoteIds = (invoice.quotes || []).map(q => q.quoteId).filter(Boolean);

    // 1. Unbilled events from this project
    const unbilledEvents = await Event.find({
      project: projectId,
      billed: false
    }).sort('-date').lean();

    // 2. Events billed by THIS invoice (they show as billed but belong to this invoice)
    const invoiceBilledEvents = currentEventIds.length > 0
      ? await Event.find({ _id: { $in: currentEventIds } }).sort('-date').lean()
      : [];

    // Merge without duplicates (unbilled + this invoice's events)
    const seenEventIds = new Set();
    const allEvents = [];
    for (const ev of [...invoiceBilledEvents, ...unbilledEvents]) {
      const id = ev._id.toString();
      if (!seenEventIds.has(id)) {
        seenEventIds.add(id);
        allEvents.push(ev);
      }
    }
    // Sort by date desc
    allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Invoiceable quotes from project (signed/partial)
    const invoiceableQuotes = await Quote.find({
      project: projectId,
      status: { $in: ['signed', 'partial'] }
    }).sort('-signedAt');

    // Build quotes map for fast lookup
    const quotesMap = new Map();
    for (const q of invoiceableQuotes) {
      quotesMap.set(q._id.toString(), q.toObject());
    }

    // 4. For quotes in this invoice's snapshots, restore their remainingAmount
    //    as if this invoice didn't exist
    for (const snapshot of invoice.quotes || []) {
      const qId = snapshot.quoteId?.toString();
      if (!qId) continue;
      const snapshotInvoicedAmount = snapshot.invoicedAmount || snapshot.subtotal || 0;

      if (quotesMap.has(qId)) {
        // Quote is already invoiceable — add back what this invoice took
        const q = quotesMap.get(qId);
        q.invoicedAmount = Math.max(0, (q.invoicedAmount || 0) - snapshotInvoicedAmount);
      } else {
        // Quote might be fully 'invoiced' because of this invoice — load it
        const quote = await Quote.findById(qId).lean();
        if (quote) {
          quote.invoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - snapshotInvoicedAmount);
          quotesMap.set(qId, quote);
        }
      }
    }

    // Calculate remainingAmount for each quote (same logic as getInvoiceableQuotes)
    const allQuotes = Array.from(quotesMap.values()).map(q => {
      const quoteNet = q.subtotal - (q.discountAmount || 0);
      q.remainingAmount = quoteNet - (q.invoicedAmount || 0);
      return q;
    });

    // Sort by signedAt desc
    allQuotes.sort((a, b) => new Date(b.signedAt || 0) - new Date(a.signedAt || 0));

    res.json({
      success: true,
      data: {
        events: allEvents,
        quotes: allQuotes,
        currentEventIds: currentEventIds.map(id => id.toString()),
        currentQuoteIds: currentQuoteIds.map(id => id.toString())
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
export const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // skipReminders can be toggled on any invoice (not just drafts)
    if (req.body.skipReminders !== undefined) {
      invoice.skipReminders = !!req.body.skipReminders;
      // If only toggling skipReminders, save and return early
      if (Object.keys(req.body).length === 1) {
        await invoice.save();
        return res.json({ success: true, data: invoice });
      }
    }

    // ── Date-only updates allowed on any status ──
    const dateOnlyFields = ['issueDate', 'dueDate', 'paidAt'];
    const bodyKeys = Object.keys(req.body).filter(k => k !== 'skipReminders');
    const isDateOnlyUpdate = bodyKeys.length > 0 && bodyKeys.every(k => dateOnlyFields.includes(k));

    if (isDateOnlyUpdate) {
      const settings = await Settings.getSettings(req.user._id);
      const paymentTerms = settings?.invoicing?.defaultPaymentTerms || 30;

      if (req.body.issueDate) {
        const newIssueDate = new Date(req.body.issueDate.length === 10 ? req.body.issueDate + 'T12:00:00' : req.body.issueDate);
        invoice.issueDate = newIssueDate;
        // Auto-recalculate dueDate unless explicitly provided
        if (!req.body.dueDate) {
          const newDueDate = new Date(newIssueDate);
          newDueDate.setDate(newDueDate.getDate() + paymentTerms);
          invoice.dueDate = newDueDate;
        }
      }
      if (req.body.dueDate) {
        invoice.dueDate = new Date(req.body.dueDate.length === 10 ? req.body.dueDate + 'T12:00:00' : req.body.dueDate);
      }
      if (req.body.paidAt) {
        invoice.paidAt = new Date(req.body.paidAt.length === 10 ? req.body.paidAt + 'T12:00:00' : req.body.paidAt);
      }

      await invoice.save();
      return res.json({ success: true, data: invoice });
    }

    // Only draft invoices can be fully updated
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Seules les factures en brouillon peuvent être modifiées'
      });
    }

    const { notes, issueDate, dueDate, vatRate, customLines, discountType, discountValue, eventIds, quoteIds, quotePartials } = req.body;

    if (notes !== undefined) invoice.notes = notes;
    if (issueDate) {
      invoice.issueDate = new Date(issueDate.length === 10 ? issueDate + 'T12:00:00' : issueDate);
    }
    if (dueDate) invoice.dueDate = dueDate;

    // ─── Standard invoice edit (events/quotes) ───
    if (invoice.invoiceType === 'standard' && (eventIds !== undefined || quoteIds !== undefined)) {
      const newEventIds = eventIds || [];
      const newQuoteIds = quoteIds || [];

      if (newEventIds.length === 0 && newQuoteIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Sélectionnez au moins un événement ou un devis' });
      }

      const currentEventIds = (invoice.events || []).map(e => e.eventId?.toString()).filter(Boolean);
      const currentQuoteIds = (invoice.quotes || []).map(q => q.quoteId?.toString()).filter(Boolean);

      const removedEventIds = currentEventIds.filter(id => !newEventIds.includes(id));
      const addedEventIds = newEventIds.filter(id => !currentEventIds.includes(id));
      const removedQuoteIds = currentQuoteIds.filter(id => !newQuoteIds.includes(id));
      const addedQuoteIds = newQuoteIds.filter(id => !currentQuoteIds.includes(id));

      // Track rollback state
      const rollbackOps = { unbilledEvents: [], revertedQuotes: [], billedEvents: [], updatedQuotes: [] };

      try {
        // 1. Unbill removed events
        if (removedEventIds.length > 0) {
          await Event.updateMany(
            { _id: { $in: removedEventIds } },
            { billed: false, invoice: null }
          );
          rollbackOps.unbilledEvents = removedEventIds;
        }

        // 2. Revert removed quotes
        for (const qId of removedQuoteIds) {
          const snapshot = invoice.quotes.find(q => q.quoteId?.toString() === qId);
          const quote = await Quote.findById(qId);
          if (!quote || !snapshot) continue;

          const snapshotAmount = snapshot.invoicedAmount || snapshot.subtotal || 0;
          const newInvoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - snapshotAmount);
          const quoteNetAmount = quote.subtotal - (quote.discountAmount || 0);
          const updatedInvoices = (quote.invoices || []).filter(inv => inv.invoice.toString() !== invoice._id.toString());

          let newStatus = 'signed';
          if (newInvoicedAmount > 0 && newInvoicedAmount < quoteNetAmount) newStatus = 'partial';
          else if (newInvoicedAmount >= quoteNetAmount) newStatus = 'invoiced';

          rollbackOps.revertedQuotes.push({
            id: qId, previousStatus: quote.status,
            previousInvoicedAmount: quote.invoicedAmount || 0,
            previousInvoices: quote.invoices
          });

          await Quote.findByIdAndUpdate(qId, {
            $set: {
              status: newStatus, invoicedAmount: newInvoicedAmount,
              invoice: newStatus === 'invoiced' ? quote.invoice : null,
              invoicedAt: newStatus === 'invoiced' ? quote.invoicedAt : null,
              invoices: updatedInvoices
            }
          });
        }

        // 3. Fetch & validate new events
        const addedEvents = addedEventIds.length > 0
          ? await Event.find({ _id: { $in: addedEventIds }, project: invoice.project._id, billed: false })
          : [];
        // Kept events (still in the invoice) — use original snapshots
        const keptEventSnapshots = (invoice.events || []).filter(e => newEventIds.includes(e.eventId?.toString()));

        // Create snapshots for added events (same logic as createInvoice)
        const addedEventSnapshots = addedEvents.map(event => {
          let amount = 0;
          if (event.type === 'hours') amount = event.hours * event.hourlyRate;
          else if (event.type === 'expense') amount = event.amount;
          return {
            eventId: event._id, description: event.description, type: event.type,
            hours: event.hours, hourlyRate: event.hourlyRate, amount, date: event.date
          };
        });

        // 4. Bill added events
        if (addedEvents.length > 0) {
          const addedIds = addedEvents.map(e => e._id);
          await Event.updateMany({ _id: { $in: addedIds } }, { billed: true, invoice: invoice._id });
          rollbackOps.billedEvents = addedIds;
        }

        // 5. Fetch & validate new quotes + create snapshots
        const addedQuotes = addedQuoteIds.length > 0
          ? await Quote.find({ _id: { $in: addedQuoteIds }, project: invoice.project._id, status: { $in: ['signed', 'partial'] } })
          : [];
        const keptQuoteSnapshots = (invoice.quotes || []).filter(q => newQuoteIds.includes(q.quoteId?.toString()));

        let subtotal = 0;
        let totalQuoteDiscount = 0;

        // Sum kept event snapshots
        for (const es of keptEventSnapshots) subtotal += es.amount || 0;
        // Sum added event snapshots
        for (const es of addedEventSnapshots) subtotal += es.amount || 0;

        // Sum kept quote snapshots (reuse existing snapshot amounts)
        for (const qs of keptQuoteSnapshots) {
          const qId = qs.quoteId?.toString();
          const quote = await Quote.findById(qId).lean();
          const quoteDiscount = quote?.discountAmount || 0;
          const quoteNet = (quote?.subtotal || qs.subtotal) - quoteDiscount;
          const invoiceNetAmount = qs.invoicedAmount || qs.subtotal || 0;
          const invoiceRatio = quoteNet > 0 ? invoiceNetAmount / quoteNet : 0;
          totalQuoteDiscount += quoteDiscount * invoiceRatio;
          subtotal += invoiceNetAmount + (quoteDiscount * invoiceRatio);
        }

        // Create snapshots for added quotes (same logic as createInvoice)
        const addedQuoteSnapshots = [];
        for (const quote of addedQuotes) {
          const partial = quotePartials?.[quote._id.toString()];
          const quoteDiscount = quote.discountAmount || 0;
          const quoteNet = quote.subtotal - quoteDiscount;
          let invoiceNetAmount = quoteNet;
          let isPartial = false;

          if (partial && partial.value > 0) {
            if (partial.type === 'percent') invoiceNetAmount = quoteNet * (partial.value / 100);
            else invoiceNetAmount = Math.min(partial.value, quoteNet);
            isPartial = invoiceNetAmount < quoteNet;
          }

          const remainingNet = quoteNet - (quote.invoicedAmount || 0);
          if (invoiceNetAmount > remainingNet) invoiceNetAmount = remainingNet;

          const invoiceRatio = quoteNet > 0 ? invoiceNetAmount / quoteNet : 0;
          const proRatedDiscount = quoteDiscount * invoiceRatio;
          totalQuoteDiscount += proRatedDiscount;
          subtotal += invoiceNetAmount + proRatedDiscount;

          addedQuoteSnapshots.push({
            quoteId: quote._id, number: quote.number,
            lines: quote.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discountType: l.discountType || undefined, discountValue: l.discountValue || undefined, discount: l.discount || 0, total: l.total })),
            subtotal: quote.subtotal, invoicedAmount: invoiceNetAmount, isPartial, signedAt: quote.signedAt
          });

          // 6. Update quote tracking
          const newInvoicedAmount = (quote.invoicedAmount || 0) + invoiceNetAmount;
          const isFullyInvoiced = newInvoicedAmount >= quoteNet;

          rollbackOps.updatedQuotes.push({
            id: quote._id, previousStatus: quote.status,
            previousInvoicedAmount: quote.invoicedAmount || 0, previousInvoice: quote.invoice
          });

          await Quote.findByIdAndUpdate(quote._id, {
            $set: {
              status: isFullyInvoiced ? 'invoiced' : 'partial',
              invoicedAmount: newInvoicedAmount,
              invoice: isFullyInvoiced ? invoice._id : quote.invoice,
              invoicedAt: isFullyInvoiced ? new Date() : quote.invoicedAt
            },
            $push: { invoices: { invoice: invoice._id, amount: invoiceNetAmount, invoicedAt: new Date() } }
          });
        }

        // 7. Also handle quotePartials for KEPT quotes (user may have changed partial amounts)
        // For kept quotes that have a new partial value, we need to update them
        const updatedKeptQuoteSnapshots = [];
        for (const qs of keptQuoteSnapshots) {
          const qId = qs.quoteId?.toString();
          const partial = quotePartials?.[qId];

          if (partial && parseFloat(partial.value) > 0) {
            // User specified a new partial amount for this kept quote — recalculate
            const quote = await Quote.findById(qId);
            if (quote) {
              const quoteDiscount = quote.discountAmount || 0;
              const quoteNet = quote.subtotal - quoteDiscount;
              const oldSnapshotAmount = qs.invoicedAmount || qs.subtotal || 0;

              // The quote's invoicedAmount in DB includes this invoice's old amount
              // So remaining = quoteNet - (currentInvoicedAmount - oldSnapshotAmount)
              const otherInvoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - oldSnapshotAmount);
              const remainingNet = quoteNet - otherInvoicedAmount;

              let newInvoiceNetAmount;
              if (partial.type === 'percent') {
                newInvoiceNetAmount = quoteNet * (parseFloat(partial.value) / 100);
              } else {
                newInvoiceNetAmount = Math.min(parseFloat(partial.value), remainingNet);
              }
              if (newInvoiceNetAmount > remainingNet) newInvoiceNetAmount = remainingNet;

              const isPartialQuote = newInvoiceNetAmount < quoteNet;

              // Subtract old amounts from subtotal/discount and add new
              const oldInvoiceRatio = quoteNet > 0 ? oldSnapshotAmount / quoteNet : 0;
              subtotal -= oldSnapshotAmount + (quoteDiscount * oldInvoiceRatio);
              totalQuoteDiscount -= quoteDiscount * oldInvoiceRatio;

              const newInvoiceRatio = quoteNet > 0 ? newInvoiceNetAmount / quoteNet : 0;
              subtotal += newInvoiceNetAmount + (quoteDiscount * newInvoiceRatio);
              totalQuoteDiscount += quoteDiscount * newInvoiceRatio;

              // Update quote tracking in DB
              const newTotalInvoiced = otherInvoicedAmount + newInvoiceNetAmount;
              const isFullyInvoiced = newTotalInvoiced >= quoteNet;

              // Update the invoices[] entry for this invoice
              const updatedInvoices = (quote.invoices || []).map(inv => {
                if (inv.invoice.toString() === invoice._id.toString()) {
                  return { ...inv.toObject(), amount: newInvoiceNetAmount, invoicedAt: new Date() };
                }
                return inv;
              });

              await Quote.findByIdAndUpdate(qId, {
                $set: {
                  status: isFullyInvoiced ? 'invoiced' : newTotalInvoiced > 0 ? 'partial' : 'signed',
                  invoicedAmount: newTotalInvoiced,
                  invoice: isFullyInvoiced ? invoice._id : quote.invoice,
                  invoicedAt: isFullyInvoiced ? new Date() : quote.invoicedAt,
                  invoices: updatedInvoices
                }
              });

              updatedKeptQuoteSnapshots.push({
                quoteId: quote._id, number: quote.number,
                lines: quote.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discountType: l.discountType || undefined, discountValue: l.discountValue || undefined, discount: l.discount || 0, total: l.total })),
                subtotal: quote.subtotal, invoicedAmount: newInvoiceNetAmount, isPartial: isPartialQuote, signedAt: quote.signedAt
              });
              continue;
            }
          }
          updatedKeptQuoteSnapshots.push(qs);
        }

        // 8. Recalculate totals
        const discountAmount = Math.round(totalQuoteDiscount * 100) / 100;
        const netAmount = subtotal - discountAmount;
        const vatAmt = netAmount * (invoice.vatRate / 100);
        const total = roundTo5ct(netAmount + vatAmt);

        // 9. Update invoice
        invoice.events = [...keptEventSnapshots, ...addedEventSnapshots];
        invoice.quotes = [...updatedKeptQuoteSnapshots, ...addedQuoteSnapshots];
        invoice.subtotal = subtotal;
        invoice.discountType = discountAmount > 0 ? 'fixed' : undefined;
        invoice.discountValue = discountAmount > 0 ? discountAmount : undefined;
        invoice.discountAmount = discountAmount;
        invoice.vatAmount = vatAmt;
        invoice.vatBreakdown = invoice.vatRate > 0
          ? [{ rate: invoice.vatRate, base: Math.round(netAmount * 100) / 100, amount: Math.round(vatAmt * 100) / 100 }]
          : [];
        invoice.total = total;

        await invoice.save();
        return res.json({ success: true, data: invoice });

      } catch (error) {
        // Compensatory rollback
        try {
          // Re-bill unbilled events
          if (rollbackOps.unbilledEvents.length > 0) {
            await Event.updateMany({ _id: { $in: rollbackOps.unbilledEvents } }, { billed: true, invoice: invoice._id });
          }
          // Unbill newly billed events
          if (rollbackOps.billedEvents.length > 0) {
            await Event.updateMany({ _id: { $in: rollbackOps.billedEvents } }, { billed: false, invoice: null });
          }
          // Restore reverted quotes
          for (const q of rollbackOps.revertedQuotes) {
            await Quote.findByIdAndUpdate(q.id, {
              $set: { status: q.previousStatus, invoicedAmount: q.previousInvoicedAmount, invoices: q.previousInvoices }
            });
          }
          // Revert newly updated quotes
          for (const q of rollbackOps.updatedQuotes) {
            await Quote.findByIdAndUpdate(q.id, {
              $set: { status: q.previousStatus, invoicedAmount: q.previousInvoicedAmount, invoice: q.previousInvoice },
              $pull: { invoices: { invoice: invoice._id } }
            });
          }
        } catch (rollbackErr) {
          console.error('Standard invoice update rollback failed:', rollbackErr.message, { invoiceId: invoice._id });
        }
        throw error;
      }
    }

    // Allow editing custom lines on custom invoices
    if (customLines !== undefined && invoice.invoiceType === 'custom') {
      const processedLines = customLines.map(line => {
        const discount = computeLineDiscount(line);
        return {
          description: line.description,
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice,
          discountType: line.discountType || undefined,
          discountValue: line.discountValue || undefined,
          discount,
          total: Math.max(0, (line.quantity || 1) * line.unitPrice - discount)
        };
      });
      invoice.customLines = processedLines;
      invoice.subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);
    }

    // Update discount
    if (discountType !== undefined) {
      invoice.discountType = discountType || undefined;
      invoice.discountValue = discountValue || 0;
    }

    if (vatRate !== undefined) {
      const cleanVatRate = parseFloat(vatRate);
      if (isNaN(cleanVatRate) || cleanVatRate < 0 || cleanVatRate > 100) {
        return res.status(400).json({ success: false, error: 'TVA invalide (0-100%)' });
      }
      invoice.vatRate = cleanVatRate;
    }

    // Recalculate totals with discount
    let discountAmt = 0;
    if (invoice.discountType && invoice.discountValue > 0) {
      discountAmt = invoice.discountType === 'percentage'
        ? invoice.subtotal * (invoice.discountValue / 100)
        : Math.min(invoice.discountValue, invoice.subtotal);
    }
    invoice.discountAmount = discountAmt;
    const netTotal = invoice.subtotal - discountAmt;
    invoice.vatAmount = netTotal * (invoice.vatRate / 100);
    invoice.total = roundTo5ct(netTotal + invoice.vatAmount);

    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Change invoice status
// @route   PATCH /api/invoices/:id/status
export const changeInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // Validate status transition
    const ALLOWED_TRANSITIONS = {
      'draft': ['sent', 'cancelled'],
      'sent': ['draft', 'paid', 'cancelled'],
      'partial': ['paid', 'cancelled'],
      'paid': ['cancelled'],
      'cancelled': []
    };

    const allowed = ALLOWED_TRANSITIONS[invoice.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Transition de "${invoice.status}" vers "${status}" non autorisée`
      });
    }

    const oldStatus = invoice.status;
    invoice.status = status;

    // Set paid date and paidAmount if status is paid (direct mark as paid)
    if (status === 'paid' && !invoice.paidAt) {
      invoice.paidAt = new Date();
      invoice.paidAmount = invoice.total;
    }

    // If cancelled, unbill the events and quotes (with compensatory rollback)
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      // Step 1: Unbill events
      await Event.updateMany(
        { invoice: invoice._id },
        { billed: false, invoice: null }
      );

      // Step 2: Update quotes (with rollback if it fails)
      try {
        if (invoice.quotes && invoice.quotes.length > 0) {
          for (const quoteSnapshot of invoice.quotes) {
            const quote = await Quote.findById(quoteSnapshot.quoteId);
            if (!quote) continue;

            const newInvoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - (quoteSnapshot.invoicedAmount || quoteSnapshot.subtotal || 0));

            const updatedInvoices = (quote.invoices || []).filter(
              inv => inv.invoice.toString() !== invoice._id.toString()
            );

            let newStatus = 'signed';
            if (newInvoicedAmount > 0 && newInvoicedAmount < quote.subtotal) {
              newStatus = 'partial';
            } else if (newInvoicedAmount >= quote.subtotal) {
              newStatus = 'invoiced';
            }

            await Quote.findByIdAndUpdate(quote._id, {
              $set: {
                status: newStatus,
                invoicedAmount: newInvoicedAmount,
                invoice: newStatus === 'invoiced' ? quote.invoice : null,
                invoicedAt: newStatus === 'invoiced' ? quote.invoicedAt : null,
                invoices: updatedInvoices
              }
            });
          }
        } else {
          await Quote.updateMany(
            { invoice: invoice._id },
            { status: 'signed', invoice: null, invoicedAt: null }
          );
        }
      } catch (quoteErr) {
        // Rollback step 1: re-bill events since quote update failed
        try {
          const eventIds = (invoice.events || []).map(e => e.eventId).filter(Boolean);
          if (eventIds.length > 0) {
            await Event.updateMany(
              { _id: { $in: eventIds } },
              { billed: true, invoice: invoice._id }
            );
          }
        } catch (rollbackErr) {
          console.error('Cancellation rollback failed (re-billing events):', rollbackErr.message, { invoiceId: invoice._id });
        }
        throw quoteErr;
      }

      await historyService.invoiceCancelled(invoice.project._id, invoice.number);
    } else if (status === 'draft' && oldStatus === 'sent') {
      await historyService.log(invoice.project._id, 'invoice_reverted', `Facture ${invoice.number} repassée en brouillon`, { invoiceNumber: invoice.number });
    } else if (status === 'sent') {
      await historyService.invoiceSent(invoice.project._id, invoice.number);
    } else if (status === 'paid') {
      await historyService.invoicePaid(invoice.project._id, invoice.number);
    }

    await invoice.save();

    // Publish to Hub Event Bus for cross-app automations
    if (status === 'paid') {
      safePublish('invoice.paid', {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        projectId: invoice.project._id.toString(),
        projectName: invoice.project.name,
        total: invoice.total,
        paidAt: invoice.paidAt,
        client: invoice.project.client,
        hubUserId: req.user?.hubUserId || null
      });

      // Publish to Lexa bridge (fire-and-forget, HMAC signed)
      publishToLexa('invoice.paid', req.user?.hubUserId || null, {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        clientName: typeof invoice.project.client === 'object' ? (invoice.project.client?.name || invoice.project.client?.company || '') : (invoice.project.client || ''),
        paidAmount: invoice.total,
        paidDate: invoice.paidAt,
        paymentMethod: 'direct',
      }, req.user?._id || null).catch(() => { /* silent fire-and-forget */ });
    } else if (status === 'sent') {
      safePublish('invoice.sent', {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        projectId: invoice.project._id.toString(),
        projectName: invoice.project.name,
        total: invoice.total,
        client: invoice.project.client,
        hubUserId: req.user?.hubUserId || null
      });
    }

    // Auto-sync AbaNinja (non-blocking)
    if (status === 'sent' || status === 'paid') {
      try {
        const Settings = (await import('../models/Settings.js')).default;
        const settings = await Settings.getSettings(req.user._id);
        if (settings.abaninja?.enabled && settings.abaninja?.autoSync && settings.abaninja?.syncInvoices && !invoice.abaNinjaId) {
          const { AbaNinjaService } = await import('../services/abaninja.service.js');
          const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));

          // Find or create client address
          const client = invoice.project.client;
          let address = await service.findAddressByEmail(client.email);
          if (!address) {
            const addressData = service.mapClientToAddress(client);
            address = await service.createAddress(addressData);
          }

          // Create invoice in AbaNinja
          const invoiceData = service.mapInvoiceToAbaNinja(invoice, invoice.project, address.id);
          const abaNinjaInvoice = await service.createInvoice(invoiceData);

          // Update invoice
          invoice.abaNinjaId = abaNinjaInvoice.id;
          invoice.abaNinjaSyncedAt = new Date();
          invoice.abaNinjaSyncStatus = 'synced';
          await invoice.save();

          console.log(`Auto-synced invoice ${invoice.number} to AbaNinja (ID: ${abaNinjaInvoice.id})`);
        }
      } catch (err) {
        console.error('AbaNinja auto-sync failed:', err.message);
        // Ne JAMAIS bloquer l'opération principale
      }
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a payment on an invoice
// @route   POST /api/invoices/:id/payments
export const recordPayment = async (req, res, next) => {
  try {
    const { amount, date, method, notes } = req.body;
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // Only sent or partial invoices can receive payments
    if (!['sent', 'partial'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: 'Seules les factures envoyées ou partiellement payées peuvent recevoir un paiement'
      });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Le montant doit être supérieur à 0' });
    }

    // Cap to remaining amount
    const remaining = invoice.total - (invoice.paidAmount || 0);
    const finalAmount = Math.min(paymentAmount, remaining);

    // Push payment
    invoice.payments.push({
      amount: finalAmount,
      date: date ? new Date(date) : new Date(),
      method: method || 'bank_transfer',
      notes: notes || undefined
    });

    // Update paidAmount
    invoice.paidAmount = (invoice.paidAmount || 0) + finalAmount;

    // Update status (Swiss tolerance: < 0.05 CHF difference = fully paid)
    if (isFullyPaid(invoice.paidAmount, invoice.total)) {
      invoice.status = 'paid';
      invoice.paidAmount = invoice.total; // Normalize to avoid display artifacts
      invoice.paidAt = new Date();
    } else {
      invoice.status = 'partial';
    }

    await invoice.save();

    // Log history
    await historyService.invoicePaymentReceived(
      invoice.project._id,
      invoice.number,
      finalAmount
    );

    if (invoice.status === 'paid') {
      await historyService.invoicePaid(invoice.project._id, invoice.number);
    }

    // Publish to Hub Event Bus if fully paid
    if (invoice.status === 'paid') {
      safePublish('invoice.paid', {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        projectId: invoice.project._id.toString(),
        projectName: invoice.project.name,
        total: invoice.total,
        paidAt: invoice.paidAt,
        client: invoice.project.client,
        hubUserId: req.user?.hubUserId || null
      });

      // Publish to Lexa bridge (fire-and-forget, HMAC signed)
      publishToLexa('invoice.paid', req.user?.hubUserId || null, {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.number,
        clientName: typeof invoice.project.client === 'object' ? (invoice.project.client?.name || invoice.project.client?.company || '') : (invoice.project.client || ''),
        paidAmount: invoice.paidAmount,
        paidDate: invoice.paidAt,
        paymentMethod: method || 'bank_transfer',
      }, req.user?._id || null).catch(() => { /* silent fire-and-forget */ });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // Block deletion of sent, partial or paid invoices
    if (['paid', 'sent', 'partial'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer une facture envoyée, partiellement payée ou payée. Annulez-la d\'abord.'
      });
    }

    // Step 1: Unbill all events linked to this invoice
    await Event.updateMany(
      { invoice: invoice._id },
      { billed: false, invoice: null }
    );

    // Step 2: Update quotes (with rollback if it fails)
    try {
      if (invoice.quotes && invoice.quotes.length > 0) {
        for (const quoteSnapshot of invoice.quotes) {
          const quote = await Quote.findById(quoteSnapshot.quoteId);
          if (!quote) continue;

          const newInvoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - (quoteSnapshot.invoicedAmount || quoteSnapshot.subtotal || 0));

          const updatedInvoices = (quote.invoices || []).filter(
            inv => inv.invoice.toString() !== invoice._id.toString()
          );

          let newStatus = 'signed';
          if (newInvoicedAmount > 0 && newInvoicedAmount < quote.subtotal) {
            newStatus = 'partial';
          } else if (newInvoicedAmount >= quote.subtotal) {
            newStatus = 'invoiced';
          }

          await Quote.findByIdAndUpdate(quote._id, {
            $set: {
              status: newStatus,
              invoicedAmount: newInvoicedAmount,
              invoice: newStatus === 'invoiced' ? quote.invoice : null,
              invoicedAt: newStatus === 'invoiced' ? quote.invoicedAt : null,
              invoices: updatedInvoices
            }
          });
        }
      } else {
        await Quote.updateMany(
          { invoice: invoice._id },
          { status: 'signed', invoice: null, invoicedAt: null }
        );
      }
    } catch (quoteErr) {
      // Rollback step 1: re-bill events since quote update failed
      try {
        const eventIds = (invoice.events || []).map(e => e.eventId).filter(Boolean);
        if (eventIds.length > 0) {
          await Event.updateMany(
            { _id: { $in: eventIds } },
            { billed: true, invoice: invoice._id }
          );
        }
      } catch (rollbackErr) {
        console.error('Deletion rollback failed (re-billing events):', rollbackErr.message, { invoiceId: invoice._id });
      }
      throw quoteErr;
    }

    // Log history
    await historyService.invoiceDeleted(invoice.project._id, invoice.number);

    // Delete the invoice
    await Invoice.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Facture supprimée' });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate invoice PDF
// @route   GET /api/invoices/:id/pdf
export const getInvoicePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);

    // For credit notes, resolve the original invoice number
    if (invoice.documentType === 'credit_note' && invoice.creditNoteRef) {
      const origInvoice = await Invoice.findById(invoice.creditNoteRef).select('number').lean();
      invoice._creditNoteRefNumber = origInvoice?.number || '';
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, invoice.project, settings);

    // Set response headers
    const filePrefix = invoice.documentType === 'credit_note' ? 'Avoir' : 'Facture';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}-${invoice.number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Send invoice email
// @route   POST /api/invoices/:id/send
export const sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user) {
      if (!invoice.project.userId) {
        return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
      }
      if (invoice.project.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    // Validate client email
    if (!invoice.project.client || !invoice.project.client.email) {
      return res.status(400).json({
        success: false,
        error: 'Le client n\'a pas d\'adresse email configurée'
      });
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);

    // Validate SMTP config
    if (!settings.smtp || !settings.smtp.host || !settings.smtp.user || !settings.smtp.pass) {
      return res.status(400).json({
        success: false,
        error: 'Configuration SMTP manquante. Configurez votre serveur SMTP dans les paramètres.'
      });
    }

    // For credit notes, resolve the original invoice number
    if (invoice.documentType === 'credit_note' && invoice.creditNoteRef) {
      const origInvoice = await Invoice.findById(invoice.creditNoteRef).select('number').lean();
      invoice._creditNoteRefNumber = origInvoice?.number || '';
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, invoice.project, settings);

    // CO art. 958f: Compute SHA-256 hash for document integrity verification
    const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');
    invoice.pdfHash = pdfHash;

    // Send email
    try {
      await sendInvoiceEmail(invoice, invoice.project, settings, pdfBuffer);
    } catch (emailError) {
      // Return SMTP errors as 400 with the actual message
      const msg = emailError.message || 'Erreur d\'envoi';
      const userMsg = msg.includes('authentication failed')
        ? 'Échec d\'authentification SMTP. Vérifiez votre mot de passe dans les paramètres.'
        : msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')
          ? 'Impossible de contacter le serveur SMTP. Vérifiez l\'hôte et le port.'
          : `Erreur d'envoi email : ${msg}`;
      return res.status(400).json({ success: false, error: userMsg });
    }

    // Update invoice status to 'sent' if it was draft
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      await invoice.save();
      await historyService.invoiceSent(invoice.project._id, invoice.number);
    } else if (invoice.isModified('pdfHash')) {
      // Save hash even on resend
      await invoice.save();
    }

    // Publish to Hub Event Bus for cross-app automations
    safePublish('invoice.sent', {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.number,
      projectId: invoice.project._id.toString(),
      projectName: invoice.project.name,
      total: invoice.total,
      client: invoice.project.client,
      hubUserId: req.user?.hubUserId || null
    });

    res.json({
      success: true,
      message: `Facture ${invoice.number} envoyée à ${invoice.project.client.email}`,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a credit note (avoir) for an invoice — CO 957a, LTVA art. 33
// @route   POST /api/invoices/:id/credit-note
export const createCreditNote = async (req, res, next) => {
  try {
    const originalInvoice = await Invoice.findById(req.params.id)
      .populate({ path: 'project', select: 'name client userId' });

    if (!originalInvoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (req.user && originalInvoice.project?.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Only allow credit notes for sent/paid/partial invoices
    if (!['sent', 'paid', 'partial'].includes(originalInvoice.status)) {
      return res.status(400).json({
        success: false,
        error: 'Un avoir ne peut être créé que pour une facture envoyée, payée ou partiellement payée'
      });
    }

    // Check if a credit note already exists for this invoice
    const existingCreditNote = await Invoice.findOne({
      creditNoteRef: originalInvoice._id,
      documentType: 'credit_note'
    });
    if (existingCreditNote) {
      return res.status(400).json({
        success: false,
        error: `Un avoir (${existingCreditNote.number}) existe déjà pour cette facture`
      });
    }

    const { reason, amount: partialAmount } = req.body;

    // Determine credit note amount (full or partial)
    const creditAmount = partialAmount && partialAmount > 0 && partialAmount < originalInvoice.total
      ? partialAmount
      : originalInvoice.total;

    const ratio = creditAmount / originalInvoice.total;
    const creditSubtotal = Math.round((originalInvoice.subtotal || 0) * ratio * 100) / 100;
    const creditVatAmount = Math.round((originalInvoice.vatAmount || 0) * ratio * 100) / 100;
    const creditTotal = roundTo5ct(creditAmount);

    // Generate credit note number
    const number = await Invoice.generateCreditNoteNumber();

    // Build credit note lines from original invoice
    let creditLines = [];
    if (originalInvoice.customLines?.length > 0) {
      creditLines = originalInvoice.customLines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
        discount: line.discount || 0,
        total: Math.round(line.total * ratio * 100) / 100
      }));
    }

    // Build vatBreakdown for credit note
    const creditVatBreakdown = (originalInvoice.vatBreakdown || []).map(v => ({
      rate: v.rate,
      base: Math.round(v.base * ratio * 100) / 100,
      amount: Math.round(v.amount * ratio * 100) / 100
    }));

    const creditNote = await Invoice.create({
      project: originalInvoice.project._id,
      number,
      documentType: 'credit_note',
      creditNoteRef: originalInvoice._id,
      invoiceType: 'custom',
      customLines: creditLines,
      subtotal: creditSubtotal,
      vatRate: originalInvoice.vatRate,
      vatAmount: creditVatAmount,
      vatBreakdown: creditVatBreakdown,
      total: creditTotal,
      issueDate: new Date(),
      dueDate: new Date(),
      status: 'sent',
      notes: reason || `Avoir pour facture ${originalInvoice.number}`
    });

    // Log history
    await historyService.log(
      originalInvoice.project._id,
      'invoice_created',
      `Avoir ${number} créé pour facture ${originalInvoice.number} (${formatCurrencyBackend(creditTotal)})`,
      { invoiceNumber: number, originalInvoice: originalInvoice.number, creditAmount: creditTotal }
    );

    res.status(201).json({ success: true, data: creditNote });
  } catch (error) {
    next(error);
  }
};

/** Format currency for backend logs */
const formatCurrencyBackend = (amount) =>
  new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0) + ' CHF';

// @desc    Get invoice PDF hash (CO art. 958f integrity verification)
// @route   GET /api/invoices/:id/hash
export const getInvoiceHash = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({ path: 'project', select: 'userId' });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (req.user && invoice.project?.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({
      success: true,
      data: {
        invoiceNumber: invoice.number,
        pdfHash: invoice.pdfHash || null,
        algorithm: 'SHA-256',
        hashDate: invoice.pdfHash ? invoice.updatedAt : null
      }
    });
  } catch (error) {
    next(error);
  }
};
