import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import {
  generateJournalCSV,
  generateClientListCSV,
  generateRevenueReportPDF,
  generateVatDeclarationCSV
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
 * Export fiduciaire complet (ZIP)
 * GET /api/exports/fiduciary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Génère un ZIP contenant :
 *  - rapport_fiduciaire.csv (résumé complet)
 *  - journal_comptable.csv (écritures chronologiques)
 *  - tva_T1.csv ... tva_T4.csv (déclarations TVA par trimestre)
 *  - rapport_revenus.pdf (rapport PDF)
 *  - pieces_justificatives/ (scans et justificatifs par catégorie)
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

    // ─── Data queries ───────────────────────────────────────────────

    const settings = await Settings.getSettings(userId);
    const company = settings?.company || {};

    // All invoices in period (any status except draft)
    const allInvoices = await Invoice.find({
      status: { $ne: 'draft' },
      issueDate: { $gte: fromDate, $lte: toDate }
    })
      .populate({ path: 'project', match: { userId }, select: 'name client userId' })
      .sort({ issueDate: 1 })
      .lean();
    const userInvoices = allInvoices.filter(inv => inv.project !== null);

    // Paid invoices for journal
    const paidInvoices = userInvoices.filter(inv => ['paid', 'partial'].includes(inv.status));

    // Expenses
    const expenses = await BankTransaction.find({
      userId,
      creditDebit: 'DBIT',
      matchStatus: { $ne: 'ignored' },
      bookingDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('expenseCategory', 'name accountNumber vatRate')
      .sort({ bookingDate: 1 })
      .lean();

    // ─── Build CSV: Rapport fiduciaire ──────────────────────────────

    const BOM = '\uFEFF';
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-CH') : '';
    const fmtN = (n) => (n || 0).toFixed(2);

    const lines = [];

    // Header
    lines.push('=== DOSSIER COMPTABLE ===');
    lines.push(`Entreprise;${esc(company.name || '')}`);
    lines.push(`IDE;${esc(company.siret || '')}`);
    lines.push(`N° TVA;${esc(company.vatNumber || '')}`);
    lines.push(`Forme juridique;${esc(company.legalForm || '')}`);
    lines.push(`Canton;${esc(company.canton || '')}`);
    lines.push(`Période;${from} au ${to}`);
    lines.push(`Généré le;${new Date().toLocaleDateString('fr-CH')}`);
    lines.push('');

    // Section 1: Revenus
    lines.push('--- REVENUS (FACTURES ÉMISES) ---');
    lines.push('N° Facture;Client;Société;Date émission;Date paiement;HT;TVA;TTC;Statut');
    let totalRevenueHT = 0, totalRevenueVAT = 0, totalRevenueTTC = 0;

    for (const inv of userInvoices) {
      const client = inv.project.client || {};
      const ht = inv.subtotal || 0;
      const vat = inv.vatAmount || 0;
      const ttc = inv.total || 0;
      totalRevenueHT += ht;
      totalRevenueVAT += vat;
      totalRevenueTTC += ttc;
      lines.push([
        inv.number, esc(client.name || ''), esc(client.company || ''),
        fmtD(inv.issueDate), fmtD(inv.paidAt),
        fmtN(ht), fmtN(vat), fmtN(ttc), inv.status
      ].join(';'));
    }
    lines.push(`TOTAL;;;${userInvoices.length} factures;;${fmtN(totalRevenueHT)};${fmtN(totalRevenueVAT)};${fmtN(totalRevenueTTC)}`);
    lines.push('');

    // Section 2: Dépenses par catégorie
    lines.push('--- DÉPENSES PAR CATÉGORIE ---');
    lines.push('Catégorie;N° Comptable;Nombre;Total HT;TVA déductible');

    const expByCat = {};
    let totalExp = 0, totalExpVAT = 0;
    for (const exp of expenses) {
      const catId = exp.expenseCategory?._id?.toString() || 'uncategorized';
      if (!expByCat[catId]) {
        const cat = exp.expenseCategory || { name: 'Non catégorisé', accountNumber: '' };
        expByCat[catId] = { name: cat.name, accountNumber: cat.accountNumber || '', total: 0, vat: 0, count: 0 };
      }
      expByCat[catId].total += exp.amount;
      expByCat[catId].vat += exp.vatAmount || 0;
      expByCat[catId].count++;
      totalExp += exp.amount;
      totalExpVAT += exp.vatAmount || 0;
    }
    for (const d of Object.values(expByCat)) {
      lines.push(`${esc(d.name)};${d.accountNumber};${d.count};${fmtN(d.total)};${fmtN(d.vat)}`);
    }
    lines.push(`TOTAL;;;${fmtN(totalExp)};${fmtN(totalExpVAT)}`);
    lines.push('');

    // Section 3: Détail dépenses
    lines.push('--- DÉTAIL DÉPENSES ---');
    lines.push('Date;Fournisseur;Catégorie;N° Comptable;Montant;TVA;Taux TVA;Notes;Justificatif');
    for (const exp of expenses) {
      const cat = exp.expenseCategory || {};
      lines.push([
        fmtD(exp.bookingDate), esc(exp.counterpartyName || ''),
        esc(cat.name || 'Non catégorisé'), cat.accountNumber || '',
        fmtN(exp.amount), fmtN(exp.vatAmount || 0), exp.vatRate ? `${exp.vatRate}%` : '',
        esc((exp.notes || '').replace(/\n/g, ' ')),
        exp.attachments?.length ? 'Oui' : ''
      ].join(';'));
    }
    lines.push('');

    // Section 4: Résumé TVA
    lines.push('--- RÉSUMÉ TVA ---');
    lines.push(`TVA collectée (sur ventes);${fmtN(totalRevenueVAT)}`);
    lines.push(`TVA déductible (sur achats);${fmtN(totalExpVAT)}`);
    lines.push(`TVA nette à payer;${fmtN(totalRevenueVAT - totalExpVAT)}`);
    lines.push('');

    // Section 5: Compte de résultat (P&L)
    lines.push('--- COMPTE DE RÉSULTAT ---');
    lines.push(`Chiffre d'affaires HT;${fmtN(totalRevenueHT)}`);
    lines.push(`Charges totales;${fmtN(totalExp)}`);
    lines.push(`Résultat net;${fmtN(totalRevenueHT - totalExp)}`);
    const margin = totalRevenueHT > 0 ? ((totalRevenueHT - totalExp) / totalRevenueHT * 100).toFixed(1) : '0.0';
    lines.push(`Marge nette;${margin}%`);

    const rapportCSV = BOM + lines.join('\n');

    // ─── Build CSV: Journal comptable ───────────────────────────────

    const journalCSV = generateJournalCSV(paidInvoices, { from: fromDate, to: toDate });

    // ─── Build CSV: Déclarations TVA par trimestre ──────────────────

    const year = fromDate.getFullYear();
    const vatCSVs = [];

    for (let q = 1; q <= 4; q++) {
      const qStart = new Date(year, (q - 1) * 3, 1);
      const qEnd = new Date(year, q * 3, 0, 23, 59, 59, 999);

      // Only generate for quarters within the date range
      if (qStart > toDate || qEnd < fromDate) continue;

      const qInvoices = userInvoices.filter(inv => {
        const d = new Date(inv.issueDate);
        return d >= qStart && d <= qEnd;
      });
      const qExpenses = expenses.filter(exp => {
        const d = new Date(exp.bookingDate);
        return d >= qStart && d <= qEnd;
      });

      const qRevenueHT = qInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
      const qVatCollected = qInvoices.reduce((s, i) => s + (i.vatAmount || 0), 0);
      const qVatDeductible = qExpenses.reduce((s, e) => s + (e.vatAmount || 0), 0);

      const vatCSV = generateVatDeclarationCSV({
        quarter: q, year,
        quarterData: { revenueHT: qRevenueHT, vatCollected: qVatCollected, vatDeductible: qVatDeductible, vatNet: qVatCollected - qVatDeductible },
        company
      });

      vatCSVs.push({ quarter: q, csv: vatCSV });
    }

    // ─── Build PDF: Rapport de revenus ──────────────────────────────

    const revenuePDF = await generateRevenueReportPDF(userInvoices, { from: fromDate, to: toDate }, settings);

    // ─── Assemble ZIP ───────────────────────────────────────────────

    const safFrom = from.replace(/[^a-zA-Z0-9\-]/g, '');
    const safTo = to.replace(/[^a-zA-Z0-9\-]/g, '');
    const companySlug = (company.name || 'swigs').replace(/[^a-zA-Z0-9À-ÿ]/g, '_').slice(0, 30);
    const filename = `comptabilite_${companySlug}_${safFrom}_${safTo}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => {
      console.error('[Export] Archiver error:', err.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Erreur lors de la création du ZIP' });
    });
    archive.pipe(res);

    // 1. Rapport fiduciaire principal
    archive.append(Buffer.from(rapportCSV, 'utf-8'), { name: '01_rapport_fiduciaire.csv' });

    // 2. Journal comptable
    archive.append(Buffer.from(journalCSV, 'utf-8'), { name: '02_journal_comptable.csv' });

    // 3. Déclarations TVA par trimestre
    for (const { quarter, csv } of vatCSVs) {
      archive.append(Buffer.from(csv, 'utf-8'), { name: `03_tva/declaration_tva_T${quarter}_${year}.csv` });
    }

    // 4. Rapport revenus PDF
    archive.append(revenuePDF, { name: '04_rapport_revenus.pdf' });

    // 5. Pièces justificatives par catégorie
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
        archive.append(buffer, { name: `05_pieces_justificatives/${catFolder}/${attFilename}` });
      }
    }

    // 6. Liste clients
    const projects = await Project.find({ userId }).select('client').lean();
    const clientsMap = new Map();
    for (const p of projects) {
      if (p.client?.name) clientsMap.set(p.client.email || p.client.name, p.client);
    }
    const clientsCSV = generateClientListCSV(Array.from(clientsMap.values()));
    archive.append(Buffer.from(clientsCSV, 'utf-8'), { name: '06_liste_clients.csv' });

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};
