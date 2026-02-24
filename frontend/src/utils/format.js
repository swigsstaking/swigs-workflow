const CHF = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' });
const CHF_ROUND = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const formatCurrency = (amount) => CHF.format(amount || 0);
export const formatCurrencyRound = (amount) => CHF_ROUND.format(amount || 0);
