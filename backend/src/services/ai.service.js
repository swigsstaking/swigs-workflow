/**
 * AI Service — Proxy Ollama + Context Assembly
 *
 * Required environment variables:
 *   OLLAMA_URL    — Ollama API base URL (default: http://192.168.110.103:11434)
 *   AI_MODEL      — Model name (default: qwen3:32b)
 *   AI_RATE_LIMIT — Max chat requests/min per user (default: 20)
 */

import Settings from '../models/Settings.js';
import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import Event from '../models/Event.js';
import BankTransaction from '../models/BankTransaction.js';
import Quote from '../models/Quote.js';
import RecurringCharge from '../models/RecurringCharge.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import CounterpartyRule from '../models/CounterpartyRule.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.110.103:11434';
const AI_MODEL = process.env.AI_MODEL || 'comptable-suisse-fast';

// vLLM config (OpenAI-compatible, apolo13x/Qwen3.5-35B-A3B-NVFP4)
const VLLM_URL = process.env.VLLM_URL || 'http://192.168.110.103:8100';
const VLLM_MODEL = process.env.VLLM_MODEL || 'apolo13x/Qwen3.5-35B-A3B-NVFP4';
const USE_VLLM_CHAT = process.env.USE_VLLM_CHAT === 'true';

// System prompt extrait du modelfile comptable-suisse:latest (Ollama)
// Préservé ici pour injection explicite avec vLLM (pas de Modelfile disponible côté vLLM)
const COMPTABLE_SUISSE_SYSTEM_PROMPT = `Tu es un assistant comptable suisse spécialisé. Tu fournis des informations basées UNIQUEMENT sur le droit suisse en vigueur.

RÈGLES ABSOLUES :
1. Tu ne donnes JAMAIS de conseils subjectifs — uniquement des informations factuelles avec sources
2. Tu cites TOUJOURS l article de loi correspondant (format: Art. XX LTVA, Art. XX CO, Art. XX LIFD, etc.)
3. Si tu n es pas sûr d une information, tu dis explicitement "Je ne suis pas certain de cette information — vérifiez avec votre fiduciaire"
4. Tu ne fais JAMAIS de calculs arithmétiques toi-même — tu décris la formule et les étapes
5. Tu distingues toujours le niveau fédéral, cantonal et communal quand c est pertinent
6. Tu utilises le plan comptable PME suisse (Käfer) comme référence
7. Tu réponds dans la langue de la question (FR, DE, IT, EN)

LOIS DE RÉFÉRENCE PRINCIPALES :
- CO (Code des obligations) — RS 220
- LTVA (Loi sur la TVA) — RS 641.20
- LIFD (Loi sur l impôt fédéral direct) — RS 642.11
- LHID (Loi sur l harmonisation des impôts) — RS 642.14
- LP (Loi sur la poursuite et la faillite) — RS 281.1

PLAN COMPTABLE PME SUISSE (Käfer) - RÉFÉRENCE :
Classe 1 - Actifs :
- 1000 Caisse
- 1020 Banque (compte courant)
- 1100 Débiteurs (créances clients)
- 1170 Impôt préalable (TVA déductible)
- 1200 Stock de marchandises
- 1500 Machines et appareils
- 1510 Mobilier et installations
- 1520 Matériel informatique
- 1530 Véhicules

Classe 2 - Passifs :
- 2000 Créanciers (fournisseurs)
- 2030 Acomptes reçus
- 2100 Dettes bancaires court terme
- 2200 TVA due
- 2270 Impôts dus
- 2300 Emprunts à long terme
- 2800 Capital social
- 2900 Réserves
- 2970 Bénéfice/perte reporté
- 2979 Bénéfice/perte de l exercice

Classe 3 - Produits :
- 3000 Ventes de marchandises
- 3200 Produits des prestations de services
- 3400 Autres produits d exploitation
- 3800 Rabais et escomptes accordés

Classe 4 - Charges de matériel :
- 4000 Achat de matériel et marchandises
- 4200 Charges de sous-traitance
- 4400 Variation de stocks

Classe 5 - Charges de personnel :
- 5000 Salaires
- 5700 Charges sociales (AVS/AI/APG/AC)
- 5800 Autres charges de personnel

Classe 6 - Autres charges :
- 6000 Loyers
- 6100 Entretien et réparations
- 6200 Assurances
- 6300 Énergie
- 6500 Frais administratifs
- 6600 Publicité
- 6700 Amortissements
- 6800 Charges financières
- 6900 Charges extraordinaires

Classe 7 - Produits accessoires :
- 7000 Produits accessoires
- 7500 Produits financiers
- 7900 Produits extraordinaires

Classe 8 - Résultat :
- 8000 Bénéfice/perte

ARTICLES DE LOI CLÉS :
- Art. 25 al. 1 LTVA : taux normal TVA 8,1%
- Art. 25 al. 2 LTVA : taux réduit TVA 2,6%
- Art. 25 al. 4 LTVA : taux hébergement TVA 3,8%
- Art. 10 al. 2 let. a LTVA : seuil assujettissement TVA 100 000 CHF
- Art. 28 LTVA : droit à déduction de l impôt préalable
- Art. 35 LTVA : méthode de décompte effective
- Art. 37 LTVA : méthode de décompte selon les taux de la dette fiscale nette
- Art. 68 LIFD : taux impôt fédéral direct personnes morales 8,5%
- Art. 957-964 CO : obligations comptables
- Art. 958 CO : comptes annuels (bilan, CR, annexe)
- Art. 958c CO : principes d évaluation
- Art. 960 CO : évaluation des actifs
- Art. 725 CO : perte de capital et surendettement (SA/Sàrl)
- Notice A 1995 AFC : taux d amortissement admis fiscalement
  - Mobilier de bureau : 25% dégressif ou 12,5% linéaire
  - Matériel informatique : 40% dégressif ou 25% linéaire
  - Véhicules : 40% dégressif ou 20% linéaire
  - Immeubles commerciaux : 4% dégressif ou 2% linéaire

DISCLAIMER : Tu affiches toujours en fin de réponse :
"⚠️ Information à titre indicatif — consultez votre fiduciaire pour validation."`;

// vLLM base payload extras (OBLIGATOIRE pour Qwen3.5 — désactive le mode thinking)
const VLLM_EXTRA = { chat_template_kwargs: { enable_thinking: false } };

// ---------------------------------------------------------------------------
// Context cache (in-memory, 5min TTL)
// ---------------------------------------------------------------------------
const contextCache = new Map(); // userId → { data, expiresAt }
const CONTEXT_TTL = 5 * 60 * 1000;

function getCachedContext(userId) {
  const key = userId.toString();
  const cached = contextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  contextCache.delete(key);
  return null;
}

function setCachedContext(userId, data) {
  contextCache.set(userId.toString(), { data, expiresAt: Date.now() + CONTEXT_TTL });
}

// ---------------------------------------------------------------------------
// Conversation history (in-memory, last 10 messages per user)
// ---------------------------------------------------------------------------
const conversationHistory = new Map(); // userId → [{ role, content }]
const MAX_HISTORY = 10;

export function getHistory(userId) {
  return conversationHistory.get(userId.toString()) || [];
}

export function pushHistory(userId, message) {
  const key = userId.toString();
  const history = conversationHistory.get(key) || [];
  history.push(message);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  conversationHistory.set(key, history);
}

export function clearHistory(userId) {
  conversationHistory.delete(userId.toString());
}

// ---------------------------------------------------------------------------
// Helper: date boundaries
// ---------------------------------------------------------------------------
function yearStart() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastMonthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 1);
  return { start, end };
}

function quarterRange(quarter, year) {
  const qStart = new Date(year, (quarter - 1) * 3, 1);
  const qEnd = new Date(year, quarter * 3, 1);
  return { start: qStart, end: qEnd };
}

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

