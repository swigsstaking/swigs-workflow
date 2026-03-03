import CounterpartyRule from '../models/CounterpartyRule.js';

/**
 * Classify a DBIT transaction using counterparty rules.
 * Returns { expenseCategory, autoClassified } or null if no rule found.
 */
export async function classifyTransaction(tx, userId) {
  if (!tx.counterpartyName || tx.creditDebit !== 'DBIT') return null;

  // Exact match on counterpartyName
  const rule = await CounterpartyRule.findOne({
    userId,
    counterpartyName: tx.counterpartyName
  });

  if (rule) {
    // Increment match count (non-blocking)
    CounterpartyRule.updateOne(
      { _id: rule._id },
      { $inc: { matchCount: 1 } }
    ).catch(() => {});

    return {
      expenseCategory: rule.expenseCategory,
      autoClassified: true
    };
  }

  return null;
}

/**
 * Classify multiple transactions in bulk.
 * Returns a Map of txId → classification result.
 */
export async function classifyBulk(transactions, userId) {
  const dbitTxs = transactions.filter(tx => tx.creditDebit === 'DBIT' && tx.counterpartyName);
  if (dbitTxs.length === 0) return new Map();

  // Fetch all rules for this user at once
  const rules = await CounterpartyRule.find({ userId }).lean();
  const ruleMap = new Map();
  for (const rule of rules) {
    ruleMap.set(rule.counterpartyName, rule);
  }

  const results = new Map();
  const matchIncrements = [];

  for (const tx of dbitTxs) {
    const rule = ruleMap.get(tx.counterpartyName);
    if (rule) {
      results.set(tx.txId || tx._id?.toString(), {
        expenseCategory: rule.expenseCategory,
        autoClassified: true
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
