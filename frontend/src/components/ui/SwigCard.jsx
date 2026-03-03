import TopoOverlay from './TopoOverlay';

/**
 * SWIGS branded card with optional:
 * - Topographic texture overlay
 * - Left accent border (for KPI-style cards)
 * - Hover elevation effect
 * - Cream background variant (for special sections)
 */
export default function SwigCard({
  children,
  className = '',
  accentBorder = false,
  hover = true,
  cream = false,
  topoOpacity = 0.025,
  noPadding = false,
  ...props
}) {
  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-white dark:bg-dark-card',
        'rounded-[8px]',
        // Stone border in light, dark-border in dark
        accentBorder
          ? 'border border-l-[3px] border-[rgb(var(--swigs-stone)/0.45)] dark:border-dark-border border-l-primary-500'
          : 'border border-[rgb(var(--swigs-stone)/0.45)] dark:border-dark-border',
        // Hover lift + border accent brightening
        hover
          ? 'transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:border-[rgb(var(--swigs-stone)/0.75)] dark:hover:border-primary-500/30'
          : '',
        cream ? 'bg-[rgb(var(--swigs-cream)/0.45)] dark:bg-dark-card' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      <TopoOverlay opacity={topoOpacity} />
      <div className={`relative ${noPadding ? '' : ''}`}>{children}</div>
    </div>
  );
}
