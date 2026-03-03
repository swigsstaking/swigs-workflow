import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, Pause, Play, Trash2, Edit2, Zap,
  Calendar, AlertCircle, ChevronDown, ChevronUp,
  Receipt, Send, Check, FileDown, Mail
} from 'lucide-react';
import { recurringInvoicesApi, invoicesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { InvoiceStatusBadge } from '../../ui/Badge';
import RecurringInvoiceModal from './RecurringInvoiceModal';
import { formatCurrency } from '../../../utils/format';

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

function RecurringRow({ item, onEdit, onChangeStatus, onDelete, onGenerate, onRefresh, generatingId, deletingId, statusChangingId }) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [missingEmailWarning, setMissingEmailWarning] = useState(false);
  const { addToast } = useToastStore();

  const clientEmail = item.project?.client?.email;
  const clientName = item.project?.client?.name || item.project?.client?.company || '—';
  const projectName = item.project?.name || '—';
  const total = getTotal(item);
  const generatedInvoices = item.generatedInvoices || [];
  const [autoSendLocal, setAutoSendLocal] = useState(item.autoSend || false);
  const [togglingAutoSend, setTogglingAutoSend] = useState(false);

  const handleToggleAutoSend = async () => {
    if (!autoSendLocal && !clientEmail) {
      setMissingEmailWarning(true);
      return;
    }
    setTogglingAutoSend(true);
    const newVal = !autoSendLocal;
    try {
      await recurringInvoicesApi.update(item._id, { autoSend: newVal });
      setAutoSendLocal(newVal);
      addToast({ type: 'success', message: newVal ? 'Envoi automatique activé' : 'Envoi automatique désactivé' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la mise à jour' });
    } finally {
      setTogglingAutoSend(false);
    }
  };

  const handleSendEmail = async (invoiceId) => {
    if (!clientEmail) {
      setMissingEmailWarning(true);
      return;
    }
    setActionLoading(invoiceId);
    try {
      await invoicesApi.send(invoiceId);
      addToast({ type: 'success', message: 'Facture envoyée par email' });
      onRefresh();
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.error || 'Erreur lors de l\'envoi' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvoiceStatus = async (invoiceId, newStatus) => {
    setActionLoading(invoiceId);
    try {
      await invoicesApi.changeStatus(invoiceId, newStatus);
      addToast({ type: 'success', message: newStatus === 'sent' ? 'Facture marquée envoyée' : 'Facture marquée payée' });
      onRefresh();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async (invoiceId, number) => {
    setActionLoading(invoiceId);
    try {
      const { data } = await invoicesApi.getPdf(invoiceId);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number || 'facture'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du téléchargement du PDF' });
    } finally {
      setActionLoading(null);
    }
  };

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
            <div className="col-span-2 flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <Zap className={`w-3 h-3 ${autoSendLocal ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span className={autoSendLocal ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                  Envoi automatique {autoSendLocal ? 'activé' : 'désactivé'}
                </span>
              </div>
              {item.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={handleToggleAutoSend}
                  disabled={togglingAutoSend}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 ${
                    autoSendLocal ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    autoSendLocal ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`} />
                </button>
              )}
            </div>
            {item.notes && (
              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Notes : </span>
                <span className="text-slate-700 dark:text-slate-300">{item.notes}</span>
              </div>
            )}
          </div>

          {/* Generated Invoices */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Factures générées ({generatedInvoices.length})
            </p>
            {generatedInvoices.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                Aucune facture générée.
                {item.nextGenerationDate && (
                  <span className="ml-1">Prochaine génération : {formatDate(item.nextGenerationDate)}</span>
                )}
              </p>
            ) : (
              <div className="space-y-1.5">
                {generatedInvoices.map(inv => (
                  <div key={inv._id} className="flex items-center gap-3 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300 min-w-[120px]">
                      {inv.number || '—'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      {formatDate(inv.issueDate)}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(inv.total)}
                    </span>
                    <InvoiceStatusBadge status={inv.status} />
                    <div className="flex items-center gap-1 ml-auto">
                      {inv.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendEmail(inv._id)}
                            disabled={actionLoading === inv._id}
                            title="Envoyer par email"
                            className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInvoiceStatus(inv._id, 'sent')}
                            disabled={actionLoading === inv._id}
                            title="Marquer envoyée (sans email)"
                            className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {inv.status === 'sent' && (
                        <button
                          type="button"
                          onClick={() => handleInvoiceStatus(inv._id, 'paid')}
                          disabled={actionLoading === inv._id}
                          title="Marquer payée"
                          className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(inv._id, inv.number)}
                        disabled={actionLoading === inv._id}
                        title="Télécharger PDF"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={missingEmailWarning}
        onClose={() => setMissingEmailWarning(false)}
        onConfirm={() => setMissingEmailWarning(false)}
        title="Email client manquant"
        message={`Le client "${clientName}" n'a pas d'adresse email configurée. L'envoi automatique et les rappels ne fonctionneront pas. Ajoutez un email dans les informations du projet.`}
        confirmLabel="Compris"
        cancelLabel="Fermer"
      />
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
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await recurringInvoicesApi.getAll();
      setItems(data?.data || []);
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

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    try {
      await recurringInvoicesApi.delete(deleteConfirmId);
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
              onRefresh={load}
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

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer la récurrence"
        message="Supprimer cette récurrence ? Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
