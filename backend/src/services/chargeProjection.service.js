import mongoose from 'mongoose';
import RecurringCharge from '../models/RecurringCharge.js';
import BankTransaction from '../models/BankTransaction.js';

/**
 * Project recurring charges over a date range.
 * For the current month, checks which charges have already been paid.
 * Returns a Map<'YYYY-M', { projectedExpenses, charges[] }>
 */
export async function projectCharges(userId, startDate, endDate) {
  const charges = await RecurringCharge.find({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true
  }).lean();

  if (charges.length === 0) return new Map();

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // For the current month, find which counterparties already have a DBIT this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const paidThisMonth = await BankTransaction.distinct('counterpartyName', {
    userId: new mongoose.Types.ObjectId(userId),
    creditDebit: 'DBIT',
    bookingDate: { $gte: monthStart, $lte: monthEnd },
    counterpartyName: { $in: charges.map(c => c.counterpartyName) }
  });

  const paidSet = new Set(paidThisMonth);

  // Build projection map
  const projectionMap = new Map();

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Iterate month by month
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${m}`;

    // Only project current month (unpaid) and future months
    const isCurrentMonth = key === currentKey;
    const isFutureMonth = cursor > monthEnd;

    if (isCurrentMonth || isFutureMonth) {
      for (const charge of charges) {
        const shouldInclude = chargeOccursInMonth(charge, y, m);
        if (!shouldInclude) continue;

        // Skip if already paid this month
        if (isCurrentMonth && paidSet.has(charge.counterpartyName)) continue;

        if (!projectionMap.has(key)) {
          projectionMap.set(key, { projectedExpenses: 0, charges: [] });
        }
        const entry = projectionMap.get(key);
        entry.projectedExpenses += charge.expectedAmount;
        entry.charges.push({
          _id: charge._id,
          counterpartyName: charge.counterpartyName,
          expectedAmount: charge.expectedAmount,
          frequency: charge.frequency,
          isConfirmed: charge.isConfirmed
        });
      }
    }

    // Advance to next month
    cursor = new Date(y, m, 1);
  }

  return projectionMap;
}

/**
 * Determine if a charge occurs in a given month based on its frequency.
 */
function chargeOccursInMonth(charge, year, month) {
  if (charge.frequency === 'monthly') return true;

  if (charge.frequency === 'quarterly') {
    // Estimate which months the charge occurs based on lastSeenDate
    if (charge.lastSeenDate) {
      const lastMonth = new Date(charge.lastSeenDate).getMonth() + 1;
      // Check if (month - lastMonth) is a multiple of 3
      const diff = ((month - lastMonth) % 12 + 12) % 12;
      return diff % 3 === 0;
    }
    // Fallback: standard quarters
    return [1, 4, 7, 10].includes(month);
  }

  if (charge.frequency === 'yearly') {
    if (charge.lastSeenDate) {
      return new Date(charge.lastSeenDate).getMonth() + 1 === month;
    }
    return month === 1;
  }

  return false;
}
