import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Play, Pause, Settings, Trash2, ChevronRight,
  Zap, Mail, Clock, GitBranch, MoreVertical, Activity,
  ShoppingCart, CreditCard, Package, CheckCircle, UserPlus,
  FileText, Receipt, PenTool, Hand
} from 'lucide-react';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAutomationStore } from '../stores/automationStore';
import { useToastStore } from '../stores/toastStore';
import AutomationBuilder from '../components/Automations/AutomationBuilder';
import NewAutomationModal from '../components/Automations/NewAutomationModal';
import { Skeleton } from '../components/ui/Skeleton';

const TRIGGER_LABELS = {
  'order.created': 'Nouvelle commande',
  'order.paid': 'Commande payée',
  'order.shipped': 'Commande expédiée',
  'order.delivered': 'Commande livrée',
  'customer.created': 'Nouveau client',
  'customer.updated': 'Client modifié',
  'project.status_changed': 'Statut projet changé',
  'invoice.created': 'Facture créée',
  'invoice.paid': 'Facture payée',
  'quote.signed': 'Devis signé',
  'time.schedule': 'Planifié',
  'manual': 'Manuel'
};

const TRIGGER_ICONS = {
  'order.created': ShoppingCart,
  'order.paid': CreditCard,
  'order.shipped': Package,
  'order.delivered': CheckCircle,
  'customer.created': UserPlus,
  'customer.updated': UserPlus,
  'project.status_changed': Activity,
  'invoice.created': FileText,
  'invoice.paid': Receipt,
  'quote.signed': PenTool,
  'time.schedule': Clock,
  'manual': Hand
};

export default function Automations() {
  const {
    automations,
    selectedAutomation,
    loading,
    fetchAutomations,
    toggleAutomation,
    deleteAutomation,
    clearSelection
  } = useAutomationStore();
  const { addToast } = useToastStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleEdit = (automation) => {
    setEditingAutomation(automation);
  };

  const handleCloseBuilder = () => {
    setEditingAutomation(null);
    fetchAutomations();
  };

  const handleToggle = async (automation) => {
    setTogglingId(automation._id);
    try {
      await toggleAutomation(automation._id);
      addToast({
        type: 'success',
        message: automation.isActive ? 'Automation désactivée' : 'Automation activée'
      });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la modification de l\'automation' });
    } finally {
      setTogglingId(null);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = async (automation) => {
    setDeleteTarget(automation);
    setActiveMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAutomation(deleteTarget._id);
      addToast({ type: 'success', message: 'Automation supprimée' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      setDeleteTarget(null);
    }
  };

  // If editing, show the builder
  if (editingAutomation) {
    return (
      <AutomationBuilder
        automation={editingAutomation}
        onClose={handleCloseBuilder}
      />
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Automations
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Créez des workflows automatisés pour vos emails et notifications
            </p>
          </div>
          <Button icon={Plus} onClick={() => setShowNewModal(true)}>
            Nouvelle automation
          </Button>
        </div>

        {/* Automations Grid */}
        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="w-20 h-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Zap className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              Aucune automation
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Créez votre première automation pour envoyer des emails automatiquement
              quand certains événements se produisent.
            </p>
            <Button icon={Plus} onClick={() => setShowNewModal(true)}>
              Créer une automation
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {automations.map((automation) => (
              <motion.div
                key={automation._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  relative p-4 rounded-xl border transition-all cursor-pointer
                  ${automation.isActive
                    ? 'bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-700'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50'
                  }
                `}
                onClick={() => handleEdit(automation)}
              >
                <div className="flex items-center gap-4">
                  {/* Trigger Icon */}
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${automation.isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }
                  `}>
                    {(() => {
                      const Icon = TRIGGER_ICONS[automation.triggerType] || Zap;
                      return <Icon className="w-6 h-6" />;
                    })()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {automation.name}
                      </h3>
                      {automation.isActive ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {TRIGGER_LABELS[automation.triggerType] || automation.triggerType}
                      {automation.description && ` • ${automation.description}`}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {automation.nodes?.length || 0}
                      </p>
                      <p className="text-xs text-slate-500">nodes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {automation.stats?.totalRuns || 0}
                      </p>
                      <p className="text-xs text-slate-500">exécutions</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggle(automation)}
                      disabled={togglingId === automation._id}
                      className={`
                        p-2 rounded-lg transition-colors disabled:opacity-50
                        ${automation.isActive
                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }
                      `}
                      title={automation.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {togglingId === automation._id ? (
                        <Activity className="w-5 h-5 animate-spin" />
                      ) : automation.isActive ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === automation._id ? null : automation._id)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenu === automation._id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-10">
                          <button
                            onClick={() => {
                              handleEdit(automation);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(automation)}
                            className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* New Automation Modal */}
        <NewAutomationModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={(automation) => {
            setShowNewModal(false);
            setEditingAutomation(automation);
          }}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Supprimer l'automation"
          message={`Êtes-vous sûr de vouloir supprimer "${deleteTarget?.name}" ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          variant="danger"
        />
      </div>
  );
}
