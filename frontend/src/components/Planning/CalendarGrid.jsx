import { useMemo, useRef, useState, memo } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDroppable } from '@dnd-kit/core';
import PlannedBlockCard from './PlannedBlockCard';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h to 22h
const QUARTER_HEIGHT = 12; // pixels per 15 minutes
const HOUR_HEIGHT = QUARTER_HEIGHT * 4; // 48 pixels per hour
const START_HOUR = 6;

// Pure presentational — no droppable hook
const HourSlot = memo(function HourSlot() {
  return (
    <div
      className="relative border-t border-slate-200 dark:border-dark-border"
      style={{ height: HOUR_HEIGHT }}
    >
      {/* Quarter-hour visual guides */}
      <div className="absolute left-0 right-0 top-1/4 border-t border-slate-100/30 dark:border-dark-border/20" />
      <div className="absolute left-0 right-0 top-1/2 border-t border-slate-100/50 dark:border-dark-border/30" />
      <div className="absolute left-0 right-0 top-3/4 border-t border-slate-100/30 dark:border-dark-border/20" />
    </div>
  );
});

function DayColumn({ date, blocks, onBlockUpdate, onBlockDelete, onBlockClick }) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const columnId = `day|${dateStr}`;
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  const dayBlocks = blocks.filter(block => {
    const blockDate = new Date(block.start);
    return isSameDay(blockDate, date);
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative flex-1 min-w-[100px] transition-colors
        ${isOver ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}
      `}
    >
      {/* Hour slots — presentational only */}
      {HOURS.map(hour => (
        <HourSlot key={hour} />
      ))}

      {/* Blocks */}
      {dayBlocks.map(block => (
        <PlannedBlockCard
          key={block._id}
          block={block}
          hourHeight={HOUR_HEIGHT}
          startHour={START_HOUR}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
          onClick={onBlockClick}
        />
      ))}
    </div>
  );
}

export default function CalendarGrid({
  currentDate,
  viewMode,
  blocks,
  onBlockUpdate,
  onBlockDelete,
  onBlockClick
}) {
  const scrollContainerRef = useRef(null);
  const timeColumnRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Sync scroll between time column and grid
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  // Generate days for the view
  const days = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    }
    // Week view
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, viewMode]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Time labels column - fixed */}
      <div
        ref={timeColumnRef}
        className="w-14 flex-shrink-0 border-r border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg overflow-hidden"
      >
        {/* Header spacer */}
        <div className="h-10 border-b border-slate-200 dark:border-dark-border sticky top-0 bg-slate-50 dark:bg-dark-bg z-20" />

        {/* Hour labels - translate with scroll */}
        <div style={{ transform: `translateY(-${scrollTop}px)` }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="text-[11px] text-slate-500 dark:text-slate-400 text-right pr-2 border-t border-transparent"
              style={{ height: HOUR_HEIGHT, paddingTop: '2px' }}
            >
              {hour}:00
            </div>
          ))}
        </div>
      </div>

      {/* Days columns - scrollable */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto"
      >
        <div className="flex min-w-max">
          {days.map(day => (
            <div
              key={day.toISOString()}
              className="flex-1 min-w-[100px] border-r border-slate-200 dark:border-dark-border last:border-r-0"
            >
              {/* Day header - sticky */}
              <div
                className={`
                  h-10 flex flex-col items-center justify-center border-b border-slate-200 dark:border-dark-border
                  sticky top-0 z-10
                  ${isToday(day)
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-white dark:bg-dark-card'
                  }
                `}
              >
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                  {format(day, 'EEE', { locale: fr })}
                </span>
                <span
                  className={`
                    text-sm font-semibold leading-none
                    ${isToday(day)
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-900 dark:text-white'
                    }
                  `}
                >
                  {format(day, 'd', { locale: fr })}
                </span>
              </div>

              {/* Day content */}
              <DayColumn
                date={day}
                blocks={blocks}
                onBlockUpdate={onBlockUpdate}
                onBlockDelete={onBlockDelete}
                onBlockClick={onBlockClick}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export constants for use in Planning.jsx
export { HOUR_HEIGHT, QUARTER_HEIGHT, START_HOUR };
