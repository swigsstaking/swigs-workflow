import { AbaNinjaService } from '../services/abaninja.service.js';
import Settings from '../models/Settings.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Client from '../models/Client.js';
import Project from '../models/Project.js';
import { historyService } from '../services/historyService.js';
import { decrypt } from '../utils/crypto.js';

/**
 * Test AbaNinja connection
 * @route POST /api/abaninja/test-connection
 */
export const testConnection = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);

    if (!settings.abaninja?.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Clé API AbaNinja non configurée'
      });
    }

    const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));
    const result = await service.testConnection();

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Clé API invalide'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Erreur de connexion à AbaNinja',
      details: error.message
    });
  }
};

/**
 * Sync a single invoice to AbaNinja
 * @route POST /api/abaninja/sync/invoice/:id
 */
export const syncInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Load invoice + project + settings
    const invoice = await Invoice.findById(id).populate('project');
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Facture non trouvée'
      });
    }

    // Verify ownership
    if (invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    const settings = await Settings.getSettings(req.user._id);
    if (!settings.abaninja?.enabled || !settings.abaninja?.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'AbaNinja non configuré'
      });
    }

    const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));

    // Find or create client address in AbaNinja
    const client = invoice.project.client;
    let address = await service.findAddressByEmail(client.email);

    if (!address) {
      const addressData = service.mapClientToAddress(client);
      address = await service.createAddress(addressData);
    }

    // Check if already synced
    if (invoice.abaNinjaId) {
      return res.status(400).json({
        success: false,
        error: 'Cette facture est déjà synchronisée avec AbaNinja'
      });
    }

    // Map and create invoice in AbaNinja
    const invoiceData = service.mapInvoiceToAbaNinja(invoice, invoice.project, address.id);
    const abaNinjaInvoice = await service.createInvoice(invoiceData);

    // Update invoice with sync info
    invoice.abaNinjaId = abaNinjaInvoice.id;
    invoice.abaNinjaSyncedAt = new Date();
    invoice.abaNinjaSyncStatus = 'synced';
    await invoice.save();

    // Log in history
    try {
      await historyService.log(
        invoice.project._id,
        'invoice_synced_abaninja',
        `Facture ${invoice.number} synchronisée avec AbaNinja (ID: ${abaNinjaInvoice.id})`,
        { invoiceId: invoice._id, abaNinjaId: abaNinjaInvoice.id }
      );
    } catch (historyError) {
      console.error('Failed to log AbaNinja sync:', historyError);
    }

    res.json({
      success: true,
      message: 'Facture synchronisée avec succès',
      data: {
        abaNinjaId: abaNinjaInvoice.id,
        syncedAt: invoice.abaNinjaSyncedAt
      }
    });
  } catch (error) {
    console.error('AbaNinja sync error:', error);

    // Update error status
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (invoice) {
        invoice.abaNinjaSyncStatus = 'error';
        await invoice.save();
      }
    } catch (updateError) {
      console.error('Failed to update sync status:', updateError);
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation',
      details: error.message
    });
  }
};

/**
 * Sync a single quote to AbaNinja
 * @route POST /api/abaninja/sync/quote/:id
 */
export const syncQuote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Load quote + project + settings
    const quote = await Quote.findById(id).populate('project');
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Devis non trouvé'
      });
    }

    // Verify ownership
    if (quote.project.userId && quote.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    const settings = await Settings.getSettings(req.user._id);
    if (!settings.abaninja?.enabled || !settings.abaninja?.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'AbaNinja non configuré'
      });
    }

    const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));

    // Find or create client address in AbaNinja
    const client = quote.project.client;
    let address = await service.findAddressByEmail(client.email);

    if (!address) {
      const addressData = service.mapClientToAddress(client);
      address = await service.createAddress(addressData);
    }

    // Check if already synced
    if (quote.abaNinjaId) {
      return res.status(400).json({
        success: false,
        error: 'Ce devis est déjà synchronisé avec AbaNinja'
      });
    }

    // Map and create estimate in AbaNinja
    const quoteData = service.mapQuoteToAbaNinja(quote, quote.project, address.id);
    const abaNinjaEstimate = await service.createEstimate(quoteData);

    // Update quote with sync info
    quote.abaNinjaId = abaNinjaEstimate.id;
    quote.abaNinjaSyncedAt = new Date();
    quote.abaNinjaSyncStatus = 'synced';
    await quote.save();

    // Log in history
    try {
      await historyService.log(
        quote.project._id,
        'quote_synced_abaninja',
        `Devis ${quote.number} synchronisé avec AbaNinja (ID: ${abaNinjaEstimate.id})`,
        { quoteId: quote._id, abaNinjaId: abaNinjaEstimate.id }
      );
    } catch (historyError) {
      console.error('Failed to log AbaNinja sync:', historyError);
    }

    res.json({
      success: true,
      message: 'Devis synchronisé avec succès',
      data: {
        abaNinjaId: abaNinjaEstimate.id,
        syncedAt: quote.abaNinjaSyncedAt
      }
    });
  } catch (error) {
    console.error('AbaNinja sync error:', error);

    // Update error status
    try {
      const quote = await Quote.findById(req.params.id);
      if (quote) {
        quote.abaNinjaSyncStatus = 'error';
        await quote.save();
      }
    } catch (updateError) {
      console.error('Failed to update sync status:', updateError);
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation',
      details: error.message
    });
  }
};

