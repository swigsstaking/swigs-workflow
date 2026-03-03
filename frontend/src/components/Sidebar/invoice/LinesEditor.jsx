import { useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Tag, Info } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

/** Compute the line total accounting for discount */
function getLineTotal(line) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isNaN(qty) || isNaN(price)) return 0;
  const gross = qty * price;
  const discount = computeDiscountAmount(line, gross);
  return Math.max(0, gross - discount);
}

/** Compute the CHF discount amount from type + value */
function computeDiscountAmount(line, gross) {
  const val = parseFloat(line.discountValue) || 0;
  if (!line.discountType || val <= 0) return 0;
  if (line.discountType === 'percentage') return Math.min(gross, gross * (val / 100));
  return Math.min(val, gross);
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

  // Re-resize when value changes externally (e.g. data loaded from API)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => resize(el));
    return () => cancelAnimationFrame(raf);
  }, [value, resize]);

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
  disabled = false,
  showInfoToggle = false
}) {
  const handleTitleChange = (index, newTitle) => {
    const { detail } = splitDescription(lines[index].description);
    updateLine(index, 'description', joinDescription(newTitle, detail));
  };

  const handleDetailChange = (index, newDetail) => {
    const { title } = splitDescription(lines[index].description);
    updateLine(index, 'description', joinDescription(title, newDetail));
  };

  const toggleDiscount = (index) => {
    const line = lines[index];
    if (line.discountType) {
      // Remove discount
      updateLine(index, 'discountType', '');
      updateLine(index, 'discountValue', 0);
    } else {
      // Add discount (default fixed)
      updateLine(index, 'discountType', 'fixed');
      updateLine(index, 'discountValue', 0);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="col-span-5">Description</div>
        <div className="col-span-2 text-center">Qté</div>
        <div className="col-span-2 text-center">Prix unit.</div>
        <div className="col-span-3 text-right">Total</div>
      </div>

      {lines.map((line, index) => {
        const { title, detail } = splitDescription(line.description);
        const isInfo = !!line.isInfoLine;
        const hasDiscount = !isInfo && !!line.discountType;
        const gross = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
        const discountAmt = isInfo ? 0 : computeDiscountAmount(line, gross);
        return (
          <div
            key={index}
            className={`p-2 rounded-lg ${isInfo ? 'bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50' : 'bg-slate-50/80 dark:bg-slate-800/30'}`}
          >
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5 space-y-1">
                <AutoTextarea
                  value={title}
                  onChange={(e) => handleTitleChange(index, e.target.value)}
                  placeholder="Titre..."
                  disabled={disabled}
                  ariaLabel={`Titre ligne ${index + 1}`}
                  className="font-medium"
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
              <div className="col-span-3 flex flex-col items-end pt-1">
                <div className="flex items-center gap-1">
                  {isInfo ? (
                    <span className="text-xs font-medium text-blue-500 dark:text-blue-400 whitespace-nowrap px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30">
                      Info
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatCurrency(getLineTotal(line))}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1 || disabled}
                    className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {hasDiscount && discountAmt > 0 && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap mr-6">
                    -{formatCurrency(discountAmt)}
                    {line.discountType === 'percentage' && ` (${line.discountValue}%)`}
                  </span>
                )}
              </div>
            </div>

            {/* Discount sub-row */}
            {!disabled && (
              <div className="mt-1.5 flex items-center gap-2">
                {showInfoToggle && (
                  <button
                    type="button"
                    onClick={() => updateLine(index, 'isInfoLine', !isInfo)}
                    className={`flex items-center gap-1 text-xs transition-colors ${isInfo ? 'text-blue-500 hover:text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}
                    title={isInfo ? 'Convertir en ligne standard' : 'Marquer comme ligne informative (non incluse dans le total)'}
                  >
                    <Info className="w-3 h-3" />
                    <span>{isInfo ? 'Ligne info' : 'Info'}</span>
                  </button>
                )}
                {!isInfo && (
                  !hasDiscount ? (
                    <button
                      type="button"
                      onClick={() => toggleDiscount(index)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-500 transition-colors"
                    >
                      <Tag className="w-3 h-3" />
                      <span>Rabais</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <Tag className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <select
                        value={line.discountType}
                        onChange={(e) => updateLine(index, 'discountType', e.target.value)}
                        className="px-1.5 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        <option value="fixed">CHF</option>
                        <option value="percentage">%</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step={line.discountType === 'percentage' ? '1' : '0.01'}
                        max={line.discountType === 'percentage' ? '100' : undefined}
                        value={line.discountValue === '' ? '' : (line.discountValue || '')}
                        onChange={(e) => updateLine(index, 'discountValue', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        onBlur={(e) => updateLine(index, 'discountValue', parseFloat(e.target.value) || 0)}
                        placeholder={line.discountType === 'percentage' ? '10' : '0.00'}
                        className="w-20 px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      />
                      {discountAmt > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          -{formatCurrency(discountAmt)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDiscount(index)}
                        className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Retirer
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Show discount in read-only mode */}
            {disabled && hasDiscount && discountAmt > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Tag className="w-3 h-3" />
                <span>
                  Rabais: -{formatCurrency(discountAmt)}
                  {line.discountType === 'percentage' && ` (${line.discountValue}%)`}
                </span>
              </div>
            )}
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
