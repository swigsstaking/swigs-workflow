import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import {
  generateJournalCSV,
  generateClientListCSV,
  generateRevenueReportPDF
} from '../services/export.service.js';
import Settings from '../models/Settings.js';
import archiver from 'archiver';

/**
 * Export journal comptable (CSV)
 * GET /api/exports/journal?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportJournal = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const userId = req.user._id;

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres from et to sont requis'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide'
      });
    }

    // Find all paid invoices in date range for this user
    const invoices = await Invoice.find({
      status: 'paid',
      paidAt: {
        $gte: fromDate,
        $lte: toDate
      }
    })
      .populate({
        path: 'project',
        match: { userId },
        select: 'name client userId'
      })
      .sort({ paidAt: 1 });

    // Filter out invoices where project doesn't belong to user (populate returns null)
    const userInvoices = invoices.filter(inv => inv.project !== null);

    // Generate CSV
    const csv = generateJournalCSV(userInvoices, { from: fromDate, to: toDate });

    // Send as downloadable file (sanitize filename to prevent header injection)
    const sanitizedFrom = from.replace(/[^a-zA-Z0-9\-]/g, '');
    const sanitizedTo = to.replace(/[^a-zA-Z0-9\-]/g, '');
    const filename = `journal_${sanitizedFrom}_${sanitizedTo}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Export client list (CSV)
 * GET /api/exports/clients
 */