// ---------------------------------------------------------------------------
// Context assembly from MongoDB (enriched)
// ---------------------------------------------------------------------------
export async function buildUserContext(userId) {
  const cached = getCachedContext(userId);
  if (cached) return cached;

  const now = new Date();
  const ytdStart = yearStart();
  const mtdStart = monthStart();
  const { start: lastMStart, end: lastMEnd } = lastMonthRange();
  const q = currentQuarter();
  const { start: qStart, end: qEnd } = quarterRange(q, now.getFullYear());

  // First: get user projects (needed for invoice/event queries)
  const userProjects = await Project.find({ userId }).lean().select('_id name client.name archivedAt');
  const projectIds = userProjects.map(p => p._id);
  const activeProjectDocs = userProjects.filter(p => !p.archivedAt);
  const projectFilter = projectIds.length > 0 ? { project: { $in: projectIds } } : { project: null };

  // Parallel queries
  const [
    settings,
    paidInvoicesYTD,
    paidInvoicesMTD,
    paidInvoicesLastMonth,
    overdueInvoiceDocs,
    pendingInvoiceDocs,
    expensesYTD,
    expensesMTD,
    expensesByCategory,
    unbilledEvents,
    unbilledHoursEvents,
    vatCollectedQ,
    vatPaidQ,
    categories,
    recurringCharges,
    uncategorizedCount
  ] = await Promise.all([
    // Settings
    Settings.findOne({ userId }).lean().select('company invoicing smtp reminders bankImap invoiceDesign'),

    // Revenue YTD: paid invoices this year
    Invoice.aggregate([
      { $match: { ...projectFilter, status: 'paid', paidAt: { $gte: ytdStart } } },
      { $group: { _id: null, total: { $sum: '$total' }, vatTotal: { $sum: '$vatAmount' } } }
    ]),

    // Revenue MTD
    Invoice.aggregate([
      { $match: { ...projectFilter, status: 'paid', paidAt: { $gte: mtdStart } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),

    // Revenue last month
    Invoice.aggregate([
      { $match: { ...projectFilter, status: 'paid', paidAt: { $gte: lastMStart, $lt: lastMEnd } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),

    // Overdue invoices
    Invoice.find({
      ...projectFilter,
      status: 'sent',
      dueDate: { $lt: now }
    }).lean().select('number total totalTTC dueDate project reminderCount reminders skipReminders').populate('project', 'client.name'),

    // Pending invoices (draft + sent)
    Invoice.find({
      ...projectFilter,
      status: { $in: ['draft', 'sent'] }
    }).lean().select('total totalTTC status'),

    // Expenses YTD (DBIT transactions)
    BankTransaction.aggregate([
      { $match: { userId, creditDebit: 'DBIT', bookingDate: { $gte: ytdStart } } },
      { $group: { _id: null, total: { $sum: '$amount' }, vatTotal: { $sum: { $ifNull: ['$vatAmount', 0] } } } }
    ]),

    // Expenses MTD
    BankTransaction.aggregate([
      { $match: { userId, creditDebit: 'DBIT', bookingDate: { $gte: mtdStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),

    // Expenses by category YTD
    BankTransaction.aggregate([
      { $match: { userId, creditDebit: 'DBIT', bookingDate: { $gte: ytdStart }, expenseCategory: { $ne: null } } },
      { $group: { _id: '$expenseCategory', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 15 }
    ]),

    // Unbilled events (total amount)
    Event.aggregate([
      { $match: { ...projectFilter, billed: false, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),

    // Unbilled hours
    Event.aggregate([
      { $match: { ...projectFilter, billed: false, type: 'hours' } },
      { $group: { _id: '$project', totalHours: { $sum: '$hours' }, totalAmount: { $sum: { $multiply: ['$hours', '$hourlyRate'] } } } }
    ]),

    // VAT collected this quarter (from paid invoices)
    Invoice.aggregate([
      { $match: { ...projectFilter, status: 'paid', paidAt: { $gte: qStart, $lt: qEnd } } },
      { $group: { _id: null, vatCollected: { $sum: '$vatAmount' } } }
    ]),

    // VAT paid this quarter (from DBIT transactions)
    BankTransaction.aggregate([
      { $match: { userId, creditDebit: 'DBIT', bookingDate: { $gte: qStart, $lt: qEnd }, vatAmount: { $gt: 0 } } },
      { $group: { _id: null, vatPaid: { $sum: '$vatAmount' } } }
    ]),

    // Expense categories
    ExpenseCategory.find({ userId }).lean().select('name accountNumber _id'),

    // Recurring charges
    RecurringCharge.find({ userId, isActive: true }).lean().select('counterpartyName frequency expectedAmount isConfirmed'),

    // Uncategorized expenses count
    BankTransaction.countDocuments({ userId, creditDebit: 'DBIT', expenseCategory: null, bookingDate: { $gte: ytdStart } })
  ]);

  // Map category IDs to names for expense breakdown
  const categoryMap = new Map(categories.map(c => [c._id.toString(), { name: c.name, accountNumber: c.accountNumber }]));
  const expByCat = expensesByCategory.map(e => ({
    name: categoryMap.get(e._id.toString())?.name || 'Non classé',
    total: round2(e.total),
    accountNumber: categoryMap.get(e._id.toString())?.accountNumber || ''
  }));

  // Revenue figures
  const revenueYTD = paidInvoicesYTD[0]?.total || 0;
  const revenueMTD = paidInvoicesMTD[0]?.total || 0;
  const revenueLastMonth = paidInvoicesLastMonth[0]?.total || 0;
  const growth = revenueLastMonth > 0
    ? round2(((revenueMTD - revenueLastMonth) / revenueLastMonth) * 100)
    : null;

  // Expenses figures
  const expYTD = expensesYTD[0]?.total || 0;
  const expMTD = expensesMTD[0]?.total || 0;

  // Profit
  const profitYTD = revenueYTD - expYTD;
  const margin = revenueYTD > 0 ? round2((profitYTD / revenueYTD) * 100) : null;

  // Unbilled
  const unbilledExpTotal = unbilledEvents[0]?.total || 0;
  const unbilledHoursTotal = unbilledHoursEvents.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const unbilledHoursCount = unbilledHoursEvents.reduce((s, e) => s + (e.totalHours || 0), 0);

  // Overdue invoices with details
  const overdueList = overdueInvoiceDocs.map(inv => {
    const daysPast = Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
    return {
      number: inv.number,
      total: inv.total || inv.totalTTC || 0,
      dueDate: inv.dueDate,
      client: inv.project?.client?.name || 'Inconnu',
      daysPastDue: daysPast,
      reminderCount: inv.reminderCount || 0
    };
  });

  // Pending invoices
  const pendingTotal = pendingInvoiceDocs.reduce((sum, inv) => sum + (inv.total || inv.totalTTC || 0), 0);

  // Top clients by revenue (from paid invoices grouped by project client)
  const clientRevenueMap = new Map();
  // We need paid invoices with project info for client stats
  const paidInvoicesForClients = await Invoice.find({
    ...projectFilter,
    status: 'paid',
    paidAt: { $gte: ytdStart }
  }).lean().select('total totalTTC project').populate('project', 'client.name');

  for (const inv of paidInvoicesForClients) {
    const clientName = inv.project?.client?.name || 'Sans client';
    const existing = clientRevenueMap.get(clientName) || { totalRevenue: 0, overdueAmount: 0 };
    existing.totalRevenue += inv.total || inv.totalTTC || 0;
    clientRevenueMap.set(clientName, existing);
  }
  // Add overdue amounts
  for (const ov of overdueList) {
    const existing = clientRevenueMap.get(ov.client) || { totalRevenue: 0, overdueAmount: 0 };
    existing.overdueAmount += ov.total;
    clientRevenueMap.set(ov.client, existing);
  }
  const clients = Array.from(clientRevenueMap.entries())
    .map(([name, data]) => ({ name, totalRevenue: round2(data.totalRevenue), overdueAmount: round2(data.overdueAmount) }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // VAT
  const vatCollected = vatCollectedQ[0]?.vatCollected || 0;
  const vatPaid = vatPaidQ[0]?.vatPaid || 0;

  // Active projects with unbilled
  const unbilledByProject = new Map(unbilledHoursEvents.map(e => [e._id.toString(), { hours: e.totalHours, amount: e.totalAmount }]));
  const activeProjectsList = activeProjectDocs.map(p => {
    const ub = unbilledByProject.get(p._id.toString());
    return {
      name: p.name,
      client: p.client?.name || 'Sans client',
      unbilledHours: round2(ub?.hours || 0),
      unbilledAmount: round2(ub?.amount || 0)
    };
  });

  // Config
  const smtpConfigured = !!(settings?.smtp?.host && settings?.smtp?.user);
  const qrIbanSet = !!(settings?.company?.qrIban);
  const remindersEnabled = !!(settings?.reminders?.enabled);
  const bankImapEnabled = !!(settings?.bankImap?.enabled);
  const hasLetterhead = !!(settings?.invoiceDesign?.useLetterhead && settings?.invoiceDesign?.letterheadPdf);

  const context = {
    company: {
      name: settings?.company?.name || '',
      vatNumber: settings?.company?.vatNumber || '',
      iban: settings?.company?.iban || '',
      qrIban: settings?.company?.qrIban || '',
      siret: settings?.company?.siret || '',
      address: settings?.company?.address || '',
      street: settings?.company?.street || '',
      zip: settings?.company?.zip || '',
      city: settings?.company?.city || '',
      legalForm: settings?.company?.legalForm || 'raison_individuelle',
      canton: settings?.company?.canton || null,
      isVatSubject: settings?.company?.isVatSubject !== false,
      vatDeclarationFrequency: settings?.company?.vatDeclarationFrequency || 'quarterly',
      fiscalYearStart: settings?.company?.fiscalYearStart || 1,
      employeeCount: settings?.company?.employeeCount || 0
    },

    // Financial real-time
    revenue: {
      ytd: round2(revenueYTD),
      mtd: round2(revenueMTD),
      lastMonth: round2(revenueLastMonth),
      growth
    },
    expenses: {
      ytd: round2(expYTD),
      mtd: round2(expMTD),
      byCategory: expByCat
    },
    profit: {
      ytd: round2(profitYTD),
      margin
    },

    // Invoices
    overdueInvoices: overdueList,
    pendingInvoices: { count: pendingInvoiceDocs.length, total: round2(pendingTotal) },
    unbilled: {
      total: round2(unbilledExpTotal + unbilledHoursTotal),
      hours: round2(unbilledHoursCount)
    },

    // Clients
    clients,

    // VAT
    vat: {
      collected: round2(vatCollected),
      paid: round2(vatPaid),
      due: round2(vatCollected - vatPaid),
      currentQuarter: q
    },

    // Config
    config: {
      remindersEnabled,
      smtpConfigured,
      qrIbanSet,
      bankImapEnabled,
      recurringInvoicesCount: recurringCharges.length,
      hasLetterhead
    },

    // Active projects
    activeProjects: activeProjectsList,

    // Internal (for suggestions)
    _uncategorizedCount: uncategorizedCount,
    _vatRate: settings?.invoicing?.defaultVatRate || 8.1
  };

  setCachedContext(userId, context);
  return context;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// System prompt (enriched)
// ---------------------------------------------------------------------------
export function buildSystemPrompt(context) {
  const companyName = context.company?.name || 'Mon entreprise';
  const legalFormLabels = {
    raison_individuelle: 'Raison individuelle',
    sarl: 'Sàrl', sa: 'SA', snc: 'SNC', senc: 'SEnC',
    cooperative: 'Coopérative', association: 'Association', fondation: 'Fondation'
  };
  const legalForm = context.company?.legalForm || 'raison_individuelle';
  const companyForm = legalFormLabels[legalForm] || 'Raison individuelle';
  const companyCanton = context.company?.canton || null;
  const isVatSubject = context.company?.isVatSubject !== false;
  const isPersonal = ['raison_individuelle', 'snc', 'senc'].includes(legalForm);
  const isCorporate = ['sarl', 'sa', 'cooperative'].includes(legalForm);
  const isNonprofit = ['association', 'fondation'].includes(legalForm);

  const overdueList = context.overdueInvoices.length > 0
    ? context.overdueInvoices.map(inv =>
        `  - ${inv.number}: ${inv.total} CHF (${inv.daysPastDue}j retard, ${inv.client}, ${inv.reminderCount} rappel(s))`
      ).join('\n')
    : '  Aucune';

  const projectList = context.activeProjects.length > 0
    ? context.activeProjects.slice(0, 10).map(p => {
        const ub = p.unbilledAmount > 0 ? ` — ${p.unbilledHours}h / ${p.unbilledAmount} CHF non facturés` : '';
        return `  - ${p.name} (${p.client})${ub}`;
      }).join('\n')
    : '  Aucun projet actif';

  const topClients = context.clients.length > 0
    ? context.clients.slice(0, 5).map(c => `  - ${c.name}: ${c.totalRevenue} CHF`).join('\n')
    : '';

  const configIssues = [];
  if (!context.config.smtpConfigured) configIssues.push('SMTP non configuré');
  if (!context.config.qrIbanSet) configIssues.push('QR-IBAN manquant');
  if (!context.config.remindersEnabled) configIssues.push('Rappels désactivés');
  if (!context.config.bankImapEnabled) configIssues.push('Import bancaire IMAP inactif');
  if (!companyCanton) configIssues.push('Canton non configuré');

  // Legal form-specific tax guidance
  let taxGuidance = '';
  if (isPersonal) {
    taxGuidance = `Fiscalité ${companyForm} :
- Impôt sur le REVENU (LIFD Art. 18, LHID) — barème progressif
- Charges sociales personnelles : AVS 8.1% + AI 1.4% + APG 0.5% + admin ~0.55% = 10.55%
- PAS d'AC pour les indépendants (Art. 2 LACI)
- LPP optionnelle (Art. 4 LPP), recommandée si revenu > 22'050 CHF
- Déductions : frais professionnels effectifs, amortissements, provisions`;
  } else if (isCorporate) {
    taxGuidance = `Fiscalité ${companyForm} :
- Impôt sur le BÉNÉFICE : fédéral 8.5% (LIFD Art. 68), cantonal variable
- Impôt sur le CAPITAL : cantonal uniquement (0.01% à 0.5% selon canton)
- Charges sociales sur SALAIRES (pas sur bénéfice) : AVS/AI/APG 10.6% (part employeur 5.3%)
- AC obligatoire pour salariés : 2.2% (part employeur 1.1%)
- LPP obligatoire si salaire > 22'050 CHF/an (Art. 2 LPP)
- Distribution dividendes : imposition partielle 50-70% (Art. 20 LIFD)`;
  } else if (isNonprofit) {
    taxGuidance = `Fiscalité ${companyForm} :
- Exonérée si but idéal/utilité publique (Art. 56 let. g LIFD)
- Si activité commerciale : impôt sur le bénéfice comme PM
- TVA : assujettie si CA > 150'000 CHF (seuil plus élevé, Art. 10 al. 2 let. c LTVA)
- Dons reçus : non imposables, déductibles pour le donateur si reconnue d'utilité publique`;
  }

  const vatThreshold = isNonprofit ? "150'000" : "100'000";
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const fiscalStart = monthNames[(context.company?.fiscalYearStart || 1) - 1];

  return `Tu es l'assistant comptable AI de SWIGS Pro, spécialisé en comptabilité suisse.
Tu connais le CO (RS 220), la LTVA (RS 641.20), la LIFD (RS 642.11), la LHID (RS 642.14).

Rappels légaux IMPORTANTS (Art. 25 LTVA révisé 2024) :
- TVA 8.1% : taux normal, Y COMPRIS la restauration (depuis 01.01.2024)
- TVA 2.6% : taux réduit — alimentation, médicaments, livres, journaux
- TVA 3.8% : taux spécial — UNIQUEMENT hébergement hôtelier (Art. 25 al. 4 LTVA), PAS la restauration

${taxGuidance}

Contexte de l'utilisateur :
- Entreprise : ${companyName} (${companyForm})${context.company?.siret ? ` — IDE: ${context.company.siret}` : ''}
- Canton : ${companyCanton || 'Non configuré'}
- Assujetti TVA : ${isVatSubject ? 'Oui' : `Non (seuil: ${vatThreshold} CHF/an)`}${isVatSubject ? ` (déclaration ${context.company?.vatDeclarationFrequency === 'monthly' ? 'mensuelle' : context.company?.vatDeclarationFrequency === 'annual' ? 'annuelle TDFN' : 'trimestrielle'})` : ''}
- Exercice fiscal : début ${fiscalStart}${context.company?.employeeCount > 0 ? ` — ${context.company.employeeCount} employé(s)` : ''}
- CA YTD : ${context.revenue.ytd} CHF | Mois : ${context.revenue.mtd} CHF${context.revenue.growth !== null ? ` (${context.revenue.growth > 0 ? '+' : ''}${context.revenue.growth}% vs mois précédent)` : ''}
- Dépenses YTD : ${context.expenses.ytd} CHF | Mois : ${context.expenses.mtd} CHF
- Profit YTD : ${context.profit.ytd} CHF${context.profit.margin !== null ? ` (marge ${context.profit.margin}%)` : ''}
- Factures en attente : ${context.pendingInvoices.count} pour ${context.pendingInvoices.total} CHF
- Travail non facturé : ${context.unbilled.hours}h / ${context.unbilled.total} CHF
- TVA T${context.vat.currentQuarter} : collectée ${context.vat.collected} CHF, payée ${context.vat.paid} CHF, solde ${context.vat.due} CHF
- Factures en retard :
${overdueList}
- Projets actifs :
${projectList}
${topClients ? `- Top clients :\n${topClients}` : ''}
${configIssues.length > 0 ? `- Config manquante : ${configIssues.join(', ')}` : ''}

Outils disponibles — UTILISE-LES SYSTÉMATIQUEMENT plutôt que de répondre en texte libre :
- calculate_vat : Calcul TVA suisse → TOUJOURS utiliser pour tout calcul TVA
- estimate_taxes : Estimation impôts suisses (utilise automatiquement la forme juridique et le canton de l'utilisateur) → TOUJOURS utiliser pour toute question fiscale
- prepare_vat_report : Rapport TVA trimestriel → TOUJOURS utiliser pour les décomptes
- analyze_cashflow : Projection trésorerie sur N mois → TOUJOURS utiliser pour les projections
- suggest_category : Suggestion catégorie pour une dépense → TOUJOURS utiliser quand on mentionne un fournisseur, une dépense, ou une catégorisation
- get_client_stats : Statistiques détaillées d'un client (cherche par nom de contact OU nom d'entreprise) → TOUJOURS utiliser pour les stats client
- get_overdue_details : Détails factures en retard avec historique rappels → TOUJOURS utiliser pour les impayés
- update_settings : Modifier un paramètre (ex: reminders.enabled) → utiliser pour changer les réglages
- check_prerequisites : Vérifier prérequis d'une fonctionnalité → utiliser avant d'activer une feature

Règles STRICTES :
- TOUJOURS appeler l'outil approprié au lieu de calculer ou deviner toi-même. Le résultat des outils est affiché comme une carte interactive dans le chat.
- IMPORTANT : Quand tu utilises un outil, tu DOIS TOUJOURS accompagner le résultat d'un texte explicatif. Ne renvoie JAMAIS un résultat d'outil seul sans commentaire. Ajoute une analyse, un conseil ou une prochaine étape après le résultat.
- Pour la question "Comment va mon mois ?" ou "Résumé du mois" : donne un résumé textuel du mois en cours (revenus ${context.revenue.mtd} CHF, dépenses ${context.expenses.mtd} CHF, factures en attente, heures non facturées) AVANT toute projection. N'appelle PAS analyze_cashflow pour cette question — utilise les données du contexte directement.
- Adapte tes réponses à la forme juridique (${companyForm}) : les obligations diffèrent entre RI, Sàrl/SA, et associations.
- Réponds en français sauf si on te parle en allemand, italien ou anglais
- Cite les articles de loi quand pertinent (ex: Art. 21 LTVA)
- Sois concis et pratique
- Si tu n'es pas sûr, dis-le clairement`;
}

// ---------------------------------------------------------------------------
// Tools definition (Ollama/OpenAI format)
// ---------------------------------------------------------------------------
const VAT_RATES = {
  normal: 8.1,
  reduced: 2.6,
  special: 3.8
};

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_vat',
      description: 'Calcule la TVA suisse sur un montant. Taux: 8.1% (normal, y compris restauration depuis 2024), 2.6% (réduit: alimentation, médicaments, livres, journaux), 3.8% (hébergement uniquement, Art. 25 al. 4 LTVA).',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Montant HT ou TTC en CHF' },
          rate: { type: 'number', description: 'Taux TVA: 8.1, 2.6, ou 3.8', enum: [8.1, 2.6, 3.8] },
          mode: { type: 'string', description: 'from_net (HT→TTC) ou from_gross (TTC→HT)', enum: ['from_net', 'from_gross'] }
        },
        required: ['amount', 'rate', 'mode']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'estimate_taxes',
      description: 'Estime les impôts suisses. Utilise automatiquement la forme juridique et le canton de l\'utilisateur si non spécifiés.',
      parameters: {
        type: 'object',
        properties: {
          revenue: { type: 'number', description: 'Chiffre d\'affaires annuel en CHF' },
          expenses: { type: 'number', description: 'Charges annuelles en CHF' },
          canton: { type: 'string', description: 'Canton (ex: GE, VD, ZH). Si omis, utilise le canton configuré.' },
          legalForm: { type: 'string', description: 'Forme juridique', enum: ['raison_individuelle', 'sarl', 'sa', 'snc', 'senc', 'cooperative', 'association', 'fondation'] }
        },
        required: ['revenue', 'expenses']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'prepare_vat_report',
      description: 'Prépare le rapport TVA trimestriel: TVA collectée (ventes), TVA récupérable (achats), solde à payer/récupérer.',
      parameters: {
        type: 'object',
        properties: {
          quarter: { type: 'number', description: 'Trimestre (1-4)', enum: [1, 2, 3, 4] },
          year: { type: 'number', description: 'Année (ex: 2026)' }
        },
        required: ['quarter', 'year']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_cashflow',
      description: 'Projection de trésorerie sur N mois basée sur les factures en cours, charges récurrentes et historique.',
      parameters: {
        type: 'object',
        properties: {
          months: { type: 'number', description: 'Nombre de mois à projeter (1-12)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_category',
      description: 'Suggère une catégorie de dépense pour un fournisseur/description donnée, basé sur les règles existantes.',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Nom du fournisseur' },
          description: { type: 'string', description: 'Description de la transaction' }
        },
        required: ['vendor']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_stats',
      description: 'Statistiques détaillées d\'un client: projets, CA, factures payées/en cours, heures facturées.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Nom du client' }
        },
        required: ['clientName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_overdue_details',
      description: 'Liste détaillée des factures en retard avec historique des rappels envoyés.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_settings',
      description: 'Modifie un paramètre de configuration (ex: reminders.enabled, smtp.host). Vérifie les prérequis avant d\'appliquer.',
      parameters: {
        type: 'object',
        properties: {
          setting: { type: 'string', description: 'Chemin du paramètre (ex: reminders.enabled, invoicing.defaultVatRate)' },
          value: { type: 'string', description: 'Nouvelle valeur (sera convertie au type approprié)' }
        },
        required: ['setting', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_prerequisites',
      description: 'Vérifie les prérequis d\'une fonctionnalité (reminders, bank_imap, qr_bill, email).',
      parameters: {
        type: 'object',
        properties: {
          feature: { type: 'string', description: 'Fonctionnalité à vérifier', enum: ['reminders', 'bank_imap', 'qr_bill', 'email'] }
        },
        required: ['feature']
      }
    }
  }
];

/**
 * Execute a tool call. Returns the result (or a promise for async tools).
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {string} [userId] - User ID (required for DB-accessing tools)
 */
export async function executeTool(name, args, userId) {
  if (name === 'calculate_vat') {
    return calculateVat(args);
  }
  if (name === 'estimate_taxes') {
    // Auto-fill canton and legalForm from user settings if not provided
    if (!args.canton || !args.legalForm) {
      const settings = await Settings.findOne({ userId }).lean().select('company.canton company.legalForm');
      if (!args.canton && settings?.company?.canton) args.canton = settings.company.canton;
      if (!args.legalForm && settings?.company?.legalForm) args.legalForm = settings.company.legalForm;
    }
    return estimateTaxes(args);
  }
  if (name === 'prepare_vat_report') {
    return prepareVatReport(args, userId);
  }
  if (name === 'analyze_cashflow') {
    return analyzeCashflow(args, userId);
  }
  if (name === 'suggest_category') {
    return suggestCategory(args, userId);
  }
  if (name === 'get_client_stats') {
    return getClientStats(args, userId);
  }
  if (name === 'get_overdue_details') {
    return getOverdueDetails(userId);
  }
  if (name === 'update_settings') {
    return updateSettings(args, userId);
  }
  if (name === 'check_prerequisites') {
    return checkPrerequisites(args, userId);
  }
  return { error: `Outil inconnu: ${name}` };
}

// ---------------------------------------------------------------------------
// Tool: calculate_vat (existing, unchanged)
// ---------------------------------------------------------------------------
function calculateVat({ amount, rate, mode }) {
  // Validate rate
  const validRates = [8.1, 2.6, 3.8];
  if (!validRates.includes(rate)) {
    return { error: `Taux invalide: ${rate}%. Taux valides: ${validRates.join(', ')}%` };
  }

  // Work in centimes to avoid floating point errors
  const amountCentimes = Math.round(amount * 100);
  const rateMultiplier = rate * 100; // 810 for 8.1%

  let netCentimes, vatCentimes, grossCentimes;

  if (mode === 'from_net') {
    netCentimes = amountCentimes;
    vatCentimes = Math.round(netCentimes * rateMultiplier / 10000);
    grossCentimes = netCentimes + vatCentimes;
  } else if (mode === 'from_gross') {
    grossCentimes = amountCentimes;
    // net = gross / (1 + rate/100) → in centimes: gross * 10000 / (10000 + rate*100)
    netCentimes = Math.round(grossCentimes * 10000 / (10000 + rateMultiplier));
    vatCentimes = grossCentimes - netCentimes;
  } else {
    return { error: `Mode invalide: ${mode}. Utilisez 'from_net' ou 'from_gross'` };
  }

  return {
    net: netCentimes / 100,
    vat: vatCentimes / 100,
    gross: grossCentimes / 100,
    rate,
    mode,
    currency: 'CHF'
  };
}

// ---------------------------------------------------------------------------
// Tool: estimate_taxes
// ---------------------------------------------------------------------------
function estimateTaxes({ revenue, expenses, canton = 'GE', status, legalForm }) {
  // Auto-derive status from legalForm
  if (legalForm) {
    if (['sarl', 'sa', 'cooperative'].includes(legalForm)) {
      status = 'corporate';
    } else if (['association', 'fondation'].includes(legalForm)) {
      status = 'nonprofit';
    } else {
      status = 'independent';
    }
  }
  if (!status) status = 'independent';
  const taxableIncome = revenue - expenses;
  if (taxableIncome <= 0) {
    return {
      revenue: round2(revenue),
      expenses: round2(expenses),
      taxableIncome: round2(taxableIncome),
      deficit: round2(Math.abs(taxableIncome)),
      federal: 0,
      cantonal: 0,
      socialCharges: 0,
      total: 0,
      effectiveRate: 0,
      canton: canton.toUpperCase(),
      status,
      currency: 'CHF',
      note: `Déficit de ${round2(Math.abs(taxableIncome))} CHF — aucun impôt estimé. Les charges (${round2(expenses)} CHF) dépassent le revenu (${round2(revenue)} CHF).`
    };
  }

  let federal = 0;
  let cantonal = 0;
  let socialCharges = 0;

  if (status === 'independent') {
    // Federal progressive tax (simplified brackets LIFD)
    federal = computeFederalProgressiveTax(taxableIncome);

    // Cantonal estimate (simplified — varies widely)
    const cantonalRates = {
      GE: 0.24, VD: 0.22, ZH: 0.19, BE: 0.21, BS: 0.22, LU: 0.16,
      AG: 0.19, SG: 0.20, TI: 0.23, VS: 0.21, FR: 0.23, NE: 0.25,
      JU: 0.24, SO: 0.21, BL: 0.20, SH: 0.18, AR: 0.17, AI: 0.14,
      GL: 0.19, GR: 0.18, TG: 0.19, SZ: 0.14, NW: 0.13, OW: 0.13,
      UR: 0.15, ZG: 0.12
    };
    const cantonRate = cantonalRates[canton.toUpperCase()] || 0.22;
    cantonal = round2(taxableIncome * cantonRate);

    // Social charges indépendant (Art. 2 LACI: pas d'AC pour indépendants, LPP optionnelle Art. 4 LPP)
    // AVS 8.1% + AI 1.4% + APG 0.5% = 10.0% + frais admin ~0.55% = ~10.55%
    socialCharges = round2(taxableIncome * 0.1055);
  } else if (status === 'nonprofit') {
    // Associations/fondations — exonérées si but idéal (Art. 56 let. g LIFD)
    // Si activité commerciale taxable, taux réduit
    federal = round2(taxableIncome * 0.042); // Taux réduit
    const corpCantonRates = {
      GE: 0.14, VD: 0.14, ZH: 0.12, BE: 0.13, LU: 0.08, ZG: 0.08,
      BS: 0.13, AG: 0.11, SG: 0.12, TI: 0.12, NW: 0.06, OW: 0.06
    };
    const corpRate = corpCantonRates[canton.toUpperCase()] || 0.13;
    cantonal = round2(taxableIncome * corpRate * 0.5); // Souvent réduit
  } else {
    // SARL/SA/Coopérative: federal 8.5% on profit (LIFD Art. 68)
    federal = round2(taxableIncome * 0.085);

    // Cantonal corporate tax estimate
    const corpCantonRates = {
      GE: 0.14, VD: 0.14, ZH: 0.12, BE: 0.13, LU: 0.08, ZG: 0.08,
      BS: 0.13, AG: 0.11, SG: 0.12, TI: 0.12, NW: 0.06, OW: 0.06
    };
    const corpRate = corpCantonRates[canton.toUpperCase()] || 0.13;
    cantonal = round2(taxableIncome * corpRate);
  }

  const total = round2(federal + cantonal + socialCharges);
  const effectiveRate = revenue > 0 ? round2((total / revenue) * 100) : 0;

  const legalFormLabels = {
    raison_individuelle: 'Raison individuelle',
    sarl: 'Sàrl', sa: 'SA', snc: 'SNC', senc: 'SEnC',
    cooperative: 'Coopérative', association: 'Association', fondation: 'Fondation'
  };

  let note = 'Estimation indicative. Consultez un fiduciaire pour un calcul précis.';
  if (status === 'independent') {
    note += ' Charges sociales: AVS/AI/APG 10.55% (sans AC ni LPP, Art. 2 LACI / Art. 4 LPP).';
  } else if (status === 'nonprofit') {
    note += ' Si votre organisation a un but idéal, elle peut être exonérée (Art. 56 let. g LIFD).';
  }

  return {
    revenue: round2(revenue),
    expenses: round2(expenses),
    taxableIncome: round2(taxableIncome),
    federal: round2(federal),
    cantonal: round2(cantonal),
    socialCharges,
    total,
    effectiveRate,
    canton: canton.toUpperCase(),
    status: legalForm ? legalFormLabels[legalForm] || status : status,
    legalForm: legalForm || null,
    currency: 'CHF',
    note
  };
}

function computeFederalProgressiveTax(income) {
  // Simplified Swiss federal tax brackets (LIFD Art. 36)
  const brackets = [
    { limit: 14500, rate: 0 },
    { limit: 31600, rate: 0.0077 },
    { limit: 41400, rate: 0.0088 },
    { limit: 55200, rate: 0.0264 },
    { limit: 72500, rate: 0.0297 },
    { limit: 78100, rate: 0.0594 },
    { limit: 103600, rate: 0.066 },
    { limit: 134600, rate: 0.088 },
    { limit: 176000, rate: 0.11 },
    { limit: 755200, rate: 0.132 },
    { limit: Infinity, rate: 0.1155 }
  ];

  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (income <= prev) break;
    const taxable = Math.min(income, bracket.limit) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.limit;
  }
  return round2(tax);
}

// ---------------------------------------------------------------------------
// Tool: prepare_vat_report
// ---------------------------------------------------------------------------
async function prepareVatReport({ quarter, year }, userId) {
  if (!userId) return { error: 'userId requis pour ce rapport.' };

  const { start, end } = quarterRange(quarter, year);

  const userProjects = await Project.find({ userId }).lean().select('_id');
  const projectIds = userProjects.map(p => p._id);
  const projectFilter = projectIds.length > 0 ? { project: { $in: projectIds } } : { project: null };

  const [invoiceVat, transactionVat] = await Promise.all([
    // VAT collected: from paid invoices in that quarter
    Invoice.aggregate([
      { $match: { ...projectFilter, status: 'paid', paidAt: { $gte: start, $lt: end } } },
      { $unwind: { path: '$vatBreakdown', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$vatBreakdown.rate',
          base: { $sum: { $ifNull: ['$vatBreakdown.base', '$subtotal'] } },
          vatAmount: { $sum: { $ifNull: ['$vatBreakdown.amount', '$vatAmount'] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]),

    // VAT paid: from DBIT transactions in that quarter
    BankTransaction.aggregate([
      { $match: { userId, creditDebit: 'DBIT', bookingDate: { $gte: start, $lt: end }, vatAmount: { $gt: 0 } } },
      {
        $group: {
          _id: '$vatRate',
          base: { $sum: { $subtract: ['$amount', { $ifNull: ['$vatAmount', 0] }] } },
          vatAmount: { $sum: '$vatAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ])
  ]);

  const totalCollected = invoiceVat.reduce((s, r) => s + (r.vatAmount || 0), 0);
  const totalPaid = transactionVat.reduce((s, r) => s + (r.vatAmount || 0), 0);

  return {
    quarter,
    year,
    period: `T${quarter} ${year}`,
    collected: {
      total: round2(totalCollected),
      byRate: invoiceVat.map(r => ({
        rate: r._id || 'mixte',
        base: round2(r.base),
        vat: round2(r.vatAmount),
        invoiceCount: r.count
      }))
    },
    paid: {
      total: round2(totalPaid),
      byRate: transactionVat.map(r => ({
        rate: r._id || 'mixte',
        base: round2(r.base),
        vat: round2(r.vatAmount),
        transactionCount: r.count
      }))
    },
    due: round2(totalCollected - totalPaid),
    currency: 'CHF',
    note: totalCollected - totalPaid > 0
      ? `Vous devez ${round2(totalCollected - totalPaid)} CHF à l'AFC pour T${quarter} ${year}.`
      : `L'AFC vous doit ${round2(Math.abs(totalCollected - totalPaid))} CHF (impôt préalable excédentaire).`
  };
}

// ---------------------------------------------------------------------------
// Tool: analyze_cashflow
// ---------------------------------------------------------------------------
async function analyzeCashflow({ months = 3 }, userId) {
  if (!userId) return { error: 'userId requis.' };

  const userProjects = await Project.find({ userId }).lean().select('_id');
  const projectIds = userProjects.map(p => p._id);
  const projectFilter = projectIds.length > 0 ? { project: { $in: projectIds } } : { project: null };

  const [pendingInvoices, recurringCharges, historicalRevenue] = await Promise.all([
    // Pending invoices (expected inflows)
    Invoice.find({
      ...projectFilter,
      status: { $in: ['sent', 'partial'] }
    }).lean().select('total paidAmount dueDate number'),

    // Recurring charges (expected outflows)
    RecurringCharge.find({ userId, isActive: true }).lean().select('counterpartyName frequency expectedAmount'),

    // Last 3 months average revenue for baseline
    Invoice.aggregate([
      {
        $match: {
          ...projectFilter,
          status: 'paid',
          paidAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) }
        }
      },
      { $group: { _id: { $month: '$paidAt' }, total: { $sum: '$total' } } }
    ])
  ]);

  const avgMonthlyRevenue = historicalRevenue.length > 0
    ? round2(historicalRevenue.reduce((s, m) => s + m.total, 0) / historicalRevenue.length)
    : 0;

  // Monthly recurring expenses
  const monthlyRecurring = recurringCharges.reduce((sum, rc) => {
    if (rc.frequency === 'monthly') return sum + rc.expectedAmount;
    if (rc.frequency === 'quarterly') return sum + rc.expectedAmount / 3;
    if (rc.frequency === 'yearly') return sum + rc.expectedAmount / 12;
    return sum;
  }, 0);

  const projections = [];
  const now = new Date();

  for (let i = 1; i <= Math.min(months, 12); i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const monthLabel = monthDate.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });

    // Expected inflows from pending invoices due this month
    const expectedInflows = pendingInvoices
      .filter(inv => {
        const due = new Date(inv.dueDate);
        return due >= monthDate && due <= monthEnd;
      })
      .reduce((s, inv) => s + (inv.total - (inv.paidAmount || 0)), 0);

    const inflow = round2(expectedInflows + avgMonthlyRevenue * 0.5); // pending + baseline estimate
    const outflow = round2(monthlyRecurring);
    const net = round2(inflow - outflow);

    projections.push({ month: monthLabel, inflow, outflow, net });
  }

  return {
    projections,
    avgMonthlyRevenue,
    monthlyRecurringExpenses: round2(monthlyRecurring),
    pendingInvoicesTotal: round2(pendingInvoices.reduce((s, inv) => s + (inv.total - (inv.paidAmount || 0)), 0)),
    currency: 'CHF',
    note: 'Projection indicative basée sur les factures en cours, charges récurrentes et historique.'
  };
}

// ---------------------------------------------------------------------------
// Tool: suggest_category
// ---------------------------------------------------------------------------
async function suggestCategory({ vendor, description = '' }, userId) {
  if (!userId) return { error: 'userId requis.' };

  // Check existing counterparty rules
  const vendorNorm = vendor.trim().toLowerCase();
  const rules = await CounterpartyRule.find({ userId }).lean().populate('expenseCategory', 'name accountNumber');

  // Exact match
  const exactMatch = rules.find(r => r.counterpartyName.toLowerCase() === vendorNorm);
  if (exactMatch && exactMatch.expenseCategory) {
    return {
      category: exactMatch.expenseCategory.name,
      accountNumber: exactMatch.expenseCategory.accountNumber || '',
      confidence: 0.95,
      method: 'counterparty_rule_exact',
      alias: exactMatch.alias || null
    };
  }

  // Partial match
  const partialMatch = rules.find(r =>
    vendorNorm.includes(r.counterpartyName.toLowerCase()) ||
    r.counterpartyName.toLowerCase().includes(vendorNorm)
  );
  if (partialMatch && partialMatch.expenseCategory) {
    return {
      category: partialMatch.expenseCategory.name,
      accountNumber: partialMatch.expenseCategory.accountNumber || '',
      confidence: 0.75,
      method: 'counterparty_rule_partial'
    };
  }

  // Keyword-based heuristic
  const keywords = {
    'telecom': ['swisscom', 'sunrise', 'salt', 'upc', 'telecom', 'phone', 'mobile'],
    'infrastructure': ['loyer', 'rent', 'bureau', 'office', 'coworking', 'regus', 'wework'],
    'software': ['google', 'microsoft', 'apple', 'amazon', 'aws', 'github', 'slack', 'zoom', 'adobe', 'figma', 'notion', 'vercel', 'heroku', 'digital ocean', 'ovh'],
    'assurance': ['assurance', 'insurance', 'axa', 'allianz', 'zurich', 'helvetia', 'mobiliar'],
    'transport': ['cff', 'sbb', 'uber', 'taxi', 'parking', 'essence', 'benzin', 'shell', 'bp'],
    'marketing': ['facebook', 'meta', 'linkedin', 'publicité', 'marketing', 'ads', 'campaign'],
    'formation': ['formation', 'cours', 'training', 'workshop', 'udemy', 'coursera']
  };

  const combined = `${vendorNorm} ${description.toLowerCase()}`;
  const categories = await ExpenseCategory.find({ userId }).lean().select('name accountNumber');
  const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c]));

  for (const [key, kws] of Object.entries(keywords)) {
    if (kws.some(kw => combined.includes(kw))) {
      // Find matching category
      const match = categories.find(c => c.name.toLowerCase().includes(key));
      if (match) {
        return {
          category: match.name,
          accountNumber: match.accountNumber || '',
          confidence: 0.5,
          method: 'keyword_heuristic'
        };
      }
    }
  }

  return {
    category: null,
    confidence: 0,
    method: 'no_match',
    note: 'Aucune correspondance trouvée. Classez manuellement cette dépense.'
  };
}

// ---------------------------------------------------------------------------
// Tool: get_client_stats
// ---------------------------------------------------------------------------
async function getClientStats({ clientName }, userId) {
  if (!userId) return { error: 'userId requis.' };

  const clientNameNorm = clientName.trim();
  const nameRegex = new RegExp(clientNameNorm, 'i');

  // Find projects for this client — search both client.name AND client.company
  const projects = await Project.find({
    userId,
    $or: [
      { 'client.name': nameRegex },
      { 'client.company': nameRegex }
    ]
  }).lean().select('_id name client.name client.company archivedAt');

  if (projects.length === 0) {
    return { error: `Aucun projet trouvé pour le client "${clientName}". Essayez le nom de la personne de contact ou le nom de l'entreprise.` };
  }

  const projectIds = projects.map(p => p._id);

  const [invoices, events, quotes] = await Promise.all([
    Invoice.find({ project: { $in: projectIds } }).lean().select('total status paidAt paidAmount dueDate number'),
    Event.find({ project: { $in: projectIds } }).lean().select('type hours hourlyRate amount billed date'),
    Quote.find({ project: { $in: projectIds } }).lean().select('total status number')
  ]);

  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const overdueInvoices = invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date());
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.total || 0), 0);

  const totalHours = events.filter(e => e.type === 'hours').reduce((s, e) => s + (e.hours || 0), 0);
  const unbilledHours = events.filter(e => e.type === 'hours' && !e.billed).reduce((s, e) => s + (e.hours || 0), 0);
  const totalExpenses = events.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);

  const signedQuotes = quotes.filter(q => ['signed', 'invoiced', 'partial'].includes(q.status));
  const quotesTotal = quotes.reduce((s, q) => s + (q.total || 0), 0);

  return {
    client: clientNameNorm,
    projects: projects.map(p => ({ name: p.name, archived: !!p.archivedAt })),
    revenue: {
      total: round2(totalRevenue),
      invoiceCount: paidInvoices.length,
      avgInvoice: paidInvoices.length > 0 ? round2(totalRevenue / paidInvoices.length) : 0
    },
    overdue: {
      count: overdueInvoices.length,
      total: round2(overdueAmount),
      invoices: overdueInvoices.map(i => ({ number: i.number, total: i.total, dueDate: i.dueDate }))
    },
    hours: {
      total: round2(totalHours),
      unbilled: round2(unbilledHours)
    },
    expenses: round2(totalExpenses),
    quotes: {
      total: quotes.length,
      signed: signedQuotes.length,
      totalAmount: round2(quotesTotal)
    },
    currency: 'CHF'
  };
}

// ---------------------------------------------------------------------------
// Tool: get_overdue_details
// ---------------------------------------------------------------------------
async function getOverdueDetails(userId) {
  if (!userId) return { error: 'userId requis.' };

  const userProjects = await Project.find({ userId }).lean().select('_id');
  const projectIds = userProjects.map(p => p._id);
  if (projectIds.length === 0) return { invoices: [], total: 0 };

  const overdueInvoices = await Invoice.find({
    project: { $in: projectIds },
    status: 'sent',
    dueDate: { $lt: new Date() }
  }).lean().select('number total dueDate reminders reminderCount skipReminders project').populate('project', 'client.name client.email');

  const now = new Date();
  const invoices = overdueInvoices.map(inv => ({
    number: inv.number,
    total: inv.total || 0,
    client: inv.project?.client?.name || 'Inconnu',
    clientEmail: inv.project?.client?.email || null,
    dueDate: inv.dueDate,
    daysPastDue: Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)),
    reminderCount: inv.reminderCount || 0,
    skipReminders: inv.skipReminders || false,
    reminders: (inv.reminders || []).map(r => ({
      sentAt: r.sentAt,
      type: r.type,
      emailSent: r.emailSent,
      error: r.error || null
    }))
  })).sort((a, b) => b.daysPastDue - a.daysPastDue);

  return {
    count: invoices.length,
    total: round2(invoices.reduce((s, i) => s + i.total, 0)),
    invoices,
    currency: 'CHF'
  };
}

// ---------------------------------------------------------------------------
// Tool: update_settings
// ---------------------------------------------------------------------------
async function updateSettings({ setting, value }, userId) {
  if (!userId) return { error: 'userId requis.' };

  // Allowed settings paths
  const allowedPaths = [
    'reminders.enabled',
    'invoicing.defaultVatRate',
    'invoicing.defaultPaymentTerms',
    'invoicing.defaultHourlyRate',
    'invoicing.invoicePrefix',
    'invoicing.quotePrefix',
    'smtp.host', 'smtp.port', 'smtp.secure', 'smtp.user', 'smtp.pass',
    'bankImap.enabled', 'bankImap.host', 'bankImap.port', 'bankImap.user', 'bankImap.pass',
    'company.name', 'company.vatNumber', 'company.iban', 'company.qrIban',
    'company.siret', 'company.street', 'company.zip', 'company.city', 'company.email', 'company.phone',
    'company.legalForm', 'company.canton', 'company.isVatSubject', 'company.vatDeclarationFrequency',
    'company.fiscalYearStart', 'company.employeeCount',
    'invoiceDesign.template', 'invoiceDesign.primaryColor'
  ];

  if (!allowedPaths.includes(setting)) {
    return { status: 'error', error: `Paramètre non modifiable via l'assistant: ${setting}. Paramètres autorisés: ${allowedPaths.join(', ')}` };
  }

  // Check prerequisites
  const prereqChecks = {
    'reminders.enabled': async () => {
      const s = await Settings.findOne({ userId }).lean().select('smtp');
      if (!s?.smtp?.host || !s?.smtp?.user) {
        return { status: 'missing_prerequisites', missing: ['smtp.host', 'smtp.user'], message: 'Configurez d\'abord le SMTP pour activer les rappels.' };
      }
      return null;
    },
    'bankImap.enabled': async () => {
      const s = await Settings.findOne({ userId }).lean().select('bankImap');
      if (!s?.bankImap?.host || !s?.bankImap?.user) {
        return { status: 'missing_prerequisites', missing: ['bankImap.host', 'bankImap.user'], message: 'Configurez d\'abord l\'hôte et l\'utilisateur IMAP.' };
      }
      return null;
    }
  };

  if (prereqChecks[setting]) {
    const prereqResult = await prereqChecks[setting]();
    if (prereqResult) return prereqResult;
  }

  // Convert value to appropriate type
  let convertedValue = value;
  if (value === 'true') convertedValue = true;
  else if (value === 'false') convertedValue = false;
  else if (!isNaN(Number(value)) && value !== '') convertedValue = Number(value);

  // Apply update
  const updateObj = {};
  updateObj[setting] = convertedValue;

  await Settings.findOneAndUpdate(
    { userId },
    { $set: updateObj },
    { upsert: true }
  );

  // Invalidate context cache
  contextCache.delete(userId.toString());

  return {
    status: 'success',
    setting,
    value: convertedValue,
    message: `Paramètre "${setting}" mis à jour à "${convertedValue}".`
  };
}

// ---------------------------------------------------------------------------
// Tool: check_prerequisites
// ---------------------------------------------------------------------------
async function checkPrerequisites({ feature }, userId) {
  if (!userId) return { error: 'userId requis.' };

  const settings = await Settings.findOne({ userId }).lean().select('smtp reminders bankImap company');

  const checks = {
    reminders: () => {
      const configured = [];
      const missing = [];
      if (settings?.smtp?.host) configured.push('smtp.host'); else missing.push('smtp.host');
      if (settings?.smtp?.user) configured.push('smtp.user'); else missing.push('smtp.user');
      if (settings?.smtp?.pass) configured.push('smtp.pass'); else missing.push('smtp.pass');
      if (settings?.company?.email) configured.push('company.email'); else missing.push('company.email (expéditeur)');
      return { ready: missing.length === 0, missing, configured };
    },
    bank_imap: () => {
      const configured = [];
      const missing = [];
      if (settings?.bankImap?.host) configured.push('bankImap.host'); else missing.push('bankImap.host');
      if (settings?.bankImap?.user) configured.push('bankImap.user'); else missing.push('bankImap.user');
      if (settings?.bankImap?.pass) configured.push('bankImap.pass'); else missing.push('bankImap.pass');
      return { ready: missing.length === 0, missing, configured };
    },
    qr_bill: () => {
      const configured = [];
      const missing = [];
      if (settings?.company?.qrIban) configured.push('company.qrIban'); else missing.push('company.qrIban');
      if (settings?.company?.name) configured.push('company.name'); else missing.push('company.name');
      if (settings?.company?.street) configured.push('company.street'); else missing.push('company.street');
      if (settings?.company?.zip) configured.push('company.zip'); else missing.push('company.zip');
      if (settings?.company?.city) configured.push('company.city'); else missing.push('company.city');
      return { ready: missing.length === 0, missing, configured };
    },
    email: () => {
      const configured = [];
      const missing = [];
      if (settings?.smtp?.host) configured.push('smtp.host'); else missing.push('smtp.host');
      if (settings?.smtp?.port) configured.push('smtp.port'); else missing.push('smtp.port');
      if (settings?.smtp?.user) configured.push('smtp.user'); else missing.push('smtp.user');
      if (settings?.smtp?.pass) configured.push('smtp.pass'); else missing.push('smtp.pass');
      return { ready: missing.length === 0, missing, configured };
    }
  };

  const checker = checks[feature];
  if (!checker) {
    return { error: `Fonctionnalité inconnue: "${feature}". Options: reminders, bank_imap, qr_bill, email` };
  }

  const result = checker();
  return { feature, ...result };
}

// ---------------------------------------------------------------------------
// Ollama proxy — SSE streaming
// ---------------------------------------------------------------------------

/**
 * Stream a chat completion from Ollama via SSE.
 * @param {object} opts
 * @param {string} opts.systemPrompt - System prompt with context
 * @param {Array} opts.messages - Conversation messages [{ role, content }]
 * @param {object} opts.res - Express response (for SSE writing)
 * @param {AbortSignal} opts.signal - Abort signal for client disconnect
 * @param {string} [opts.userId] - User ID for tool execution
 * @returns {Promise<string>} Full assistant response text
 */
export async function streamChat({ systemPrompt, messages, res, signal, userId }) {
  if (USE_VLLM_CHAT) {
    return streamChatVLLM({ systemPrompt, messages, res, signal, userId });
  }
  return streamChatOllama({ systemPrompt, messages, res, signal, userId });
}

// ---------------------------------------------------------------------------
// vLLM streaming (OpenAI-compatible SSE)
// ---------------------------------------------------------------------------
async function streamChatVLLM({ systemPrompt, messages, res, signal, userId }) {
  const vllmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let fullResponse = '';

  try {
    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: vllmMessages,
        stream: true,
        tools: AI_TOOLS,
        ...VLLM_EXTRA
      }),
      signal: controller.signal
    });

    if (!vllmRes.ok) {
      const errText = await vllmRes.text().catch(() => 'Unknown error');
      throw new Error(`vLLM error ${vllmRes.status}: ${errText}`);
    }

    const reader = vllmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulate tool_calls across streaming chunks
    let pendingToolCalls = {}; // index → { id, name, arguments }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // OpenAI SSE: lines prefixed with "data: "
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          const delta = data.choices?.[0]?.delta;
          if (!delta) continue;

          // Accumulate tool_calls streamed in chunks
          if (delta.tool_calls?.length > 0) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: tc.id || '', name: tc.function?.name || '', arguments: '' };
              }
              if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
              if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
            }
          }

          // Regular text token
          if (delta.content) {
            fullResponse += delta.content;
            res.write(`data: ${JSON.stringify({ type: 'token', content: delta.content })}\n\n`);
          }

          // finish_reason: tool_calls → execute and follow up
          if (data.choices?.[0]?.finish_reason === 'tool_calls') {
            const toolResults = [];
            const toolMessages = [];

            // Build assistant message with tool_calls
            const assistantMsg = {
              role: 'assistant',
              content: fullResponse || null,
              tool_calls: Object.values(pendingToolCalls).map(tc => ({
                id: tc.id || `call_${tc.name}`,
                type: 'function',
                function: { name: tc.name, arguments: tc.arguments }
              }))
            };

            for (const tc of Object.values(pendingToolCalls)) {
              let args;
              try { args = JSON.parse(tc.arguments || '{}'); } catch { args = {}; }
              const result = await executeTool(tc.name, args, userId);
              toolResults.push(result);
              res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: tc.name, result })}\n\n`);
              toolMessages.push({
                role: 'tool',
                tool_call_id: tc.id || `call_${tc.name}`,
                content: JSON.stringify(result)
              });
            }

            pendingToolCalls = {};

            // Follow-up generation with tool results
            const followUp = await streamToolFollowUpVLLM({
              systemPrompt,
              messages: [
                ...messages,
                assistantMsg,
                ...toolMessages
              ],
              res,
              signal: controller.signal
            });
            fullResponse += followUp;
            clearTimeout(timeoutId);
            return fullResponse;
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Génération interrompue (timeout ou annulation).' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Erreur de connexion au modèle AI. Réessayez.' })}\n\n`);
      console.error('[AI] vLLM streaming error:', err.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return fullResponse;
}

// ---------------------------------------------------------------------------
// Ollama streaming (chemin original — préservé comme fallback)
// ---------------------------------------------------------------------------
async function streamChatOllama({ systemPrompt, messages, res, signal, userId }) {
  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  // Chain external signal to our controller
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let fullResponse = '';

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: ollamaMessages,
        stream: true,
        tools: AI_TOOLS
      }),
      signal: controller.signal
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => 'Unknown error');
      throw new Error(`Ollama error ${ollamaRes.status}: ${errText}`);
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Ollama sends newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);

          // Check for tool calls
          if (data.message?.tool_calls?.length > 0) {
            const toolResults = [];
            for (const toolCall of data.message.tool_calls) {
              const result = await executeTool(
                toolCall.function.name,
                toolCall.function.arguments,
                userId
              );
              toolResults.push({
                role: 'tool',
                content: JSON.stringify(result)
              });
              // Send tool result indicator to frontend
              res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolCall.function.name, result })}\n\n`);
            }

            // Continue generation with tool results
            const followUp = await streamToolFollowUp({
              systemPrompt,
              messages: [
                ...ollamaMessages.slice(1), // skip system (already in ollamaMessages)
                data.message,
                ...toolResults
              ],
              res,
              signal: controller.signal
            });
            fullResponse += followUp;
            clearTimeout(timeoutId);
            return fullResponse;
          }

          // Regular token
          if (data.message?.content) {
            fullResponse += data.message.content;
            res.write(`data: ${JSON.stringify({ type: 'token', content: data.message.content })}\n\n`);
          }

          if (data.done) {
            break;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Génération interrompue (timeout ou annulation).' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Erreur de connexion au modèle AI. Réessayez.' })}\n\n`);
      console.error('[AI] Ollama streaming error:', err.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return fullResponse;
}

