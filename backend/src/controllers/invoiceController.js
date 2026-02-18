import Invoice from '../models/Invoice.js';
import Event from '../models/Event.js';
import Quote from '../models/Quote.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { historyService } from '../services/historyService.js';
import { generateInvoicePDF } from '../services/pdf.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import { decrypt } from '../utils/crypto.js';

// Helper: Verify project ownership
const verifyProjectOwnership = async (projectId, userId) => {
  const query = { _id: projectId };
  if (userId) {
    query.userId = userId;
  }
  return Project.findOne(query);
};

// Helper: Get user's project IDs
const getUserProjectIds = async (userId) => {
  if (!userId) return null;
  const projects = await Project.find({ userId }).select('_id');
  return projects.map(p => p._id);
};

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

    if (status) {
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
    const { status, limit } = req.query;

    // Filter by user's projects
    const projectIds = await getUserProjectIds(req.user?._id);

    let query = {};
    if (projectIds) {
      query.project = { $in: projectIds };
    }
    if (status) query.status = status;

    let invoicesQuery = Invoice.find(query)
      .populate('project', 'name client')
      .sort('-createdAt');

    if (limit) {
      invoicesQuery = invoicesQuery.limit(parseInt(limit));
    }

    const invoices = await invoicesQuery;

    res.json({ success: true, data: invoices });
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
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice from events and/or quotes, or custom lines
// @route   POST /api/projects/:projectId/invoices
export const createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceType = 'standard',
      eventIds = [],
      quoteIds = [],
      quotePartials = {}, // { quoteId: { type: 'percent'|'amount', value: number } }
      customLines = [],
      notes,
      dueDate,
      issueDate
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
    const finalIssueDate = issueDate ? new Date(issueDate) : new Date();

    // Calculate due date based on issue date
    const finalDueDate = dueDate ? new Date(dueDate) : new Date(
      finalIssueDate.getTime() + settings.invoicing.defaultPaymentTerms * 24 * 60 * 60 * 1000
    );

    // Generate invoice number
    const number = await Invoice.generateNumber();

    let invoice;

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
      const processedLines = customLines.map(line => ({
        description: line.description,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice,
        total: (line.quantity || 1) * line.unitPrice
      }));

      const subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount;

      // Create custom invoice
      invoice = await Invoice.create({
        project: req.params.projectId,
        number,
        invoiceType: 'custom',
        events: [],
        quotes: [],
        customLines: processedLines,
        subtotal,
        vatRate,
        vatAmount,
        total,
        issueDate: finalIssueDate,
        dueDate: finalDueDate,
        notes
      });

      // Log history
      await historyService.invoiceCreated(project._id, number, total);

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

    // Calculate totals from quotes with partial support
    const quoteSnapshots = quotes.map(quote => {
      const partial = quotePartials[quote._id.toString()];
      let invoiceAmount = quote.subtotal; // Default: full amount
      let isPartial = false;

      // Calculate partial amount if specified
      if (partial && partial.value > 0) {
        if (partial.type === 'percent') {
          invoiceAmount = quote.subtotal * (partial.value / 100);
        } else {
          invoiceAmount = partial.value;
        }
        isPartial = invoiceAmount < quote.subtotal;
      }

      // Check remaining amount (if quote was already partially invoiced)
      const remainingAmount = quote.subtotal - (quote.invoicedAmount || 0);
      if (invoiceAmount > remainingAmount) {
        invoiceAmount = remainingAmount;
      }

      subtotal += invoiceAmount;

      return {
        quoteId: quote._id,
        number: quote.number,
        lines: quote.lines.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.total
        })),
        subtotal: quote.subtotal,
        invoicedAmount: invoiceAmount, // Amount invoiced this time
        isPartial,
        signedAt: quote.signedAt
      };
    });

    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Create standard invoice
    invoice = await Invoice.create({
      project: req.params.projectId,
      number,
      invoiceType: 'standard',
      events: eventSnapshots,
      quotes: quoteSnapshots,
      customLines: [],
      subtotal,
      vatRate,
      vatAmount,
      total,
      issueDate: finalIssueDate,
      dueDate: finalDueDate,
      notes
    });

    // Mark events as billed
    if (eventIds.length > 0) {
      await Event.updateMany(
        { _id: { $in: eventIds } },
        { billed: true, invoice: invoice._id }
      );
    }

    // Update quotes with partial payment tracking
    for (const quote of quotes) {
      const snapshot = quoteSnapshots.find(qs => qs.quoteId.toString() === quote._id.toString());
      const newInvoicedAmount = (quote.invoicedAmount || 0) + snapshot.invoicedAmount;
      const isFullyInvoiced = newInvoicedAmount >= quote.subtotal;

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
    }

    // Log history
    await historyService.invoiceCreated(project._id, number, total);

    res.status(201).json({ success: true, data: invoice });
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
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Only draft invoices can be fully updated
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Seules les factures en brouillon peuvent être modifiées'
      });
    }

    const { notes, dueDate, vatRate, customLines } = req.body;

    if (notes !== undefined) invoice.notes = notes;
    if (dueDate) invoice.dueDate = dueDate;

    // Allow editing custom lines on custom invoices
    if (customLines !== undefined && invoice.invoiceType === 'custom') {
      const processedLines = customLines.map(line => ({
        description: line.description,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice,
        total: (line.quantity || 1) * line.unitPrice
      }));
      invoice.customLines = processedLines;
      invoice.subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);
      invoice.vatAmount = invoice.subtotal * (invoice.vatRate / 100);
      invoice.total = invoice.subtotal + invoice.vatAmount;
    }

    if (vatRate !== undefined) {
      invoice.vatRate = vatRate;
      invoice.vatAmount = invoice.subtotal * (vatRate / 100);
      invoice.total = invoice.subtotal + invoice.vatAmount;
    }

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
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const oldStatus = invoice.status;
    invoice.status = status;

    // Set paid date if status is paid
    if (status === 'paid' && !invoice.paidAt) {
      invoice.paidAt = new Date();
    }

    // If cancelled, unbill the events and quotes
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      await Event.updateMany(
        { invoice: invoice._id },
        { billed: false, invoice: null }
      );
      await Quote.updateMany(
        { invoice: invoice._id },
        { status: 'signed', invoice: null, invoicedAt: null }
      );
      await historyService.invoiceCancelled(invoice.project._id, invoice.number);
    } else if (status === 'sent') {
      await historyService.invoiceSent(invoice.project._id, invoice.number);
    } else if (status === 'paid') {
      await historyService.invoicePaid(invoice.project._id, invoice.number);
    }

    await invoice.save();

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

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('project');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify project ownership
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Unbill all events linked to this invoice
    await Event.updateMany(
      { invoice: invoice._id },
      { billed: false, invoice: null }
    );

    // Handle partial quote invoicing: decrement invoicedAmount and recalculate status
    if (invoice.quotes && invoice.quotes.length > 0) {
      for (const quoteSnapshot of invoice.quotes) {
        const quote = await Quote.findById(quoteSnapshot.quoteId);
        if (!quote) continue;

        // Decrement invoicedAmount by the amount from this invoice
        const newInvoicedAmount = Math.max(0, (quote.invoicedAmount || 0) - (quoteSnapshot.invoicedAmount || quoteSnapshot.subtotal || 0));

        // Remove this invoice from the invoices array
        const updatedInvoices = quote.invoices.filter(
          inv => inv.invoice.toString() !== invoice._id.toString()
        );

        // Recalculate status based on new invoicedAmount
        let newStatus = 'signed';
        if (newInvoicedAmount > 0 && newInvoicedAmount < quote.subtotal) {
          newStatus = 'partial';
        } else if (newInvoicedAmount >= quote.subtotal) {
          newStatus = 'invoiced';
        }

        // Update quote
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
      // Legacy: Reset quotes status back to 'signed' (for old invoices without partial tracking)
      await Quote.updateMany(
        { invoice: invoice._id },
        { status: 'signed', invoice: null, invoicedAt: null }
      );
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
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, invoice.project, settings);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Facture-${invoice.number}.pdf"`);
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
    if (req.user && invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
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

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, invoice.project, settings);

    // Send email
    await sendInvoiceEmail(invoice, invoice.project, settings, pdfBuffer);

    // Update invoice status to 'sent' if it was draft
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      await invoice.save();
      await historyService.invoiceSent(invoice.project._id, invoice.number);
    }

    res.json({
      success: true,
      message: `Facture ${invoice.number} envoyée à ${invoice.project.client.email}`,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};
