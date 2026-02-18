import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = '#3B82F6',
  format = 'currency'
}) {
  const formatValue = (val) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('fr-CH', {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
    }
    if (format === 'percent') {
      return `${val}%`;
    }
    if (format === 'hours') {
      return `${val}h`;
    }
    return val.toLocaleString('fr-CH');
  };

  const getTrendIcon = () => {
    if (change === undefined || change === null) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined || change === null) return 'text-slate-400';
    if (change > 0) return 'text-emerald-500';
    if (change < 0) return 'text-red-500';
    return 'text-slate-400';
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {change !== undefined && change !== null && (
          <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {formatValue(value)}
      </p>

      {changeLabel && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          {changeLabel}
        </p>
      )}
    </div>
  );
}
