import { useRef, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

function getLineTotal(line) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isNaN(qty) || isNaN(price)) return 0;
  return qty * price;
}

/** Split stored "title\ndescription" into separate parts */
function splitDescription(desc) {
  if (!desc) return { title: '', detail: '' };
  const idx = desc.indexOf('\n');
  if (idx < 0) return { title: desc, detail: '' };
  return { title: desc.substring(0, idx), detail: desc.substring(idx + 1) };
}

/** Join title + detail back into stored format */
function joinDescription(title, detail) {
  const t = title || '';
  const d = detail || '';
  return d ? `${t}\n${d}` : t;
}

/** Auto-growing textarea hook */
function useAutoResize() {
  const ref = useRef(null);
  const resize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const setRef = useCallback((el) => {
    ref.current = el;
    if (el) resize(el);
  }, [resize]);

  return { setRef, resize };
}

function AutoTextarea({ value, onChange, placeholder, disabled, className, ariaLabel }) {
  const { setRef, resize } = useAutoResize();

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        resize(e.target);
      }}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      rows={1}
      className={`w-full px-2 py-1.5 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden ${className || ''}`}
    />
  );
}

export default function LinesEditor({
  lines,
  updateLine,
  removeLine,
  addLine,
  disabled = false
}) {
  const handleTitleChange = (index, newTitle) => {
    const { detail } = splitDescription(lines[index].description);
    updateLine(index, 'description', joinDescription(newTitle, detail));
  };

  const handleDetailChange = (index, newDetail) => {
    const { title } = splitDescription(lines[index].description);
    updateLine(index, 'description', joinDescription(title, newDetail));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="col-span-6">Description</div>
        <div className="col-span-2 text-center">Qté</div>
        <div className="col-span-2 text-center">Prix</div>
        <div className="col-span-2 text-right">Total</div>
      </div>

      {lines.map((line, index) => {
        const { title, detail } = splitDescription(line.description);
        return (
          <div
            key={index}
            className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30"
          >
            <div className="col-span-6 space-y-1">
              <input
                value={title}
                onChange={(e) => handleTitleChange(index, e.target.value)}
                placeholder="Titre..."
                disabled={disabled}
                aria-label={`Titre ligne ${index + 1}`}
                className="w-full px-2 py-1.5 text-sm font-medium rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <AutoTextarea
                value={detail}
                onChange={(e) => handleDetailChange(index, e.target.value)}
                placeholder="Description (optionnel)..."
                disabled={disabled}
                ariaLabel={`Description ligne ${index + 1}`}
                className="text-slate-600 dark:text-slate-300"
              />
            </div>
            <div className="col-span-2 pt-1">
              <input
                type="number"
                min="0"
                step="0.5"
                value={line.quantity === '' ? '' : line.quantity}
                onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? '' : e.target.value)}
                onBlur={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 1)}
                disabled={disabled}
                aria-label={`Quantité ligne ${index + 1}`}
                className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-2 pt-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice === '' ? '' : line.unitPrice}
                onChange={(e) => updateLine(index, 'unitPrice', e.target.value === '' ? '' : e.target.value)}
                onBlur={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                aria-label={`Prix ligne ${index + 1}`}
                className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1 pt-1">
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
        );
      })}

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
