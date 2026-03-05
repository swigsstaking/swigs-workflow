import CounterpartyRule from '../models/CounterpartyRule.js';
import ExpenseCategory from '../models/ExpenseCategory.js';

/**
 * Calculate VAT amount from TTC amount and VAT rate.
 * Formula: vatAmount = amount * vatRate / (100 + vatRate)
 */
export function calcVatFromTTC(amount, vatRate) {
  if (!vatRate || vatRate <= 0) return 0;
  return Math.round((amount * vatRate / (100 + vatRate)) * 100) / 100;
}

/**
 * Classify a DBIT transaction using counterparty rules.
 * Returns { expenseCategory, autoClassified, vatRate, vatAmount } or null if no rule found.
 */
export async function classifyTransaction(tx, userId) {
  if (!tx.counterpartyName || tx.creditDebit !== 'DBIT') return null;

  // Exact match on counterpartyName
  const rule = await CounterpartyRule.findOne({
    userId,
    counterpartyName: tx.counterpartyName
  }).lean();

  if (rule) {
    // Increment match count (non-blocking)
    CounterpartyRule.updateOne(
      { _id: rule._id },
      { $inc: { matchCount: 1 } }
    ).catch(() => {});

    // Fetch the category to get its vatRate
    let vatRate = 8.1; // default Swiss standard rate
    if (rule.expenseCategory) {
      const cat = await ExpenseCategory.findById(rule.expenseCategory).select('vatRate').lean();
      if (cat && cat.vatRate !== undefined) vatRate = cat.vatRate;
    }

    return {
      expenseCategory: rule.expenseCategory,
      autoClassified: true,
      vatRate,
      vatAmount: calcVatFromTTC(tx.amount, vatRate)
    };
  }

  return null;
}

/**
 * Classify multiple transactions in bulk.
 * Returns a Map of txId → classification result (with vatRate/vatAmount).
 */
export async function classifyBulk(transactions, userId) {
  const dbitTxs = transactions.filter(tx => tx.creditDebit === 'DBIT' && tx.counterpartyName);
  if (dbitTxs.length === 0) return new Map();

  // Fetch all rules and categories for this user at once
  const [rules, categories] = await Promise.all([
    CounterpartyRule.find({ userId }).lean(),
    ExpenseCategory.find({ userId }).select('_id vatRate').lean()
  ]);

  const ruleMap = new Map();
  for (const rule of rules) {
    ruleMap.set(rule.counterpartyName, rule);
  }

  const catVatMap = new Map();
  for (const cat of categories) {
    catVatMap.set(cat._id.toString(), cat.vatRate ?? 8.1);
  }

  const results = new Map();
  const matchIncrements = [];

  for (const tx of dbitTxs) {
    const rule = ruleMap.get(tx.counterpartyName);
    if (rule) {
      const vatRate = rule.expenseCategory ? (catVatMap.get(rule.expenseCategory.toString()) ?? 8.1) : 8.1;
      results.set(tx.txId || tx._id?.toString(), {
        expenseCategory: rule.expenseCategory,
        autoClassified: true,
        vatRate,
        vatAmount: calcVatFromTTC(tx.amount, vatRate)
      });
      matchIncrements.push(rule._id);
    }
  }

  // Bulk increment match counts
  if (matchIncrements.length > 0) {
    const countMap = {};
    for (const id of matchIncrements) {
      const key = id.toString();
      countMap[key] = (countMap[key] || 0) + 1;
    }

    const ops = Object.entries(countMap).map(([id, count]) => ({
      updateOne: {
        filter: { _id: id },
        update: { $inc: { matchCount: count } }
      }
    }));

    CounterpartyRule.bulkWrite(ops).catch(() => {});
  }

  return results;
}
