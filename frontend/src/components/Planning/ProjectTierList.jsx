import { useDraggable } from '@dnd-kit/core';
import { User } from 'lucide-react';

function DraggableProjectChip({ project }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project._id,
    data: { project }
  });

  const statusColor = project.status?.color || '#6B7280';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg
        bg-white dark:bg-dark-card border-2 cursor-grab
        transition-all select-none
        ${isDragging
          ? 'opacity-50 shadow-lg scale-105 z-50'
          : 'hover:shadow-md hover:-translate-y-0.5'
        }
      `}
      style={{
        borderColor: statusColor,
        borderLeftWidth: '4px'
      }}
    >
      {/* Project info */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[120px]">
          {project.name}
        </p>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[80px]">{project.client?.name}</span>
        </div>
      </div>

      {/* Status indicator */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusColor }}
      />
    </div>
  );
}

export default function ProjectTierList({ projects }) {
  if (projects.length === 0) {
    return (
      <div className="h-20 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Aucun projet disponible
        </p>
      </div>
    );
  }

  return (
    <div className="h-20 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg">
      <div className="h-full px-4 overflow-x-auto">
        <div className="h-full flex items-center gap-3">
          {/* Label */}
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
            Projets
          </span>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 dark:bg-dark-border flex-shrink-0" />

          {/* Project chips */}
          {projects.map(project => (
            <DraggableProjectChip key={project._id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}
