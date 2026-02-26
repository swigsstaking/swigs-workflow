import { useState, useEffect } from 'react';
import { RefreshCw, Calendar, Save } from 'lucide-react';
import { recurringInvoicesApi, projectsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';
import LinesEditor from '../../Sidebar/invoice/LinesEditor';
import { formatCurrency } from '../../../utils/format';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
];

const FREQUENCY_LABELS = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
};

function getDefaultLine() {
  return { description: '', quantity: 1, unitPrice: 0 };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function getLineTotal(line) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isNaN(qty) || isNaN(price)) return 0;
  return qty * price;
}

function computeNextDate(startDate, frequency, dayOfMonth) {
  if (!startDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);

  if (frequency === 'weekly') {
    const next = new Date(start);
    while (next <= today) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  const dom = parseInt(dayOfMonth) || 1;
  let candidate = new Date(start.getFullYear(), start.getMonth(), Math.min(dom, 28));

  const addPeriod = (d) => {
    if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  };

  while (candidate <= today) {
    addPeriod(candidate);
  }
  return candidate;
}

export default function RecurringInvoiceModal({ isOpen, onClose, editItem, settings, onSaved }) {
  const { addToast } = useToastStore();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const defaultVat = parseFloat((settings?.invoicing?.vatRate ?? 8.1).toFixed(2));

  const [form, setForm] = useState({
    projectId: '',
    lines: [getDefaultLine()],
    frequency: 'monthly',
    dayOfMonth: 1,
    startDate: new Date().toISOString().slice(0, 10),
    hasEndDate: false,
    endDate: '',
    vatRate: defaultVat,
    paymentDays: 30,
    notes: '',
    autoSend: false,
  });

  // Load projects
  useEffect(() => {
    if (!isOpen) return;
    setLoadingProjects(true);
    projectsApi.getAll({ limit: 200 })
      .then(res => setProjects(res.data?.data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (!isOpen) return;
    if (editItem) {
      setForm({
        projectId: editItem.project?._id || editItem.project || '',
        lines: editItem.customLines?.length
          ? editItem.customLines.map(l => ({ description: l.description || '', quantity: l.quantity ?? 1, unitPrice: l.unitPrice ?? 0 }))
          : [getDefaultLine()],
        frequency: editItem.frequency || 'monthly',
        dayOfMonth: editItem.dayOfMonth ?? 1,
        startDate: editItem.startDate ? editItem.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        hasEndDate: !!editItem.endDate,
        endDate: editItem.endDate ? editItem.endDate.slice(0, 10) : '',
        vatRate: editItem.vatRate ?? defaultVat,
        paymentDays: editItem.paymentTermsDays ?? 30,
        notes: editItem.notes || '',
        autoSend: editItem.autoSend ?? false,
      });
    } else {
      setForm({
        projectId: '',
        lines: [getDefaultLine()],
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date().toISOString().slice(0, 10),
        hasEndDate: false,
        endDate: '',
        vatRate: defaultVat,
        paymentDays: 30,
        notes: '',
        autoSend: false,
      });
    }
  }, [isOpen, editItem]);

  const isCancelled = editItem?.status === 'cancelled';
  const selectedProject = projects.find(p => p._id === form.projectId);

  // Lines helpers
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, getDefaultLine()] }));
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

  // Totals
  const roundTo5ct = (amount) => Math.round(amount / 0.05) * 0.05;
  const subtotal = form.lines.reduce((sum, l) => sum + getLineTotal(l), 0);
  const vatAmount = subtotal * (parseFloat(form.vatRate) || 0) / 100;
  const total = roundTo5ct(subtotal + vatAmount);

  const nextDate = computeNextDate(form.startDate, form.frequency, form.dayOfMonth);

  const showDayOfMonth = ['monthly', 'quarterly', 'yearly'].includes(form.frequency);

  const isValid = form.projectId
    && form.lines.every(l => l.description.trim() !== '' && parseFloat(l.quantity) > 0)
    && form.startDate;

  const handleSave = async () => {
    if (!isValid || isCancelled) return;
    setSaving(true);
    try {
      const payload = {
        project: form.projectId,
        customLines: form.lines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice) || 0,
        })),
        frequency: form.frequency,
        dayOfMonth: showDayOfMonth ? (parseInt(form.dayOfMonth) || 1) : undefined,
        startDate: form.startDate,
        endDate: form.hasEndDate && form.endDate ? form.endDate : undefined,
        vatRate: parseFloat(form.vatRate) || 0,
        paymentTermsDays: parseInt(form.paymentDays) || 30,
        notes: form.notes || undefined,
        autoSend: form.autoSend,
      };

      if (editItem) {
        await recurringInvoicesApi.update(editItem._id, payload);
        addToast({ type: 'success', message: 'Récurrence mise à jour' });
      } else {
        await recurringInvoicesApi.create(payload);
        addToast({ type: 'success', message: 'Récurrence créée' });
      }
      onSaved();
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.error || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Modifier la récurrence' : 'Nouvelle récurrence'}
      size="lg"
    >
      <div className="space-y-5 -m-6 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isCancelled && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-lg text-sm text-red-700 dark:text-red-300">
              Cette récurrence est annulée et ne peut plus être modifiée.
            </div>
          )}

          {/* Projet */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Projet <span className="text-red-500">*</span>
            </label>
            <select
              value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              disabled={isCancelled || loadingProjects}
              className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Sélectionner un projet...</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProject?.client && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Client : {selectedProject.client.name || selectedProject.client.company || '—'}
              </p>
            )}
          </div>

          {/* Lignes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Lignes de facturation
            </label>
            <LinesEditor
              lines={form.lines}
              updateLine={updateLine}
              removeLine={removeLine}
              addLine={addLine}
              disabled={isCancelled}
            />
          </div>

          {/* Fréquence et dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Fréquence
              </label>
              <select
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                disabled={isCancelled}
                className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isCancelled}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Date de début"
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                disabled={isCancelled}
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
                  disabled={isCancelled}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
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
                  disabled={isCancelled}
                  className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg disabled:opacity-50 disabled:cursor-not-allowed"
                />
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 pt-1.5">Sans fin</p>
              )}
            </div>
          </div>

          {/* TVA + délai */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="TVA (%)"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.vatRate}
                onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))}
                disabled={isCancelled}
              />
            </div>
            <div>
              <Input
                label="Délai de paiement (jours)"
                type="number"
                min="0"
                value={form.paymentDays}
                onChange={e => setForm(f => ({ ...f, paymentDays: e.target.value }))}
                disabled={isCancelled}
              />
            </div>
          </div>

          {/* Notes */}
          <Textarea
            label="Notes (optionnel)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Remarques, conditions..."
            rows={2}
            disabled={isCancelled}
          />

          {/* Auto-send toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-dark-border rounded-xl">
            <div>
              <div className="font-medium text-slate-900 dark:text-white text-sm">
                Envoi automatique par email
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                La facture sera envoyée automatiquement lors de la génération
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, autoSend: !f.autoSend }))}
              disabled={isCancelled}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-bg disabled:opacity-50 disabled:cursor-not-allowed ${
                form.autoSend ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.autoSend ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Summary */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-dark-border rounded-xl space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Résumé
            </p>
            <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
              <span>TVA ({parseFloat(form.vatRate).toFixed(1)}%)</span>
              <span>{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-2 mt-1">
              <span>Total / {FREQUENCY_LABELS[form.frequency] || form.frequency}</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {nextDate && (
              <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Prochaine facture : {formatDate(nextDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-dark-border flex-shrink-0">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          {!isCancelled && (
            <Button
              icon={Save}
              onClick={handleSave}
              loading={saving}
              disabled={!isValid || saving}
              className="flex-1"
            >
              {editItem ? 'Enregistrer' : 'Créer'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
