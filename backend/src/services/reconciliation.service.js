import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';

/**
 * Try to reconcile a bank transaction with an unpaid invoice
 * @param {Object} tx - Parsed transaction
 * @param {string} userId - User ID for filtering
 * @returns {{ matchedInvoice, matchMethod, matchConfidence, matchStatus }}
 */
export async function reconcileTransaction(tx, userId) {
  // Only reconcile incoming payments
  if (tx.creditDebit !== 'CRDT') {
    return { matchedInvoice: null, matchMethod: null, matchConfidence: 0, matchStatus: 'unmatched' };
  }

  // Get user's project IDs for filtering
  const projects = await Project.find({ userId }).select('_id client');
  const projectIds = projects.map(p => p._id);

  // Unpaid sent invoices only
  const sentInvoices = await Invoice.find({
    project: { $in: projectIds },
    status: 'sent'
  }).populate({ path: 'project', select: 'client name' }).lean();

  if (sentInvoices.length === 0) {
    return { matchedInvoice: null, matchMethod: null, matchConfidence: 0, matchStatus: 'unmatched' };
  }

  // Strategy 1: QR structured reference (confidence 100)
  if (tx.reference) {
    const refDigits = tx.reference.replace(/[^0-9]/g, '');
    for (const inv of sentInvoices) {
      // FAC-2026-001 → 2026001
      const invoiceDigits = inv.number.replace(/[^0-9]/g, '');
      if (refDigits && invoiceDigits && refDigits.includes(invoiceDigits)) {
        return {
          matchedInvoice: inv._id,
          matchMethod: 'qr_reference',
          matchConfidence: 100,
          matchStatus: 'matched'
        };
      }
    }
  }

  // Strategy 1b: FAC-YYYY-NNN pattern in unstructured reference (confidence 90)
  if (tx.unstructuredReference) {
    const facMatch = tx.unstructuredReference.match(/FAC-\d{4}-\d{3}/i);
    if (facMatch) {
      const facNumber = facMatch[0].toUpperCase();
      const inv = sentInvoices.find(i => i.number === facNumber);
      if (inv) {
        return {
          matchedInvoice: inv._id,
          matchMethod: 'qr_reference',
          matchConfidence: 90,
          matchStatus: 'matched'
        };
      }
    }
  }

  // Strategy 2: Amount + client name fuzzy match (confidence 60-85)
  const amountMatches = sentInvoices.filter(inv =>
    Math.abs(inv.total - tx.amount) < 0.01
  );

  if (amountMatches.length === 1) {
    // Single amount match — check client name
    const inv = amountMatches[0];
    const confidence = computeNameConfidence(tx.counterpartyName, inv.project?.client);
    if (confidence >= 60) {
      return {
        matchedInvoice: inv._id,
        matchMethod: 'amount_client',
        matchConfidence: confidence,
        matchStatus: confidence >= 80 ? 'matched' : 'suggested'
      };
    }
  } else if (amountMatches.length > 1 && tx.counterpartyName) {
    // Multiple amount matches — use name to disambiguate
    let bestMatch = null;
    let bestConfidence = 0;

    for (const inv of amountMatches) {
      const confidence = computeNameConfidence(tx.counterpartyName, inv.project?.client);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = inv;
      }
    }

    if (bestMatch && bestConfidence >= 60) {
      return {
        matchedInvoice: bestMatch._id,
        matchMethod: 'amount_client',
        matchConfidence: bestConfidence,
        matchStatus: bestConfidence >= 80 ? 'matched' : 'suggested'
      };
    }
  }

  return { matchedInvoice: null, matchMethod: null, matchConfidence: 0, matchStatus: 'unmatched' };
}

function computeNameConfidence(txName, client) {
  if (!txName || !client) return 0;

  const normalize = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const txNorm = normalize(txName);
  if (!txNorm) return 0;

  // Check company name
  const companyNorm = normalize(client.company);
  if (companyNorm && txNorm.includes(companyNorm)) return 85;
  if (companyNorm && companyNorm.includes(txNorm)) return 80;

  // Check person name
  const nameNorm = normalize(client.name);
  if (nameNorm && txNorm.includes(nameNorm)) return 75;
  if (nameNorm && nameNorm.includes(txNorm)) return 70;

  // Partial match: check if all words in client name appear in tx name
  const nameWords = nameNorm.split(/\s+/).filter(w => w.length > 2);
  if (nameWords.length > 0) {
    const matchedWords = nameWords.filter(w => txNorm.includes(w));
    if (matchedWords.length === nameWords.length) return 70;
    if (matchedWords.length > 0) return 60;
  }

  return 0;
}
