import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Project from '../models/Project.js';
import BankTransaction from '../models/BankTransaction.js';

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

  // Invoices Pro sont liées via Project (pas userId direct).
  const projects = await Project.find({ userId: user._id }, { _id: 1, name: 1, client: 1 }).lean();
  const projectIds = projects.map(p => p._id);
  const projectMap = new Map(projects.map(p => [p._id.toString(), p]));

  const [invoices, expenses, bankTxs] = await Promise.all([
    projectIds.length
      ? Invoice.find({ project: { $in: projectIds } }).sort({ createdAt: -1 }).lean()
      : Promise.resolve([]),
    Expense.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    BankTransaction.find({ userId: user._id }).sort({ bookingDate: -1 }).lean(),
  ]);

  const invoicesPayload = invoices.map(inv => {
    const proj = inv.project ? projectMap.get(inv.project.toString()) : null;
    const client = proj?.client;
    return {
      invoiceId: inv._id.toString(),
      invoiceNumber: inv.invoiceNumber || inv.number || inv._id.toString().slice(-6),
      projectName: proj?.name,
      clientName: typeof client === 'string' ? client : (client?.name ?? null),
      client,
      total: inv.total ?? inv.amountTtc,
      amountHt: inv.subtotal ?? inv.amountHt,
      amountTva: inv.vatAmount ?? inv.amountTva,
      amountTtc: inv.total ?? inv.amountTtc,
      tvaRate: inv.vatRate ?? inv.tvaRate ?? 8.1,
      dueDate: inv.dueDate,
      status: inv.status,
      paidAt: inv.paidAt,
      sentAt: inv.sentAt,
      createdAt: inv.createdAt,
    };
  });

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

  const bankTransactionsPayload = bankTxs.map(tx => {
    const isCredit = tx.creditDebit === 'CRDT' || tx.creditDebit === 'CREDIT';
    const signedAmount = isCredit ? Number(tx.amount) : -Number(tx.amount);
    const desc = [tx.counterpartyName, tx.reference || tx.unstructuredReference].filter(Boolean).join(' — ') || 'Transaction bancaire';
    return {
      bankTxId: tx._id.toString(),
      date: tx.bookingDate?.toISOString().slice(0, 10),
      amount: signedAmount,
      currency: tx.currency || 'CHF',
      description: desc,
      counterpartyName: tx.counterpartyName,
      iban: tx.counterpartyIban,
      bankRef: tx.reference || tx.unstructuredReference,
    };
  });

  res.json({
    hubUserId,
    invoicesCount: invoicesPayload.length,
    expensesCount: expensesPayload.length,
    bankTransactionsCount: bankTransactionsPayload.length,
    invoices: invoicesPayload,
    expenses: expensesPayload,
    bankTransactions: bankTransactionsPayload,
  });
});

export default router;