/**
 * Sync a single client to AbaNinja
 * @route POST /api/abaninja/sync/client/:id
 */
export const syncClient = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Load client
    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    // Verify ownership
    if (client.userId && client.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    const settings = await Settings.getSettings(req.user._id);
    if (!settings.abaninja?.enabled || !settings.abaninja?.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'AbaNinja non configuré'
      });
    }

    const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));

    // Check if already synced
    let address;
    if (client.abaNinjaId) {
      // Update existing
      const addressData = service.mapClientToAddress(client);
      address = await service.updateAddress(client.abaNinjaId, addressData);
    } else {
      // Create new
      const addressData = service.mapClientToAddress(client);
      address = await service.createAddress(addressData);
      client.abaNinjaId = address.id;
    }

    client.abaNinjaSyncedAt = new Date();
    await client.save();

    res.json({
      success: true,
      message: 'Client synchronisé avec succès',
      data: {
        abaNinjaId: address.id,
        syncedAt: client.abaNinjaSyncedAt
      }
    });
  } catch (error) {
    console.error('AbaNinja sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation',
      details: error.message
    });
  }
};

/**
 * Sync all documents (bulk)
 * @route POST /api/abaninja/sync/all
 */
export const syncAll = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    if (!settings.abaninja?.enabled || !settings.abaninja?.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'AbaNinja non configuré'
      });
    }

    const service = new AbaNinjaService(decrypt(settings.abaninja.apiKey));
    const stats = {
      clients: 0,
      invoices: 0,
      quotes: 0,
      errors: []
    };

    // Get user's projects
    const projects = await Project.find({ userId: req.user._id });
    const projectIds = projects.map(p => p._id);

    // Sync clients (if enabled)
    if (settings.abaninja.syncClients) {
      const clients = await Client.find({
        userId: req.user._id,
        abaNinjaId: null
      });

      for (const client of clients) {
        try {
          const addressData = service.mapClientToAddress(client);
          const address = await service.createAddress(addressData);
          client.abaNinjaId = address.id;
          client.abaNinjaSyncedAt = new Date();
          await client.save();
          stats.clients++;
        } catch (error) {
          console.error(`Failed to sync client ${client._id}:`, error);
          stats.errors.push({
            type: 'client',
            id: client._id,
            name: client.name,
            error: error.message
          });
        }
      }
    }

    // Sync invoices (if enabled)
    if (settings.abaninja.syncInvoices) {
      const invoices = await Invoice.find({
        project: { $in: projectIds },
        status: { $in: ['sent', 'paid'] },
        abaNinjaId: null
      }).populate('project');

      for (const invoice of invoices) {
        try {
          const client = invoice.project.client;
          let address = await service.findAddressByEmail(client.email);

          if (!address) {
            const addressData = service.mapClientToAddress(client);
            address = await service.createAddress(addressData);
          }

          const invoiceData = service.mapInvoiceToAbaNinja(invoice, invoice.project, address.id);
          const abaNinjaInvoice = await service.createInvoice(invoiceData);

          invoice.abaNinjaId = abaNinjaInvoice.id;
          invoice.abaNinjaSyncedAt = new Date();
          invoice.abaNinjaSyncStatus = 'synced';
          await invoice.save();
          stats.invoices++;

          // Log in history
          try {
            await historyService.log(
              invoice.project._id,
              'invoice_synced_abaninja',
              `Facture ${invoice.number} synchronisée avec AbaNinja (sync groupé)`,
              { invoiceId: invoice._id, abaNinjaId: abaNinjaInvoice.id }
            );
          } catch (historyError) {
            console.error('Failed to log sync:', historyError);
          }
        } catch (error) {
          console.error(`Failed to sync invoice ${invoice._id}:`, error);
          invoice.abaNinjaSyncStatus = 'error';
          await invoice.save();
          stats.errors.push({
            type: 'invoice',
            id: invoice._id,
            number: invoice.number,
            error: error.message
          });
        }
      }
    }

    // Sync quotes (if enabled)
    if (settings.abaninja.syncQuotes) {
      const quotes = await Quote.find({
        project: { $in: projectIds },
        status: { $in: ['sent', 'signed'] },
        abaNinjaId: null
      }).populate('project');

      for (const quote of quotes) {
        try {
          const client = quote.project.client;
          let address = await service.findAddressByEmail(client.email);

          if (!address) {
            const addressData = service.mapClientToAddress(client);
            address = await service.createAddress(addressData);
          }

          const quoteData = service.mapQuoteToAbaNinja(quote, quote.project, address.id);
          const abaNinjaEstimate = await service.createEstimate(quoteData);

          quote.abaNinjaId = abaNinjaEstimate.id;
          quote.abaNinjaSyncedAt = new Date();
          quote.abaNinjaSyncStatus = 'synced';
          await quote.save();
          stats.quotes++;

          // Log in history
          try {
            await historyService.log(
              quote.project._id,
              'quote_synced_abaninja',
              `Devis ${quote.number} synchronisé avec AbaNinja (sync groupé)`,
              { quoteId: quote._id, abaNinjaId: abaNinjaEstimate.id }
            );
          } catch (historyError) {
            console.error('Failed to log sync:', historyError);
          }
        } catch (error) {
          console.error(`Failed to sync quote ${quote._id}:`, error);
          quote.abaNinjaSyncStatus = 'error';
          await quote.save();
          stats.errors.push({
            type: 'quote',
            id: quote._id,
            number: quote.number,
            error: error.message
          });
        }
      }
    }

    // Update lastSyncAt
    settings.abaninja.lastSyncAt = new Date();
    await settings.save();

    res.json({
      success: true,
      message: 'Synchronisation terminée',
      data: stats
    });
  } catch (error) {
    console.error('AbaNinja bulk sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation groupée',
      details: error.message
    });
  }
};

