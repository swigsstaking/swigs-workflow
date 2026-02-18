import Quote from '../models/Quote.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { historyService } from '../services/historyService.js';
import { generateQuotePDF } from '../services/pdf.service.js';
import { sendQuoteEmail } from '../services/email.service.js';

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

// @desc    Get quotes for a project
// @route   GET /api/projects/:projectId/quotes
export const getQuotes = async (req, res, next) => {
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

    const quotes = await Quote.find(query).sort('-createdAt');

    res.json({ success: true, data: quotes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoiceable quotes for a project (signed or partially invoiced)
// @route   GET /api/projects/:projectId/quotes/invoiceable
export const getInvoiceableQuotes = async (req, res, next) => {
  try {
    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Include both 'signed' and 'partial' (partially invoiced) quotes
    const quotes = await Quote.find({
      project: req.params.projectId,
      status: { $in: ['signed', 'partial'] }
    }).sort('-signedAt');

    // Calculate remaining amounts for partial quotes
    const quotesWithRemaining = quotes.map(q => {
      const qObj = q.toObject();
      qObj.invoicedAmount = qObj.invoicedAmount || 0;
      qObj.remainingAmount = qObj.subtotal - qObj.invoicedAmount;
      return qObj;
    });

    const total = quotesWithRemaining.reduce((sum, q) => sum + q.remainingAmount, 0);

    res.json({
      success: true,
      data: quotesWithRemaining,
      totals: {
        total,
        count: quotes.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all quotes (global)
// @route   GET /api/quotes
export const getAllQuotes = async (req, res, next) => {
  try {
    const { status, limit } = req.query;

    // Filter by user's projects
    const projectIds = await getUserProjectIds(req.user?._id);

    let query = {};
    if (projectIds) {
      query.project = { $in: projectIds };
    }
    if (status) query.status = status;

    let quotesQuery = Quote.find(query)
      .populate('project', 'name client')
      .sort('-createdAt');

    if (limit) {
      quotesQuery = quotesQuery.limit(parseInt(limit));
    }

    const quotes = await quotesQuery;

    res.json({ success: true, data: quotes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single quote
// @route   GET /api/quotes/:id
export const getQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({ success: true, data: quote });
  } catch (error) {
    next(error);
  }
};

// @desc    Create quote
// @route   POST /api/projects/:projectId/quotes
export const createQuote = async (req, res, next) => {
  try {
    const { lines, notes, validUntil } = req.body;

    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);

    // Calculate totals
    const processedLines = lines.map(line => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice
    }));

    const subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);
    const vatRate = settings.invoicing.defaultVatRate;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Generate quote number
    const number = await Quote.generateNumber();

    // Calculate validity date (default 30 days)
    const finalValidUntil = validUntil || new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    // Create quote
    const quote = await Quote.create({
      project: req.params.projectId,
      number,
      lines: processedLines,
      subtotal,
      vatRate,
      vatAmount,
      total,
      validUntil: finalValidUntil,
      notes
    });

    // Log history
    await historyService.quoteCreated(project._id, number, total);

    res.status(201).json({ success: true, data: quote });
  } catch (error) {
    next(error);
  }
};

// @desc    Update quote
// @route   PUT /api/quotes/:id
export const updateQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('project');

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { lines, notes, validUntil, vatRate } = req.body;
    const previousStatus = quote.status;

    // Determine what can be edited based on status
    // - draft: full edit
    // - sent: full edit (reverts to draft)
    // - refused/expired: full edit (reverts to draft, allows recycling)
    // - signed: only notes (commitment made)
    // - partial/invoiced: only notes (already billed)
    const canFullEdit = ['draft', 'sent', 'refused', 'expired'].includes(quote.status);
    const isLocked = ['signed', 'partial', 'invoiced'].includes(quote.status);

    if (isLocked) {
      // For locked quotes, only notes can be updated
      if (notes !== undefined) {
        quote.notes = notes;
        await quote.save();
        return res.json({
          success: true,
          data: quote,
          message: 'Seules les notes ont été mises à jour (devis signé ou facturé)'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Ce devis est signé ou facturé, seules les notes peuvent être modifiées'
      });
    }

    // Full edit for draft, sent, refused, expired
    if (lines) {
      quote.lines = lines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.quantity * line.unitPrice
      }));

      quote.subtotal = quote.lines.reduce((sum, line) => sum + line.total, 0);
    }

    if (vatRate !== undefined) {
      quote.vatRate = vatRate;
    }

    quote.vatAmount = quote.subtotal * (quote.vatRate / 100);
    quote.total = quote.subtotal + quote.vatAmount;

    if (notes !== undefined) quote.notes = notes;
    if (validUntil) quote.validUntil = validUntil;

    // If quote was sent/refused/expired and content changed, revert to draft
    if (['sent', 'refused', 'expired'].includes(previousStatus) && lines) {
      quote.status = 'draft';
      quote.signedAt = null;
    }

    await quote.save();

    // Log if status changed
    if (previousStatus !== quote.status) {
      await historyService.quoteUpdated(quote.project._id, quote.number, previousStatus, quote.status);
    }

    res.json({
      success: true,
      data: quote,
      statusChanged: previousStatus !== quote.status,
      previousStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change quote status
// @route   PATCH /api/quotes/:id/status
export const changeQuoteStatus = async (req, res, next) => {
  // Allowed manual transitions (system can bypass for partial/invoiced)
  const ALLOWED_TRANSITIONS = {
    'draft':    ['sent', 'signed', 'refused'],
    'sent':     ['signed', 'refused', 'expired', 'draft'],
    'signed':   [],          // Only system can change (partial, invoiced via invoice creation)
    'refused':  ['draft'],
    'expired':  ['draft'],
    'partial':  [],          // Managed by invoicing system
    'invoiced': []           // Final state, managed by system
  };

  try {
    const { status } = req.body;
    const quote = await Quote.findById(req.params.id).populate('project');

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Validate transition
    const allowedNext = ALLOWED_TRANSITIONS[quote.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Impossible de passer de "${quote.status}" à "${status}"`
      });
    }

    quote.status = status;

    // Set signed date if status is signed
    if (status === 'signed' && !quote.signedAt) {
      quote.signedAt = new Date();
      await historyService.quoteSigned(quote.project._id, quote.number);
    } else if (status === 'sent') {
      await historyService.quoteSent(quote.project._id, quote.number);
    } else if (status === 'refused') {
      await historyService.quoteRefused(quote.project._id, quote.number);
    }

    await quote.save();

    res.json({ success: true, data: quote });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete quote
// @route   DELETE /api/quotes/:id
export const deleteQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('project');

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Deletion rules:
    // - draft, sent, refused, expired: can be deleted
    // - signed: can be deleted ONLY if not invoiced (invoicedAmount === 0)
    // - partial, invoiced: cannot be deleted (snapshot exists in invoices)

    if (['partial', 'invoiced'].includes(quote.status)) {
      return res.status(400).json({
        success: false,
        error: 'Ce devis est déjà facturé et ne peut pas être supprimé. Supprimez d\'abord la facture associée.'
      });
    }

    if (quote.status === 'signed' && quote.invoicedAmount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ce devis signé a déjà été partiellement facturé et ne peut pas être supprimé.'
      });
    }

    const quoteNumber = quote.number;
    const projectId = quote.project._id;

    await quote.deleteOne();

    // Log deletion in history
    await historyService.quoteDeleted(projectId, quoteNumber);

    res.json({ success: true, data: {}, message: `Devis ${quoteNumber} supprimé` });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate quote PDF
// @route   GET /api/quotes/:id/pdf
export const getQuotePDF = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Get settings
    const settings = await Settings.getSettings(req.user?._id);

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(quote, quote.project, settings);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Devis-${quote.number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// @desc    Send quote email
// @route   POST /api/quotes/:id/send
export const sendQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate({
        path: 'project',
        select: 'name client userId'
      });

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Devis non trouvé' });
    }

    // Verify project ownership
    if (req.user && quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Validate client email
    if (!quote.project.client || !quote.project.client.email) {
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
    const pdfBuffer = await generateQuotePDF(quote, quote.project, settings);

    // Send email
    await sendQuoteEmail(quote, quote.project, settings, pdfBuffer);

    // Update quote status to 'sent' if it was draft
    if (quote.status === 'draft') {
      quote.status = 'sent';
      await quote.save();
      await historyService.quoteSent(quote.project._id, quote.number);
    }

    res.json({
      success: true,
      message: `Devis ${quote.number} envoyé à ${quote.project.client.email}`,
      data: quote
    });
  } catch (error) {
    next(error);
  }
};
