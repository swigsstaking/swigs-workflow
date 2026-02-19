export default function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border ${padding ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-sm font-semibold text-slate-900 dark:text-white ${className}`}>
      {children}
    </h3>
  );
}
