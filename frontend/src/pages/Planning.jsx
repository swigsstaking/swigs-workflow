import { useEffect, useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import DeleteBlockModal from '../components/Planning/DeleteBlockModal';
import BlockDetailModal from '../components/Planning/BlockDetailModal';
import { usePlanningStore } from '../stores/planningStore';
import { useProjectStore } from '../stores/projectStore';
import { useToastStore } from '../stores/toastStore';
import CalendarGrid, { QUARTER_HEIGHT, START_HOUR, HOUR_HEIGHT } from '../components/Planning/CalendarGrid';
import ProjectTierList from '../components/Planning/ProjectTierList';
import PlannedBlockCard from '../components/Planning/PlannedBlockCard';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

export default function Planning() {
  const {
    currentDate,
    viewMode,
    blocks,
    loading,
    fetchBlocks,
    goToNextWeek,
    goToPrevWeek,
    goToNextDay,
    goToPrevDay,
    goToToday,
    setViewMode,
    createBlock,
    updateBlock,
    deleteBlock
  } = usePlanningStore();

  const hasLoadedOnce = useRef(false);

  const { projects, fetchProjects, fetchStatuses } = useProjectStore();
  const { addToast } = useToastStore();

  // State for drag overlay
  const [activeItem, setActiveItem] = useState(null);

  // State for delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState(null);

  // State for detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  );

  const totalPlannedHours = useMemo(() => {
    return blocks.reduce((sum, block) => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);
  }, [blocks]);

  // Load data on mount
  useEffect(() => {
    fetchStatuses();
    fetchProjects();
  }, []);

  useEffect(() => {
    const loadBlocks = async () => {
      try {
        await fetchBlocks();
        hasLoadedOnce.current = true;
      } catch (error) {
        console.error('Error loading blocks:', error);
        addToast({
          type: 'error',
          message: 'Erreur lors du chargement du planning'
        });
      }
    };
    loadBlocks();
  }, [currentDate, viewMode]);

  // Force day view on mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => {
      if (e.matches && viewMode !== 'day') {
        setViewMode('day');
      }
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [viewMode, setViewMode]);

  // Handle drag start to track active item
  const handleDragStart = (event) => {
    const { active } = event;
    const activeId = active.id.toString();

    if (activeId.startsWith('block-')) {
      // Dragging an existing block
      const blockId = activeId.replace('block-', '');
      const block = blocks.find(b => b._id === blockId);
      if (block) {
        setActiveItem({ type: 'block', data: block });
      }
    } else {
      // Dragging a project from the tier list
      const project = projects.find(p => p._id === activeId);
      if (project) {
        setActiveItem({ type: 'project', data: project });
      }
    }
  };

  // Handle drag end - create new block or move existing
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveItem(null); // Clear active item

    if (!over) return;

    const overId = over.id.toString();

    // Support both new column format (day|yyyy-MM-dd) and legacy slot format (slot|yyyy-MM-dd|hour)
    let dateStr, hour, minute;

    if (overId.startsWith('day|')) {
      // Column-level droppable: calculate hour + minute from pointer position
      dateStr = overId.split('|')[1];
      try {
        const pointerY = event.activatorEvent.clientY + event.delta.y;
        const columnTop = over.rect.top;
        const offsetInColumn = pointerY - columnTop;
        const totalMinutes = START_HOUR * 60 + Math.max(0, offsetInColumn / HOUR_HEIGHT) * 60;
        hour = Math.floor(totalMinutes / 60);
        const rawMinute = totalMinutes % 60;
        // Snap to nearest quarter
        minute = Math.floor(rawMinute / 15) * 15;
      } catch {
        hour = START_HOUR;
        minute = 0;
      }
    } else if (overId.startsWith('slot|')) {
      // Legacy slot format fallback
      const parts = overId.split('|');
      dateStr = parts[1];
      hour = parseInt(parts[2]);
      minute = 0;
      try {
        const pointerY = event.activatorEvent.clientY + event.delta.y;
        const slotTop = over.rect.top;
        const offsetInSlot = pointerY - slotTop;
        const quarterIndex = Math.min(3, Math.max(0, Math.floor(offsetInSlot / QUARTER_HEIGHT)));
        minute = quarterIndex * 15;
      } catch {
        // Fallback to minute 0
      }
    } else {
      return;
    }

    if (!dateStr || isNaN(hour)) return;

    const activeId = active.id.toString();

    // Check if we're moving an existing block
    if (activeId.startsWith('block-')) {
      const blockId = activeId.replace('block-', '');
      const block = blocks.find(b => b._id === blockId);

      if (block) {
        // Calculate duration of the block
        const oldStart = new Date(block.start);
        const oldEnd = new Date(block.end);
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        // New start time
        const newStart = new Date(dateStr);
        newStart.setHours(hour, minute, 0, 0);

        // New end time (preserve duration)
        const newEnd = new Date(newStart.getTime() + durationMs);

        await updateBlock(blockId, {
          start: newStart.toISOString(),
          end: newEnd.toISOString()
        });
      }
    } else {
      // Creating a new block from project tier list
      const project = projects.find(p => p._id === activeId);

      if (project) {
        const start = new Date(dateStr);
        start.setHours(hour, minute, 0, 0);

        const end = new Date(start);
        end.setHours(start.getHours() + 1); // Default 1 hour duration

        await createBlock({
          projectId: project._id,
          project: project,
          start: start.toISOString(),
          end: end.toISOString()
        });
      }
    }
  };

  // Handle delete with modal
  const handleDeleteRequest = (blockId) => {
    const block = blocks.find(b => b._id === blockId);
    if (block) {
      setBlockToDelete(block);
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (blockToDelete) {
      await deleteBlock(blockToDelete._id);
      setBlockToDelete(null);
      setDeleteModalOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setBlockToDelete(null);
    setDeleteModalOpen(false);
  };

  // Handle click on block to open detail modal
  const handleBlockClick = (block) => {
    setSelectedBlock(block);
    setDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setSelectedBlock(null);
    setDetailModalOpen(false);
  };

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'week') {
      goToPrevWeek();
    } else {
      goToPrevDay();
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      goToNextWeek();
    } else {
      goToNextDay();
    }
  };

  // Format header date
  const formatHeaderDate = () => {
    if (viewMode === 'week') {
      return format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    }
    return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
  };

  // Render drag overlay content
  const renderDragOverlay = () => {
    if (!activeItem) return null;

    if (activeItem.type === 'block') {
      const block = activeItem.data;
      const statusColor = block.project?.status?.color || '#6B7280';
      return (
        <div
          className="rounded-lg px-3 py-2 shadow-lg opacity-90"
          style={{
            backgroundColor: `${statusColor}30`,
            borderLeft: `3px solid ${statusColor}`,
            minWidth: 120
          }}
        >
          <p className="text-sm font-medium" style={{ color: statusColor }}>
            {block.project?.name || 'Projet'}
          </p>
          {block.project?.client?.name && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {block.project.client.name}
            </p>
          )}
        </div>
      );
    }

    if (activeItem.type === 'project') {
      const project = activeItem.data;
      const statusColor = project.status?.color || '#6B7280';
      return (
        <div
          className="rounded-lg px-3 py-2 shadow-lg opacity-90"
          style={{
            backgroundColor: `${statusColor}30`,
            borderLeft: `3px solid ${statusColor}`,
            minWidth: 120
          }}
        >
          <p className="text-sm font-medium" style={{ color: statusColor }}>
            {project.name}
          </p>
          {project.client?.name && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {project.client.name}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-41px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Planning
            </h1>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <Button
                variant="secondary"
                size="sm"
                onClick={goToToday}
              >
                Aujourd'hui
              </Button>

              <button
                onClick={handleNext}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Current date */}
            <span className="text-slate-600 dark:text-slate-400 capitalize">
              {formatHeaderDate()}
            </span>
            {totalPlannedHours > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-3">{totalPlannedHours.toFixed(1)}h planifiées</span>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-dark-bg rounded-lg">
            <button
              onClick={() => setViewMode('week')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${viewMode === 'week'
                  ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }
              `}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${viewMode === 'day'
                  ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }
              `}
            >
              Jour
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto relative">
          {loading && !hasLoadedOnce.current ? (
            /* Planning Grid Skeleton */
            <div className="flex h-full">
              {/* Time column skeleton */}
              <div className="w-14 flex-shrink-0 border-r border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg">
                <div className="h-10 border-b border-slate-200 dark:border-dark-border" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex justify-end pr-2 pt-1" style={{ height: 48 }}>
                    <Skeleton className="h-3 w-8" />
                  </div>
                ))}
              </div>
              {/* Day columns skeleton */}
              <div className="flex-1 flex">
                {Array.from({ length: viewMode === 'week' ? 7 : 1 }).map((_, col) => (
                  <div key={col} className="flex-1 min-w-[100px] border-r border-slate-200 dark:border-dark-border last:border-r-0">
                    {/* Header skeleton */}
                    <div className="h-10 flex flex-col items-center justify-center border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card">
                      <Skeleton className="h-2 w-6 mb-1" />
                      <Skeleton className="h-4 w-4" />
                    </div>
                    {/* Hour lines skeleton */}
                    {Array.from({ length: 8 }).map((_, row) => (
                      <div
                        key={row}
                        className="border-t border-slate-200 dark:border-dark-border"
                        style={{ height: 48 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <CalendarGrid
                currentDate={currentDate}
                viewMode={viewMode}
                blocks={blocks}
                onBlockUpdate={updateBlock}
                onBlockDelete={handleDeleteRequest}
                onBlockClick={handleBlockClick}
              />

              {/* Empty State Overlay */}
              {blocks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center py-16 text-center bg-white/80 dark:bg-dark-bg/80 backdrop-blur-sm rounded-2xl px-8">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Aucun bloc planifié
                    </h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Glissez un projet depuis la liste pour planifier du temps.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Project Tier List */}
        <ProjectTierList projects={projects.filter(p => !p.archivedAt)} />
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>

      {/* Delete Confirmation Modal */}
      <DeleteBlockModal
        isOpen={deleteModalOpen}
        block={blockToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Block Detail Modal */}
      <BlockDetailModal
        isOpen={detailModalOpen}
        block={selectedBlock}
        onClose={handleDetailModalClose}
        onUpdate={updateBlock}
        onDelete={handleDeleteRequest}
      />
    </DndContext>
  );
}
