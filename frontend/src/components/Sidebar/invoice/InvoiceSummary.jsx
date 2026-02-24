import { Settings2, ChevronDown, ChevronUp, Calendar, Send, Bell } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

const FREQUENCY_LABELS = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
};

function computeNextDate(startDate, frequency, dayOfMonth) {
  if (!startDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);

  if (frequency === 'weekly') {
    const next = new Date(start);
    while (next <= today) next.setDate(next.getDate() + 7);
    return next;
  }

  const dom = parseInt(dayOfMonth) || 1;
  let candidate = new Date(start.getFullYear(), start.getMonth(), Math.min(dom, 28));
  const addPeriod = (d) => {
    if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  };
  while (candidate <= today) addPeriod(candidate);
  return candidate;
}

function formatDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export default function InvoiceSummary({
  mode,
  totalSelected,
  selectedEvents,
  selectedQuotes,
  quotePartials,
  getEventsTotal,
  getQuotesTotal,
  getCustomTotal,
  getSelectedTotal,
  customLines,
  showAdvanced,
  setShowAdvanced,
  customIssueDate,
  setCustomIssueDate,
  vatRate = 0.081,
  // Recurring props
  recurringForm,
  setRecurringForm,
  // Smart features
  autoSend,
  setAutoSend,
  skipReminders,
  setSkipReminders,
  settings
}) {
  const hasSmtp = !!(settings?.smtp?.host && settings?.smtp?.user);
  const hasReminders = !!settings?.reminders?.enabled;

  return (
    <div className="w-full lg:w-80 flex-shrink-0 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 overflow-y-auto max-h-[50vh] lg:max-h-none">
      {/* Advanced options - standard/custom only */}
      {mode !== 'recurring' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Options avancées</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Date d'émission
                </span>
                <input
                  type="date"
                  value={customIssueDate}
                  onChange={(e) => setCustomIssueDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Laissez vide pour la date du jour
                </p>
              </label>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl bg-white dark:bg-slate-800/50 p-4 border border-slate-200/50 dark:border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Récapitulatif
        </h4>

        {mode === 'recurring' ? (
          <RecurringSummary
            recurringForm={recurringForm}
            vatRate={vatRate}
          />
        ) : totalSelected === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            {mode === 'standard' ? 'Sélectionnez au moins un élément' : 'Remplissez les lignes'}
          </p>
        ) : (
          <div className="space-y-4">
            {mode === 'standard' ? (
              <div className="space-y-2 text-sm">
                {selectedEvents.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Événements ({selectedEvents.length})
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(getEventsTotal())}
                    </span>
                  </div>
                )}
                {selectedQuotes.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Devis ({selectedQuotes.length})
                      {Object.keys(quotePartials).length > 0 && (
                        <span className="text-amber-500 text-xs ml-1">(acompte)</span>
                      )}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(getQuotesTotal())}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    {customLines.length} ligne{customLines.length > 1 ? 's' : ''}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatCurrency(getCustomTotal())}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-700/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total HT</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatCurrency(getSelectedTotal())}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">TVA {(vatRate * 100).toFixed(1)}%</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {formatCurrency(getSelectedTotal() * vatRate)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Total TTC</span>
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(getSelectedTotal() * (1 + vatRate))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send options - all modes */}
      {(
        <div className="mt-4 space-y-3">
          {/* Auto-send toggle */}
          {hasSmtp && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Envoi automatique
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'recurring' && setRecurringForm) {
                    setRecurringForm(f => ({ ...f, autoSend: !f.autoSend }));
                  } else {
                    setAutoSend?.(!autoSend);
                  }
                }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  (mode === 'recurring' ? recurringForm?.autoSend : autoSend)
                    ? 'bg-primary-600'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  (mode === 'recurring' ? recurringForm?.autoSend : autoSend)
                    ? 'translate-x-[18px]'
                    : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}

          {/* Reminders toggle */}
          {hasReminders && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Relances automatiques
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSkipReminders?.(!skipReminders)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  !skipReminders
                    ? 'bg-primary-600'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  !skipReminders
                    ? 'translate-x-[18px]'
                    : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )}
          {!hasReminders && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/30 text-slate-400">
              <Bell className="w-3.5 h-3.5" />
              <span>Relances désactivées (activer dans Paramètres)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecurringSummary({ recurringForm, vatRate }) {
  if (!recurringForm) return null;

  const subtotal = recurringForm.lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity);
    const price = parseFloat(l.unitPrice);
    if (isNaN(qty) || isNaN(price)) return sum;
    return sum + qty * price;
  }, 0);

  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;
  const nextDate = computeNextDate(recurringForm.startDate, recurringForm.frequency, recurringForm.dayOfMonth);

  const hasLines = recurringForm.lines.some(l => l.description.trim() && parseFloat(l.unitPrice) > 0);

  if (!hasLines) {
    return (
      <p className="text-sm text-slate-400 text-center py-4">
        Remplissez les lignes
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">
            {recurringForm.lines.length} ligne{recurringForm.lines.length > 1 ? 's' : ''}
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {formatCurrency(subtotal)}
          </span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-700/50 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Total HT</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {formatCurrency(subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">TVA {(vatRate * 100).toFixed(1)}%</span>
          <span className="text-slate-600 dark:text-slate-400">
            {formatCurrency(vatAmount)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Total / {FREQUENCY_LABELS[recurringForm.frequency] || recurringForm.frequency}
          </span>
          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {nextDate && (
        <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>Prochaine facture : {formatDate(nextDate)}</span>
        </div>
      )}
    </div>
  );
}
