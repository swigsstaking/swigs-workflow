import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';

const router = Router();

const APP_SECRET = process.env.APP_SECRET || process.env.LEXA_INTERNAL_SECRET;

function requireAppSecret(req, res, next) {
  const secret = req.headers['x-app-secret'];
  if (!APP_SECRET || secret !== APP_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

/**
 * GET /api/integrations/lexa/export
 * Headers: X-App-Secret, X-Hub-User-Id
 * Returns: { invoices: [...], expenses: [...] }
 * Format compat avec les handlers Lexa bridge
 */
router.get('/export', requireAppSecret, async (req, res) => {
  const hubUserId = req.headers['x-hub-user-id'];
  if (!hubUserId) return res.status(400).json({ error: 'X-Hub-User-Id required' });

  // Trouver le user Pro associé au hubUserId (fallback _id ObjectId direct)
  const User = (await import('../models/User.js')).default;
  let user = await User.findOne({ hubUserId });
  if (!user) {
    // Essayer comme _id direct si hubUserId est un ObjectId valide
    try { user = await User.findById(hubUserId); } catch {}
  }
  if (!user) return res.status(404).json({ error: 'user not found' });

  const [invoices, expenses] = await Promise.all([
    Invoice.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    Expense.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
  ]);

  const invoicesPayload = invoices.map(inv => ({
    invoiceId: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber || inv.number || inv._id.toString().slice(-6),
    projectName: inv.projectName,
    clientName: inv.clientName || inv.client?.name || (typeof inv.client === 'string' ? inv.client : null),
    client: inv.client,
    total: inv.total ?? inv.amountTtc,
    amountHt: inv.amountHt,
    amountTva: inv.amountTva,
    amountTtc: inv.amountTtc ?? inv.total,
    tvaRate: inv.tvaRate ?? 8.1,
    dueDate: inv.dueDate,
    status: inv.status,
    paidAt: inv.paidAt,
    sentAt: inv.sentAt,
    createdAt: inv.createdAt,
  }));

  const expensesPayload = expenses.map(exp => ({
    expenseId: exp._id.toString(),
    description: exp.description || exp.employeeName,
    amount: exp.amountTtc,
    currency: 'CHF',
    date: exp.date?.toISOString().slice(0, 10),
    category: exp.category,
    supplierName: exp.supplierName || exp.employeeName,
    status: exp.status,
    submittedAt: exp.submittedAt,
  }));

  res.json({
    hubUserId,
    invoicesCount: invoicesPayload.length,
    expensesCount: expensesPayload.length,
    invoices: invoicesPayload,
    expenses: expensesPayload,
  });
});

export default router;
