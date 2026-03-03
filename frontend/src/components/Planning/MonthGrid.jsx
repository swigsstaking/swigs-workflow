import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  format
} from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MAX_VISIBLE_BLOCKS = 3;

export default function MonthGrid({ currentDate, blocks, onBlockClick, onDayClick }) {
  // Build weeks grid: array of 4-6 weeks, each with 7 days
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const result = [];
    let day = gridStart;
    while (day <= gridEnd) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(day));
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [currentDate]);

  // Index blocks by date string for fast lookup
  const blocksByDate = useMemo(() => {
    const map = {};
    blocks.forEach(block => {
      const start = new Date(block.start);
      const key = format(start, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(block);
    });
    // Sort each day's blocks by start time
    Object.values(map).forEach(arr => arr.sort((a, b) => new Date(a.start) - new Date(b.start)));
    return map;
  }, [blocks]);

  return (
    <div className="flex flex-col h-full">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shrink-0">
        {DAY_NAMES.map(name => (
          <div
            key={name}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(100px, 1fr))` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-slate-200 dark:border-dark-border last:border-b-0">
            {week.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayBlocks = blocksByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const visibleBlocks = dayBlocks.slice(0, MAX_VISIBLE_BLOCKS);
              const overflow = dayBlocks.length - MAX_VISIBLE_BLOCKS;

              return (
                <div
                  key={dateKey}
                  className={`
                    relative border-r border-slate-200 dark:border-dark-border last:border-r-0 p-1 flex flex-col
                    ${!isCurrentMonth ? 'bg-slate-50/60 dark:bg-zinc-900/30' : 'bg-white dark:bg-dark-bg'}
                  `}
                >
                  {/* Day number */}
                  <button
                    onClick={() => onDayClick(day)}
                    className={`
                      w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium mb-0.5 transition-colors self-start
                      ${today
                        ? 'bg-primary-500 text-white'
                        : isCurrentMonth
                          ? 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          : 'text-slate-300 dark:text-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }
                    `}
                    title={`Voir le ${format(day, 'd MMMM yyyy', { locale: fr })}`}
                  >
                    {format(day, 'd')}
                  </button>

                  {/* Blocks */}
                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    {visibleBlocks.map(block => {
                      const statusColor = block.project?.status?.color || '#6B7280';
                      const startTime = format(new Date(block.start), 'HH:mm');
                      return (
                        <button
                          key={block._id}
                          onClick={(e) => { e.stopPropagation(); onBlockClick(block); }}
                          className="group flex items-center gap-1 rounded px-1.5 py-0.5 text-left transition-opacity hover:opacity-80 truncate"
                          style={{ backgroundColor: `${statusColor}20`, borderLeft: `2px solid ${statusColor}` }}
                          title={`${block.project?.name || 'Projet'} — ${startTime}`}
                        >
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">{startTime}</span>
                          <span
                            className="text-[11px] font-medium truncate"
                            style={{ color: statusColor }}
                          >
                            {block.project?.name || 'Projet'}
                          </span>
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 pl-1 font-medium">
                        +{overflow} autre{overflow > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
