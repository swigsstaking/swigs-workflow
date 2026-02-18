import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { remindersApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import {
  Bell, TrendingUp, AlertTriangle, Users, Clock, CreditCard,
  FileText, ArrowUpRight, Send, RefreshCw, ChevronRight,
  Loader2, CalendarClock, Receipt, ShieldCheck, BarChart3
} from 'lucide-react';

// Format CHF amount
const fmt = (n) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(n || 0);
const fmtShort = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n?.toFixed(0) || '0';
};

// Relative date
const relDate = (d) => {
  if (!d) return '-';
  const diff = Math.floor((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 0) return `Dans ${diff}j`;
  return `Il y a ${Math.abs(diff)}j`;
};

// Reminder type labels
const reminderLabels = {
  reminder_1: '1er rappel',
  reminder_2: '2e rappel',
  reminder_3: '3e rappel',
  final_notice: 'Mise en demeure'
};

// Reliability badge
function ReliabilityBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-xs text-white/40">N/A</span>;
  const color = score >= 70 ? 'from-emerald-500 to-emerald-600'
    : score >= 40 ? 'from-amber-500 to-amber-600'
    : 'from-red-500 to-red-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r ${color}`}>
      {score}%
    </span>
  );
}

// --- Glass Card wrapper ---
function GlassCard({ children, className = '', span = 1, rowSpan = 1 }) {
  const colClass = span === 2 ? 'md:col-span-2' : span === 3 ? 'md:col-span-3' : '';
  const rowClass = rowSpan === 2 ? 'md:row-span-2' : '';
  return (
    <div className={`
      relative overflow-hidden rounded-2xl
      bg-white/[0.06] backdrop-blur-xl
      border border-white/[0.08]
      shadow-[0_8px_32px_rgba(0,0,0,0.12)]
      hover:bg-white/[0.09] hover:border-white/[0.12]
      transition-all duration-300
      ${colClass} ${rowClass} ${className}
    `}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative p-5">
        {children}
      </div>
    </div>
  );
}

// --- KPI Pill ---
function KpiPill({ icon: Icon, label, value, sub, color = 'from-primary-500/20 to-primary-600/10' }) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {sub && <p className="text-xs text-white/50 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color}`}>
          <Icon className="w-5 h-5 text-white/80" />
        </div>
      </div>
    </GlassCard>
  );
}

