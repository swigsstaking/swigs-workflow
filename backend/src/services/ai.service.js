/**
 * AI Service — Proxy Ollama + Context Assembly
 *
 * Required environment variables:
 *   OLLAMA_URL    — Ollama API base URL (default: http://192.168.110.103:11434)
 *   AI_MODEL      — Model name (default: qwen3:32b)
 *   AI_RATE_LIMIT — Max chat requests/min per user (default: 20)
 */

import Settings from '../models/Settings.js';
import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.110.103:11434';
const AI_MODEL = process.env.AI_MODEL || 'qwen3:32b';

// ---------------------------------------------------------------------------
// Context cache (in-memory, 5min TTL)
// ---------------------------------------------------------------------------
const contextCache = new Map(); // userId → { data, expiresAt }
const CONTEXT_TTL = 5 * 60 * 1000;

function getCachedContext(userId) {
  const key = userId.toString();
  const cached = contextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  contextCache.delete(key);
  return null;
}

function setCachedContext(userId, data) {
  contextCache.set(userId.toString(), { data, expiresAt: Date.now() + CONTEXT_TTL });
}

// ---------------------------------------------------------------------------
// Conversation history (in-memory, last 10 messages per user)
// ---------------------------------------------------------------------------
const conversationHistory = new Map(); // userId → [{ role, content }]
const MAX_HISTORY = 10;

export function getHistory(userId) {
  return conversationHistory.get(userId.toString()) || [];
}

export function pushHistory(userId, message) {
  const key = userId.toString();
  const history = conversationHistory.get(key) || [];
  history.push(message);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  conversationHistory.set(key, history);
}

export function clearHistory(userId) {
  conversationHistory.delete(userId.toString());
}

// ---------------------------------------------------------------------------
// Context assembly from MongoDB
// ---------------------------------------------------------------------------
export async function buildUserContext(userId) {
  const cached = getCachedContext(userId);
  if (cached) return cached;

  const [settings, overdueInvoices, pendingInvoices, activeProjects] = await Promise.all([
    Settings.findOne({ userId }).lean().select('company invoicing'),

    Invoice.find({
      userId,
      status: 'sent',
      dueDate: { $lt: new Date() }
    }).lean().select('number totalTTC dueDate clientName'),

    Invoice.find({
      userId,
      status: { $in: ['draft', 'sent'] }
    }).lean().select('number totalTTC status'),

    Project.find({
      userId,
      archivedAt: null
    }).lean().select('name client.name')
  ]);

  const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

  const context = {
    company: settings?.company || {},
    vatRate: settings?.invoicing?.defaultVatRate || 8.1,
    overdueInvoices: overdueInvoices.map(inv => ({
      number: inv.number,
      amount: inv.totalTTC,
      dueDate: inv.dueDate,
      client: inv.clientName
    })),
    pendingCount: pendingInvoices.length,
    pendingTotal: Math.round(pendingTotal * 100) / 100,
    activeProjects: activeProjects.map(p => ({
      name: p.name,
      client: p.client?.name || 'Sans client'
    }))
  };

  setCachedContext(userId, context);
  return context;
}

export function buildSystemPrompt(context) {
  const companyName = context.company?.name || 'Mon entreprise';
  const companyForm = context.company?.siret ? `IDE: ${context.company.siret}` : '';

  const overdueList = context.overdueInvoices.length > 0
    ? context.overdueInvoices.map(inv =>
        `  - ${inv.number}: ${inv.amount} CHF (échéance ${new Date(inv.dueDate).toLocaleDateString('fr-CH')}, ${inv.client})`
      ).join('\n')
    : '  Aucune';

  const projectList = context.activeProjects.length > 0
    ? context.activeProjects.slice(0, 10).map(p => `  - ${p.name} (${p.client})`).join('\n')
    : '  Aucun projet actif';

  return `Tu es l'assistant comptable AI de SWIGS Pro, spécialisé en comptabilité suisse.
Tu connais le CO (RS 220), la LTVA (RS 641.20), la LIFD (RS 642.11), la LHID (RS 642.14).

Contexte de l'utilisateur :
- Entreprise : ${companyName} ${companyForm}
- Taux TVA par défaut : ${context.vatRate}%
- Factures en attente : ${context.pendingCount} pour ${context.pendingTotal} CHF
- Factures en retard :
${overdueList}
- Projets actifs :
${projectList}

Règles :
- Réponds en français sauf si on te parle en allemand, italien ou anglais
- Cite les articles de loi quand pertinent (ex: Art. 21 LTVA)
- Sois concis et pratique
- Si tu n'es pas sûr, dis-le clairement
- Pour les calculs de TVA, utilise l'outil calculate_vat plutôt que de calculer toi-même`;
}

