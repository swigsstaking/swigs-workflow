import Automation from '../models/Automation.js';
import AutomationRun from '../models/AutomationRun.js';

/**
 * Detect cycles in node graph using DFS
 */
const hasCycle = (nodes) => {
  const adjacency = {};
  for (const node of nodes) {
    adjacency[node.id] = (node.connections || []).map(c =>
      typeof c === 'string' ? c : c.targetId
    );
  }

  const visited = new Set();
  const inStack = new Set();

  const dfs = (nodeId) => {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of (adjacency[nodeId] || [])) {
      if (dfs(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (dfs(node.id)) return true;
  }
  return false;
};

// @desc    Get all automations
// @route   GET /api/automations
export const getAutomations = async (req, res, next) => {
  try {
    const query = req.user?._id ? { userId: req.user._id } : {};
    const automations = await Automation.find(query).sort('-updatedAt');

    res.json({ success: true, data: automations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single automation
// @route   GET /api/automations/:id
export const getAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({ success: true, data: automation });
  } catch (error) {
    next(error);
  }
};

// @desc    Create automation
// @route   POST /api/automations
export const createAutomation = async (req, res, next) => {
  try {
    const { name, description, triggerType, triggerConfig, nodes } = req.body;

    const automation = await Automation.create({
      userId: req.user?._id,
      name,
      description,
      triggerType,
      triggerConfig,
      nodes: nodes || [],
      isActive: false
    });

    res.status(201).json({ success: true, data: automation });
  } catch (error) {
    next(error);
  }
};

// @desc    Update automation
// @route   PUT /api/automations/:id
export const updateAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { name, description, triggerType, triggerConfig, nodes } = req.body;

    if (name !== undefined) automation.name = name;
    if (description !== undefined) automation.description = description;
    if (triggerType !== undefined) automation.triggerType = triggerType;
    if (triggerConfig !== undefined) automation.triggerConfig = triggerConfig;
    if (nodes !== undefined) automation.nodes = nodes;

    await automation.save();

    res.json({ success: true, data: automation });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete automation
// @route   DELETE /api/automations/:id
export const deleteAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    await Automation.findByIdAndDelete(req.params.id);

    // Also delete related runs
    await AutomationRun.deleteMany({ automation: req.params.id });

    res.json({ success: true, message: 'Automation supprimée' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle automation active state
// @route   PATCH /api/automations/:id/toggle
export const toggleAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Validate before activating
    if (!automation.isActive) {
      // Check that automation has at least a trigger node
      const triggerNode = automation.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) {
        return res.status(400).json({
          success: false,
          error: 'L\'automation doit avoir au moins un trigger'
        });
      }

      // Check for cycles in the node graph
      if (hasCycle(automation.nodes)) {
        return res.status(400).json({
          success: false,
          error: 'L\'automation contient une boucle infinie dans les connexions'
        });
      }
    }

    automation.isActive = !automation.isActive;
    await automation.save();

    res.json({ success: true, data: automation });
  } catch (error) {
    next(error);
  }
};

// @desc    Run automation manually
// @route   POST /api/automations/:id/run
export const runAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { testData, testMode, testEmail } = req.body;

    // Build context — inject test override when testMode is on
    const context = { ...(testData || {}) };
    if (testMode && testEmail) {
      context._test = { enabled: true, email: testEmail };
    }

    // Create a manual run
    const run = await AutomationRun.create({
      automation: automation._id,
      automationName: automation.name,
      triggerType: 'manual',
      triggerData: testData || {},
      status: 'pending',
      context,
      isTest: !!testMode
    });

    // Import and use executor service
    const { executeRun } = await import('../services/automation/executorService.js');

    // Execute asynchronously
    executeRun(run._id).catch(err => {
      console.error('Manual run execution error:', err);
    });

    res.json({
      success: true,
      data: run,
      message: 'Exécution démarrée'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get automation runs
// @route   GET /api/automations/:id/runs
export const getAutomationRuns = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { limit = 20, page = 1, status } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    const query = { automation: req.params.id };
    if (status) query.status = status;

    const [runs, total] = await Promise.all([
      AutomationRun.find(query)
        .sort('-createdAt')
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit),
      AutomationRun.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: runs,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate automation
// @route   POST /api/automations/:id/duplicate
export const duplicateAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findById(req.params.id);

    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation non trouvée' });
    }

    // Check ownership
    if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const duplicate = await Automation.create({
      userId: automation.userId,
      name: `${automation.name} (copie)`,
      description: automation.description,
      triggerType: automation.triggerType,
      triggerConfig: automation.triggerConfig,
      nodes: automation.nodes,
      isActive: false,
      stats: { totalRuns: 0, successfulRuns: 0, failedRuns: 0 }
    });

    res.status(201).json({ success: true, data: duplicate });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single automation run
// @route   GET /api/automation-runs/:id
export const getAutomationRun = async (req, res, next) => {
  try {
    const run = await AutomationRun.findById(req.params.id)
      .populate('automation', 'name userId');

    if (!run) {
      return res.status(404).json({ success: false, error: 'Exécution non trouvée' });
    }

    // Check ownership
    if (req.user && run.automation.userId && run.automation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    res.json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
};

// @desc    Retry failed run
// @route   POST /api/automation-runs/:id/retry
export const retryRun = async (req, res, next) => {
  try {
    const run = await AutomationRun.findById(req.params.id)
      .populate('automation');

    if (!run) {
      return res.status(404).json({ success: false, error: 'Exécution non trouvée' });
    }

    if (run.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Seules les exécutions échouées peuvent être relancées'
      });
    }

    // Create new run with same trigger data
    const newRun = await AutomationRun.create({
      automation: run.automation._id,
      automationName: run.automation.name,
      triggerType: run.triggerType,
      triggerData: run.triggerData,
      status: 'pending',
      context: run.triggerData
    });

    // Execute
    const { executeRun } = await import('../services/automation/executorService.js');
    executeRun(newRun._id).catch(err => {
      console.error('Retry execution error:', err);
    });

    res.json({
      success: true,
      data: newRun,
      message: 'Nouvelle exécution démarrée'
    });
  } catch (error) {
    next(error);
  }
};
