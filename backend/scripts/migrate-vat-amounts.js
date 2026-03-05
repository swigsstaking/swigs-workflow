/**
 * Migration: Recalculate vatAmount on existing DBIT transactions
 * that have an expenseCategory but no vatAmount.
 *
 * Usage: node backend/scripts/migrate-vat-amounts.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import BankTransaction from '../src/models/BankTransaction.js';
import ExpenseCategory from '../src/models/ExpenseCategory.js';

function calcVatFromTTC(amount, vatRate) {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round((amount * vatRate / (100 + vatRate)) * 100) / 100;
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find all DBIT transactions with expenseCategory but no vatAmount
  const txs = await BankTransaction.find({
    creditDebit: 'DBIT',
    expenseCategory: { $ne: null },
    $or: [{ vatAmount: null }, { vatAmount: { $exists: false } }, { vatAmount: 0 }]
  }).lean();

  console.log(`Found ${txs.length} DBIT transactions to update`);

  if (txs.length === 0) {
    console.log('Nothing to migrate');
    await mongoose.disconnect();
    return;
  }

  // Fetch all categories
  const categories = await ExpenseCategory.find({}).select('_id vatRate').lean();
  const catMap = new Map();
  for (const cat of categories) {
    catMap.set(cat._id.toString(), cat.vatRate ?? 8.1);
  }

  const ops = [];
  for (const tx of txs) {
    const vatRate = tx.expenseCategory ? (catMap.get(tx.expenseCategory.toString()) ?? 8.1) : 8.1;
    const vatAmount = calcVatFromTTC(tx.amount, vatRate);
    ops.push({
      updateOne: {
        filter: { _id: tx._id },
        update: { $set: { vatRate, vatAmount } }
      }
    });
  }

  if (ops.length > 0) {
    const result = await BankTransaction.bulkWrite(ops);
    console.log(`Updated ${result.modifiedCount} transactions with VAT amounts`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
