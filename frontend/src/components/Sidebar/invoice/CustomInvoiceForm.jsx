import LinesEditor from './LinesEditor';
import ServicePicker from './ServicePicker';

export default function CustomInvoiceForm({
  customLines,
  updateCustomLine,
  removeCustomLine,
  addCustomLine,
  notes,
  setNotes,
  formatCurrency,
  onSelectService
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
        formatCurrency={formatCurrency}
      />

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
