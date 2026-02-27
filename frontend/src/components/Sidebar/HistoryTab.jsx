import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FolderPlus, RefreshCw, Archive, RotateCcw,
  Tag, Calendar, FileText, Receipt, CheckCircle,
  XCircle, Send, PenTool, History, Bell, BellOff, Landmark
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

const actionConfig = {
  project_created:   { icon: FolderPlus,  color: '#10B981', label: 'Projet créé' },
  project_updated:   { icon: RefreshCw,   color: '#3B82F6', label: 'Projet modifié' },
  project_archived:  { icon: Archive,     color: '#6B7280', label: 'Projet archivé' },
  project_restored:  { icon: RotateCcw,   color: '#8B5CF6', label: 'Projet restauré' },
  status_change:     { icon: Tag,         color: '#F59E0B', label: 'Statut changé' },
  event_added:       { icon: Calendar,    color: '#3B82F6', label: 'Événement ajouté' },
  event_updated:     { icon: RefreshCw,   color: '#6B7280', label: 'Événement modifié' },
  event_deleted:     { icon: XCircle,     color: '#EF4444', label: 'Événement supprimé' },
  quote_created:     { icon: FileText,    color: '#8B5CF6', label: 'Devis créé' },
  quote_sent:        { icon: Send,        color: '#3B82F6', label: 'Devis envoyé' },
  quote_signed:      { icon: PenTool,     color: '#10B981', label: 'Devis signé' },
  quote_refused:     { icon: XCircle,     color: '#EF4444', label: 'Devis refusé' },
  invoice_created:   { icon: Receipt,     color: '#F59E0B', label: 'Facture créée' },
  invoice_sent:      { icon: Send,        color: '#3B82F6', label: 'Facture envoyée' },
  invoice_paid:      { icon: CheckCircle, color: '#10B981', label: 'Facture payée' },
  invoice_cancelled: { icon: XCircle,     color: '#EF4444', label: 'Facture annulée' },
  invoice_deleted:   { icon: XCircle,     color: '#6B7280', label: 'Facture supprimée' },
  bank_import:       { icon: Landmark,    color: '#3B82F6', label: 'Import bancaire' },
  bank_reconciled:   { icon: Landmark,    color: '#10B981', label: 'Rapprochement bancaire' },
  reminder_sent:     { icon: Bell,        color: '#F59E0B', label: 'Rappel envoyé' },
  reminder_failed:   { icon: BellOff,     color: '#EF4444', label: 'Rappel échoué' },
};

export default function HistoryTab({ project }) {
  const { projectHistory } = useProjectStore();

  return (
    <div className="p-5">
      <p className="text-xs text-[rgb(var(--swigs-stone))] dark:text-zinc-500 mb-5 leading-relaxed">
        Historique complet et immuable des actions sur ce projet.
      </p>

      {projectHistory.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[rgb(var(--swigs-cream)/0.6)] dark:bg-zinc-800 border border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border flex items-center justify-center mb-4">
            <History className="w-6 h-6 text-[rgb(var(--swigs-stone))]" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Aucune activité enregistrée</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline vertical line — swigs-stone */}
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[rgb(var(--swigs-stone)/0.3)] dark:bg-dark-border" />

          <div className="space-y-3">
            {projectHistory.map((entry) => {
              const config = actionConfig[entry.action] || { icon: RefreshCw, color: '#C8C3BC', label: entry.action };
              const Icon = config.icon;

              return (
                <div key={entry._id} className="relative flex gap-3.5">
                  {/* Icon dot on timeline */}
                  <div
                    className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-[3px] border-white dark:border-dark-card flex-shrink-0"
                    style={{ backgroundColor: `${config.color}22` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>

                  {/* Content card */}
                  <div className="flex-1 pb-1">
                    <div className="
                      bg-white dark:bg-dark-card
                      border border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border
                      rounded-[8px] px-3.5 py-2.5
                    ">
                      <p className="text-[13px] font-medium text-slate-900 dark:text-white leading-snug">
                        {entry.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: config.color }}>
                          {config.label}
                        </span>
                        <span className="text-[rgb(var(--swigs-stone))] dark:text-zinc-600">·</span>
                        <span className="text-[11px] text-[rgb(var(--swigs-stone))] dark:text-zinc-500">
                          {format(new Date(entry.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
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
