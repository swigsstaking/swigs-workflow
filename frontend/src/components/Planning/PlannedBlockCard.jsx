import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

const QUARTER_HEIGHT = 12; // Must match CalendarGrid
const MIN_DURATION_QUARTERS = 1; // Minimum 15 minutes

export default function PlannedBlockCard({
  block,
  hourHeight,
  startHour: gridStartHour = 6,
  onUpdate,
  onDelete,
  onClick
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block._id}`,
    data: { block }
  });

  // Calculate position and height
  const startDate = new Date(block.start);
  const endDate = new Date(block.end);
  const blockStartHour = startDate.getHours() + startDate.getMinutes() / 60;
  const blockEndHour = endDate.getHours() + endDate.getMinutes() / 60;
  const duration = blockEndHour - blockStartHour;

  // Position from top (gridStartHour is 0)
  const topOffset = (blockStartHour - gridStartHour) * hourHeight;
  const height = duration * hourHeight;

  // Get color from project status
  const statusColor = block.project?.status?.color || '#6B7280';
  const projectName = block.project?.name || 'Projet';
  const clientName = block.project?.client?.name || '';

  // Resize handlers with 15-minute snapping
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startY: e.clientY,
      startHeight: height
    };

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - resizeRef.current.startY;
      // Snap to 15-minute increments
      const newHeightRaw = resizeRef.current.startHeight + deltaY;
      const quartersCount = Math.max(MIN_DURATION_QUARTERS, Math.round(newHeightRaw / QUARTER_HEIGHT));
      const newDurationMinutes = quartersCount * 15;

      const newEnd = new Date(startDate);
      newEnd.setMinutes(startDate.getMinutes() + newDurationMinutes);

      // Update block in real-time (optimistic)
      onUpdate(block._id, { end: newEnd.toISOString() });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(block._id);
  };

  const handleClick = (e) => {
    // Don't open modal when clicking delete button or resize handle
    if (e.target.closest('button') || e.target.closest('[data-resize-handle]')) return;
    if (onClick) {
      onClick(block);
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`
        absolute left-1 right-1 rounded-lg overflow-hidden
        transition-shadow select-none
        ${isDragging ? 'opacity-50 shadow-lg z-50 cursor-grabbing' : 'hover:shadow-md cursor-pointer'}
        ${isResizing ? 'z-50' : ''}
      `}
      style={{
        top: topOffset,
        height: Math.max(height, 24),
        backgroundColor: `${statusColor}20`,
        borderLeft: `3px solid ${statusColor}`
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header with drag handle and title */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-1 px-1 py-0.5 cursor-grab"
      >
        <GripVertical className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <p
          className="text-[11px] font-medium truncate leading-tight flex-1"
          style={{ color: statusColor }}
        >
          {projectName}
        </p>
      </div>

      {/* Content - more compact */}
      <div className="px-2 pb-1 overflow-hidden">
        {height >= 32 && clientName && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            {clientName}
          </p>
        )}
        {height >= 44 && (
          <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
            {format(startDate, 'HH:mm', { locale: fr })} - {format(endDate, 'HH:mm', { locale: fr })}
          </p>
        )}
        {height >= 60 && block.notes && (
          <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight">
            {block.notes}
          </p>
        )}
      </div>

      {/* Delete button */}
      {showActions && (
        <button
          onClick={handleDelete}
          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-white dark:bg-dark-card shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <X className="w-3 h-3 text-red-500" />
        </button>
      )}

      {/* Resize handle */}
      <div
        data-resize-handle
        onMouseDown={handleResizeStart}
        className={`
          absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize
          flex items-center justify-center
          ${showActions ? 'bg-slate-200/50 dark:bg-slate-700/50' : ''}
        `}
      >
        {showActions && (
          <div className="w-8 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
        )}
      </div>
    </div>
  );
}
