import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

export default function StatusFilter() {
  const { statuses } = useProjectStore();
  const { hiddenStatuses, toggleHiddenStatus, clearHiddenStatuses } = useUIStore();

  const hasHidden = hiddenStatuses.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => clearHiddenStatuses()}
        className={`
          px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
          ${!hasHidden
            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
            : 'bg-slate-100 dark:bg-dark-card text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-hover'
          }
        `}
      >
        Tous
      </button>

      {statuses.map(status => {
        const isHidden = hiddenStatuses.includes(status._id);
        return (
          <button
            key={status._id}
            onClick={() => toggleHiddenStatus(status._id)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg transition-all
              ${isHidden
                ? 'opacity-40 line-through'
                : 'hover:opacity-80'
              }
            `}
            style={{
              backgroundColor: isHidden
                ? `${status.color}10`
                : `${status.color}20`,
              color: status.color
            }}
            title={isHidden ? `Afficher "${status.name}"` : `Masquer "${status.name}"`}
          >
            {status.name}
          </button>
        );
      })}
    </div>
  );
}
