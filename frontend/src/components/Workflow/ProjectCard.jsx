import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Euro, User, FileText, ChevronDown, Receipt, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';

const sizeConfig = {
  small: {
    padding: 'p-3',
    titleSize: 'text-sm',
    textSize: 'text-xs',
    iconSize: 'w-3 h-3',
    gap: 'gap-1',
    statusPadding: 'px-1.5 py-0.5'
  },
  medium: {
    padding: 'p-4',
    titleSize: 'text-base',
    textSize: 'text-sm',
    iconSize: 'w-3.5 h-3.5',
    gap: 'gap-1.5',
    statusPadding: 'px-2 py-0.5'
  },
  large: {
    padding: 'p-5',
    titleSize: 'text-lg',
    textSize: 'text-base',
    iconSize: 'w-4 h-4',
    gap: 'gap-2',
    statusPadding: 'px-2.5 py-1'
  }
};

export default function ProjectCard({
  project,
  onClick,
  cardStyle = 'left-border',
  cardSize = 'medium',
  isDragging = false,
  showArchived = false
}) {
  const { expandedCards, toggleCardExpanded } = useUIStore();
  const { restoreProject, fetchProjects } = useProjectStore();
  const { addToast } = useToastStore();
  const isExpanded = expandedCards[project._id] || false;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const statusColor = project.status?.color || '#6B7280';
  const size = sizeConfig[cardSize] || sizeConfig.medium;

  // Check if there's expandable content
  const hasExpandableContent =
    (project.recentEvents && project.recentEvents.length > 0) ||
    (project.recentQuotes && project.recentQuotes.length > 0);

  const getStyleProps = () => {
    if (cardStyle === 'full-border') {
      return {
        className: '',
        style: {
          borderColor: statusColor,
          borderWidth: '2px',
          borderStyle: 'solid'
        }
      };
    }
    return {
      className: 'border border-slate-200 dark:border-dark-border',
      style: {
        borderLeftColor: statusColor,
        borderLeftWidth: '4px'
      }
    };
  };

  const styleProps = getStyleProps();

  const handleExpandClick = (e) => {
    e.stopPropagation();
    toggleCardExpanded(project._id);
  };

  const getEventTotal = (event) => {
    if (event.type === 'hours') {
      return event.hours * event.hourlyRate;
    }
    if (event.type === 'expense') {
      return event.amount;
    }
    return 0;
  };

  const handleRestore = async (e) => {
    e.stopPropagation();
    try {
      await restoreProject(project._id);
      await fetchProjects({ archived: false });
      addToast({
        type: 'success',
        message: `Projet "${project.name}" restauré avec succès`
      });
    } catch (error) {
      console.error('Error restoring project:', error);
      addToast({
        type: 'error',
        message: 'Erreur lors de la restauration du projet'
      });
    }
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`
        bg-white dark:bg-dark-card rounded-xl shadow-sm
        transition-shadow duration-200
        overflow-hidden select-none
        ${styleProps.className}
        ${isDragging ? 'shadow-xl ring-2 ring-primary-500 scale-105' : 'hover:shadow-md'}
      `}
      style={{ ...styleProps.style, pointerEvents: isDragging ? 'none' : 'auto' }}
    >
      <div className={size.padding}>
        {/* Project name */}
        <h3 className={`font-semibold text-slate-900 dark:text-white truncate mb-1 ${size.titleSize}`}>
          {project.name}
        </h3>

        {/* Client */}
        <div className={`flex items-center ${size.gap} ${size.textSize} text-slate-500 dark:text-slate-300 mb-3`}>
          <User className={size.iconSize} />
          <span className="truncate">{project.client?.name}</span>
        </div>

        {/* Stats - Line 1: Amount + Hours */}
        {(project.unbilledTotal > 0 || project.unbilledHours > 0) && (
          <div className={`flex items-center gap-x-4 ${size.textSize} mb-1`}>
            {/* Unbilled Total */}
            {project.unbilledTotal > 0 && (
              <div className={`flex items-center ${size.gap} text-amber-600 dark:text-amber-400`}>
                <Euro className={size.iconSize} />
                <span className="font-medium">
                  {formatCurrency(project.unbilledTotal)}
                </span>
              </div>
            )}

            {/* Unbilled Hours */}
            {project.unbilledHours > 0 && (
              <div className={`flex items-center ${size.gap} text-slate-500 dark:text-slate-400`}>
                <Clock className={size.iconSize} />
                <span>{project.unbilledHours}h</span>
              </div>
            )}
          </div>
        )}

        {/* Stats - Line 2: Quotes */}
        {project.unbilledQuotesTotal > 0 && (
          <div className={`flex items-center ${size.gap} ${size.textSize} text-violet-600 dark:text-violet-400`}>
            <FileText className={size.iconSize} />
            <span className="font-medium">
              {formatCurrency(project.unbilledQuotesTotal)}
            </span>
            {project.unbilledQuotesCount > 1 && (
              <span className="text-xs opacity-70">({project.unbilledQuotesCount} devis)</span>
            )}
          </div>
        )}

        {/* Status badge + Restore/Expand button */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-border flex items-center justify-between">
          <span
            className={`inline-flex ${size.statusPadding} text-xs font-medium rounded-full`}
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor
            }}
          >
            {project.status?.name}
          </span>

          <div className="flex items-center gap-1">
            {showArchived && (
              <button
                onClick={handleRestore}
                className="px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1"
                title="Restaurer ce projet"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                Restaurer
              </button>
            )}

            {hasExpandableContent && (
              <motion.button
                onClick={handleExpandClick}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {isExpanded && hasExpandableContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.25, delay: 0.1 }
              }
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.15 }
              }
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Recent Events */}
              {project.recentEvents && project.recentEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    <Clock className="w-3 h-3" />
                    Événements récents
                  </div>
                  <div className="space-y-1.5">
                    {project.recentEvents.map((event) => (
                      <div
                        key={event._id}
                        className="flex items-center justify-between text-xs bg-slate-50 dark:bg-dark-bg rounded-lg px-2.5 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 dark:text-slate-300 truncate">
                            {event.description}
                          </p>
                          <p className="text-slate-400 dark:text-slate-500 text-[10px]">
                            {format(new Date(event.date), 'dd MMM', { locale: fr })}
                            {event.type === 'hours' && ` • ${event.hours}h`}
                          </p>
                        </div>
                        <span className="text-amber-600 dark:text-amber-400 font-medium ml-2">
                          {formatCurrency(getEventTotal(event))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Quotes */}
              {project.recentQuotes && project.recentQuotes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    <FileText className="w-3 h-3" />
                    Devis en cours
                  </div>
                  <div className="space-y-1.5">
                    {project.recentQuotes.map((quote) => (
                      <div
                        key={quote._id}
                        className="flex items-center justify-between text-xs bg-violet-50 dark:bg-violet-900/20 rounded-lg px-2.5 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 dark:text-slate-300 font-medium">
                            {quote.number}
                          </p>
                          <p className="text-slate-400 dark:text-slate-500 text-[10px]">
                            {format(new Date(quote.issueDate), 'dd MMM', { locale: fr })}
                            {' • '}
                            <span className={`
                              ${quote.status === 'signed' ? 'text-emerald-500' : ''}
                              ${quote.status === 'sent' ? 'text-blue-500' : ''}
                              ${quote.status === 'draft' ? 'text-slate-400' : ''}
                              ${quote.status === 'partial' ? 'text-amber-500' : ''}
                            `}>
                              {quote.status === 'signed' && 'Signé'}
                              {quote.status === 'sent' && 'Envoyé'}
                              {quote.status === 'draft' && 'Brouillon'}
                              {quote.status === 'partial' && 'Partiel'}
                            </span>
                          </p>
                        </div>
                        <span className="text-violet-600 dark:text-violet-400 font-medium ml-2">
                          {formatCurrency(quote.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