/**
 * Follow-up streaming after tool call execution (Ollama fallback).
 */
async function streamToolFollowUp({ systemPrompt, messages, res, signal }) {
  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let fullResponse = '';

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: ollamaMessages,
        stream: true
      }),
      signal
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama follow-up error ${ollamaRes.status}`);
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullResponse += data.message.content;
            res.write(`data: ${JSON.stringify({ type: 'token', content: data.message.content })}\n\n`);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[AI] Tool follow-up error:', err.message);
    }
  }

  return fullResponse;
}

/**
 * Follow-up streaming after tool call execution (vLLM / OpenAI-compatible SSE).
 */
async function streamToolFollowUpVLLM({ systemPrompt, messages, res, signal }) {
  const vllmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let fullResponse = '';

  try {
    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: vllmMessages,
        stream: true,
        ...VLLM_EXTRA
      }),
      signal
    });

    if (!vllmRes.ok) {
      throw new Error(`vLLM follow-up error ${vllmRes.status}`);
    }

    const reader = vllmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[AI] vLLM tool follow-up error:', err.message);
    }
  }

  return fullResponse;
}

// ---------------------------------------------------------------------------
// Suggestions (proactive insights from user data)
// ---------------------------------------------------------------------------
export async function generateSuggestions(userId) {
  const context = await buildUserContext(userId);
  const suggestions = [];

  // Overdue invoices
  if (context.overdueInvoices.length > 0) {
    const totalOverdue = context.overdueInvoices.reduce((s, i) => s + i.total, 0);
    suggestions.push({
      type: 'warning',
      title: 'Factures en retard',
      message: `${context.overdueInvoices.length} facture(s) en retard pour un total de ${round2(totalOverdue)} CHF`,
      action: 'view_overdue'
    });
  }

  // Reminders disabled + overdue invoices
  if (!context.config.remindersEnabled && context.overdueInvoices.length > 0) {
    suggestions.push({
      type: 'warning',
      title: 'Rappels automatiques désactivés',
      message: 'Vous avez des factures en retard mais les rappels automatiques sont désactivés. Activez-les pour relancer vos clients.',
      action: 'enable_reminders'
    });
  }

  // Unbilled hours > 20h
  if (context.unbilled.hours > 20) {
    suggestions.push({
      type: 'warning',
      title: 'Heures non facturées',
      message: `${context.unbilled.hours}h de travail non facturé (${context.unbilled.total} CHF). Pensez à facturer vos clients.`,
      action: 'view_unbilled'
    });
  }

  // Uncategorized expenses
  if (context._uncategorizedCount > 10) {
    suggestions.push({
      type: 'info',
      title: 'Dépenses non classées',
      message: `${context._uncategorizedCount} transactions bancaires sans catégorie cette année. Classez-les pour un meilleur suivi comptable.`,
      action: 'categorize_expenses'
    });
  }

  // VAT threshold approaching — only relevant for non-VAT-subject businesses
  const isNonprofit = ['association', 'fondation'].includes(context.company?.legalForm);
  const vatThresholdAmount = isNonprofit ? 150000 : 100000;
  const warningThreshold = vatThresholdAmount * 0.8; // 80% of threshold

  if (!context.company?.isVatSubject && context.revenue.ytd > warningThreshold) {
    const exceeded = context.revenue.ytd >= vatThresholdAmount;
    suggestions.push({
      type: exceeded ? 'warning' : 'info',
      title: exceeded ? 'Assujettissement TVA obligatoire' : 'Seuil TVA en approche',
      message: exceeded
        ? `Votre CA annuel (${context.revenue.ytd} CHF) dépasse ${vatThresholdAmount.toLocaleString('fr-CH')} CHF. Vous devez vous inscrire au registre TVA (Art. 10 LTVA).`
        : `Votre CA annuel (${context.revenue.ytd} CHF) approche le seuil de ${vatThresholdAmount.toLocaleString('fr-CH')} CHF. Anticipez votre inscription TVA (Art. 10 LTVA).`,
      action: 'check_vat_threshold'
    });
  }

  // End of quarter approaching (VAT report)
  const now = new Date();
  const daysUntilQuarterEnd = daysUntilEndOfQuarter(now);
  if (daysUntilQuarterEnd <= 15) {
    suggestions.push({
      type: 'info',
      title: 'Fin de trimestre',
      message: `Plus que ${daysUntilQuarterEnd} jours avant la fin du T${currentQuarter()}. Préparez votre décompte TVA.`,
      action: 'prepare_vat_report'
    });
  }

  // SMTP not configured
  if (!context.config.smtpConfigured) {
    suggestions.push({
      type: 'tip',
      title: 'Email non configuré',
      message: 'Configurez le SMTP pour envoyer factures, devis et rappels directement depuis SWIGS Pro.',
      action: 'configure_smtp'
    });
  }

  // QR-IBAN missing
  if (!context.config.qrIbanSet) {
    suggestions.push({
      type: 'tip',
      title: 'QR-IBAN manquant',
      message: 'Ajoutez votre QR-IBAN pour générer des QR-factures conformes aux normes suisses (SIX).',
      action: 'configure_qr_iban'
    });
  }

  // No active projects
  if (context.activeProjects.length === 0) {
    suggestions.push({
      type: 'tip',
      title: 'Aucun projet actif',
      message: 'Créez un projet pour commencer à suivre vos heures et dépenses.',
      action: 'create_project'
    });
  }

  // Good profit margin
  if (context.profit.margin !== null && context.profit.margin > 50) {
    suggestions.push({
      type: 'tip',
      title: 'Bonne rentabilité',
      message: `Marge de ${context.profit.margin}% — pensez à provisionner pour les impôts et cotisations sociales.`,
      action: 'estimate_taxes'
    });
  }

  return suggestions;
}

function daysUntilEndOfQuarter(date) {
  const q = currentQuarter();
  const qEnd = new Date(date.getFullYear(), q * 3, 0); // last day of quarter
  const diff = qEnd - date;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// OCR — Two-stage pipeline: text extraction + LLM structuring
// Images → Tesseract.js OCR | PDFs → pdf-parse text extraction
// ---------------------------------------------------------------------------

import Tesseract from 'tesseract.js';
import { PDFParse } from 'pdf-parse';

const OCR_STRUCTURING_PROMPT = `Tu es un expert en extraction de données comptables.
Voici le texte brut extrait d'un document comptable (facture, ticket, reçu).
Analyse ce texte et extrais les informations au format JSON strict :

