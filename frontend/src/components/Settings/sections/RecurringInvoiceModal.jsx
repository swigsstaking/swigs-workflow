import { useState, useEffect } from 'react';
import { X, RefreshCw, Plus, Trash2, Calendar, Save } from 'lucide-react';
import { recurringInvoicesApi, projectsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';

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

function getLineTotal(line) {
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isNaN(qty) || isNaN(price)) return 0;
  return qty * price;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
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

  const defaultVat = settings?.invoicing?.vatRate ?? 8.1;

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
        lines: editItem.lines?.length
          ? editItem.lines.map(l => ({ description: l.description || '', quantity: l.quantity ?? 1, unitPrice: l.unitPrice ?? 0 }))
          : [getDefaultLine()],
        frequency: editItem.frequency || 'monthly',
        dayOfMonth: editItem.dayOfMonth ?? 1,
        startDate: editItem.startDate ? editItem.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        hasEndDate: !!editItem.endDate,
        endDate: editItem.endDate ? editItem.endDate.slice(0, 10) : '',
        vatRate: editItem.vatRate ?? defaultVat,
        paymentDays: editItem.paymentDays ?? 30,
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

  if (!isOpen) return null;

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
  const subtotal = form.lines.reduce((sum, l) => sum + getLineTotal(l), 0);
  const vatAmount = subtotal * (parseFloat(form.vatRate) || 0) / 100;
  const total = subtotal + vatAmount;

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
        lines: form.lines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice) || 0,
        })),
        frequency: form.frequency,
        dayOfMonth: showDayOfMonth ? (parseInt(form.dayOfMonth) || 1) : undefined,
        startDate: form.startDate,
        endDate: form.hasEndDate && form.endDate ? form.endDate : undefined,
        vatRate: parseFloat(form.vatRate) || 0,
        paymentDays: parseInt(form.paymentDays) || 30,
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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {editItem ? 'Modifier la récurrence' : 'Nouvelle récurrence'}
            </h3>
            {isCancelled && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                Annulée
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Lignes de facturation
              </label>
            </div>

            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-center">Qté</div>
              <div className="col-span-2 text-center">Prix unit.</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {form.lines.map((line, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30"
              >
                <div className="col-span-6">
                  <input
                    type="text"
                    value={line.description}
                    onChange={e => updateLine(i, 'description', e.target.value)}
                    placeholder="Description..."
                    disabled={isCancelled}
                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.quantity === '' ? '' : line.quantity}
                    onChange={e => updateLine(i, 'quantity', e.target.value === '' ? '' : e.target.value)}
                    onBlur={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)}
                    disabled={isCancelled}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice === '' ? '' : line.unitPrice}
                    onChange={e => updateLine(i, 'unitPrice', e.target.value === '' ? '' : e.target.value)}
                    onBlur={e => updateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                    disabled={isCancelled}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(getLineTotal(line))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={form.lines.length === 1 || isCancelled}
                    className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {!isCancelled && (
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
              <span>TVA ({form.vatRate}%)</span>
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
    </div>
  );
}
