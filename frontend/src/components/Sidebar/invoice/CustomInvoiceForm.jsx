import { Plus, Trash2 } from 'lucide-react';

export default function CustomInvoiceForm({
  customLines,
  updateCustomLine,
  removeCustomLine,
  addCustomLine,
  getCustomLineTotal,
  notes,
  setNotes,
  formatCurrency
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="col-span-6">Description</div>
        <div className="col-span-2 text-center">Qté</div>
        <div className="col-span-2 text-center">Prix</div>
        <div className="col-span-2 text-right">Total</div>
      </div>

      {customLines.map((line, index) => (
        <div
          key={index}
          className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30"
        >
          <div className="col-span-6">
            <input
              type="text"
              value={line.description}
              onChange={(e) => updateCustomLine(index, 'description', e.target.value)}
              placeholder="Description..."
              className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.5"
              value={line.quantity === '' ? '' : line.quantity}
              onChange={(e) => updateCustomLine(index, 'quantity', e.target.value === '' ? '' : e.target.value)}
              onBlur={(e) => updateCustomLine(index, 'quantity', parseFloat(e.target.value) || 1)}
              className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice === '' ? '' : line.unitPrice}
              onChange={(e) => updateCustomLine(index, 'unitPrice', e.target.value === '' ? '' : e.target.value)}
              onBlur={(e) => updateCustomLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(getCustomLineTotal(line))}
            </span>
            <button
              type="button"
              onClick={() => removeCustomLine(index)}
              disabled={customLines.length === 1}
              className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCustomLine}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">Ajouter une ligne</span>
      </button>

      <div className="mt-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Notes (optionnel)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Remarques, conditions..."
            rows={2}
            className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
          />
        </label>
      </div>
    </div>
  );
}
