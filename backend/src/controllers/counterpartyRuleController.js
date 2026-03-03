import CounterpartyRule from '../models/CounterpartyRule.js';
import BankTransaction from '../models/BankTransaction.js';

/**
 * GET /api/counterparty-rules
 */
export const getAll = async (req, res, next) => {
  try {
    const rules = await CounterpartyRule.find({ userId: req.user._id })
      .populate('expenseCategory', 'name icon color accountNumber')
      .sort({ matchCount: -1 })
      .lean();
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/counterparty-rules
 */
export const create = async (req, res, next) => {
  try {
    const { counterpartyName, counterpartyIban, expenseCategory, alias } = req.body;

    if (!counterpartyName || !expenseCategory) {
      return res.status(400).json({ success: false, error: 'counterpartyName et expenseCategory requis' });
    }

    const rule = await CounterpartyRule.create({
      counterpartyName,
      counterpartyIban,
      expenseCategory,
      alias,
      userId: req.user._id
    });

    const populated = await rule.populate('expenseCategory', 'name icon color accountNumber');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Une règle existe déjà pour cette contrepartie' });
    }
    next(error);
  }
};

/**
 * PUT /api/counterparty-rules/:id
 */
export const update = async (req, res, next) => {
  try {
    const rule = await CounterpartyRule.findOne({ _id: req.params.id, userId: req.user._id });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Règle non trouvée' });
    }

    const { counterpartyName, counterpartyIban, expenseCategory, alias } = req.body;
    if (counterpartyName) rule.counterpartyName = counterpartyName;
    if (counterpartyIban !== undefined) rule.counterpartyIban = counterpartyIban;
    if (expenseCategory) rule.expenseCategory = expenseCategory;
    if (alias !== undefined) rule.alias = alias;

    await rule.save();
    const populated = await rule.populate('expenseCategory', 'name icon color accountNumber');
    res.json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Une règle existe déjà pour cette contrepartie' });
    }
    next(error);
  }
};

/**
 * DELETE /api/counterparty-rules/:id
 */
export const remove = async (req, res, next) => {
  try {
    const rule = await CounterpartyRule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Règle non trouvée' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/counterparty-rules/suggestions
 * Returns unique DBIT counterparties without a classification rule
 */
export const getSuggestions = async (req, res, next) => {
  try {
    // Get all existing rules for this user
    const existingRules = await CounterpartyRule.find({ userId: req.user._id })
      .select('counterpartyName')
      .lean();
    const ruleNames = new Set(existingRules.map(r => r.counterpartyName));

    // Aggregate DBIT transactions without existing rules
    const suggestions = await BankTransaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          creditDebit: 'DBIT',
          counterpartyName: { $ne: null, $nin: [...ruleNames] }
        }
      },
      {
        $group: {
          _id: '$counterpartyName',
          counterpartyIban: { $first: '$counterpartyIban' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          lastDate: { $max: '$bookingDate' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          counterpartyName: '$_id',
          counterpartyIban: 1,
          totalAmount: 1,
          count: 1,
          lastDate: 1
        }
      }
    ]);

    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/counterparty-rules/bulk
 * Create multiple rules at once
 */
export const bulkCreate = async (req, res, next) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ success: false, error: 'rules requis (array non vide)' });
    }

    const docs = rules.map(r => ({
      counterpartyName: r.counterpartyName,
      counterpartyIban: r.counterpartyIban,
      expenseCategory: r.expenseCategory,
      alias: r.alias,
      userId: req.user._id
    }));

    const created = await CounterpartyRule.insertMany(docs, { ordered: false }).catch(err => {
      // Return successfully inserted docs even if some are duplicates
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });

    res.status(201).json({ success: true, data: { created: created.length } });
  } catch (error) {
    next(error);
  }
};