/**
 * Get sync status
 * @route GET /api/abaninja/status
 */
export const getStatus = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);

    // Get user's projects
    const projects = await Project.find({ userId: req.user._id });
    const projectIds = projects.map(p => p._id);

    // Count documents
    const totalClients = await Client.countDocuments({ userId: req.user._id });
    const syncedClients = await Client.countDocuments({
      userId: req.user._id,
      abaNinjaId: { $ne: null }
    });

    const totalInvoices = await Invoice.countDocuments({
      project: { $in: projectIds },
      status: { $in: ['sent', 'paid'] }
    });
    const syncedInvoices = await Invoice.countDocuments({
      project: { $in: projectIds },
      status: { $in: ['sent', 'paid'] },
      abaNinjaId: { $ne: null }
    });

    const totalQuotes = await Quote.countDocuments({
      project: { $in: projectIds },
      status: { $in: ['sent', 'signed'] }
    });
    const syncedQuotes = await Quote.countDocuments({
      project: { $in: projectIds },
      status: { $in: ['sent', 'signed'] },
      abaNinjaId: { $ne: null }
    });

    // Count errors
    const errorInvoices = await Invoice.countDocuments({
      project: { $in: projectIds },
      abaNinjaSyncStatus: 'error'
    });
    const errorQuotes = await Quote.countDocuments({
      project: { $in: projectIds },
      abaNinjaSyncStatus: 'error'
    });

    res.json({
      success: true,
      data: {
        enabled: settings.abaninja?.enabled || false,
        lastSyncAt: settings.abaninja?.lastSyncAt || null,
        clients: {
          total: totalClients,
          synced: syncedClients,
          pending: totalClients - syncedClients
        },
        invoices: {
          total: totalInvoices,
          synced: syncedInvoices,
          pending: totalInvoices - syncedInvoices,
          errors: errorInvoices
        },
        quotes: {
          total: totalQuotes,
          synced: syncedQuotes,
          pending: totalQuotes - syncedQuotes,
          errors: errorQuotes
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
