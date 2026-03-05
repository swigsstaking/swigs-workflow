import { Landmark, TrendingUp, AlertTriangle, Repeat } from 'lucide-react';
import { fmt } from '../utils/briefingLogic';

export default function AccountingSnapshot({ accounting }) {
  if (!accounting) return null;

  const { lastBankBalance, revenueYtd, expensesYtd, profitMarginYtd, budgetAlerts } = accounting;
  const profitYtd = (revenueYtd || 0) - (expensesYtd || 0);

  const barPercent = revenueYtd > 0
    ? Math.min(100, Math.round((expensesYtd || 0) / revenueYtd * 100))
    : 0;

  return (
    <div className="bg-white border border-slate-200 dark:bg-white/[0.04] dark:backdrop-blur-sm dark:border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Comptabilité</h3>
        {budgetAlerts?.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            {budgetAlerts.length}
          </span>
        )}
      </div>

      {/* Bank balance */}
      {lastBankBalance?.amount != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-white/30">
              Solde {lastBankBalance.iban ? `...${lastBankBalance.iban.slice(-4)}` : ''}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {fmt(lastBankBalance.amount)}
            </span>
          </div>
        </div>
      )}

      {/* P&L YTD */}
      {revenueYtd != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400 dark:text-white/30">P&L YTD</span>
            {profitMarginYtd != null && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                profitMarginYtd >= 20
                  ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15'
                  : profitMarginYtd >= 5
                    ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15'
                    : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15'
              }`}>
                {profitMarginYtd}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 dark:bg-red-500/60 rounded-full transition-all"
              style={{ width: `${barPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-400 dark:text-white/30">
              Dép. {fmt(expensesYtd || 0)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-white/30">
              CA {fmt(revenueYtd || 0)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1">
            <TrendingUp className={`w-3 h-3 ${profitYtd >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
            <span className={`text-xs font-semibold ${profitYtd >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {fmt(profitYtd)}
            </span>
          </div>
        </div>
      )}

      {/* Recurring charges */}
      {accounting.recurringCharges?.count > 0 && (
        <div className="mb-3 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <Repeat className="w-3 h-3 text-red-400" />
            <span className="text-[11px] text-slate-400 dark:text-white/30">Charges récurrentes</span>
            <span className="ml-auto text-xs font-semibold text-red-500 dark:text-red-400">
              ~{fmt(accounting.recurringCharges.estimatedMonthly)}/m
            </span>
          </div>
          {accounting.recurringCharges.topCharges?.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {c.categoryColor && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.categoryColor }} />
                )}
                <span className="text-[11px] text-slate-600 dark:text-white/60 truncate">{c.name}</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/40 flex-shrink-0 ml-2">
                {fmt(c.amount)}/{c.frequency === 'monthly' ? 'm' : c.frequency === 'quarterly' ? 'trim' : 'an'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Budget alerts summary */}
      {budgetAlerts?.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06] space-y-1.5">
          {budgetAlerts.slice(0, 3).map((a) => (
            <div key={a.categoryName} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.categoryColor }} />
                <span className="text-[11px] text-slate-600 dark:text-white/60 truncate">{a.categoryName}</span>
              </div>
              <span className={`text-[10px] font-medium flex-shrink-0 ml-2 ${
                a.percent >= 100 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {a.percent}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
