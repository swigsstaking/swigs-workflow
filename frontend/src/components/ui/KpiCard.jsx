import SwigCard from './SwigCard';

/**
 * SWIGS Metric KPI Card
 * - Lucide icon in tinted box (top-right)
 * - Stone section label (small-caps style)
 * - Large Plus Jakarta Sans value
 * - Optional contextual subtitle
 * - Optional trend pill
 * - Left accent border (primary color)
 */
export default function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendUp,
  className = '',
}) {
  return (
    <SwigCard accentBorder hover className={className}>
      <div className="p-5">
        {/* Label row */}
        <div className="flex items-start justify-between mb-3">
          <span className="swigs-section-label">{label}</span>
          {Icon && (
            <div className="w-8 h-8 rounded-[6px] bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="swigs-amount text-2xl font-extrabold text-slate-900 dark:text-white mb-1.5 leading-none">
          {value}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div className="text-xs text-slate-500 dark:text-zinc-500">{subtitle}</div>
        )}

        {/* Trend pill */}
        {trend && (
          <div
            className={[
              'inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-[4px] text-xs font-semibold',
              trendUp
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
            ].join(' ')}
          >
            {trendUp ? '↑' : '↓'} {trend}
          </div>
        )}
      </div>
    </SwigCard>
  );
}
