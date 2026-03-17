import {
  buildUserContext,
  buildSystemPrompt,
  streamChat,
  getHistory,
  pushHistory,
  generateSuggestions,
  checkOllamaHealth,
  executeTool,
  ocrDocument
} from '../services/ai.service.js';

// Active SSE connections — allows /chat/stop to abort
const activeStreams = new Map(); // userId → AbortController

// ---------------------------------------------------------------------------
// POST /api/ai/chat — SSE streaming chat
// ---------------------------------------------------------------------------
export const chat = async (req, res, next) => {
  const userId = req.user._id;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Le champ "message" est requis.' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
  res.flushHeaders();

  // Abort controller for this stream
  const abortController = new AbortController();
  activeStreams.set(userId.toString(), abortController);

  // Cleanup on client disconnect
  req.on('close', () => {
    abortController.abort();
    activeStreams.delete(userId.toString());
  });

  try {
    // Build context + system prompt
    const context = await buildUserContext(userId);
    const systemPrompt = buildSystemPrompt(context);

    // Add user message to history
    pushHistory(userId, { role: 'user', content: message.trim() });
    const history = getHistory(userId);

    // Stream from Ollama
    const fullResponse = await streamChat({
      systemPrompt,
      messages: history,
      res,
      signal: abortController.signal
    });

    // Save assistant response to history
    if (fullResponse) {
      pushHistory(userId, { role: 'assistant', content: fullResponse });
    }

    // End SSE stream
    res.write(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`);
  } catch (err) {
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Erreur interne.' })}\n\n`);
    console.error('[AI] Chat error:', err.message);
  } finally {
    activeStreams.delete(userId.toString());
    res.end();
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/chat/stop — Abort an active generation
// ---------------------------------------------------------------------------
export const stopChat = async (req, res) => {
  const userId = req.user._id.toString();
  const controller = activeStreams.get(userId);

  if (controller) {
    controller.abort();
    activeStreams.delete(userId);
    return res.json({ success: true, message: 'Génération arrêtée.' });
  }

  res.json({ success: true, message: 'Aucune génération en cours.' });
};

// ---------------------------------------------------------------------------
// GET /api/ai/suggestions — Proactive suggestions
// ---------------------------------------------------------------------------
export const getSuggestions = async (req, res, next) => {
  try {
    const suggestions = await generateSuggestions(req.user._id);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/ai/tools/vat — Direct VAT calculation
// ---------------------------------------------------------------------------
export const calculateVat = async (req, res) => {
  const { amount, rate, mode } = req.body;

  if (typeof amount !== 'number' || typeof rate !== 'number' || !mode) {
    return res.status(400).json({
      success: false,
      error: 'Paramètres requis: amount (number), rate (number), mode ("from_net" ou "from_gross")'
    });
  }

  const result = executeTool('calculate_vat', { amount, rate, mode });

  if (result.error) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({ success: true, data: result });
};

// ---------------------------------------------------------------------------
// POST /api/ai/ocr — Document OCR extraction
// ---------------------------------------------------------------------------
export const ocr = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Aucun fichier envoyé.' });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'Format non supporté. Formats acceptés : JPEG, PNG, WebP, PDF.'
    });
  }

  try {
    const data = await ocrDocument(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[AI] OCR error:', err.message);
    res.status(422).json({
      success: false,
      error: err.message || 'Erreur lors de l\'extraction du document.'
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ai/health — Ollama health check
// ---------------------------------------------------------------------------
export const health = async (req, res) => {
  const status = await checkOllamaHealth();
  const httpCode = status.status === 'ok' ? 200 : 503;
  res.status(httpCode).json(status);
};
