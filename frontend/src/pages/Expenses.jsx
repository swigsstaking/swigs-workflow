import { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Plus, Loader2, AlertCircle, CheckCircle2,
  Clock, XCircle, Banknote, ChevronDown, Trash2, Send,
  FileText, Filter,
} from 'lucide-react';
import { expensesApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select, Textarea } from '../components/ui/Input';
import { formatCurrency } from '../utils/format';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'vehicle_fuel',        label: 'Carburant' },
  { value: 'vehicle_maintenance', label: 'Entretien véhicule' },
  { value: 'meal',                label: 'Repas' },
  { value: 'travel',              label: 'Voyage & déplacement' },
  { value: 'office_supplies',     label: 'Fournitures bureau' },
  { value: 'phone_internet',      label: 'Téléphone & internet' },
  { value: 'other',               label: 'Autre' },
];

const STATUS_CONFIG = {
  draft:      { label: 'Brouillon',  icon: FileText,    color: 'text-slate-500 dark:text-zinc-400',   bg: 'bg-slate-100 dark:bg-zinc-800' },
  submitted:  { label: 'Soumise',    icon: Clock,       color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
  approved:   { label: 'Approuvée',  icon: CheckCircle2,color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  reimbursed: { label: 'Remboursée', icon: Banknote,    color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
  rejected:   { label: 'Refusée',    icon: XCircle,     color: 'text-red-500 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-500/10' },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';

function getCategoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function ExpenseFormModal({ isOpen, onClose, onSuccess, user }) {
  const { addToast } = useToastStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeName: user?.name || '',
    category: 'other',
    description: '',
    amountTtc: '',
    amountHt: '',
    tvaRate: '8.1',
    date: new Date().toISOString().slice(0, 10),
    attachmentUrl: '',
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amountTtc || Number(form.amountTtc) <= 0) {
      addToast({ type: 'error', message: 'Montant TTC requis et > 0' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeName: form.employeeName || user?.name,
        category: form.category,
        description: form.description || undefined,
        amountTtc: Number(form.amountTtc),
        amountHt: form.amountHt ? Number(form.amountHt) : undefined,
        tvaRate: form.tvaRate ? Number(form.tvaRate) : 0,
        date: form.date,
        attachmentUrl: form.attachmentUrl || undefined,
      };
      // Calculer TVA si HT et taux fournis
      if (payload.amountHt && payload.tvaRate) {
        payload.amountTva = Math.round((payload.amountHt * payload.tvaRate / 100) * 100) / 100;
      }
      await expensesApi.create(payload);
      addToast({ type: 'success', message: 'Note de frais créée' });
      onSuccess();
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle note de frais" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Employé / Bénéficiaire"
          value={form.employeeName}
          onChange={set('employeeName')}
          placeholder={user?.name || 'Nom'}
          required
        />

        <Select
          label="Catégorie"
          value={form.category}
          onChange={set('category')}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>

        <Textarea
          label="Description"
          value={form.description}
          onChange={set('description')}
          placeholder="Ticket carburant, repas client, achat..."
          rows={2}
          autoResize
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Montant TTC (CHF) *"
            type="number"
            step="0.01"
            min="0"
            value={form.amountTtc}
            onChange={set('amountTtc')}
            placeholder="0.00"
            required
          />
          <Input
            label="Montant HT (CHF)"
            type="number"
            step="0.01"
            min="0"
            value={form.amountHt}
            onChange={set('amountHt')}
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Taux TVA (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.tvaRate}
            onChange={set('tvaRate')}
            placeholder="8.1"
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={set('date')}
          />
        </div>

        <Input
          label="URL justificatif (facultatif)"
          type="url"
          value={form.attachmentUrl}
          onChange={set('attachmentUrl')}
          placeholder="https://..."
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-zinc-700">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" loading={saving} icon={Plus}>
            Créer la note
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onSubmit, onDelete, submitting }) {
  const isDraft = expense.status === 'draft';

  return (
    <tr className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
      <td className="py-3 px-4 text-sm text-slate-500 dark:text-zinc-400 whitespace-nowrap">
        {fmtDate(expense.date)}
      </td>
      <td className="py-3 px-4">
        <div className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate max-w-[180px]">
          {expense.description || getCategoryLabel(expense.category)}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-zinc-500">{expense.employeeName}</div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-500 dark:text-zinc-400 hidden sm:table-cell">
        {getCategoryLabel(expense.category)}
      </td>
      <td className="py-3 px-4 text-sm font-semibold text-slate-800 dark:text-zinc-100 text-right whitespace-nowrap">
        {formatCurrency(expense.amountTtc)}
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <StatusBadge status={expense.status} />
        {expense.lexaIngested && (
          <span className="ml-1 text-[10px] text-emerald-500 dark:text-emerald-400" title="Ingéré par Lexa">
            ✓ Lexa
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isDraft && (
            <>
              <button
                onClick={() => onSubmit(expense._id)}
                disabled={submitting === expense._id}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium rounded-[6px] bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                title="Soumettre pour approbation (publie vers Lexa)"
              >
                {submitting === expense._id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Send className="w-3 h-3" />
                }
                <span className="hidden sm:inline">Soumettre</span>
              </button>
              <button
                onClick={() => onDelete(expense._id)}
                className="p-1 rounded-[6px] text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Expenses() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(null); // id en cours de soumission
  const [filterStatus, setFilterStatus] = useState('');

  const fetchExpenses = useCallback(async () => {
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const res = await expensesApi.getAll(params);
      setExpenses(res.data.data || []);
    } catch {
      addToast({ type: 'error', message: 'Erreur de chargement des notes de frais' });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, addToast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (id) => {
    setSubmitting(id);
    try {
      await expensesApi.submit(id);
      addToast({ type: 'success', message: 'Note soumise — envoyée vers Lexa pour comptabilisation' });
      fetchExpenses();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors de la soumission' });
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette note de frais ?')) return;
    try {
      await expensesApi.remove(id);
      addToast({ type: 'success', message: 'Note supprimée' });
      fetchExpenses();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors de la suppression' });
    }
  };

  // Stats rapides
  const stats = {
    total:     expenses.length,
    draft:     expenses.filter((e) => e.status === 'draft').length,
    submitted: expenses.filter((e) => e.status === 'submitted').length,
    totalTtc:  expenses.reduce((s, e) => s + (e.amountTtc || 0), 0),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-500" />
            Notes de frais
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Gérez vos dépenses professionnelles et soumettez-les pour remboursement.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setShowCreate(true)}>
          Nouvelle note
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',       value: stats.total,     suffix: 'notes' },
          { label: 'Brouillons',  value: stats.draft,     suffix: '' },
          { label: 'En attente',  value: stats.submitted, suffix: '' },
          { label: 'Montant TTC', value: formatCurrency(stats.totalTtc), suffix: '' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-3"
          >
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">{kpi.label}</div>
            <div className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              {kpi.value}{kpi.suffix && <span className="text-sm font-normal text-slate-400 dark:text-zinc-500 ml-1">{kpi.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-[13px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-zinc-500">
            <Receipt className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune note de frais</p>
            <p className="text-xs mt-1">Cliquez sur "Nouvelle note" pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/30">
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Date</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Description</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide hidden sm:table-cell">Catégorie</th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Montant TTC</th>
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide hidden md:table-cell">Statut</th>
                  <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <ExpenseRow
                    key={expense._id}
                    expense={expense}
                    onSubmit={handleSubmit}
                    onDelete={handleDelete}
                    submitting={submitting}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Infos Lexa */}
      <div className="mt-4 flex items-start gap-2 text-xs text-slate-400 dark:text-zinc-500">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Lors de la soumission, la note est automatiquement transmise à{' '}
          <strong className="text-slate-500 dark:text-zinc-400">Lexa</strong> pour création d'écriture comptable (compte 6xxx / 1020).
        </span>
      </div>

      {/* Modals */}
      {showCreate && (
        <ExpenseFormModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={fetchExpenses}
          user={user}
        />
      )}
    </div>
  );
}
