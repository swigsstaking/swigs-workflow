import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { formatCurrency } from '../../../utils/format';
import { useUIStore } from '../../../stores/uiStore';

function ReliabilityBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-[10px] text-slate-400 dark:text-white/30">N/A</span>;
  }
  const color =
    score >= 70
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
      : score >= 40
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {score}%
    </span>
  );
}

export default function ClientReliabilityList({ clients }) {
  const navigate = useNavigate();
  const { setSearchQuery } = useUIStore();
  const top = (clients || []).slice(0, 5);
  if (!top.length) return null;

  const handleClientClick = (client) => {
    const search = client.company || client.name;
    if (search) {
      setSearchQuery(search);
      navigate('/workflow');
    }
  };

  return (
    <div className="bg-white border border-slate-200 dark:bg-white/[0.04] dark:backdrop-blur-sm dark:border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary-500 dark:text-primary-400" />
        <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Top clients</h3>
      </div>

      <div className="space-y-2.5">
        {top.map((c, i) => (
          <div
            key={i}
            onClick={() => handleClientClick(c)}
            className="flex items-center gap-2.5 cursor-pointer rounded-lg px-1 -mx-1 py-0.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-slate-500 dark:text-white/60">
                {(c.company || c.name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-800 dark:text-white/80 truncate block font-medium">
                {c.company || c.name}
              </span>
              {c.totalOverdue > 0 && (
                <span className="text-[10px] text-red-500 dark:text-red-400/70">
                  {formatCurrency(c.totalOverdue)} en retard
                </span>
              )}
            </div>
            <ReliabilityBadge score={c.reliabilityScore} />
          </div>
        ))}
      </div>
    </div>
  );
}
