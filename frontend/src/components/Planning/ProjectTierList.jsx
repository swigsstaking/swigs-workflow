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
      title={project.name + (project.client?.name ? ' — ' + project.client.name : '')}
      className={`
        flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-[8px]
        bg-white dark:bg-dark-card border border-[rgb(var(--swigs-stone)/0.4)] dark:border-dark-border
        cursor-grab transition-all select-none
        ${isDragging
          ? 'opacity-50 shadow-lg scale-105 z-50'
          : 'hover:shadow-md hover:-translate-y-px hover:border-[rgb(var(--swigs-stone)/0.7)]'
        }
      `}
      style={{ borderLeftColor: statusColor, borderLeftWidth: '3px' }}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate max-w-[120px] leading-tight">
          {project.name}
        </p>
        {project.client?.name && (
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate max-w-[100px]">
            {project.client.name}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProjectTierList({ projects }) {
  if (projects.length === 0) {
    return (
      <div className="h-16 border-t border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border bg-[rgb(var(--swigs-cream)/0.3)] dark:bg-dark-bg flex items-center justify-center">
        <p className="swigs-section-label">Aucun projet disponible</p>
      </div>
    );
  }

  return (
    <div className="h-16 border-t border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border bg-[rgb(var(--swigs-cream)/0.3)] dark:bg-dark-bg">
      <div className="h-full px-4 overflow-x-auto">
        <div className="h-full flex items-center gap-2">
          <span className="swigs-section-label flex-shrink-0">Projets</span>
          <div className="w-px h-6 bg-[rgb(var(--swigs-stone)/0.35)] dark:bg-dark-border flex-shrink-0" />

          {/* Project chips */}
          {projects.map(project => (
            <DraggableProjectChip key={project._id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}
