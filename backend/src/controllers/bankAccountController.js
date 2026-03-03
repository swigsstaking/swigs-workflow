import BankAccount from '../models/BankAccount.js';

/**
 * GET /api/bank-accounts
 */
export const getAll = async (req, res, next) => {
  try {
    const accounts = await BankAccount.find({ userId: req.user._id })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank-accounts
 */
export const create = async (req, res, next) => {
  try {
    const { name, iban, qrIban, bankName, currency, isDefault, color } = req.body;

    if (!name || !iban) {
      return res.status(400).json({ success: false, error: 'Nom et IBAN requis' });
    }

    const account = await BankAccount.create({
      name,
      iban: iban.replace(/\s/g, '').toUpperCase(),
      qrIban: qrIban?.replace(/\s/g, '').toUpperCase() || undefined,
      bankName,
      currency: currency || 'CHF',
      isDefault: isDefault || false,
      color: color || '#6366f1',
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: account });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Ce compte bancaire (IBAN) existe déjà' });
    }
    next(error);
  }
};

/**
 * PUT /api/bank-accounts/:id
 */
export const update = async (req, res, next) => {
  try {
    const account = await BankAccount.findOne({ _id: req.params.id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Compte non trouvé' });
    }

    const { name, iban, qrIban, bankName, currency, color } = req.body;
    if (name) account.name = name;
    if (iban) account.iban = iban.replace(/\s/g, '').toUpperCase();
    if (qrIban !== undefined) account.qrIban = qrIban?.replace(/\s/g, '').toUpperCase() || undefined;
    if (bankName !== undefined) account.bankName = bankName;
    if (currency) account.currency = currency;
    if (color) account.color = color;

    await account.save();
    res.json({ success: true, data: account });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Ce compte bancaire (IBAN) existe déjà' });
    }
    next(error);
  }
};

/**
 * DELETE /api/bank-accounts/:id
 */
export const remove = async (req, res, next) => {
  try {
    const account = await BankAccount.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Compte non trouvé' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bank-accounts/:id/default
 */
export const setDefault = async (req, res, next) => {
  try {
    const account = await BankAccount.findOne({ _id: req.params.id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Compte non trouvé' });
    }

    account.isDefault = true;
    await account.save(); // pre-save hook clears other defaults

    res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};
