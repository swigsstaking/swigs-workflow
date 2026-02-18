import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

export default function StatusFilter() {
  const { statuses } = useProjectStore();
  const { statusFilter, setStatusFilter } = useUIStore();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setStatusFilter(null)}
        className={`
          px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
          ${statusFilter === null
            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
            : 'bg-slate-100 dark:bg-dark-card text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-hover'
          }
        `}
      >
        Tous
      </button>

      {statuses.map(status => (
        <button
          key={status._id}
          onClick={() => setStatusFilter(status._id)}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
            ${statusFilter === status._id
              ? 'text-white'
              : 'hover:opacity-80'
            }
          `}
          style={{
            backgroundColor: statusFilter === status._id
              ? status.color
              : `${status.color}20`,
            color: statusFilter === status._id
              ? 'white'
              : status.color
          }}
        >
          {status.name}
        </button>
      ))}
    </div>
  );
}
