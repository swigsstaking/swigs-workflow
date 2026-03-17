/**
 * Swiss currency utilities — shared across controllers and services
 */

/** Round to nearest 5 centimes (0.05 CHF) — Swiss minimum monetary unit */
export const roundTo5ct = (amount) => Math.round(amount / 0.05) * 0.05;

/** Check if invoice is fully paid (Swiss tolerance: < 0.05 CHF difference = paid) */
export const isFullyPaid = (paidAmount, total) => {
  return (total - (paidAmount || 0)) < 0.05;
};

/** Compute per-line discount from type + value */
export const computeLineDiscount = (line) => {
  const gross = (line.quantity || 1) * (line.unitPrice || 0);
  if (!line.discountType || !line.discountValue || line.discountValue <= 0) return 0;
  if (line.discountType === 'percentage') return Math.min(gross, gross * (line.discountValue / 100));
  return Math.min(line.discountValue, gross);
};
