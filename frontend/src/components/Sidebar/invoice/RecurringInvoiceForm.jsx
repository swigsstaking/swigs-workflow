import Input, { Textarea } from '../../ui/Input';
import ServicePicker from './ServicePicker';
import LinesEditor from './LinesEditor';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
];

export default function RecurringInvoiceForm({
  form,
  setForm,
  onSelectService
}) {
  const showDayOfMonth = ['monthly', 'quarterly', 'yearly'].includes(form.frequency);

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: 1, unitPrice: 0, discountType: '', discountValue: 0 }] }));
  const removeLine = (i) => {
    if (form.lines.length === 1) return;
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  };
  const updateLine = (i, field, value) => {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [field]: value };
      return { ...f, lines };
    });
  };

  return (
    <div className="space-y-4">
      <ServicePicker onSelectService={onSelectService} />

      <LinesEditor
        lines={form.lines}
        updateLine={updateLine}
        removeLine={removeLine}
        addLine={addLine}
      />

      {/* Fréquence et dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Fréquence
          </label>
          <select
            value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg"
          >
            {FREQUENCY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {showDayOfMonth && (
          <div>
            <Input
              label="Jour du mois (1-28)"
              type="number"
              min="1"
              max="28"
              value={form.dayOfMonth}
              onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input
            label="Date de début"
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Date de fin
            </label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, hasEndDate: !f.hasEndDate, endDate: '' }))}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                form.hasEndDate ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.hasEndDate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {form.hasEndDate ? (
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg"
            />
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-1.5">Sans fin</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <Textarea
        label="Notes (optionnel)"
        value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        placeholder="Remarques, conditions..."
        rows={2}
      />
    </div>
  );
}