// ---------------------------------------------------------------------------
// Tools definition (Ollama/OpenAI format)
// ---------------------------------------------------------------------------
const VAT_RATES = {
  normal: 8.1,
  reduced: 2.6,
  special: 3.8
};

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_vat',
      description: 'Calcule la TVA suisse sur un montant. Taux: 8.1% (normal), 2.6% (réduit: alimentation, médicaments, livres), 3.8% (hébergement).',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Montant HT ou TTC en CHF' },
          rate: { type: 'number', description: 'Taux TVA: 8.1, 2.6, ou 3.8', enum: [8.1, 2.6, 3.8] },
          mode: { type: 'string', description: 'from_net (HT→TTC) ou from_gross (TTC→HT)', enum: ['from_net', 'from_gross'] }
        },
        required: ['amount', 'rate', 'mode']
      }
    }
  }
];

/**
 * Execute a tool call. Returns the result as a string.
 */
export function executeTool(name, args) {
  if (name === 'calculate_vat') {
    return calculateVat(args);
  }
  return { error: `Outil inconnu: ${name}` };
}

function calculateVat({ amount, rate, mode }) {
  // Validate rate
  const validRates = [8.1, 2.6, 3.8];
  if (!validRates.includes(rate)) {
    return { error: `Taux invalide: ${rate}%. Taux valides: ${validRates.join(', ')}%` };
  }

  // Work in centimes to avoid floating point errors
  const amountCentimes = Math.round(amount * 100);
  const rateMultiplier = rate * 100; // 810 for 8.1%

  let netCentimes, vatCentimes, grossCentimes;

  if (mode === 'from_net') {
    netCentimes = amountCentimes;
    vatCentimes = Math.round(netCentimes * rateMultiplier / 10000);
    grossCentimes = netCentimes + vatCentimes;
  } else if (mode === 'from_gross') {
    grossCentimes = amountCentimes;
    // net = gross / (1 + rate/100) → in centimes: gross * 10000 / (10000 + rate*100)
    netCentimes = Math.round(grossCentimes * 10000 / (10000 + rateMultiplier));
    vatCentimes = grossCentimes - netCentimes;
  } else {
    return { error: `Mode invalide: ${mode}. Utilisez 'from_net' ou 'from_gross'` };
  }

  return {
    net: netCentimes / 100,
    vat: vatCentimes / 100,
    gross: grossCentimes / 100,
    rate,
    mode,
    currency: 'CHF'
  };
}

// ---------------------------------------------------------------------------
// Ollama proxy — SSE streaming
// ---------------------------------------------------------------------------

/**
 * Stream a chat completion from Ollama via SSE.
 * @param {object} opts
 * @param {string} opts.systemPrompt - System prompt with context
 * @param {Array} opts.messages - Conversation messages [{ role, content }]
 * @param {object} opts.res - Express response (for SSE writing)
 * @param {AbortSignal} opts.signal - Abort signal for client disconnect
 * @returns {Promise<string>} Full assistant response text
 */
export async function streamChat({ systemPrompt, messages, res, signal }) {
  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  // Chain external signal to our controller
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let fullResponse = '';

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: ollamaMessages,
        stream: true,
        tools: AI_TOOLS
      }),
      signal: controller.signal
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => 'Unknown error');
      throw new Error(`Ollama error ${ollamaRes.status}: ${errText}`);
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Ollama sends newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);

          // Check for tool calls
          if (data.message?.tool_calls?.length > 0) {
            const toolResults = [];
            for (const toolCall of data.message.tool_calls) {
              const result = executeTool(
                toolCall.function.name,
                toolCall.function.arguments
              );
              toolResults.push({
                role: 'tool',
                content: JSON.stringify(result)
              });
              // Send tool result indicator to frontend
              res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolCall.function.name, result })}\n\n`);
            }

            // Continue generation with tool results
            const followUp = await streamToolFollowUp({
              systemPrompt,
              messages: [
                ...ollamaMessages.slice(1), // skip system (already in ollamaMessages)
                data.message,
                ...toolResults
              ],
              res,
              signal: controller.signal
            });
            fullResponse += followUp;
            clearTimeout(timeoutId);
            return fullResponse;
          }

          // Regular token
          if (data.message?.content) {
            fullResponse += data.message.content;
            res.write(`data: ${JSON.stringify({ type: 'token', content: data.message.content })}\n\n`);
          }

          if (data.done) {
            break;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Génération interrompue (timeout ou annulation).' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Erreur de connexion au modèle AI. Réessayez.' })}\n\n`);
      console.error('[AI] Ollama streaming error:', err.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return fullResponse;
}

