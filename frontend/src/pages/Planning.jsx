import { useEffect, useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Settings, Link2 } from 'lucide-react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import DeleteBlockModal from '../components/Planning/DeleteBlockModal';
import BlockDetailModal from '../components/Planning/BlockDetailModal';
import MonthGrid from '../components/Planning/MonthGrid';
import CalendarSyncModal from '../components/Planning/CalendarSyncModal';
import { usePlanningStore } from '../stores/planningStore';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import CalendarGrid, { QUARTER_HEIGHT, START_HOUR, HOUR_HEIGHT } from '../components/Planning/CalendarGrid';
import ProjectTierList from '../components/Planning/ProjectTierList';
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
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    setViewMode,
    setCurrentDate,
    createBlock,
    updateBlock,
    deleteBlock
  } = usePlanningStore();

  const hasLoadedOnce = useRef(false);

  const { projects, statuses, fetchProjects, fetchStatuses } = useProjectStore();
  const { planningHiddenStatuses, togglePlanningHiddenStatus, clearPlanningHiddenStatuses } = useUIStore();
  const { addToast } = useToastStore();
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const hasFilters = planningHiddenStatuses.length > 0;

  // State for drag overlay
  const [activeItem, setActiveItem] = useState(null);

  // State for delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState(null);

  // State for detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);

  // State for calendar sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false);

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

  // Force day view on mobile (not month — month is readable on mobile)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => {
      if (e.matches && viewMode === 'week') {
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
    if (viewMode === 'month') goToPrevMonth();
    else if (viewMode === 'week') goToPrevWeek();
    else goToPrevDay();
  };

  const handleNext = () => {
    if (viewMode === 'month') goToNextMonth();
    else if (viewMode === 'week') goToNextWeek();
    else goToNextDay();
  };

  // Navigate to a specific day from MonthGrid
  const handleDayClick = (date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  // Format header date
  const formatHeaderDate = () => {
    if (viewMode === 'month') {
      return format(currentDate, "MMMM yyyy", { locale: fr });
    }
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
        {/* Header — SWIGS Carte Alpine */}
        <div className="relative flex items-center justify-between px-3 sm:px-5 py-3 border-b border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border bg-white dark:bg-dark-card shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <h1 className="font-display font-bold text-[16px] tracking-tight text-slate-900 dark:text-white">
              Planning
            </h1>
            <div className="w-px h-4 bg-[rgb(var(--swigs-stone)/0.35)] dark:bg-dark-border" />
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-[6px] text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Button variant="secondary" size="sm" onClick={goToToday}>
                Aujourd&apos;hui
              </Button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-[6px] text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Current date */}
            <span className="text-[12.5px] text-slate-500 dark:text-zinc-400 capitalize hidden sm:inline">
              {formatHeaderDate()}
            </span>
            {totalPlannedHours > 0 && (
              <span className="swigs-section-label hidden md:inline">
                {totalPlannedHours.toFixed(1)}h planifiées
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Filter Menu */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`
                relative p-1.5 rounded-[6px] transition-all
                ${hasFilters
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05]'
                }
              `}
              title="Filtrer les statuts"
            >
              <Settings className="w-4 h-4" />
              {hasFilters && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {planningHiddenStatuses.length}
                </span>
              )}
            </button>

            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-dark-card rounded-[8px] shadow-lg border border-[rgb(var(--swigs-stone)/0.35)] dark:border-dark-border py-2 z-20">
                  <div className="px-4 py-1.5 flex items-center justify-between">
                    <p className="swigs-section-label">Masquer des statuts</p>
                    {hasFilters && (
                      <button
                        onClick={() => clearPlanningHiddenStatuses()}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Tout afficher
                      </button>
                    )}
                  </div>
                  <div className="mt-1">
                    {statuses.map(status => {
                      const isHidden = planningHiddenStatuses.includes(status._id);
                      return (
                        <button
                          key={status._id}
                          onClick={() => togglePlanningHiddenStatus(status._id)}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-[rgb(var(--swigs-stone)/0.08)] dark:hover:bg-dark-hover flex items-center gap-3 transition-colors"
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                          <span className={`flex-1 text-[13px] ${isHidden ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-slate-700 dark:text-zinc-300'}`}>
                            {status.name}
                          </span>
                          <div className={`w-7 h-4 rounded-full transition-colors flex items-center ${isHidden ? 'bg-slate-200 dark:bg-zinc-700' : 'bg-primary-500'}`}>
                            <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isHidden ? 'translate-x-0.5' : 'translate-x-[16px]'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sync button */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className="p-1.5 rounded-[6px] text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] transition-all"
            title="Synchroniser avec un calendrier externe"
          >
            <Link2 className="w-4 h-4" />
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 p-1 bg-[rgb(var(--swigs-stone)/0.1)] dark:bg-zinc-950/60 rounded-[6px]">
            {[
              { key: 'month', label: 'Mois' },
              { key: 'week', label: 'Semaine' },
              { key: 'day', label: 'Jour' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`
                  px-2.5 py-1 text-[12px] font-medium rounded-[4px] transition-all
                  ${viewMode === key
                    ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
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
                {Array.from({ length: viewMode === 'week' ? 7 : viewMode === 'month' ? 7 : 1 }).map((_, col) => (
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
          ) : viewMode === 'month' ? (
            <MonthGrid
              currentDate={currentDate}
              blocks={blocks}
              onBlockClick={handleBlockClick}
              onDayClick={handleDayClick}
            />
          ) : (
            <CalendarGrid
              currentDate={currentDate}
              viewMode={viewMode}
              blocks={blocks}
              onBlockUpdate={updateBlock}
              onBlockDelete={handleDeleteRequest}
              onBlockClick={handleBlockClick}
            />
          )}
        </div>

        {blocks.length === 0 && !loading && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-[rgb(var(--swigs-cream)/0.4)] dark:bg-white/[0.02] border-t border-b border-[rgb(var(--swigs-stone)/0.25)] dark:border-white/[0.06]">
            <Calendar className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0" />
            <p className="text-[12.5px] text-slate-500 dark:text-zinc-400">
              <span className="font-medium text-slate-600 dark:text-zinc-300">Aucun bloc planifié</span>
              {viewMode !== 'month' && <>{' — '}glissez un projet depuis la liste ci-dessous ↓ pour planifier du temps.</>}
            </p>
          </div>
        )}

        {/* Project Tier List — hidden in month view (no drag-and-drop) */}
        {viewMode !== 'month' && (
          <ProjectTierList projects={projects.filter(p => !p.archivedAt && !planningHiddenStatuses.includes(p.status?._id))} />
        )}
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

      {/* Calendar Sync Modal */}
      <CalendarSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
      />
    </DndContext>
  );
}
