import mongoose from 'mongoose';
import BankTransaction from '../models/BankTransaction.js';
import RecurringCharge from '../models/RecurringCharge.js';

/**
 * Detect recurring charges from bank transactions.
 * Groups DBIT transactions by counterpartyName over the last 12 months,
 * then scores each group for recurrence patterns.
 */
export async function detectRecurringCharges(userId) {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Aggregate DBIT transactions grouped by counterpartyName
  const groups = await BankTransaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        creditDebit: 'DBIT',
        bookingDate: { $gte: twelveMonthsAgo },
        counterpartyName: { $ne: null, $nin: ['', null] }
      }
    },
    {
      $group: {
        _id: '$counterpartyName',
        distinctMonths: {
          $addToSet: {
            $dateToString: { format: '%Y-%m', date: '$bookingDate' }
          }
        },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' },
        lastDate: { $max: '$bookingDate' },
        count: { $sum: 1 },
        sampleIds: { $push: '$_id' },
        dates: { $push: '$bookingDate' },
        topCategory: { $first: '$expenseCategory' }
      }
    },
    {
      $addFields: {
        distinctMonthCount: { $size: '$distinctMonths' }
      }
    },
    {
      $match: {
        distinctMonthCount: { $gte: 3 }
      }
    }
  ]);

  // Post-process each group
  const results = [];
  for (const g of groups) {
    const frequency = detectFrequency(g.distinctMonths);
    if (!frequency) continue;

    const confidence = calculateConfidence(g, frequency);
    if (confidence < 20) continue;

    const dayOfMonth = estimateDayOfMonth(g.dates);
    const amountVariance = g.avgAmount > 0
      ? Math.round(((g.maxAmount - g.minAmount) / g.avgAmount) * 100)
      : 0;

    results.push({
      counterpartyName: g._id,
      frequency,
      expectedAmount: Math.round(g.avgAmount * 100) / 100,
      amountVariance: Math.min(amountVariance, 100),
      dayOfMonth,
      lastSeenDate: g.lastDate,
      detectionConfidence: confidence,
      sampleTransactionIds: g.sampleIds.slice(-6),
      expenseCategory: g.topCategory || null,
      count: g.count,
      distinctMonthCount: g.distinctMonthCount
    });
  }

  // Upsert into RecurringCharge — do not overwrite user-confirmed fields
  const upserted = [];
  for (const r of results) {
    const existing = await RecurringCharge.findOne({
      userId,
      counterpartyName: r.counterpartyName
    });

    if (existing) {
      // Update detection fields only — preserve user overrides on confirmed charges
      existing.detectionConfidence = r.detectionConfidence;
      existing.lastSeenDate = r.lastSeenDate;
      existing.sampleTransactionIds = r.sampleTransactionIds;
      if (!existing.isConfirmed) {
        existing.frequency = r.frequency;
        existing.expectedAmount = r.expectedAmount;
        existing.amountVariance = r.amountVariance;
        existing.dayOfMonth = r.dayOfMonth;
        if (r.expenseCategory) existing.expenseCategory = r.expenseCategory;
      }
      await existing.save();
      upserted.push(existing);
    } else {
      const charge = await RecurringCharge.create({
        userId,
        counterpartyName: r.counterpartyName,
        frequency: r.frequency,
        expectedAmount: r.expectedAmount,
        amountVariance: r.amountVariance,
        dayOfMonth: r.dayOfMonth,
        lastSeenDate: r.lastSeenDate,
        detectionConfidence: r.detectionConfidence,
        sampleTransactionIds: r.sampleTransactionIds,
        expenseCategory: r.expenseCategory
      });
      upserted.push(charge);
    }
  }

  return upserted;
}

/**
 * Detect frequency from a sorted list of YYYY-MM strings.
 * Returns 'monthly', 'quarterly', 'yearly', or null.
 */
function detectFrequency(distinctMonths) {
  if (distinctMonths.length < 3) return null;

  const sorted = [...distinctMonths].sort();
  const intervals = [];

  for (let i = 1; i < sorted.length; i++) {
    const [y1, m1] = sorted[i - 1].split('-').map(Number);
    const [y2, m2] = sorted[i].split('-').map(Number);
    const diff = (y2 - y1) * 12 + (m2 - m1);
    intervals.push(diff);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  if (avgInterval < 1.5) return 'monthly';
  if (avgInterval >= 2.5 && avgInterval <= 4) return 'quarterly';
  if (avgInterval >= 10 && avgInterval <= 14) return 'yearly';

  // If most intervals are ~1, treat as monthly even with gaps
  const monthlyCount = intervals.filter(i => i <= 2).length;
  if (monthlyCount / intervals.length >= 0.6) return 'monthly';

  return null;
}

/**
 * Calculate confidence score 0–100 based on:
 * - Number of distinct months (40pts max)
 * - Amount stability (30pts max)
 * - Recency (20pts max)
 * - Total occurrences (10pts max)
 */
function calculateConfidence(group, frequency) {
  let score = 0;

  // 1) Number of distinct months — max 40pts
  const expectedMonths = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
  const monthRatio = Math.min(group.distinctMonthCount / expectedMonths, 1);
  score += Math.round(monthRatio * 40);

  // 2) Amount stability — max 30pts
  if (group.avgAmount > 0) {
    const variance = (group.maxAmount - group.minAmount) / group.avgAmount;
    const stability = Math.max(0, 1 - variance);
    score += Math.round(stability * 30);
  }

  // 3) Recency — max 20pts (last seen within 45 days = full points)
  const daysSinceLast = Math.floor((new Date() - new Date(group.lastDate)) / (1000 * 60 * 60 * 24));
  if (daysSinceLast <= 45) score += 20;
  else if (daysSinceLast <= 90) score += 10;
  else if (daysSinceLast <= 180) score += 5;

  // 4) Total occurrences — max 10pts
  score += Math.min(group.count, 10);

  return Math.min(score, 100);
}

/**
 * Estimate the most common day of month from a list of dates.
 */
function estimateDayOfMonth(dates) {
  const dayCounts = {};
  for (const d of dates) {
    const day = new Date(d).getDate();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  let maxDay = 1;
  let maxCount = 0;
  for (const [day, count] of Object.entries(dayCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxDay = parseInt(day);
    }
  }
  return maxDay;
}
