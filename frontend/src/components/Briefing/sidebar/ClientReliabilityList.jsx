import { Users } from 'lucide-react';

function ReliabilityBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-[10px] text-white/30">N/A</span>;
  }
  const color =
    score >= 70
      ? 'bg-emerald-500/20 text-emerald-300'
      : score >= 40
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-red-500/20 text-red-300';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {score}%
    </span>
  );
}

export default function ClientReliabilityList({ clients }) {
  const top = (clients || []).slice(0, 5);
  if (!top.length) return null;

  return (
    <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary-400" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Top clients</h3>
      </div>

      <div className="space-y-2.5">
        {top.map((c, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white/60">
                {(c.company || c.name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-white/80 truncate block font-medium">
                {c.company || c.name}
              </span>
              {c.totalOverdue > 0 && (
                <span className="text-[10px] text-red-400/70">
                  {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(c.totalOverdue)} en retard
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
