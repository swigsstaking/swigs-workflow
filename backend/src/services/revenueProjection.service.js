import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import RecurringInvoice from '../models/RecurringInvoice.js';

/**
 * Compute average payment days per client (by email) from paid invoices.
 * Returns Map<clientEmail, avgDays>
 */
async function computeClientAvgPaymentDays(userId) {
  const uid = new mongoose.Types.ObjectId(userId);
  const paidInvoices = await Invoice.find({
    project: { $exists: true },
    status: 'paid',
    paidAt: { $exists: true },
    issueDate: { $exists: true },
    documentType: { $ne: 'credit_note' }
  })
    .populate({ path: 'project', select: 'userId client', match: { userId: uid } })
    .select('issueDate paidAt project')
    .lean();

  const clientDays = new Map(); // email → number[]

  for (const inv of paidInvoices) {
    if (!inv.project) continue;
    const email = inv.project.client?.email;
    if (!email) continue;
    const days = Math.floor((new Date(inv.paidAt) - new Date(inv.issueDate)) / (1000 * 60 * 60 * 24));
    if (days < 0) continue;
    if (!clientDays.has(email)) clientDays.set(email, []);
    clientDays.get(email).push(days);
  }

  const avgMap = new Map();
  for (const [email, days] of clientDays) {
    avgMap.set(email, Math.round(days.reduce((a, b) => a + b, 0) / days.length));
  }
  return avgMap;
}

/**
 * Project future revenue over a date range.
 * Sources:
 *  1. Open invoices (sent/partial) — remaining unpaid amount, attributed to
 *     estimated payment month (issueDate + client avg payment days, fallback to dueDate)
 *  2. Active recurring invoices — projected generation amount per future months only
 *     (months before nextGenerationDate are already generated → covered by open invoices)
 * Returns a Map<'YYYY-M', { projectedRevenue, sources[] }>
 */
export async function projectRevenue(userId, startDate, endDate) {
  const uid = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const [openInvoices, recurringInvoices, clientAvgDays] = await Promise.all([
    Invoice.find({
      project: { $exists: true },
      status: { $in: ['sent', 'partial'] },
      documentType: { $ne: 'credit_note' }
    })
      .populate({ path: 'project', select: 'userId client name', match: { userId: uid } })
      .select('number total paidAmount dueDate issueDate status')
      .lean(),
    RecurringInvoice.find({ userId: uid, status: 'active' })
      .populate({ path: 'project', select: 'client name' })
      .select('customLines frequency nextGenerationDate endDate vatRate project')
      .lean(),
    computeClientAvgPaymentDays(userId)
  ]);

  const userInvoices = openInvoices.filter(inv => inv.project?.userId?.toString() === userId.toString());

  const projectionMap = new Map();

  const addEntry = (key, amount, source) => {
    if (!projectionMap.has(key)) {
      projectionMap.set(key, { projectedRevenue: 0, sources: [] });
    }
    const entry = projectionMap.get(key);
    entry.projectedRevenue += amount;
    entry.sources.push(source);
  };

  // 1. Open invoices — remaining amount at estimated payment month
  //    Priority: issueDate + client avg payment days → dueDate → now
  for (const inv of userInvoices) {
    const remaining = inv.total - (inv.paidAmount || 0);
    if (remaining <= 0) continue;

    const clientEmail = inv.project?.client?.email;
    const avgDays = clientEmail ? clientAvgDays.get(clientEmail) : null;

    let targetDate;
    if (avgDays != null && inv.issueDate) {
      // Dynamic: issueDate + average payment days for this client
      targetDate = new Date(inv.issueDate);
      targetDate.setDate(targetDate.getDate() + avgDays);
    } else {
      // Fallback: dueDate
      targetDate = inv.dueDate ? new Date(inv.dueDate) : now;
    }

    // If estimated date is in the past, project to current month
    if (targetDate < now) targetDate = now;
    const key = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`;

    if (targetDate >= startDate && targetDate <= endDate) {
      addEntry(key, remaining, {
        type: 'open_invoice',
        _id: inv._id.toString(),
        number: inv.number,
        remaining: Math.round(remaining * 100) / 100,
        status: inv.status,
        ...(avgDays != null ? { estimatedByAvgDays: avgDays } : {})
      });
    }
  }

  // 2. Recurring invoices — only project months NOT yet generated
  for (const rec of recurringInvoices) {
    const lineTotal = (rec.customLines || []).reduce((sum, l) => {
      const qty = l.quantity || 1;
      const base = qty * (l.unitPrice || 0);
      const disc = l.discountType === 'percentage'
        ? base * ((l.discountValue || 0) / 100)
        : (l.discountValue || 0);
      return sum + (base - disc);
    }, 0);
    const total = lineTotal * (1 + (rec.vatRate || 0) / 100);
    if (total <= 0) continue;

    const clientName = rec.project?.client?.name || '';

    // nextGenerationDate tells us the earliest month that hasn't been generated yet.
    // Any month before it is already covered by open invoices.
    const nextGen = rec.nextGenerationDate ? new Date(rec.nextGenerationDate) : now;
    const nextGenMonthStart = new Date(nextGen.getFullYear(), nextGen.getMonth(), 1);

    let cursor = new Date(Math.max(startDate.getTime(), now.getTime()));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const key = `${y}-${m}`;

      // Only project if this month hasn't been generated yet
      const monthStart = new Date(y, m - 1, 1);
      const isNotYetGenerated = monthStart >= nextGenMonthStart;

      if (isNotYetGenerated && recurringOccursInMonth(rec, y, m)) {
        if (!rec.endDate || new Date(rec.endDate) >= cursor) {
          addEntry(key, Math.round(total * 100) / 100, {
            type: 'recurring_invoice',
            _id: rec._id.toString(),
            clientName,
            projectName: rec.project?.name || '',
            frequency: rec.frequency,
            nextGenerationDate: rec.nextGenerationDate,
            amount: Math.round(total * 100) / 100
          });
        }
      }
      cursor = new Date(y, m, 1);
    }
  }

  return projectionMap;
}

function recurringOccursInMonth(rec, year, month) {
  const freq = rec.frequency;
  if (freq === 'monthly' || freq === 'weekly') return true;

  if (freq === 'quarterly') {
    if (rec.nextGenerationDate) {
      const refMonth = new Date(rec.nextGenerationDate).getMonth() + 1;
      const diff = ((month - refMonth) % 12 + 12) % 12;
      return diff % 3 === 0;
    }
    return [1, 4, 7, 10].includes(month);
  }

  if (freq === 'yearly') {
    if (rec.nextGenerationDate) {
      return new Date(rec.nextGenerationDate).getMonth() + 1 === month;
    }
    return month === 1;
  }

  return false;
}