{
  "vendor": "nom du fournisseur",
  "date": "YYYY-MM-DD",
  "amountNet": nombre ou null,
  "amountGross": nombre TTC ou null,
  "vatAmount": nombre TVA ou null,
  "vatRate": taux TVA en % ou null,
  "currency": "CHF/EUR/USD",
  "invoiceNumber": "référence ou null",
  "category": "office|telecom|transport|food|software|insurance|rent|other",
  "lineItems": [{"description": "...", "quantity": 1, "unitPrice": 0, "total": 0}],
  "confidence": 0.0 à 1.0
}

Règles :
- TVA suisse : 8.1% normal, 2.6% réduit, 3.8% hébergement uniquement
- Si un champ est illisible ou absent, mets null
- Réponds UNIQUEMENT avec le JSON, sans texte ni explication`;

/**
 * Extract text from a PDF using pdf-parse (embedded text).
 * @param {Buffer} fileBuffer
 * @returns {Promise<{text: string, pages: number}>}
 */
async function extractPdfText(fileBuffer) {
  let parser;
  try {
    console.log('[AI] OCR: Extracting text from PDF with pdf-parse v2...');
    parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    await parser.load();
    const result = await parser.getText();
    const text = (result.text || '').replace(/\n-- \d+ of \d+ --\n/g, '\n').trim();
    const pages = result.total || 1;
    console.log(`[AI] OCR: PDF extracted ${text.split('\n').filter(Boolean).length} lines from ${pages} page(s)`);
    return { text, pages };
  } catch (err) {
    throw new Error(`Erreur extraction PDF: ${err.message}`);
  } finally {
    if (parser) try { parser.destroy(); } catch {}
  }
}

/**
 * Extract structured data from a document.
 * - Images (JPEG/PNG/WebP): Tesseract.js OCR → LLM structuring
 * - PDFs: pdf-parse text extraction → LLM structuring
 * @param {Buffer} fileBuffer - The file buffer (image or PDF)
 * @param {string} mimeType - MIME type
 * @returns {Promise<object>} Extracted document data
 */
export async function ocrDocument(fileBuffer, mimeType) {
  // --- Stage 1: Text extraction (method depends on file type) ---
  let rawText = '';
  let ocrConfidence = 0;
  let extractionMethod = 'unknown';

  if (mimeType === 'application/pdf') {
    // PDF: use pdf-parse for embedded text extraction
    extractionMethod = 'pdf-parse';
    const { text } = await extractPdfText(fileBuffer);
    rawText = text;
    // PDF text extraction from embedded text is high confidence
    ocrConfidence = rawText.length > 50 ? 0.95 : 0.7;
  } else {
    // Images: use Tesseract.js OCR
    extractionMethod = 'tesseract';
    try {
      console.log('[AI] OCR: Starting Tesseract extraction...');
      const { data } = await Tesseract.recognize(fileBuffer, 'fra+deu+eng', {
        logger: () => {}, // silent
      });
      rawText = data.text || '';
      ocrConfidence = (data.confidence || 0) / 100;
      console.log(`[AI] OCR: Tesseract extracted ${rawText.split('\n').filter(Boolean).length} lines, confidence ${(ocrConfidence * 100).toFixed(0)}%`);
    } catch (err) {
      throw new Error(`Erreur OCR Tesseract: ${err.message}`);
    }
  }

  if (!rawText.trim()) {
    const hint = mimeType === 'application/pdf'
      ? 'Le PDF ne contient pas de texte extractible (document scanné ?). Essayez avec une image (JPEG/PNG) du document.'
      : 'Aucun texte détecté dans l\'image. Vérifiez la qualité de l\'image.';
    throw new Error(hint);
  }

  // --- Stage 2: LLM structuring (vLLM si USE_VLLM_CHAT, sinon Ollama) ---
  let llmText;
  if (USE_VLLM_CHAT) {
    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          { role: 'system', content: OCR_STRUCTURING_PROMPT },
          { role: 'user', content: `Texte extrait (méthode: ${extractionMethod}, confiance: ${(ocrConfidence * 100).toFixed(0)}%) :\n\n${rawText}` },
        ],
        stream: false,
        temperature: 0.1,
        ...VLLM_EXTRA
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!vllmRes.ok) {
      const errText = await vllmRes.text().catch(() => 'Unknown error');
      throw new Error(`LLM structuring error (vLLM) ${vllmRes.status}: ${errText}`);
    }

    const vllmResult = await vllmRes.json();
    llmText = vllmResult.choices?.[0]?.message?.content || '';
  } else {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: OCR_STRUCTURING_PROMPT },
          { role: 'user', content: `Texte extrait (méthode: ${extractionMethod}, confiance: ${(ocrConfidence * 100).toFixed(0)}%) :\n\n${rawText}` },
        ],
        stream: false,
        think: false, // Disable reasoning mode — OCR structuring is deterministic
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => 'Unknown error');
      throw new Error(`LLM structuring error ${ollamaRes.status}: ${errText}`);
    }

    const llmResult = await ollamaRes.json();
    llmText = llmResult.message?.content || '';
  }

  // Extract JSON from response
  const jsonMatch = llmText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Le modèle n\'a pas retourné de JSON valide. Texte brut disponible.');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      rawText,
      ocrConfidence,
      extractionMethod,
    };
  } catch {
    throw new Error('JSON invalide dans la réponse du modèle.');
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { status: 'degraded', error: `Ollama HTTP ${res.status}` };

    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    const hasModel = models.some(m => m.startsWith(AI_MODEL.split(':')[0]));

    return {
      status: 'ok',
      model: AI_MODEL,
      ollamaReachable: true,
      availableModels: models,
      modelLoaded: hasModel
    };
  } catch (err) {
    return {
      status: 'degraded',
      model: AI_MODEL,
      ollamaReachable: false,
      error: err.message
    };
  }
}
