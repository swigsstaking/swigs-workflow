import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

function getLineTotal(line) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isNaN(qty) || isNaN(price)) return 0;
  return qty * price;
}

export default function LinesEditor({
  lines,
  updateLine,
  removeLine,
  addLine,
  disabled = false
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="col-span-6">Description</div>
        <div className="col-span-2 text-center">Qté</div>
        <div className="col-span-2 text-center">Prix</div>
        <div className="col-span-2 text-right">Total</div>
      </div>

      {lines.map((line, index) => (
        <div
          key={index}
          className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30"
        >
          <div className="col-span-6">
            <input
              type="text"
              value={line.description}
              onChange={(e) => updateLine(index, 'description', e.target.value)}
              placeholder="Description..."
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.5"
              value={line.quantity === '' ? '' : line.quantity}
              onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? '' : e.target.value)}
              onBlur={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 1)}
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice === '' ? '' : line.unitPrice}
              onChange={(e) => updateLine(index, 'unitPrice', e.target.value === '' ? '' : e.target.value)}
              onBlur={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(getLineTotal(line))}
            </span>
            <button
              type="button"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1 || disabled}
              className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addLine}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Ajouter une ligne</span>
        </button>
      )}
    </div>
  );
}
