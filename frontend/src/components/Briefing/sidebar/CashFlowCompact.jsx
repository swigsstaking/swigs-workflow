import { TrendingUp } from 'lucide-react';
import { fmt, relDate } from '../utils/briefingLogic';

export default function CashFlowCompact({ forecasts }) {
  const upcoming = (forecasts || []).filter((f) => !f.isOverdue).slice(0, 5);
  if (!upcoming.length) return null;

  const total = upcoming.reduce((s, f) => s + f.total, 0);

  return (
    <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-violet-400" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Cash flow</h3>
      </div>

      <div className="space-y-2">
        {upcoming.map((f, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="min-w-0">
              <span className="text-xs text-white/70 truncate block">{f.clientName}</span>
              <span className="text-[10px] text-white/30">{relDate(f.expectedPaymentDate)}</span>
            </div>
            <span className="text-xs font-medium text-violet-400 whitespace-nowrap ml-2">
              {fmt(f.total)}
            </span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="pt-2 mt-2 border-t border-white/[0.06] flex justify-between">
          <span className="text-[11px] text-white/30">Total attendu</span>
          <span className="text-xs font-semibold text-violet-300">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
