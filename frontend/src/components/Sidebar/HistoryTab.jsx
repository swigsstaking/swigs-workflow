import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FolderPlus, RefreshCw, Archive, RotateCcw,
  Tag, Calendar, FileText, Receipt, CheckCircle,
  XCircle, Send, PenTool, History
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

const actionConfig = {
  project_created: { icon: FolderPlus, color: '#10B981' },
  project_updated: { icon: RefreshCw, color: '#3B82F6' },
  project_archived: { icon: Archive, color: '#6B7280' },
  project_restored: { icon: RotateCcw, color: '#8B5CF6' },
  status_change: { icon: Tag, color: '#F59E0B' },
  event_added: { icon: Calendar, color: '#3B82F6' },
  event_updated: { icon: RefreshCw, color: '#6B7280' },
  event_deleted: { icon: XCircle, color: '#EF4444' },
  quote_created: { icon: FileText, color: '#8B5CF6' },
  quote_sent: { icon: Send, color: '#3B82F6' },
  quote_signed: { icon: PenTool, color: '#10B981' },
  quote_refused: { icon: XCircle, color: '#EF4444' },
  invoice_created: { icon: Receipt, color: '#F59E0B' },
  invoice_sent: { icon: Send, color: '#3B82F6' },
  invoice_paid: { icon: CheckCircle, color: '#10B981' },
  invoice_cancelled: { icon: XCircle, color: '#EF4444' }
};

export default function HistoryTab({ project }) {
  const { projectHistory } = useProjectStore();

  return (
    <div className="p-6">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Historique complet et immuable des actions sur ce projet.
      </p>

      {projectHistory.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">Aucune activité enregistrée</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-dark-border" />

          <div className="space-y-4">
            {projectHistory.map((entry, index) => {
              const config = actionConfig[entry.action] || { icon: RefreshCw, color: '#6B7280' };
              const Icon = config.icon;

              return (
                <div key={entry._id} className="relative flex gap-4">
                  {/* Icon */}
                  <div
                    className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white dark:border-dark-card"
                    style={{ backgroundColor: `${config.color}30` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <p className="text-sm text-slate-900 dark:text-white">
                      {entry.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {format(new Date(entry.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
