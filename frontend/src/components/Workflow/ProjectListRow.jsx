import { Clock, User, FileText, Receipt } from 'lucide-react';
import { formatCurrencyRound as formatCurrency } from '../../utils/format';

export default function ProjectListRow({
  project,
  onClick,
  cardStyle = 'left-border',
  isDragging = false
}) {
  const statusColor = project.status?.color || '#6B7280';

  const getStyleProps = () => {
    if (cardStyle === 'full-border') {
      return {
        className: '',
        style: { borderColor: statusColor, borderWidth: '2px', borderStyle: 'solid' }
      };
    }
    if (cardStyle === 'top-gradient') {
      return {
        className: 'border border-slate-200 dark:border-dark-border',
        style: {}
      };
    }
    return {
      className: 'border border-slate-200 dark:border-dark-border',
      style: { borderLeftColor: statusColor, borderLeftWidth: '4px' }
    };
  };

  const styleProps = getStyleProps();

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-dark-card rounded-lg shadow-sm
        transition-shadow duration-200 overflow-hidden select-none relative
        ${styleProps.className}
        ${isDragging ? 'shadow-xl ring-2 ring-primary-500' : 'hover:shadow-md'}
      `}
      style={{ ...styleProps.style, pointerEvents: isDragging ? 'none' : 'auto' }}
    >
      {cardStyle === 'top-gradient' && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg z-[1]"
          style={{ background: `linear-gradient(90deg, ${statusColor} 0%, ${statusColor}88 60%, transparent 100%)` }}
        />
      )}
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_80px_100px_100px_100px] items-center gap-x-4 px-4 py-3">
        {/* Project name + client */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {project.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{project.client?.name}</span>
          </div>
        </div>

        {/* Unbilled total */}
        <div className="hidden sm:flex items-center gap-1 text-sm">
          {project.unbilledTotal > 0 ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {formatCurrency(project.unbilledTotal)}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* Hours */}
        <div className="hidden sm:flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          {project.unbilledHours > 0 ? (
            <>
              <Clock className="w-3 h-3" />
              <span>{project.unbilledHours}h</span>
            </>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* Quotes */}
        <div className="hidden sm:flex items-center gap-1 text-sm">
          {project.unbilledQuotesTotal > 0 ? (
            <>
              <FileText className="w-3 h-3 text-violet-500 dark:text-violet-400" />
              <span className="font-medium text-violet-600 dark:text-violet-400">
                {formatCurrency(project.unbilledQuotesTotal)}
              </span>
            </>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* Invoices */}
        <div className="hidden sm:flex flex-col gap-0.5">
          {project.pendingInvoicesTotal > 0 ? (
            <>
              <div className="flex items-center gap-1 text-sm">
                <Receipt className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {formatCurrency(project.pendingInvoicesTotal)}
                </span>
              </div>
              {project.recentInvoices && project.recentInvoices.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {project.recentInvoices.slice(0, 2).map((inv) => {
                    const label = inv.status === 'paid' ? 'Payée'
                      : inv.status === 'partial' ? 'Partiel'
                      : inv.reminderCount > 0 ? `Rappel ${inv.reminderCount}`
                      : inv.status === 'sent' ? 'Envoyée'
                      : 'Brouillon';
                    const color = inv.reminderCount > 0 ? 'text-red-500 dark:text-red-400'
                      : inv.status === 'paid' ? 'text-emerald-500'
                      : inv.status === 'sent' ? 'text-blue-500'
                      : 'text-slate-400';
                    return (
                      <span key={inv._id} className={`text-[10px] ${color}`}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-end">
          <span
            className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor
            }}
          >
            {project.status?.name}
          </span>
        </div>
      </div>
    </div>
  );
}
