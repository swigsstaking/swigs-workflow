import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, Pause, Play, Trash2, Edit2, Zap,
  Calendar, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { recurringInvoicesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import RecurringInvoiceModal from './RecurringInvoiceModal';

const FREQUENCY_LABELS = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
};

const FREQUENCY_BADGE = {
  weekly: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  monthly: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  quarterly: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  yearly: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function getTotal(item) {
  const lines = item?.customLines || item?.lines || [];
  if (!lines.length) return 0;
  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  return subtotal * (1 + (parseFloat(item.vatRate) || 0) / 100);
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Actif
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
        <Pause className="w-3 h-3" />
        En pause
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      Annulé
    </span>
  );
}

function RecurringRow({ item, onEdit, onChangeStatus, onDelete, onGenerate, generatingId, deletingId, statusChangingId }) {
  const [expanded, setExpanded] = useState(false);

  const clientName = item.project?.client?.name || item.project?.client?.company || '—';
  const projectName = item.project?.name || '—';
  const total = getTotal(item);

  return (
    <div className="border border-slate-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-card">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-primary-50 dark:bg-primary-900/20">
          <RefreshCw className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
              {projectName}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${FREQUENCY_BADGE[item.frequency] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {FREQUENCY_LABELS[item.frequency] || item.frequency}
            </span>
            <StatusBadge status={item.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {clientName}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {formatCurrency(total)}
            </span>
            {item.nextDate && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3" />
                {formatDate(item.nextDate)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.status !== 'cancelled' && (
            <>
              <button
                type="button"
                onClick={() => onGenerate(item._id)}
                disabled={generatingId === item._id}
                title="Générer maintenant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingId === item._id
                  ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  : <Zap className="w-4 h-4" />
                }
              </button>

              {item.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => onChangeStatus(item._id, 'paused')}
                  disabled={statusChangingId === item._id}
                  title="Mettre en pause"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onChangeStatus(item._id, 'active')}
                  disabled={statusChangingId === item._id}
                  title="Reprendre"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onEdit(item)}
                title="Modifier"
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onDelete(item._id)}
            disabled={deletingId === item._id}
            title="Supprimer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Réduire' : 'Détails'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
          {/* Lines */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Lignes
            </p>
            <div className="space-y-1">
              {(item.customLines || item.lines || []).map((line, i) => (
                <div key={i} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                  <span className="truncate flex-1 mr-4">{line.description}</span>
                  <span className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                    {line.quantity} × {formatCurrency(line.unitPrice)}
                  </span>
                  <span className="flex-shrink-0 ml-3 font-medium">
                    {formatCurrency((line.quantity || 0) * (line.unitPrice || 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dates + config */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Début</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(item.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fin</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.endDate ? formatDate(item.endDate) : 'Sans fin'}</span>
            </div>
            <div className="flex justify-between">
              <span>TVA</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{parseFloat(item.vatRate ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Délai paiement</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.paymentDays ?? 30} jours</span>
            </div>
            {item.autoSend && (
              <div className="col-span-2 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-3 h-3" />
                <span>Envoi automatique activé</span>
              </div>
            )}
            {item.notes && (
              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Notes : </span>
                <span className="text-slate-700 dark:text-slate-300">{item.notes}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecurringSection({ settings }) {
  const { addToast } = useToastStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusChangingId, setStatusChangingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recurringInvoicesApi.getAll();
      setItems(res?.data || []);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du chargement des récurrences' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = () => {
    setEditItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleChangeStatus = async (id, status) => {
    setStatusChangingId(id);
    try {
      await recurringInvoicesApi.changeStatus(id, status);
      addToast({ type: 'success', message: status === 'active' ? 'Récurrence reprise' : 'Récurrence mise en pause' });
      await load();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette récurrence ? Cette action est irréversible.')) return;
    setDeletingId(id);
    try {
      await recurringInvoicesApi.delete(id);
      addToast({ type: 'success', message: 'Récurrence supprimée' });
      await load();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerate = async (id) => {
    setGeneratingId(id);
    try {
      await recurringInvoicesApi.generateNow(id);
      addToast({ type: 'success', message: 'Facture générée avec succès' });
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.error || 'Erreur lors de la génération' });
    } finally {
      setGeneratingId(null);
    }
  };

  const activeCount = items.filter(i => i.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Facturation récurrente
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Configurez des factures générées automatiquement à intervalles réguliers.
        </p>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
          Les factures sont générées automatiquement selon la fréquence choisie. Vous pouvez aussi les générer
          manuellement avec le bouton <Zap className="w-3.5 h-3.5 inline" />.
          {activeCount > 0 && (
            <span className="ml-1 font-semibold">{activeCount} récurrence{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}.</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Récurrences ({items.length})
        </h3>
        <Button icon={Plus} onClick={handleNew} size="sm">
          Nouvelle récurrence
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <RefreshCw className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">Aucune récurrence</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
            Créez une récurrence pour automatiser la génération de vos factures périodiques.
          </p>
          <Button icon={Plus} onClick={handleNew} size="sm">
            Nouvelle récurrence
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <RecurringRow
              key={item._id}
              item={item}
              onEdit={handleEdit}
              onChangeStatus={handleChangeStatus}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
              generatingId={generatingId}
              deletingId={deletingId}
              statusChangingId={statusChangingId}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <RecurringInvoiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editItem={editItem}
        settings={settings}
        onSaved={load}
      />
    </div>
  );
}
