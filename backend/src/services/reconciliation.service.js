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

  // Unpaid invoices (sent or partially paid)
  const unpaidInvoices = await Invoice.find({
    project: { $in: projectIds },
    status: { $in: ['sent', 'partial'] }
  }).populate({ path: 'project', select: 'client name' }).lean();

  if (unpaidInvoices.length === 0) {
    return { matchedInvoice: null, matchMethod: null, matchConfidence: 0, matchStatus: 'unmatched' };
  }

  // Strategy 1: QR structured reference — full digits (confidence 100)
  if (tx.reference) {
    const refDigits = tx.reference.replace(/[^0-9]/g, '');
    for (const inv of unpaidInvoices) {
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
    const facMatches = tx.unstructuredReference.match(/FAC-\d{4}-\d{3,4}/gi);
    if (facMatches) {
      for (const fac of facMatches) {
        const facNumber = fac.toUpperCase();
        const inv = unpaidInvoices.find(i => i.number === facNumber);
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
  }

  // Strategy 1c: Short ref pattern (R0010, etc.) in SCOR reference or unstructured (confidence 95)
  // Swiss banks often embed a short ref like "R0010" in SCOR or payment details
  // which maps to the trailing number of FAC-2026-0010
  {
    const refSources = [tx.reference, tx.unstructuredReference].filter(Boolean).join(' ');
    const shortRefs = refSources.match(/\bR(\d{3,})\b/gi);
    if (shortRefs) {
      for (const shortRef of shortRefs) {
        const shortDigits = shortRef.replace(/[^0-9]/g, '');
        for (const inv of unpaidInvoices) {
          // Extract trailing number from invoice: FAC-2026-0010 → "0010"
          const trailingMatch = inv.number.match(/-(\d{3,})$/);
          if (trailingMatch && trailingMatch[1] === shortDigits) {
            // Confirm with amount match for extra confidence (account for partial payments)
            const remaining = inv.total - (inv.paidAmount || 0);
            const amountOk = Math.abs(remaining - tx.amount) < 0.01;
            return {
              matchedInvoice: inv._id,
              matchMethod: 'qr_reference',
              matchConfidence: amountOk ? 95 : 85,
              matchStatus: 'matched'
            };
          }
        }
      }
    }
  }

  // Strategy 2: Amount + client name fuzzy match (confidence 60-85)
  // For partial invoices, compare against remaining balance (total - paidAmount)
  const amountMatches = unpaidInvoices.filter(inv => {
    const remaining = inv.total - (inv.paidAmount || 0);
    return Math.abs(remaining - tx.amount) < 0.01;
  });

  if (amountMatches.length === 1) {
    // Single amount match — check client name
    const inv = amountMatches[0];
    const confidence = computeNameConfidence(tx.counterpartyName, inv.project?.client, tx.unstructuredReference);
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
      const confidence = computeNameConfidence(tx.counterpartyName, inv.project?.client, tx.unstructuredReference);
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

function computeNameConfidence(txName, client, unstructuredRef) {
  if (!txName || !client) return 0;

  const normalize = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const txNorm = normalize(txName);
  if (!txNorm) return 0;

  const companyNorm = normalize(client.company);
  const nameNorm = normalize(client.name);

  // Direct full match — counterparty contains entire company/name
  if (companyNorm && txNorm.includes(companyNorm)) return 85;
  if (companyNorm && companyNorm.includes(txNorm)) return 80;
  if (nameNorm && txNorm.includes(nameNorm)) return 75;
  if (nameNorm && nameNorm.includes(txNorm)) return 70;

  // Swiss bank format: "Person Name - Company" or "Person Name / Company"
  // Split counterparty on separators and check each segment
  const segments = txName.split(/\s+[-\/|]\s+/).map(s => normalize(s)).filter(Boolean);
  if (segments.length > 1) {
    for (const seg of segments) {
      if (companyNorm && (seg.includes(companyNorm) || companyNorm.includes(seg))) return 85;
      if (nameNorm && (seg.includes(nameNorm) || nameNorm.includes(seg))) return 80;
    }
  }

  // Check if company/name words appear in counterparty (partial word match)
  const companyWords = companyNorm.split(/\s+/).filter(w => w.length > 2);
  const nameWords = nameNorm.split(/\s+/).filter(w => w.length > 2);

  // Company words in counterparty
  if (companyWords.length > 0) {
    const matchedWords = companyWords.filter(w => txNorm.includes(w));
    if (matchedWords.length === companyWords.length) return 80;
    // If most words match (e.g., "moontain" from "moontain studio"), check unstructured ref too
    if (matchedWords.length > 0 && unstructuredRef) {
      const refNorm = normalize(unstructuredRef);
      const refMatchedWords = companyWords.filter(w => refNorm.includes(w));
      if (refMatchedWords.length === companyWords.length) return 85;
    }
    if (matchedWords.length > 0) return 65;
  }

  // Person name words in counterparty
  if (nameWords.length > 0) {
    const matchedWords = nameWords.filter(w => txNorm.includes(w));
    if (matchedWords.length === nameWords.length) return 70;
    if (matchedWords.length > 0) return 60;
  }

  return 0;
}
