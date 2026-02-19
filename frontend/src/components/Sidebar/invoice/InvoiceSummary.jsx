import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';

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
  formatCurrency,
  showAdvanced,
  setShowAdvanced,
  customIssueDate,
  setCustomIssueDate,
  vatRate = 0.081
}) {
  return (
    <div className="w-full lg:w-80 flex-shrink-0 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 overflow-y-auto max-h-[50vh] lg:max-h-none">
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

      <div className="rounded-xl bg-white dark:bg-slate-800/50 p-4 border border-slate-200/50 dark:border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Récapitulatif
        </h4>

        {totalSelected === 0 ? (
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
    </div>
  );
}
