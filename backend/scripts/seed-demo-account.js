/**
 * Seed du compte de démo SWIGS Pro — profil "Menuiserie Marchand" (artisan GE).
 *
 * Usage :
 *   node backend/scripts/seed-demo-account.js --hubUserId=<HUB_ID>
 *   node backend/scripts/seed-demo-account.js --hubUserId=<HUB_ID> --email=demo@swigs.online --name='Compte Démo'
 *
 * Idempotent : purge toutes les données rattachées au User local correspondant
 * au hubUserId, puis recrée un jeu complet (clients, projets, devis, factures,
 * événements, dépenses, statuts, catégories, settings).
 *
 * Important : utilise des numéros DEMO-* pour ne pas polluer le compteur
 * global des FAC-/DEV- de production.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import User from '../src/models/User.js';
import Settings from '../src/models/Settings.js';
import Status from '../src/models/Status.js';
import ExpenseCategory from '../src/models/ExpenseCategory.js';
import Client from '../src/models/Client.js';
import Project from '../src/models/Project.js';
import Quote from '../src/models/Quote.js';
import Invoice from '../src/models/Invoice.js';
import Event from '../src/models/Event.js';
import Expense from '../src/models/Expense.js';

// ───── Args ─────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=') || true];
    })
);

const HUB_USER_ID = args.hubUserId || process.env.DEMO_HUB_USER_ID;
const EMAIL = (args.email || 'demo@swigs.online').toLowerCase().trim();
const NAME = args.name || 'Compte Démo SWIGS';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';

if (!HUB_USER_ID) {
  console.error('❌ --hubUserId=<id> requis (ou variable DEMO_HUB_USER_ID)');
  console.error('   Lance d\'abord : node swigs-hub/backend/scripts/create-demo-user.js');
  process.exit(1);
}

// ───── Helpers ─────
const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const daysFromNow = (n) => new Date(NOW.getTime() + n * 86400000);
const round = (n) => Math.round(n * 100) / 100;
const VAT = 8.1;

// Calcule subtotal/vatAmount/total à partir d'un montant TTC
function fromTtc(totalTtc) {
  const subtotal = round(totalTtc / (1 + VAT / 100));
  const vatAmount = round(totalTtc - subtotal);
  return { subtotal, vatAmount, total: round(totalTtc) };
}

// Numéros démo (préfixe DEMO- pour ne pas polluer les compteurs prod)
let invoiceSeq = 0;
let quoteSeq = 0;
const nextInvoiceNumber = () => `DEMO-FAC-${String(++invoiceSeq).padStart(4, '0')}`;
const nextQuoteNumber = () => `DEMO-DEV-${String(++quoteSeq).padStart(4, '0')}`;

// ───── Données métier — Menuiserie Marchand ─────
const COMPANY = {
  name: 'Menuiserie Marchand Sàrl',
  street: 'Route de Meyrin 142',
  zip: '1219',
  city: 'Châtelaine',
  country: 'CH',
  canton: 'GE',
  email: 'contact@menuiserie-marchand.ch',
  phone: '+41 22 555 18 90',
  vatNumber: 'CHE-123.456.789 TVA',
  siret: 'CHE-123.456.789 TVA',
  iban: 'CH9300762011623852957',
  legalForm: 'sarl',
  isVatSubject: true,
  vatDeclarationFrequency: 'quarterly',
  fiscalYearStart: 1,
  employeeCount: 4,
};

const STATUSES = [
  { name: 'Prospect', color: '#94A3B8', order: 0, isDefault: true },
  { name: 'Devis envoyé', color: '#3B82F6', order: 1 },
  { name: 'En cours', color: '#F59E0B', order: 2 },
  { name: 'Attente fourniture', color: '#EAB308', order: 3 },
  { name: 'Livré', color: '#10B981', order: 4 },
  { name: 'Facturé', color: '#6366F1', order: 5 },
];

const EXPENSE_CATEGORIES = [
  { name: 'Bois & matériaux', icon: 'Package', color: '#a16207', accountNumber: '4000', vatRate: 8.1, order: 0 },
  { name: 'Quincaillerie', icon: 'Wrench', color: '#64748b', accountNumber: '4010', vatRate: 8.1, order: 1 },
  { name: 'Outillage', icon: 'Hammer', color: '#0891b2', accountNumber: '6500', vatRate: 8.1, order: 2 },
  { name: 'Véhicule & carburant', icon: 'Car', color: '#10b981', accountNumber: '6800', vatRate: 8.1, order: 3 },
  { name: 'Sous-traitance', icon: 'Users', color: '#f97316', accountNumber: '4400', vatRate: 8.1, order: 4 },
  { name: 'Repas chantier', icon: 'Utensils', color: '#ec4899', accountNumber: '6810', vatRate: 8.1, order: 5 },
  { name: 'Formation', icon: 'GraduationCap', color: '#f59e0b', accountNumber: '6700', vatRate: 8.1, order: 6 },
  { name: 'Assurances', icon: 'Shield', color: '#3b82f6', accountNumber: '6300', vatRate: 0, order: 7 },
];

const CLIENTS = [
  { name: 'Sophie Reynaud', company: null, email: 'sophie.reynaud@gmail.com', phone: '+41 79 412 56 78', street: 'Chemin du Pré-Bouvier 18', zip: '1242', city: 'Satigny', city_label: 'particulier' },
  { name: 'Marc Dubois', company: null, email: 'marc.dubois@bluewin.ch', phone: '+41 78 645 12 33', street: 'Av. de Champel 24', zip: '1206', city: 'Genève', city_label: 'particulier' },
  { name: 'Anne Caillot', company: 'Café Le Vésuve', email: 'anne@cafelevesuve.ch', phone: '+41 22 345 67 89', street: 'Rue des Eaux-Vives 56', zip: '1207', city: 'Genève' },
  { name: 'Patrick Jaccard', company: 'Étude Jaccard & Associés', email: 'p.jaccard@jaccard-avocats.ch', phone: '+41 22 731 89 14', street: 'Rue du Rhône 78', zip: '1204', city: 'Genève' },
  { name: 'Élise Morand', company: 'Hôtel des Bergues', email: 'e.morand@hotelbergues.ch', phone: '+41 22 908 70 00', street: 'Quai des Bergues 33', zip: '1201', city: 'Genève' },
  { name: 'Thomas Henchoz', company: 'Boulangerie Henchoz Sàrl', email: 't.henchoz@boulangerie-henchoz.ch', phone: '+41 21 311 45 67', street: 'Place de la Riponne 4', zip: '1005', city: 'Lausanne' },
  { name: 'Laurence Brunner', company: 'Brunner Architecture', email: 'l.brunner@brunner-archi.ch', phone: '+41 44 215 78 90', street: 'Bahnhofstrasse 64', zip: '8001', city: 'Zürich' },
  { name: 'Jean-Claude Périllat', company: null, email: 'jc.perillat@gmail.com', phone: '+41 79 233 11 88', street: 'Route de Florissant 92', zip: '1206', city: 'Genève', city_label: 'particulier' },
];

// ───── Run ─────
async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-demo] Connecté à ${MONGODB_URI}`);

  // 1. User local (lié au hubUserId)
  let user = await User.findOne({ hubUserId: HUB_USER_ID });
  if (!user) {
    user = await User.create({
      hubUserId: HUB_USER_ID,
      email: EMAIL,
      name: NAME,
      isActive: true,
    });
    console.log(`[seed-demo] User créé : ${user._id}`);
  } else {
    user.email = EMAIL;
    user.name = NAME;
    user.isActive = true;
    await user.save();
    console.log(`[seed-demo] User existant réutilisé : ${user._id}`);
  }
  const userId = user._id;

  // 2. PURGE : tout ce qui appartient à ce userId
  console.log('[seed-demo] Purge des données existantes...');
  const projects = await Project.find({ userId }).select('_id');
  const projectIds = projects.map((p) => p._id);

  await Promise.all([
    Event.deleteMany({ project: { $in: projectIds } }),
    Invoice.deleteMany({ project: { $in: projectIds } }),
    Quote.deleteMany({ project: { $in: projectIds } }),
    Project.deleteMany({ userId }),
    Status.deleteMany({ userId }),
    ExpenseCategory.deleteMany({ userId }),
    Client.deleteMany({ userId }),
    Expense.deleteMany({ userId }),
    Settings.deleteOne({ userId }),
  ]);
  console.log('[seed-demo] Purge terminée');

  // 3. Settings
  await Settings.create({
    userId,
    company: COMPANY,
    invoicing: {
      invoicePrefix: 'FAC-',
      quotePrefix: 'DEV-',
      defaultVatRate: 8.1,
      defaultPaymentTerms: 30,
      defaultHourlyRate: 105,
    },
    emailNotifications: {
      paymentConfirmation: true,
    },
    reminders: { enabled: true },
    invoiceDesign: {
      template: 'swiss',
      primaryColor: '#92400E',
      accentColor: '#451A03',
    },
  });
  console.log('[seed-demo] Settings créés');

  // 4. Statuses
  const createdStatuses = await Status.insertMany(STATUSES.map((s) => ({ ...s, userId })));
  const statusByName = Object.fromEntries(createdStatuses.map((s) => [s.name, s]));
  console.log(`[seed-demo] ${createdStatuses.length} statuts créés`);

  // 5. Catégories de dépenses
  await ExpenseCategory.insertMany(EXPENSE_CATEGORIES.map((c) => ({ ...c, userId })));
  console.log(`[seed-demo] ${EXPENSE_CATEGORIES.length} catégories de dépenses créées`);

  // 6. Clients
  const createdClients = await Client.insertMany(CLIENTS.map((c) => ({ ...c, userId })));
  console.log(`[seed-demo] ${createdClients.length} clients créés`);
  const clientByName = Object.fromEntries(createdClients.map((c) => [c.name, c]));

  // 7. Projets — 15 répartis sur 12 mois
  const projectDefs = [
    // Anciens projets livrés/facturés
    { name: 'Cuisine sur mesure chêne massif', client: 'Sophie Reynaud', status: 'Facturé', startedDaysAgo: 320, hourlyRate: 105 },
    { name: 'Bibliothèque salon — placage noyer', client: 'Marc Dubois', status: 'Facturé', startedDaysAgo: 280, hourlyRate: 105 },
    { name: 'Comptoir bar et étagères', client: 'Anne Caillot', status: 'Facturé', startedDaysAgo: 250, hourlyRate: 110 },
    { name: 'Aménagement bureau direction', client: 'Patrick Jaccard', status: 'Facturé', startedDaysAgo: 220, hourlyRate: 115 },
    { name: 'Rénovation portes intérieures', client: 'Jean-Claude Périllat', status: 'Livré', startedDaysAgo: 180, hourlyRate: 100 },
    { name: 'Lambris hall réception', client: 'Élise Morand', status: 'Livré', startedDaysAgo: 140, hourlyRate: 110 },

    // En cours
    { name: 'Dressing chambre principale', client: 'Sophie Reynaud', status: 'En cours', startedDaysAgo: 45, hourlyRate: 105 },
    { name: 'Agencement boutique pâtisserie', client: 'Thomas Henchoz', status: 'En cours', startedDaysAgo: 35, hourlyRate: 110 },
    { name: 'Escalier hélicoïdal hêtre', client: 'Laurence Brunner', status: 'En cours', startedDaysAgo: 25, hourlyRate: 115 },
    { name: 'Réfection parquet salon', client: 'Marc Dubois', status: 'Attente fourniture', startedDaysAgo: 18, hourlyRate: 95 },

    // Devis envoyés
    { name: 'Mobilier sur mesure chambre enfant', client: 'Jean-Claude Périllat', status: 'Devis envoyé', startedDaysAgo: 12, hourlyRate: 100 },
    { name: 'Banquette restaurant 12 places', client: 'Anne Caillot', status: 'Devis envoyé', startedDaysAgo: 8, hourlyRate: 110 },
    { name: 'Façade boutique bois lamellé', client: 'Thomas Henchoz', status: 'Devis envoyé', startedDaysAgo: 6, hourlyRate: 110 },

    // Prospects
    { name: 'Aménagement salle conférence', client: 'Patrick Jaccard', status: 'Prospect', startedDaysAgo: 4, hourlyRate: 115 },
    { name: 'Restauration boiseries XIXe', client: 'Élise Morand', status: 'Prospect', startedDaysAgo: 2, hourlyRate: 120 },
  ];

  const createdProjects = [];
  for (const def of projectDefs) {
    const client = clientByName[def.client];
    const status = statusByName[def.status];
    const proj = await Project.create({
      userId,
      name: def.name,
      status: status._id,
      clientRef: client._id,
      client: {
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company || undefined,
        street: client.street,
        zip: client.zip,
        city: client.city,
        country: 'CH',
      },
      tags: client.company ? ['B2B'] : ['Particulier'],
      createdAt: daysAgo(def.startedDaysAgo),
      updatedAt: daysAgo(Math.max(1, def.startedDaysAgo - 30)),
    });
    createdProjects.push({ project: proj, def });
  }
  console.log(`[seed-demo] ${createdProjects.length} projets créés`);

  // 8. Quotes — un devis par projet "Devis envoyé" / "En cours" / "Livré" / "Facturé"
  // (les "Prospect" et "Attente fourniture" n'ont pas encore de devis ou sont en pause)
  const quoteAmountsByProject = {
    'Cuisine sur mesure chêne massif': 28500,
    'Bibliothèque salon — placage noyer': 7200,
    'Comptoir bar et étagères': 14800,
    'Aménagement bureau direction': 19500,
    'Rénovation portes intérieures': 6400,
    'Lambris hall réception': 11200,
    'Dressing chambre principale': 9800,
    'Agencement boutique pâtisserie': 32000,
    'Escalier hélicoïdal hêtre': 24500,
    'Mobilier sur mesure chambre enfant': 5400,
    'Banquette restaurant 12 places': 8900,
    'Façade boutique bois lamellé': 16700,
  };

  const quotesByProject = {};
  for (const { project, def } of createdProjects) {
    const amount = quoteAmountsByProject[def.name];
    if (!amount) continue;

    let quoteStatus = 'sent';
    if (['Facturé', 'Livré', 'En cours'].includes(def.status)) quoteStatus = 'signed';
    if (def.status === 'Facturé') quoteStatus = 'invoiced';

    const { subtotal, vatAmount, total } = fromTtc(amount);
    const issued = daysAgo(def.startedDaysAgo);
    const validUntil = new Date(issued.getTime() + 60 * 86400000);
    const signedAt = quoteStatus !== 'sent'
      ? new Date(issued.getTime() + 5 * 86400000)
      : null;

    const lines = [
      { description: 'Étude, métré et conception 3D', quantity: 1, unitPrice: round(subtotal * 0.15), discount: 0, total: round(subtotal * 0.15) },
      { description: `Fourniture matériaux (${def.name})`, quantity: 1, unitPrice: round(subtotal * 0.45), discount: 0, total: round(subtotal * 0.45) },
      { description: 'Main d\'œuvre atelier + pose sur site', quantity: 1, unitPrice: round(subtotal * 0.40), discount: 0, total: round(subtotal * 0.40) },
    ];

    const q = await Quote.create({
      project: project._id,
      number: nextQuoteNumber(),
      lines,
      subtotal,
      vatRate: VAT,
      vatAmount,
      total,
      status: quoteStatus,
      issueDate: issued,
      validUntil,
      signedAt,
      invoicedAmount: quoteStatus === 'invoiced' ? total : 0,
      notes: 'Délai d\'exécution : 6 à 8 semaines après signature.',
      createdAt: issued,
    });
    quotesByProject[project._id.toString()] = { quote: q, amount, signedAt };
  }
  console.log(`[seed-demo] ${Object.keys(quotesByProject).length} devis créés`);

  // 9. Invoices — sur ~12 mois, mix paid/sent/overdue
  const invoiceDefs = [];

  // Facturés intégralement (anciens projets)
  for (const { project, def } of createdProjects) {
    if (def.status !== 'Facturé') continue;
    const q = quotesByProject[project._id.toString()];
    if (!q) continue;

    // Acompte 30% + solde 70%
    const issuedAcompte = new Date(q.signedAt.getTime() + 7 * 86400000);
    const issuedSolde = new Date(q.signedAt.getTime() + 60 * 86400000);

    invoiceDefs.push({
      project, daysAgoIssue: Math.round((NOW - issuedAcompte) / 86400000),
      ttc: round(q.amount * 0.30), label: 'Acompte 30%', paidDaysAfter: 12, projectName: def.name,
    });
    invoiceDefs.push({
      project, daysAgoIssue: Math.round((NOW - issuedSolde) / 86400000),
      ttc: round(q.amount * 0.70), label: 'Solde 70%', paidDaysAfter: 18, projectName: def.name,
    });
  }

  // Livrés : facture émise mais pas encore réglée (ou partiel)
  for (const { project, def } of createdProjects) {
    if (def.status !== 'Livré') continue;
    const q = quotesByProject[project._id.toString()];
    if (!q) continue;

    // Acompte payé, solde envoyé non payé
    invoiceDefs.push({
      project, daysAgoIssue: 90,
      ttc: round(q.amount * 0.30), label: 'Acompte 30%', paidDaysAfter: 14, projectName: def.name,
    });
    invoiceDefs.push({
      project, daysAgoIssue: 35,
      ttc: round(q.amount * 0.70), label: 'Solde 70%', paidDaysAfter: null, projectName: def.name,
    });
  }

  // En cours : juste l'acompte payé
  for (const { project, def } of createdProjects) {
    if (def.status !== 'En cours') continue;
    const q = quotesByProject[project._id.toString()];
    if (!q) continue;

    invoiceDefs.push({
      project, daysAgoIssue: Math.max(10, def.startedDaysAgo - 5),
      ttc: round(q.amount * 0.30), label: 'Acompte 30%', paidDaysAfter: 10, projectName: def.name,
    });
  }

  // Quelques factures custom anciennes (interventions ponctuelles, dépannages)
  invoiceDefs.push(
    { project: createdProjects.find((p) => p.def.name === 'Lambris hall réception').project, daysAgoIssue: 200, ttc: 1840, label: 'Intervention ajustement', paidDaysAfter: 22, projectName: 'Intervention' },
    { project: createdProjects.find((p) => p.def.name === 'Aménagement bureau direction').project, daysAgoIssue: 165, ttc: 980, label: 'Réglages portes coulissantes', paidDaysAfter: 8, projectName: 'Intervention' },
    { project: createdProjects.find((p) => p.def.name === 'Comptoir bar et étagères').project, daysAgoIssue: 60, ttc: 2450, label: 'Modification supplémentaire', paidDaysAfter: null, projectName: 'Modification' },
  );

  let createdInvoiceCount = 0;
  for (const def of invoiceDefs) {
    const { subtotal, vatAmount, total } = fromTtc(def.ttc);
    const issueDate = daysAgo(def.daysAgoIssue);
    const dueDate = new Date(issueDate.getTime() + 30 * 86400000);

    let status = 'sent';
    let payments = [];
    let paidAmount = 0;
    let paidAt = null;

    if (def.paidDaysAfter !== null && def.paidDaysAfter !== undefined) {
      status = 'paid';
      paidAmount = total;
      paidAt = new Date(issueDate.getTime() + def.paidDaysAfter * 86400000);
      payments = [{
        amount: total,
        date: paidAt,
        method: 'bank_transfer',
        notes: 'Réception virement bancaire',
      }];
    }

    await Invoice.create({
      project: def.project._id,
      number: nextInvoiceNumber(),
      invoiceType: 'custom',
      customLines: [{
        description: `${def.label} — ${def.projectName}`,
        quantity: 1,
        unitPrice: subtotal,
        discount: 0,
        vatRate: VAT,
        total: subtotal,
      }],
      subtotal,
      vatRate: VAT,
      vatAmount,
      vatBreakdown: [{ rate: VAT, base: subtotal, amount: vatAmount }],
      total,
      status,
      payments,
      paidAmount,
      issueDate,
      dueDate,
      paidAt,
      createdAt: issueDate,
      updatedAt: paidAt || issueDate,
    });
    createdInvoiceCount++;
  }
  console.log(`[seed-demo] ${createdInvoiceCount} factures créées`);

  // 10. Events — heures + dépenses sur projets en cours et récents
  let createdEventCount = 0;
  for (const { project, def } of createdProjects) {
    if (['Prospect', 'Devis envoyé'].includes(def.status)) continue;

    const span = Math.min(def.startedDaysAgo, 90);
    const sessionsPerProject = ['En cours', 'Attente fourniture'].includes(def.status) ? 8 : 5;

    for (let i = 0; i < sessionsPerProject; i++) {
      const dayOffset = Math.floor((span / sessionsPerProject) * i) + 1;
      const date = daysAgo(def.startedDaysAgo - dayOffset);
      const hours = 4 + Math.floor(Math.random() * 5); // 4 à 8h
      await Event.create({
        project: project._id,
        type: 'hours',
        description: ['Atelier — usinage', 'Pose sur site', 'Finitions et vernis', 'Ajustements et livraison', 'Préparation matériaux'][i % 5],
        date,
        hours,
        hourlyRate: def.hourlyRate,
        billed: ['Facturé', 'Livré'].includes(def.status),
      });
      createdEventCount++;
    }

    // 1-2 dépenses par projet récent
    if (['En cours', 'Attente fourniture', 'Livré'].includes(def.status)) {
      await Event.create({
        project: project._id,
        type: 'expense',
        description: 'Achat matériaux (bois + quincaillerie)',
        date: daysAgo(Math.max(2, def.startedDaysAgo - 5)),
        amount: round(300 + Math.random() * 800),
        billed: false,
      });
      createdEventCount++;
    }
  }
  console.log(`[seed-demo] ${createdEventCount} événements créés`);

  // 11. Expenses (notes de frais) — ~12 dépenses sur 6 mois
  const expenseDefs = [
    { daysAgo: 5, employee: 'Patrice Marchand', category: 'vehicle_fuel', amount: 142.50, desc: 'Plein diesel utilitaire' },
    { daysAgo: 8, employee: 'Patrice Marchand', category: 'meal', amount: 38.00, desc: 'Repas chantier Genève' },
    { daysAgo: 14, employee: 'Yves Chappuis', category: 'office_supplies', amount: 89.90, desc: 'Cartouches imprimante atelier' },
    { daysAgo: 22, employee: 'Patrice Marchand', category: 'travel', amount: 165.00, desc: 'Train Lausanne - rendez-vous client' },
    { daysAgo: 30, employee: 'Yves Chappuis', category: 'vehicle_maintenance', amount: 480.00, desc: 'Service annuel utilitaire VW' },
    { daysAgo: 45, employee: 'Patrice Marchand', category: 'meal', amount: 52.40, desc: 'Repas équipe — fin chantier Périllat' },
    { daysAgo: 60, employee: 'Yves Chappuis', category: 'phone_internet', amount: 79.00, desc: 'Forfait Swisscom mensuel' },
    { daysAgo: 75, employee: 'Patrice Marchand', category: 'travel', amount: 220.00, desc: 'Déplacement Zürich - relevé Brunner' },
    { daysAgo: 95, employee: 'Patrice Marchand', category: 'vehicle_fuel', amount: 138.20, desc: 'Plein diesel utilitaire' },
    { daysAgo: 110, employee: 'Yves Chappuis', category: 'office_supplies', amount: 145.00, desc: 'Logiciel sketch-up renouvellement' },
    { daysAgo: 130, employee: 'Patrice Marchand', category: 'meal', amount: 41.00, desc: 'Repas chantier Eaux-Vives' },
    { daysAgo: 160, employee: 'Yves Chappuis', category: 'other', amount: 320.00, desc: 'Salon Bois & Habitat — entrée + déplacement' },
  ];

  for (const e of expenseDefs) {
    const amountTtc = e.amount;
    const amountHt = round(amountTtc / (1 + VAT / 100));
    const amountTva = round(amountTtc - amountHt);
    const date = daysAgo(e.daysAgo);
    const isOld = e.daysAgo > 30;
    await Expense.create({
      userId,
      hubUserId: HUB_USER_ID,
      employeeName: e.employee,
      category: e.category,
      description: e.desc,
      amountTtc,
      amountHt,
      amountTva,
      tvaRate: VAT,
      date,
      status: isOld ? 'reimbursed' : (e.daysAgo > 14 ? 'approved' : 'submitted'),
      submittedAt: date,
      approvedAt: isOld ? new Date(date.getTime() + 7 * 86400000) : null,
      reimbursedAt: isOld ? new Date(date.getTime() + 14 * 86400000) : null,
    });
  }
  console.log(`[seed-demo] ${expenseDefs.length} notes de frais créées`);

  console.log('───────────────────────────────────────────────');
  console.log('[seed-demo] ✅ Seed terminé avec succès');
  console.log(`  hubUserId  : ${HUB_USER_ID}`);
  console.log(`  userId     : ${userId}`);
  console.log(`  email      : ${EMAIL}`);
  console.log(`  Projets    : ${createdProjects.length}`);
  console.log(`  Devis      : ${Object.keys(quotesByProject).length}`);
  console.log(`  Factures   : ${createdInvoiceCount}`);
  console.log(`  Événements : ${createdEventCount}`);
  console.log(`  Dépenses   : ${expenseDefs.length}`);
  console.log('───────────────────────────────────────────────');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed-demo] ❌ Erreur :', err);
  process.exit(1);
});