export const exportClients = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all projects for this user
    const projects = await Project.find({ userId }).select('client');

    // Extract unique clients (based on email)
    const clientsMap = new Map();
    for (const project of projects) {
      if (project.client && project.client.email) {
        const key = project.client.email;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, project.client);
        }
      } else if (project.client && project.client.name) {
        // For clients without email, use name as key
        const key = `name_${project.client.name}`;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, project.client);
        }
      }
    }

    const clients = Array.from(clientsMap.values());

    // Generate CSV
    const csv = generateClientListCSV(clients);

    // Send as downloadable file
    const filename = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Export revenue report (PDF)
 * GET /api/exports/revenue-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportRevenueReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const userId = req.user._id;

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres from et to sont requis'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide'
      });
    }

    // Find all invoices in date range for this user (any status)
    const invoices = await Invoice.find({
      issueDate: {
        $gte: fromDate,
        $lte: toDate
      }
    })
      .populate({
        path: 'project',
        match: { userId },
        select: 'name client userId'
      })
      .sort({ issueDate: 1 });

    // Filter out invoices where project doesn't belong to user
    const userInvoices = invoices.filter(inv => inv.project !== null);

    // Get user settings
    const settings = await Settings.getSettings(userId);

    // Generate PDF
    const pdfBuffer = await generateRevenueReportPDF(
      userInvoices,
      { from: fromDate, to: toDate },
      settings
    );

    // Send as downloadable file (sanitize filename)
    const safFrom = from.replace(/[^a-zA-Z0-9\-]/g, '');
    const safTo = to.replace(/[^a-zA-Z0-9\-]/g, '');
    const filename = `rapport_revenus_${safFrom}_${safTo}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Export fiduciaire annuel (CSV)
 * GET /api/exports/fiduciary?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportFiduciary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const userId = req.user._id;

    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Les paramètres from et to sont requis' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ success: false, error: 'Format de date invalide (attendu: YYYY-MM-DD)' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ success: false, error: 'Format de date invalide' });
    }

    // 1. Revenue: paid invoices
    const invoices = await Invoice.find({
      status: { $in: ['paid', 'partial'] },
      issueDate: { $gte: fromDate, $lte: toDate }
    })
      .populate({ path: 'project', match: { userId }, select: 'name client userId' })
      .sort({ issueDate: 1 })
      .lean();

    const userInvoices = invoices.filter(inv => inv.project !== null);

    // 2. Expenses by category (exclude ignored transactions)
    const expenses = await BankTransaction.find({
      userId,
      creditDebit: 'DBIT',
      matchStatus: { $ne: 'ignored' },
      bookingDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('expenseCategory', 'name accountNumber')
      .sort({ bookingDate: 1 })
      .lean();

    // 3. Bank balances
    const bankImports = await BankImport.find({
      userId,
      statementDate: { $gte: fromDate, $lte: toDate }
    })
      .sort({ statementDate: 1 })
      .lean();

    // 4. Expense categories for grouping
    const categories = await ExpenseCategory.find({ userId }).sort({ order: 1 }).lean();
    const catMap = new Map(categories.map(c => [c._id.toString(), c]));

    // Build CSV
    const BOM = '\uFEFF';
    const lines = [];

    // Header
    lines.push('=== RAPPORT FIDUCIAIRE ===');
    lines.push(`Période: ${from} au ${to}`);
    lines.push('');

    // Section 1: Revenus
    lines.push('--- REVENUS ---');
    lines.push('N° Facture;Client;Date;HT;TVA;TTC;Statut');
    let totalRevenueHT = 0;
    let totalRevenueVAT = 0;
    let totalRevenueTTC = 0;

    for (const inv of userInvoices) {
      const clientName = (inv.project.client?.company || inv.project.client?.name || 'Inconnu').replace(/;/g, ',');
      const ht = inv.subtotal || 0;
      const vat = inv.vatAmount || 0;
      const ttc = inv.total || 0;
      totalRevenueHT += ht;
      totalRevenueVAT += vat;
      totalRevenueTTC += ttc;
      lines.push(`${inv.number};${clientName};${new Date(inv.issueDate).toLocaleDateString('fr-CH')};${ht.toFixed(2)};${vat.toFixed(2)};${ttc.toFixed(2)};${inv.status}`);
    }
    lines.push(`TOTAL REVENUS;;;${totalRevenueHT.toFixed(2)};${totalRevenueVAT.toFixed(2)};${totalRevenueTTC.toFixed(2)}`);
    lines.push('');

    // Section 2: Dépenses par catégorie
    lines.push('--- DÉPENSES PAR CATÉGORIE ---');
    lines.push('Catégorie;N° Comptable;Nombre;Total;TVA déductible');

    // Group expenses by category
    const expensesByCategory = {};
    let totalExpenses = 0;
    let totalExpenseVAT = 0;

    for (const exp of expenses) {
      const catId = exp.expenseCategory?._id?.toString() || 'uncategorized';
      if (!expensesByCategory[catId]) {
        const cat = exp.expenseCategory || { name: 'Non catégorisé', accountNumber: '' };
        expensesByCategory[catId] = { name: cat.name, accountNumber: cat.accountNumber || '', total: 0, vatTotal: 0, count: 0 };
      }
      expensesByCategory[catId].total += exp.amount;
      expensesByCategory[catId].vatTotal += exp.vatAmount || 0;
      expensesByCategory[catId].count++;
      totalExpenses += exp.amount;
      totalExpenseVAT += exp.vatAmount || 0;
    }

    for (const [, data] of Object.entries(expensesByCategory)) {
      lines.push(`${data.name};${data.accountNumber};${data.count};${data.total.toFixed(2)};${data.vatTotal.toFixed(2)}`);
    }
    lines.push(`TOTAL DÉPENSES;;;${totalExpenses.toFixed(2)};${totalExpenseVAT.toFixed(2)}`);
    lines.push('');

    // Section 3: Détail dépenses
    lines.push('--- DÉTAIL DÉPENSES ---');
    lines.push('Date;Contrepartie;Catégorie;Montant;TVA;Notes;Pièces jointes');
    for (const exp of expenses) {
      const catName = (exp.expenseCategory?.name || 'Non catégorisé').replace(/;/g, ',');
      const counterparty = (exp.counterpartyName || '').replace(/;/g, ',');
      const notes = (exp.notes || '').replace(/;/g, ',').replace(/\n/g, ' ');
      const attachCount = exp.attachments?.length || 0;
      lines.push(`${new Date(exp.bookingDate).toLocaleDateString('fr-CH')};${counterparty};${catName};${exp.amount.toFixed(2)};${(exp.vatAmount || 0).toFixed(2)};${notes};${attachCount}`);
    }
    lines.push('');

    // Section 4: Résumé TVA
    lines.push('--- RÉSUMÉ TVA ---');
    lines.push(`TVA collectée (revenus);${totalRevenueVAT.toFixed(2)}`);
    lines.push(`TVA déductible (dépenses);${totalExpenseVAT.toFixed(2)}`);
    lines.push(`TVA nette due;${(totalRevenueVAT - totalExpenseVAT).toFixed(2)}`);
    lines.push('');

    // Section 5: Résultat
    lines.push('--- RÉSULTAT ---');
    lines.push(`Revenus HT;${totalRevenueHT.toFixed(2)}`);
    lines.push(`Dépenses;${totalExpenses.toFixed(2)}`);
    lines.push(`Résultat (bénéfice/perte);${(totalRevenueHT - totalExpenses).toFixed(2)}`);

    const csv = BOM + lines.join('\n');

    const safFrom = from.replace(/[^a-zA-Z0-9\-]/g, '');
    const safTo = to.replace(/[^a-zA-Z0-9\-]/g, '');

    // ZIP format: include CSV + all expense attachments
    if (req.query.format === 'zip') {
      const filename = `fiduciaire_${safFrom}_${safTo}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', err => {
        console.error('[Export] Archiver error:', err.message);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Erreur lors de la création du ZIP' });
      });
      archive.pipe(res);

      // Add CSV report
      archive.append(Buffer.from(csv, 'utf-8'), { name: 'rapport_fiduciaire.csv' });

      // Add expense attachments organized by category
      let attachIdx = 0;
      for (const exp of expenses) {
        if (!exp.attachments?.length) continue;
        const dateStr = new Date(exp.bookingDate).toISOString().slice(0, 10);
        const safeName = (exp.counterpartyName || 'inconnu').replace(/[^a-zA-Z0-9À-ÿ _\-]/g, '').slice(0, 40);
        const catFolder = (exp.expenseCategory?.name || 'Non catégorisé').replace(/[^a-zA-Z0-9À-ÿ _\-]/g, '');

        for (const att of exp.attachments) {
          attachIdx++;
          const ext = att.filename?.split('.').pop() || 'bin';
          const attFilename = `${dateStr}_${safeName}_${attachIdx}.${ext}`;
          const buffer = Buffer.from(att.data, 'base64');
          archive.append(buffer, { name: `pieces_justificatives/${catFolder}/${attFilename}` });
        }
      }

      await archive.finalize();
    } else {
      // CSV-only format (default)
      const filename = `fiduciaire_${safFrom}_${safTo}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    }
  } catch (error) {
    next(error);
  }
};