/**
 * Follow-up streaming after tool call execution.
 */
async function streamToolFollowUp({ systemPrompt, messages, res, signal }) {
  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let fullResponse = '';

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: ollamaMessages,
        stream: true
      }),
      signal
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama follow-up error ${ollamaRes.status}`);
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullResponse += data.message.content;
            res.write(`data: ${JSON.stringify({ type: 'token', content: data.message.content })}\n\n`);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[AI] Tool follow-up error:', err.message);
    }
  }

  return fullResponse;
}

// ---------------------------------------------------------------------------
// Suggestions (proactive insights from user data)
// ---------------------------------------------------------------------------
export async function generateSuggestions(userId) {
  const context = await buildUserContext(userId);
  const suggestions = [];

  if (context.overdueInvoices.length > 0) {
    suggestions.push({
      type: 'warning',
      title: 'Factures en retard',
      message: `${context.overdueInvoices.length} facture(s) en retard pour un total de ${context.overdueInvoices.reduce((s, i) => s + i.amount, 0).toFixed(2)} CHF`,
      action: 'view_overdue'
    });
  }

  // TODO Phase 4: suggestion seuil TVA basée sur le CA annuel réel (sum invoices paid),
  // pas les factures pending. Nécessite une query dédiée.

  if (context.activeProjects.length === 0) {
    suggestions.push({
      type: 'tip',
      title: 'Aucun projet actif',
      message: 'Créez un projet pour commencer à suivre vos heures et dépenses.',
      action: 'create_project'
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// OCR — Document extraction via Qwen vision
// ---------------------------------------------------------------------------

const OCR_PROMPT = `Analyse cette image de document comptable (facture, ticket, reçu).
Extrais les informations suivantes au format JSON strict :
- vendor: nom du fournisseur
- date: date du document (YYYY-MM-DD)
- amountNet: montant hors taxe (number ou null)
- amountGross: montant TTC (number ou null)
- vatAmount: montant TVA (number ou null)
- vatRate: taux TVA en % (number ou null)
- currency: devise (CHF, EUR, USD)
- invoiceNumber: numéro de facture/référence
- category: catégorie parmi (office, telecom, transport, food, software, insurance, rent, other)
- confidence: ton niveau de confiance de 0 à 1

Réponds UNIQUEMENT avec le JSON, sans texte autour.
Si un champ est illisible, mets null.`;

/**
 * Extract structured data from a document image using Qwen vision.
 * @param {Buffer} imageBuffer - The image file buffer
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<object>} Extracted document data
 */
export async function ocrDocument(imageBuffer, mimeType) {
  const base64 = imageBuffer.toString('base64');

  const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: OCR_PROMPT,
          images: [base64]
        }
      ],
      stream: false,
      options: { temperature: 0.1 } // Low temperature for structured extraction
    }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!ollamaRes.ok) {
    const errText = await ollamaRes.text().catch(() => 'Unknown error');
    throw new Error(`Ollama OCR error ${ollamaRes.status}: ${errText}`);
  }

  const result = await ollamaRes.json();
  const rawText = result.message?.content || '';

  // Extract JSON from response — Qwen may wrap it in markdown code blocks
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Le modèle n\'a pas retourné de JSON valide. Réponse brute disponible.');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, rawText };
  } catch {
    throw new Error('JSON invalide dans la réponse du modèle.');
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return { status: 'degraded', error: `Ollama HTTP ${res.status}` };

    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    const hasModel = models.some(m => m.startsWith(AI_MODEL.split(':')[0]));

    return {
      status: 'ok',
      model: AI_MODEL,
      ollamaReachable: true,
      availableModels: models,
      modelLoaded: hasModel
    };
  } catch (err) {
    return {
      status: 'degraded',
      model: AI_MODEL,
      ollamaReachable: false,
      error: err.message
    };
  }
}
