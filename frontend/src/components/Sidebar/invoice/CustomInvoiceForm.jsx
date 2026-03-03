import LinesEditor from './LinesEditor';
import ServicePicker from './ServicePicker';
import { Textarea } from '../../ui/Input';
import { formatCurrency } from '../../../utils/format';

export default function CustomInvoiceForm({
  customLines,
  updateCustomLine,
  removeCustomLine,
  addCustomLine,
  notes,
  setNotes,
  onSelectService,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  getDiscountAmount
}) {
  return (
    <div className="space-y-3">
      {onSelectService && (
        <ServicePicker onSelectService={onSelectService} />
      )}

      <LinesEditor
        lines={customLines}
        updateLine={updateCustomLine}
        removeLine={removeCustomLine}
        addLine={addCustomLine}
      />

      {/* Discount */}
      {setDiscountType && (
        <div className="mt-4 space-y-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Remise globale
          </span>
          <div className="flex items-center gap-2">
            <select
              value={discountType || ''}
              onChange={(e) => { setDiscountType(e.target.value); if (!e.target.value) setDiscountValue(''); }}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Aucun</option>
              <option value="percentage">%</option>
              <option value="fixed">CHF</option>
            </select>
            {discountType && (
              <input
                type="number"
                min="0"
                step={discountType === 'percentage' ? '1' : '0.01'}
                max={discountType === 'percentage' ? '100' : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '10' : '100.00'}
                className="w-24 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            )}
            {discountType && discountValue && getDiscountAmount && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                -{formatCurrency(getDiscountAmount())}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Textarea
          label="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Remarques, conditions..."
          rows={2}
        />
      </div>
    </div>
  );
}
