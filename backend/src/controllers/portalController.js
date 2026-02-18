import * as portalService from '../services/portal.service.js';
import { generateInvoicePDF, generateQuotePDF } from '../services/pdf.service.js';
import { historyService } from '../services/historyService.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Project from '../models/Project.js';

/**
 * PUBLIC ROUTES (no auth required)
 */

/**
 * Get document by portal token
 * @route GET /api/portal/:token
 */
export const getDocument = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await portalService.verifyAndGetDocument(token);

    // Extract only safe company info
    const company = {
      name: result.settings.company?.name || '',
      address: result.settings.company?.address || '',
      email: result.settings.company?.email || '',
      phone: result.settings.company?.phone || '',
      logo: result.settings.company?.logo || null
    };

    // Log access in history
    try {
      if (result.type === 'invoice') {
        await historyService.log(
          result.project._id,
          'portal_accessed',
          `Facture ${result.document.number} consultée via portail client`,
          { invoiceId: result.document._id, token }
        );
      } else if (result.type === 'quote') {
        await historyService.log(
          result.project._id,
          'portal_accessed',
          `Devis ${result.document.number} consulté via portail client`,
          { quoteId: result.document._id, token }
        );
      }
    } catch (historyError) {
      console.error('Failed to log portal access:', historyError);
    }

    res.json({
      success: true,
      data: {
        type: result.type,
        document: result.document,
        project: result.project,
        company
      }
    });
  } catch (error) {
    if (error.message.includes('invalide') || error.message.includes('expiré') || error.message.includes('révoqué')) {
      return res.status(404).json({
        success: false,
        error: 'Lien invalide ou expiré'
      });
    }
    next(error);
  }
};

/**
 * Download PDF via portal token
 * @route GET /api/portal/:token/pdf
 */
export const downloadPDF = async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await portalService.verifyAndGetDocument(token);

    // Generate PDF
    let pdfBuffer;
    let filename;

    if (result.type === 'invoice') {
      pdfBuffer = await generateInvoicePDF(result.document, result.project, result.settings);
      filename = `Facture_${result.document.number}.pdf`;
    } else if (result.type === 'quote') {
      pdfBuffer = await generateQuotePDF(result.document, result.project, result.settings);
      filename = `Devis_${result.document.number}.pdf`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Type de document non supporté pour PDF'
      });
    }

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    if (error.message.includes('invalide') || error.message.includes('expiré') || error.message.includes('révoqué')) {
      return res.status(404).json({
        success: false,
        error: 'Lien invalide ou expiré'
      });
    }
    next(error);
  }
};

/**
 * Sign quote via portal
 * @route POST /api/portal/:token/sign
 */
export const signQuote = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { signature } = req.body;

    if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'La signature est requise'
      });
    }

    const result = await portalService.verifyAndGetDocument(token);

    // Verify it's a quote
    if (result.type !== 'quote') {
      return res.status(400).json({
        success: false,
        error: 'Ce lien ne correspond pas à un devis'
      });
    }

    const quote = result.document;

    // Verify quote can be signed
    if (quote.status === 'signed') {
      return res.status(400).json({
        success: false,
        error: 'Ce devis a déjà été signé'
      });
    }

    if (quote.status === 'invoiced') {
      return res.status(400).json({
        success: false,
        error: 'Ce devis a déjà été facturé'
      });
    }

    // Update quote
    quote.status = 'signed';
    quote.signedAt = new Date();
    await quote.save();

    // Log in history
    try {
      await historyService.log(
        result.project._id,
        'quote_signed_portal',
        `Devis ${quote.number} signé via portail client par ${signature.trim()}`,
        { quoteId: quote._id, signature: signature.trim(), token }
      );
    } catch (historyError) {
      console.error('Failed to log quote signature:', historyError);
    }

    res.json({
      success: true,
      message: 'Devis signé avec succès',
      data: quote
    });
  } catch (error) {
    if (error.message.includes('invalide') || error.message.includes('expiré') || error.message.includes('révoqué')) {
      return res.status(404).json({
        success: false,
        error: 'Lien invalide ou expiré'
      });
    }
    next(error);
  }
};

/**
 * PRIVATE ROUTES (requireAuth)
 */

/**
 * Generate portal link
 * @route POST /api/portal/generate
 */
export const generateLink = async (req, res, next) => {
  try {
    const { type, documentId, expiresInDays = 30 } = req.body;

    // Validate input
    if (!type || !['invoice', 'quote'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type invalide (invoice ou quote)'
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID requis'
      });
    }

    // Verify document exists and belongs to user
    let document;
    if (type === 'invoice') {
      document = await Invoice.findById(documentId).populate('project');
    } else if (type === 'quote') {
      document = await Quote.findById(documentId).populate('project');
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Verify project ownership
    if (document.project.userId && document.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    // Generate link
    const result = await portalService.createPortalLink(
      type,
      documentId,
      req.user._id,
      expiresInDays
    );

    // Construct full URL
    const baseUrl = process.env.PORTAL_BASE_URL || 'http://localhost:5173/portal';
    const url = `${baseUrl}/${result.token}`;

    res.json({
      success: true,
      data: {
        token: result.token,
        url,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke portal link
 * @route DELETE /api/portal/links/:id
 */
export const revokeLink = async (req, res, next) => {
  try {
    const { id } = req.params;

    await portalService.revokeToken(id, req.user._id);

    res.json({
      success: true,
      message: 'Lien révoqué avec succès'
    });
  } catch (error) {
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({
        success: false,
        error: 'Lien non trouvé'
      });
    }
    if (error.message.includes('Accès refusé')) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }
    next(error);
  }
};

/**
 * Get active links for a document
 * @route GET /api/portal/links/:type/:documentId
 */
export const getLinks = async (req, res, next) => {
  try {
    const { type, documentId } = req.params;

    // Validate type
    if (!['invoice', 'quote'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type invalide (invoice ou quote)'
      });
    }

    // Verify document ownership
    let document;
    if (type === 'invoice') {
      document = await Invoice.findById(documentId).populate('project');
    } else if (type === 'quote') {
      document = await Quote.findById(documentId).populate('project');
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Verify project ownership
    if (document.project.userId && document.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    const tokens = await portalService.getActiveLinks(type, documentId, req.user._id);

    // Add full URLs
    const baseUrl = process.env.PORTAL_BASE_URL || 'http://localhost:5173/portal';
    const tokensWithUrls = tokens.map(t => ({
      ...t.toObject(),
      url: `${baseUrl}/${t.token}`
    }));

    res.json({
      success: true,
      data: tokensWithUrls
    });
  } catch (error) {
    next(error);
  }
};
