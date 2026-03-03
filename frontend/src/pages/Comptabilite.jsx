import { useState, useEffect, useCallback } from 'react';
import { Calculator, TrendingDown, TrendingUp, AlertCircle, FileText, Download, PieChart, BarChart3, Receipt } from 'lucide-react';
import { analyticsApi, exportsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import UpgradePrompt from '../components/ui/UpgradePrompt';
import Button from '../components/ui/Button';
import { formatCurrency } from '../utils/format';

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Comptabilite() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [expenses, setExpenses] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [vatDetail, setVatDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  const hasComptaPlus = user?.hasComptaPlus;

  const loadData = useCallback(async () => {
    if (!hasComptaPlus) {
      setLoading(false);
      return;
    }
    try {
      const [expRes, plRes, vatRes] = await Promise.all([
        analyticsApi.getExpenses().catch(() => ({ data: { data: null } })),
        analyticsApi.getProfitLoss().catch(() => ({ data: { data: null } })),
        analyticsApi.getVatDetail().catch(() => ({ data: { data: null } }))
      ]);
      setExpenses(expRes.data.data);
      setProfitLoss(plRes.data.data);
      setVatDetail(vatRes.data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [hasComptaPlus]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!hasComptaPlus) {
    return (
      <div className="p-6">
        <UpgradePrompt feature="La comptabilité avancée" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const maxMonthlyExpense = profitLoss ? Math.max(...profitLoss.map(m => Math.max(m.revenue, m.expenses)), 1) : 1;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comptabilité</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dépenses, résultat P&L et TVA nette
          </p>
        </div>
        <Button icon={Download} variant="secondary" size="sm" onClick={() => setShowExportModal(true)}>
          Export fiduciaire
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Dépenses YTD"
          value={formatCurrency(expenses?.ytd || 0)}
          icon={TrendingDown}
          iconColor="text-red-500"
        />
        <KpiCard
          label="Dépenses ce mois"
          value={formatCurrency(expenses?.mtd || 0)}
          icon={Receipt}
          iconColor="text-amber-500"
        />
        <KpiCard
          label="Non catégorisées"
          value={expenses?.uncategorized || 0}
          icon={AlertCircle}
          iconColor={expenses?.uncategorized > 0 ? 'text-amber-500' : 'text-emerald-500'}
          suffix="tx"
        />
        <KpiCard
          label="TVA nette"
          value={formatCurrency(vatDetail?.totals?.vatNet || 0)}
          icon={FileText}
          iconColor="text-blue-500"
        />
      </div>

      {/* P&L Chart */}
      {profitLoss && profitLoss.length > 0 && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Résultat mensuel (P&L)</h2>
          </div>
          <div className="flex items-end gap-1 h-48">
            {profitLoss.map((m, i) => {
              const revenueH = (m.revenue / maxMonthlyExpense) * 100;
              const expenseH = (m.expenses / maxMonthlyExpense) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-40">
                    <div
                      className="w-2/5 bg-emerald-500 dark:bg-emerald-400 rounded-t"
                      style={{ height: `${Math.max(revenueH, 1)}%` }}
                      title={`Revenus: ${formatCurrency(m.revenue)}`}
                    />
                    <div
                      className="w-2/5 bg-red-400 dark:bg-red-500 rounded-t"
                      style={{ height: `${Math.max(expenseH, 1)}%` }}
                      title={`Dépenses: ${formatCurrency(m.expenses)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 dark:bg-emerald-400" /> Revenus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-400 dark:bg-red-500" /> Dépenses
            </span>
          </div>
        </div>
      )}

      {/* Expenses by Category */}
      {expenses?.byCategory && expenses.byCategory.length > 0 && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dépenses par catégorie</h2>
          </div>
          <div className="space-y-3">
            {expenses.byCategory.map((cat, i) => {
              const pct = expenses.ytd > 0 ? (cat.total / expenses.ytd) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.categoryColor }} />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{cat.categoryName}</span>
                      {cat.accountNumber && (
                        <span className="text-xs text-slate-400 font-mono">{cat.accountNumber}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(cat.total)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.categoryColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VAT Detail */}
      {vatDetail && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">TVA par trimestre ({vatDetail.year})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Trimestre</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">TVA collectée</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">TVA déductible</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 font-bold">TVA nette</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vatDetail.quarters.map(q => (
                  <tr key={q.quarter}>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{q.label}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(q.vatCollected)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(q.vatDeductible)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(q.vatNet)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td className="px-4 py-2 text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(vatDetail.totals.vatCollected)}</td>
                  <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(vatDetail.totals.vatDeductible)}</td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(vatDetail.totals.vatNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <FiduciaryExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, iconColor, suffix }) {
  return (
    <div className="p-5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {value}{suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function FiduciaryExportModal({ onClose }) {
  const { addToast } = useToastStore();
  const [exporting, setExporting] = useState(false);
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportsApi.fiduciary(from, to);
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiduciaire_${from}_${to}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Export téléchargé' });
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de l\'export' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Export fiduciaire</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Exporte un rapport CSV complet : revenus, dépenses par catégorie, résumé TVA et résultat.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Du</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Au</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button icon={Download} size="sm" onClick={handleExport} loading={exporting}>
            Télécharger CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
