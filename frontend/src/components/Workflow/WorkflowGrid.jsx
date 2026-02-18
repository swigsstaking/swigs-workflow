import { useState, useCallback, useEffect } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
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
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ProjectCard from './ProjectCard';
import Button from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';

const gridConfig = {
  small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
};

function SortableProjectCard({ project, cardStyle, cardSize, onProjectClick, isAnyDragging, showArchived }) {
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
      className="touch-none"
    >
      <ProjectCard
        project={project}
        onClick={() => !isDragging && !isAnyDragging && onProjectClick(project)}
        cardStyle={cardStyle}
        cardSize={cardSize}
        isDragging={isDragging}
        showArchived={showArchived}
      />
    </div>
  );
}

export default function WorkflowGrid({ projects, onProjectClick, onPositionsChange, showArchived }) {
  const { personalization } = useSettingsStore();
  const { toggleNewProjectModal } = useUIStore();
  const [activeId, setActiveId] = useState(null);
  // Local state for optimistic reordering during drag
  const [localProjects, setLocalProjects] = useState(projects);

  // Sync local state when props change (but not during drag)
  useEffect(() => {
    if (!activeId) {
      setLocalProjects(projects);
    }
  }, [projects, activeId]);

  const cardStyle = personalization?.cardStyle || 'left-border';
  const cardSize = personalization?.cardSize || 'medium';

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // Activate after 5px of movement (immediate drag feel)
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Short delay for touch to distinguish from tap
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
      <div className="flex flex-col items-center justify-center py-20">
        <FolderOpen className="w-16 h-16 mb-4 text-slate-400" />
        <p className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">Aucun projet</p>
        <p className="text-sm text-slate-400 mb-6">Créez votre premier projet pour commencer</p>
        <Button icon={Plus} onClick={toggleNewProjectModal}>
          Créer mon premier projet
        </Button>
      </div>
    );
  }

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
        strategy={rectSortingStrategy}
      >
        <LayoutGroup>
          <div className={`grid gap-4 ${gridConfig[cardSize] || gridConfig.medium}`}>
            {localProjects.map(project => (
              <SortableProjectCard
                key={project._id}
                project={project}
                cardStyle={cardStyle}
                cardSize={cardSize}
                onProjectClick={onProjectClick}
                isAnyDragging={!!activeId}
                showArchived={showArchived}
              />
            ))}
          </div>
        </LayoutGroup>
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
            <ProjectCard
              project={activeProject}
              cardStyle={cardStyle}
              cardSize={cardSize}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
