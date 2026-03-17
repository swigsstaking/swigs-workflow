const CHF = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' });
const CHF_ROUND = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const formatCurrency = (amount) => CHF.format(amount || 0);
export const formatCurrencyRound = (amount) => CHF_ROUND.format(amount || 0);

/** Swiss rounding: round to nearest 5 centimes (0.05 CHF) */
export const roundTo5ct = (amount) => Math.round(amount / 0.05) * 0.05;

/** Round remaining amount with Swiss tolerance (< 0.05 = 0) */
export const roundRemaining = (amount) => amount < 0.05 ? 0 : roundTo5ct(amount);
