import { TrendingUp } from 'lucide-react';
import { fmt, relDate } from '../utils/briefingLogic';

export default function CashFlowCompact({ forecasts }) {
  const upcoming = (forecasts || []).filter((f) => !f.isOverdue).slice(0, 5);
  const overdue = (forecasts || []).filter((f) => f.isOverdue);
  if (!upcoming.length && !overdue.length) return null;

  const total = upcoming.reduce((s, f) => s + f.total, 0);
  const overdueTotal = overdue.reduce((s, f) => s + f.total, 0);

  return (
    <div className="bg-white border border-slate-200 dark:bg-white/[0.04] dark:backdrop-blur-sm dark:border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-violet-500 dark:text-violet-400" />
        <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Cash flow</h3>
      </div>

      {overdueTotal > 0 && (
        <div className="mb-2 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-red-600 dark:text-red-400">{overdue.length} paiement{overdue.length > 1 ? 's' : ''} en retard</span>
            <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">{fmt(overdueTotal)}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {upcoming.map((f, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="min-w-0">
              <span className="text-xs text-slate-700 dark:text-white/70 truncate block">{f.clientName}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 dark:text-white/30">{relDate(f.expectedPaymentDate)}</span>
                {f.expectedDays && (
                  <span className="text-[9px] text-slate-300 dark:text-white/20" title={`Basé sur ~${f.expectedDays}j délai moyen`}>
                    ~{f.expectedDays}j
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap ml-2">
              {fmt(f.total)}
            </span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/[0.06] flex justify-between">
          <span className="text-[11px] text-slate-400 dark:text-white/30">Total attendu</span>
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
