/**
 * Seed realistic DBIT + CRDT test data for Comptabilité page testing.
 * Creates BankImport + BankTransaction entries for the SWIGS Demo account.
 *
 * Usage: node backend/scripts/seed-compta-test-data.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import BankTransaction from '../src/models/BankTransaction.js';
import BankImport from '../src/models/BankImport.js';
import ExpenseCategory from '../src/models/ExpenseCategory.js';

function calcVatFromTTC(amount, vatRate) {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round((amount * vatRate / (100 + vatRate)) * 100) / 100;
}

// SWIGS Demo user
const DEMO_USER_ID = new mongoose.Types.ObjectId('699e9e3226991ad82f88ea27');

// Realistic Swiss expense transactions
const EXPENSE_TEMPLATES = [
  // Infrastructure
  { counterpartyName: 'INFOMANIAK NETWORK SA', category: 'Infrastructure', amounts: [29.00, 29.00, 29.00], frequency: 'monthly', iban: 'CH1234567890123456789' },
  { counterpartyName: 'HETZNER ONLINE GMBH', category: 'Infrastructure', amounts: [49.90, 52.30, 49.90], frequency: 'monthly', iban: 'DE89370400440532013000' },
  { counterpartyName: 'GOOGLE CLOUD SWITZERLAND', category: 'Infrastructure', amounts: [85.40, 92.10, 78.60], frequency: 'monthly' },

  // Matériel de bureau
  { counterpartyName: 'DIGITEC GALAXUS AG', category: 'Matériel de bureau', amounts: [459.00], frequency: 'once', monthOffset: -2 },
  { counterpartyName: 'BRACK.CH AG', category: 'Matériel de bureau', amounts: [129.90], frequency: 'once', monthOffset: -5 },
  { counterpartyName: 'OFFICE WORLD AG', category: 'Matériel de bureau', amounts: [67.80, 34.50], frequency: 'quarterly' },

  // Marketing & Publicité
  { counterpartyName: 'META PLATFORMS IRELAND', category: 'Marketing & Publicité', amounts: [250.00, 310.00, 280.00, 350.00], frequency: 'monthly' },
  { counterpartyName: 'GOOGLE ADS', category: 'Marketing & Publicité', amounts: [180.00, 220.00, 195.00], frequency: 'monthly' },
  { counterpartyName: 'VISTAPRINT BV', category: 'Marketing & Publicité', amounts: [189.00], frequency: 'once', monthOffset: -4 },

  // Formation
  { counterpartyName: 'UDEMY INC', category: 'Formation', amounts: [19.99, 24.99], frequency: 'quarterly' },
  { counterpartyName: 'OPENAI LLC', category: 'Formation', amounts: [20.00, 20.00, 20.00], frequency: 'monthly' },

  // Représentation & Déplacement
  { counterpartyName: 'SBB CFF FFS', category: 'Représentation & Déplacement', amounts: [45.00, 87.60, 32.40, 67.80, 45.00], frequency: 'bimonthly' },
  { counterpartyName: 'HOTEL ALPINA ZERMATT', category: 'Représentation & Déplacement', amounts: [285.00], frequency: 'once', monthOffset: -3 },
  { counterpartyName: 'RESTAURANT LE MAZOT', category: 'Représentation & Déplacement', amounts: [124.50, 89.00, 156.00], frequency: 'quarterly' },

  // Assurances (TVA 0%)
  { counterpartyName: 'HELVETIA ASSURANCES SA', category: 'Assurances', amounts: [345.00, 345.00, 345.00, 345.00], frequency: 'quarterly' },
  { counterpartyName: 'AXA ASSURANCES SA', category: 'Assurances', amounts: [128.50, 128.50], frequency: 'semiannual' },

  // Télécommunication
  { counterpartyName: 'SWISSCOM (SCHWEIZ) AG', category: 'Télécommunication', amounts: [79.00, 79.00, 79.00], frequency: 'monthly' },
  { counterpartyName: 'SALT MOBILE SA', category: 'Télécommunication', amounts: [49.95, 49.95, 49.95], frequency: 'monthly' },

  // Honoraires externes
  { counterpartyName: 'FIDUCIAIRE ROTH & CIE', category: 'Honoraires externes', amounts: [450.00], frequency: 'quarterly' },
  { counterpartyName: 'CABINET JURIDIQUE VALAIS', category: 'Honoraires externes', amounts: [850.00], frequency: 'once', monthOffset: -1 },

  // Divers
  { counterpartyName: 'POSTE CH SA', category: 'Divers', amounts: [12.50, 8.90, 15.60], frequency: 'bimonthly' },
  { counterpartyName: 'MIGROS GENOSSENSCHAFT', category: 'Divers', amounts: [23.40, 18.70, 31.20, 42.90], frequency: 'monthly' },

  // Some UNCATEGORIZED expenses (no category)
  { counterpartyName: 'PAYPAL EUROPE SARL', category: null, amounts: [34.50, 67.80, 22.10], frequency: 'bimonthly' },
  { counterpartyName: 'AMAZON EU SARL', category: null, amounts: [78.90, 45.30, 123.40], frequency: 'quarterly' },
  { counterpartyName: 'TRANSFERT INTERNE', category: null, amounts: [500.00, 1000.00], frequency: 'once', monthOffset: -6 },
];

// CRDT (income) transactions — to complement existing invoices
const INCOME_TEMPLATES = [
  { counterpartyName: 'ZUFFEREY & FILS SA', amounts: [4500.00], frequency: 'once', monthOffset: -1, ref: 'FAC-2026-001' },
  { counterpartyName: 'HOTEL D\'EVOLENE', amounts: [3800.00], frequency: 'once', monthOffset: -2, ref: 'FAC-2026-002' },
  { counterpartyName: 'CAVE DU TUNNEL SARL', amounts: [2200.00], frequency: 'once', monthOffset: 0, ref: 'FAC-2026-003' },
  { counterpartyName: 'FROMAGERIE DE BAGNES', amounts: [1500.00, 1800.00], frequency: 'quarterly', ref: 'VIREMENT' },
  { counterpartyName: 'HOTEL & SPA NENDAZ', amounts: [3200.00], frequency: 'once', monthOffset: -1, ref: 'FAC-2026-005' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Check existing data
  const existingCount = await BankTransaction.countDocuments({ userId: DEMO_USER_ID });
  if (existingCount > 0) {
    console.log(`Demo user already has ${existingCount} transactions. Cleaning up...`);
    await BankTransaction.deleteMany({ userId: DEMO_USER_ID, importId: /^SEED-/ });
    await BankImport.deleteMany({ userId: DEMO_USER_ID, importId: /^SEED-/ });
  }

  // Load categories
  const categories = await ExpenseCategory.find({ userId: DEMO_USER_ID }).lean();
  const catMap = new Map();
  for (const cat of categories) {
    catMap.set(cat.name, cat);
  }
  console.log(`Loaded ${categories.length} expense categories`);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Generate transactions
  const transactions = [];
  const importId = `SEED-${Date.now()}`;

  // Helper: generate dates based on frequency
  function generateDates(template) {
    const dates = [];
    const { frequency, monthOffset, amounts } = template;

    if (frequency === 'once') {
      const offset = monthOffset || 0;
      const d = new Date(currentYear, currentMonth + offset, 5 + Math.floor(Math.random() * 20));
      dates.push({ date: d, amount: amounts[0] });
    } else if (frequency === 'monthly') {
      // Last 12 months, cycling through amounts
      for (let i = 11; i >= 0; i--) {
        const m = currentMonth - i;
        const d = new Date(currentYear, m, 1 + Math.floor(Math.random() * 25));
        if (d <= now) {
          dates.push({ date: d, amount: amounts[i % amounts.length] });
        }
      }
    } else if (frequency === 'bimonthly') {
      for (let i = 10; i >= 0; i -= 2) {
        const m = currentMonth - i;
        const d = new Date(currentYear, m, 3 + Math.floor(Math.random() * 22));
        if (d <= now) {
          dates.push({ date: d, amount: amounts[(i / 2) % amounts.length] });
        }
      }
    } else if (frequency === 'quarterly') {
      for (let q = 0; q < 4; q++) {
        const m = q * 3; // Jan, Apr, Jul, Oct
        const d = new Date(currentYear, m, 10 + Math.floor(Math.random() * 15));
        if (d <= now && q < amounts.length) {
          dates.push({ date: d, amount: amounts[q] });
        }
      }
    } else if (frequency === 'semiannual') {
      for (let s = 0; s < 2; s++) {
        const m = s * 6; // Jan, Jul
        const d = new Date(currentYear, m, 15);
        if (d <= now && s < amounts.length) {
          dates.push({ date: d, amount: amounts[s] });
        }
      }
    }

    return dates;
  }

  // Generate DBIT transactions
  for (const template of EXPENSE_TEMPLATES) {
    const entries = generateDates(template);
    const cat = template.category ? catMap.get(template.category) : null;

    for (const entry of entries) {
      const vatRate = cat ? (cat.vatRate ?? 8.1) : 0;
      const vatAmount = cat ? calcVatFromTTC(entry.amount, vatRate) : 0;

      transactions.push({
        importId,
        importFilename: 'seed-compta-test.xml',
        txId: crypto.randomUUID(),
        bookingDate: entry.date,
        amount: entry.amount,
        currency: 'CHF',
        creditDebit: 'DBIT',
        counterpartyName: template.counterpartyName,
        counterpartyIban: template.iban || null,
        reference: '',
        matchStatus: 'ignored', // DBIT are typically ignored for invoice matching
        expenseCategory: cat ? cat._id : null,
        autoClassified: !!cat,
        vatRate: cat ? vatRate : undefined,
        vatAmount: cat ? vatAmount : undefined,
        userId: DEMO_USER_ID
      });
    }
  }

  // Generate CRDT transactions
  for (const template of INCOME_TEMPLATES) {
    const entries = generateDates(template);
    for (const entry of entries) {
      transactions.push({
        importId,
        importFilename: 'seed-compta-test.xml',
        txId: crypto.randomUUID(),
        bookingDate: entry.date,
        amount: entry.amount,
        currency: 'CHF',
        creditDebit: 'CRDT',
        counterpartyName: template.counterpartyName,
        reference: template.ref || '',
        matchStatus: 'unmatched',
        userId: DEMO_USER_ID
      });
    }
  }

  // Sort by date
  transactions.sort((a, b) => a.bookingDate - b.bookingDate);

  console.log(`\nGenerated ${transactions.length} transactions:`);
  const dbitCount = transactions.filter(t => t.creditDebit === 'DBIT').length;
  const crdtCount = transactions.filter(t => t.creditDebit === 'CRDT').length;
  const categorized = transactions.filter(t => t.expenseCategory).length;
  const uncategorized = transactions.filter(t => t.creditDebit === 'DBIT' && !t.expenseCategory).length;
  console.log(`  DBIT (dépenses): ${dbitCount}`);
  console.log(`  CRDT (revenus): ${crdtCount}`);
  console.log(`  Catégorisées: ${categorized}`);
  console.log(`  Non catégorisées: ${uncategorized}`);

  // Calculate totals
  const totalDBIT = transactions.filter(t => t.creditDebit === 'DBIT').reduce((s, t) => s + t.amount, 0);
  const totalVAT = transactions.filter(t => t.vatAmount).reduce((s, t) => s + t.vatAmount, 0);
  console.log(`\n  Total dépenses: ${totalDBIT.toFixed(2)} CHF`);
  console.log(`  TVA déductible totale: ${totalVAT.toFixed(2)} CHF`);

  // Create import record
  await BankImport.create({
    importId,
    filename: 'seed-compta-test.xml',
    fileType: 'camt.053',
    totalTransactions: transactions.length,
    matchedCount: 0,
    suggestedCount: 0,
    unmatchedCount: transactions.length,
    statementIban: 'CH93 0076 2011 6238 5295 7',
    statementOpeningBalance: 45000.00,
    statementClosingBalance: 45000.00 - totalDBIT,
    statementDate: now,
    userId: DEMO_USER_ID
  });

  // Insert transactions
  const result = await BankTransaction.insertMany(transactions);
  console.log(`\nInserted ${result.length} transactions`);

  // Summary by category
  console.log('\nPar catégorie:');
  const byCat = {};
  for (const tx of transactions.filter(t => t.creditDebit === 'DBIT')) {
    const catName = tx.expenseCategory ? (catMap.get([...catMap.entries()].find(([, v]) => v._id.equals(tx.expenseCategory))?.[0])?.name || '???') : 'Non catégorisé';
    byCat[catName] = (byCat[catName] || 0) + tx.amount;
  }
  for (const [name, total] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${total.toFixed(2)} CHF`);
  }

  // Summary by month
  console.log('\nPar mois:');
  const byMonth = {};
  for (const tx of transactions.filter(t => t.creditDebit === 'DBIT')) {
    const key = `${tx.bookingDate.getFullYear()}-${String(tx.bookingDate.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + tx.amount;
  }
  for (const [month, total] of Object.entries(byMonth).sort()) {
    console.log(`  ${month}: ${total.toFixed(2)} CHF`);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
