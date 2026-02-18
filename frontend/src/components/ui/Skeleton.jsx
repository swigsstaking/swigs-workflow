export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-dark-border rounded-lg ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-3 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonKPI({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6 ${className}`}>
      <Skeleton className="h-5 w-1/3 mb-6" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
    </div>
  );
}