export default function Secretary() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSendReminder = async (invoiceId) => {
    try {
      await remindersApi.send(invoiceId);
      addToast({ type: 'success', message: 'Rappel envoyé avec succès' });
      fetchDashboard(true);
    } catch {
      addToast({ type: 'error', message: "Erreur lors de l'envoi du rappel" });
    }
  };

  const handleSendAllReminders = async () => {
    if (!data?.remindersDue?.length) return;
    let sent = 0;
    for (const r of data.remindersDue) {
      try {
        await remindersApi.send(r.invoiceId);
        sent++;
      } catch { /* continue */ }
    }
    addToast({ type: 'success', message: `${sent} rappel(s) envoyé(s)` });
    fetchDashboard(true);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  const o = data?.overview || {};

  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-emerald-600/6 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Tableau de bord</h1>
            <p className="text-white/40 text-sm mt-1">Vue d'ensemble de votre activité administrative</p>
          </div>
          <button
            onClick={() => fetchDashboard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiPill
            icon={AlertTriangle}
            label="En retard"
            value={fmt(o.totalOverdue)}
            sub={`${o.overdueCount || 0} facture${(o.overdueCount || 0) > 1 ? 's' : ''}`}
            color="from-red-500/20 to-red-600/10"
          />
          <KpiPill
            icon={ShieldCheck}
            label="Taux recouvrement"
            value={`${o.recoveryRate || 100}%`}
            sub="Factures payées / envoyées"
            color="from-emerald-500/20 to-emerald-600/10"
          />
          <KpiPill
            icon={Clock}
            label="Non facturé"
            value={fmt(o.unbilledTotal)}
            sub={`${o.unbilledHours || 0}h de travail`}
            color="from-amber-500/20 to-amber-600/10"
          />
          <KpiPill
            icon={BarChart3}
            label="Délai moyen"
            value={`${o.globalAvgPaymentDays || '-'}j`}
            sub="Tous clients confondus"
            color="from-violet-500/20 to-violet-600/10"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Reminders Due Today */}
          <GlassCard span={2}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/15">
                  <Bell className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Rappels à envoyer</h3>
                {data?.remindersDue?.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[11px] font-bold">
                    {data.remindersDue.length}
                  </span>
                )}
              </div>
              {data?.remindersDue?.length > 0 && (
                <button
                  onClick={handleSendAllReminders}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-xs font-medium"
                >
                  <Send className="w-3 h-3" />
                  Tout envoyer
                </button>
              )}
            </div>
            {!data?.remindersDue?.length ? (
              <p className="text-white/30 text-sm py-4 text-center">Aucun rappel en attente</p>
            ) : (
              <div className="space-y-2">
                {data.remindersDue.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{r.clientName}</span>
                        {r.company && <span className="text-xs text-white/30 truncate hidden sm:inline">{r.company}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/40">{r.invoiceNumber}</span>
                        <span className="text-xs text-red-400/70">{r.daysOverdue}j de retard</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                          {reminderLabels[r.reminderType] || r.reminderType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{fmt(r.total)}</span>
                      <button
                        onClick={() => handleSendReminder(r.invoiceId)}
                        className="p-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-red-300 hover:bg-red-500/15 transition-colors"
                        title="Envoyer le rappel"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Payments This Week */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/15">
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Paiements reçus</h3>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mb-1">{fmt(data?.paymentsThisWeek?.total)}</p>
            <p className="text-xs text-white/40 mb-4">{data?.paymentsThisWeek?.count || 0} cette semaine</p>
            <div className="space-y-2">
              {(data?.paymentsThisWeek?.invoices || []).slice(0, 4).map((inv, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <span className="text-xs text-white/70 truncate block">{inv.clientName}</span>
                    <span className="text-[11px] text-white/30">{inv.number}</span>
                  </div>
                  <span className="text-xs font-medium text-emerald-400 whitespace-nowrap ml-2">+{fmt(inv.total)}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Critical Overdue */}
          <GlassCard span={2} rowSpan={2}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-orange-500/15">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Factures en retard critique</h3>
            </div>
            {!data?.criticalOverdue?.length ? (
              <p className="text-white/30 text-sm py-8 text-center">Aucune facture critique</p>
            ) : (
              <div className="space-y-1.5">
                {data.criticalOverdue.map((inv, i) => {
                  const severity = inv.daysOverdue > 45 ? 'bg-red-500/10 border-red-500/20' :
                    inv.daysOverdue > 30 ? 'bg-orange-500/8 border-orange-500/15' :
                    'bg-amber-500/5 border-amber-500/10';
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${severity} transition-colors`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">{inv.clientName}</span>
                          {inv.company && <span className="text-xs text-white/25 truncate hidden lg:inline">{inv.company}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{inv.number}</span>
                          <span className="text-xs text-white/25">{inv.projectName}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-sm font-semibold text-white">{fmt(inv.total)}</p>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`text-xs font-medium ${
                            inv.daysOverdue > 45 ? 'text-red-400' : inv.daysOverdue > 30 ? 'text-orange-400' : 'text-amber-400'
                          }`}>
                            {inv.daysOverdue}j
                          </span>
                          {inv.reminderCount > 0 && (
                            <span className="text-[10px] text-white/30">{inv.reminderCount} rappel{inv.reminderCount > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Upcoming Reminders */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/15">
                <CalendarClock className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Prochains rappels</h3>
            </div>
            {!data?.upcomingReminders?.length ? (
              <p className="text-white/30 text-sm py-4 text-center">Aucun rappel prévu</p>
            ) : (
              <div className="space-y-2.5">
                {data.upcomingReminders.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-xs text-white/70 truncate block">{r.clientName}</span>
                      <span className="text-[10px] text-white/30">{reminderLabels[r.reminderType]}</span>
                    </div>
                    <span className="text-xs text-blue-400/80 whitespace-nowrap ml-2">{relDate(r.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Cash Flow Forecast - reuses second row */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-violet-500/15">
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Cash flow prévu</h3>
            </div>
            {!data?.cashFlowForecast?.length ? (
              <p className="text-white/30 text-sm py-4 text-center">Aucune facture en attente</p>
            ) : (
              <div className="space-y-2">
                {data.cashFlowForecast.filter(f => !f.isOverdue).slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="min-w-0">
                      <span className="text-xs text-white/70 truncate block">{f.clientName}</span>
                      <span className="text-[11px] text-white/30">{relDate(f.expectedPaymentDate)}</span>
                    </div>
                    <span className="text-xs font-medium text-violet-400 whitespace-nowrap ml-2">{fmt(f.total)}</span>
                  </div>
                ))}
                {(() => {
                  const total = data.cashFlowForecast
                    .filter(f => !f.isOverdue)
                    .slice(0, 5)
                    .reduce((s, f) => s + f.total, 0);
                  return total > 0 ? (
                    <div className="pt-2 mt-2 border-t border-white/[0.06] flex justify-between">
                      <span className="text-[11px] text-white/30">Total attendu</span>
                      <span className="text-xs font-semibold text-violet-300">{fmt(total)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </GlassCard>

          {/* Client Intelligence */}
          <GlassCard span={3}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-primary-500/15">
                <Users className="w-4 h-4 text-primary-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Intelligence client</h3>
            </div>
            {!data?.clientIntelligence?.length ? (
              <p className="text-white/30 text-sm py-4 text-center">Aucune donnée client</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-white/30">
                      <th className="text-left pb-3 font-medium">Client</th>
                      <th className="text-right pb-3 font-medium">Total facturé</th>
                      <th className="text-right pb-3 font-medium">En retard</th>
                      <th className="text-center pb-3 font-medium">Délai moyen</th>
                      <th className="text-center pb-3 font-medium">Fiabilité</th>
                      <th className="text-center pb-3 font-medium">Rappels</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.clientIntelligence.slice(0, 8).map((client, i) => (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-bold text-white/60">
                                {(client.company || client.name || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-white font-medium truncate block text-sm">{client.company || client.name}</span>
                              {client.company && <span className="text-[11px] text-white/30 truncate block">{client.name}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-2.5 text-white/70 whitespace-nowrap">{fmt(client.totalInvoiced)}</td>
                        <td className="text-right py-2.5 whitespace-nowrap">
                          {client.totalOverdue > 0 ? (
                            <span className="text-red-400 font-medium">{fmt(client.totalOverdue)}</span>
                          ) : (
                            <span className="text-white/20">-</span>
                          )}
                        </td>
                        <td className="text-center py-2.5">
                          {client.avgPaymentDays !== null ? (
                            <span className={`font-medium ${
                              client.avgPaymentDays <= 30 ? 'text-emerald-400' :
                              client.avgPaymentDays <= 45 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {client.avgPaymentDays}j
                            </span>
                          ) : (
                            <span className="text-white/20">-</span>
                          )}
                        </td>
                        <td className="text-center py-2.5">
                          <ReliabilityBadge score={client.reliabilityScore} />
                        </td>
                        <td className="text-center py-2.5">
                          {client.reminderCount > 0 ? (
                            <span className="text-xs text-orange-400">{client.reminderCount}</span>
                          ) : (
                            <span className="text-white/20">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* Quotes Pending Signature */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/15">
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Devis en attente</h3>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{o.pendingQuotes || 0}</p>
            <p className="text-xs text-white/40 mb-3">{fmt(o.pendingQuotesTotal)} en attente de signature</p>
            <div className="space-y-2">
              {(data?.pendingQuotesList || []).map((q, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <span className="text-xs text-white/70 truncate block">{q.clientName}</span>
                    <span className="text-[11px] text-white/30">{q.number}</span>
                  </div>
                  <span className="text-xs font-medium text-cyan-400 whitespace-nowrap ml-2">{fmt(q.total)}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Unbilled Work */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/15">
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Travail non facturé</h3>
            </div>
            <p className="text-2xl font-bold text-amber-400 mb-1">{fmt(o.unbilledTotal)}</p>
            <p className="text-xs text-white/40">{o.unbilledHours || 0} heures non facturées</p>
          </GlassCard>

          {/* Recent Actions */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-primary-500/15">
                <ArrowUpRight className="w-4 h-4 text-primary-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Actions récentes</h3>
            </div>
            {!data?.recentActions?.length ? (
              <p className="text-white/30 text-sm py-4 text-center">Aucune action récente</p>
            ) : (
              <div className="space-y-2.5">
                {data.recentActions.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      a.emailSent ? 'bg-emerald-400' : 'bg-white/20'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-white/70 truncate block">
                        {reminderLabels[a.type] || a.type} - {a.clientName}
                      </span>
                      <span className="text-[11px] text-white/30">{relDate(a.sentAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

        </div>
      </div>
    </div>
  );
}
