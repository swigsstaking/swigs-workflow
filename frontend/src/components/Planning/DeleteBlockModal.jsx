import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, X } from 'lucide-react';
import Button from '../ui/Button';

export default function DeleteBlockModal({ isOpen, block, onConfirm, onCancel }) {
  if (!isOpen || !block) return null;

  const startDate = new Date(block.start);
  const endDate = new Date(block.end);
  const projectName = block.project?.name || 'Projet';
  const statusColor = block.project?.status?.color || '#6B7280';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-dark-card rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Supprimer le bloc
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Êtes-vous sûr de vouloir supprimer ce bloc planifié ?
          </p>

          {/* Block preview */}
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: `${statusColor}15`,
              borderLeft: `3px solid ${statusColor}`
            }}
          >
            <p className="font-medium" style={{ color: statusColor }}>
              {projectName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {format(startDate, "EEEE d MMMM yyyy", { locale: fr })}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {format(startDate, 'HH:mm', { locale: fr })} - {format(endDate, 'HH:mm', { locale: fr })}
            </p>
            {block.notes && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
                {block.notes}
              </p>
            )}
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
            Cette action est irréversible.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg">
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
          >
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}
