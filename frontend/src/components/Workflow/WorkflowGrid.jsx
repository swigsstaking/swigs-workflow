import { useState, useCallback, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { LayoutGroup } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  closestCenter
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ProjectCard from './ProjectCard';
import ProjectListRow from './ProjectListRow';
import EmptyState from '../ui/EmptyState';
import { useUIStore } from '../../stores/uiStore';

const gridConfig = {
  small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
};


function SortableProjectCard({ project, cardStyle, cardSize, onProjectClick, onInvoiceClick, isAnyDragging, showArchived }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
    cursor: isAnyDragging ? 'grabbing' : 'grab'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <ProjectCard
        project={project}
        onClick={() => !isDragging && !isAnyDragging && onProjectClick(project)}
        onInvoiceClick={onInvoiceClick}
        cardStyle={cardStyle}
        cardSize={cardSize}
        isDragging={isDragging}
        showArchived={showArchived}
      />
    </div>
  );
}

function SortableProjectListRow({ project, cardStyle, onProjectClick, isAnyDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
    cursor: isAnyDragging ? 'grabbing' : 'grab'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <ProjectListRow
        project={project}
        onClick={() => !isDragging && !isAnyDragging && onProjectClick(project)}
        cardStyle={cardStyle}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function WorkflowGrid({ projects, onProjectClick, onInvoiceClick, onPositionsChange, showArchived }) {
  const { toggleNewProjectModal, cardStyle: uiCardStyle, cardSize: uiCardSize, viewMode } = useUIStore();
  const [activeId, setActiveId] = useState(null);
  // Local state for optimistic reordering during drag
  const [localProjects, setLocalProjects] = useState(projects);

  // Sync local state when props change (but not during drag)
  useEffect(() => {
    if (!activeId) {
      setLocalProjects(projects);
    }
  }, [projects, activeId]);

  const cardStyle = uiCardStyle || 'left-border';
  const cardSize = uiCardSize || 'medium';
  const mode = viewMode || 'grid';

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // Activate after 5px of movement (immediate drag feel)
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Longer delay for touch to clearly distinguish scroll from drag
        tolerance: 5
      }
    })
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveId(null);
    document.body.style.cursor = '';

    if (!over || active.id === over.id) return;

    const oldIndex = localProjects.findIndex(p => p._id === active.id);
    const newIndex = localProjects.findIndex(p => p._id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedProjects = arrayMove(localProjects, oldIndex, newIndex);

      // Optimistic local update for immediate visual feedback
      setLocalProjects(reorderedProjects);

      // Build positions array for API
      const positions = reorderedProjects.map((project, index) => ({
        id: project._id,
        x: null,
        y: null,
        order: index
      }));

      if (onPositionsChange) {
        onPositionsChange(positions);
      }
    }
  }, [localProjects, onPositionsChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    document.body.style.cursor = '';
  }, []);

  const activeProject = localProjects.find(p => p._id === activeId);

  if (localProjects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Créez votre premier projet"
        description="Un projet regroupe vos devis, factures et heures pour un client. Commencez par en créer un pour organiser votre activité."
        action="Nouveau projet"
        onAction={toggleNewProjectModal}
      />
    );
  }

  const sortingStrategy = mode === 'list' ? verticalListSortingStrategy : rectSortingStrategy;

  const getGridClassName = () => {
    if (mode === 'list') return 'flex flex-col gap-1';
    return `grid gap-4 ${gridConfig[cardSize] || gridConfig.medium}`;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={localProjects.map(p => p._id)}
        strategy={sortingStrategy}
      >
        {mode === 'list' ? (
          <>
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_80px_100px_100px_100px] gap-x-4 px-4 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
              <span>Projet</span>
              <span>Non facturé</span>
              <span>Heures</span>
              <span>Devis</span>
              <span>Factures</span>
              <span className="text-right">Statut</span>
            </div>
            <div className={getGridClassName()}>
              {localProjects.map(project => (
                <SortableProjectListRow
                  key={project._id}
                  project={project}
                  cardStyle={cardStyle}
                  onProjectClick={onProjectClick}
                  isAnyDragging={!!activeId}
                />
              ))}
            </div>
          </>
        ) : (
          <LayoutGroup>
            <div className={getGridClassName()}>
              {localProjects.map(project => (
                <SortableProjectCard
                  key={project._id}
                  project={project}
                  cardStyle={cardStyle}
                  cardSize={cardSize}
                  onProjectClick={onProjectClick}
                  onInvoiceClick={onInvoiceClick}
                  isAnyDragging={!!activeId}
                  showArchived={showArchived}
                />
              ))}
            </div>
          </LayoutGroup>
        )}
      </SortableContext>

      <DragOverlay
        adjustScale={false}
        dropAnimation={{
          duration: 200,
          easing: 'ease-out'
        }}
      >
        {activeProject && (
          <div style={{ cursor: 'grabbing', transform: 'scale(1.02)' }}>
            {mode === 'list' ? (
              <ProjectListRow
                project={activeProject}
                cardStyle={cardStyle}
                isDragging
              />
            ) : (
              <ProjectCard
                project={activeProject}
                cardStyle={cardStyle}
                cardSize={cardSize}
                isDragging
              />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
