import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, TrendingDown, TrendingUp, AlertCircle, FileText, Download,
  PieChart, BarChart3, Receipt, X, ChevronRight, Loader2, RefreshCw,
  Calendar, DollarSign, Eye, ChevronDown
} from 'lucide-react';
import { analyticsApi, exportsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import UpgradePrompt from '../components/ui/UpgradePrompt';
import Button from '../components/ui/Button';
import { formatCurrency } from '../utils/format';

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const PERIOD_OPTIONS = [
  { value: 'year', label: 'Année en cours' },
  { value: 'rolling', label: '12 derniers mois' }
];

const REVENUE_MODE_OPTIONS = [
  { value: 'invoiced', label: 'Facturé' },
  { value: 'paid', label: 'Encaissé' }
];

export default function Comptabilite() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  // Data
  const [expenses, setExpenses] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [vatDetail, setVatDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [period, setPeriod] = useState('year');
  const [revenueMode, setRevenueMode] = useState('invoiced');
  const [showProjection, setShowProjection] = useState(false);
  const [vatYear, setVatYear] = useState(new Date().getFullYear());

  // UI
  const [showExportModal, setShowExportModal] = useState(false);
  const [vatThresholdWarning, setVatThresholdWarning] = useState(null);
  const [annualRevenue, setAnnualRevenue] = useState(0);
  const [plPeriodLabel, setPlPeriodLabel] = useState('');

  // Drill-down state
  const [drillDown, setDrillDown] = useState(null);

  const hasComptaPlus = user?.hasComptaPlus;

  const loadData = useCallback(async (isRefresh = false) => {
    if (!hasComptaPlus) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const plParams = { period, revenueMode };
      if (showProjection) plParams.projection = 'true';

      const [expRes, plRes, vatRes] = await Promise.all([
        analyticsApi.getExpenses({ period }).catch(() => ({ data: { data: null } })),
        analyticsApi.getProfitLoss(plParams).catch(() => ({ data: { data: null } })),
        analyticsApi.getVatDetail({ year: vatYear, revenueMode }).catch(() => ({ data: { data: null } }))
      ]);

      setExpenses(expRes.data.data);
      setProfitLoss(plRes.data.data);
      setVatDetail(vatRes.data.data);
      setVatThresholdWarning(plRes.data.vatThresholdWarning || null);
      setAnnualRevenue(plRes.data.annualRevenue || 0);
      setPlPeriodLabel(plRes.data.period || period);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasComptaPlus, period, revenueMode, showProjection, vatYear, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Drill-down handlers
  const openMonthDetail = async (month) => {
    setDrillDown({ type: 'month', title: `${monthNames[month.monthNum - 1]} ${month.year}`, loading: true, data: null });
    try {
      const res = await analyticsApi.getProfitLossDetail(month.year, month.monthNum, { revenueMode });
      setDrillDown(d => ({ ...d, loading: false, data: res.data.data }));
    } catch {
      setDrillDown(d => ({ ...d, loading: false, data: { invoices: [], transactions: [] } }));
    }
  };

  const openCategoryDetail = async (cat) => {
    setDrillDown({ type: 'category', title: cat.categoryName, loading: true, data: null });
    try {
      const res = await analyticsApi.getExpenseCategoryDetail(cat.categoryId || 'uncategorized', { period });
      setDrillDown(d => ({ ...d, loading: false, data: res.data.data }));
    } catch {
      setDrillDown(d => ({ ...d, loading: false, data: [] }));
    }
  };

  const openVatQuarterDetail = async (q) => {
    setDrillDown({ type: 'vat', title: `TVA ${q.label} ${vatDetail?.year || vatYear}`, loading: true, data: null });
    try {
      const res = await analyticsApi.getVatQuarterDetail(q.quarter, { year: vatDetail?.year || vatYear, revenueMode });
      setDrillDown(d => ({ ...d, loading: false, data: res.data.data }));
    } catch {
      setDrillDown(d => ({ ...d, loading: false, data: { invoices: [], transactions: [] } }));
    }
  };

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
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  // P&L totals
  const plTotals = profitLoss ? profitLoss.reduce((acc, m) => ({
    revenue: acc.revenue + (m.revenue || 0),
    expenses: acc.expenses + (m.expenses || 0),
    profit: acc.profit + (m.profit || 0),
    vatCollected: acc.vatCollected + (m.vatCollected || 0),
    vatDeductible: acc.vatDeductible + (m.vatDeductible || 0)
  }), { revenue: 0, expenses: 0, profit: 0, vatCollected: 0, vatDeductible: 0 }) : null;

  const maxMonthlyVal = profitLoss ? Math.max(...profitLoss.map(m => Math.max(m.revenue || 0, m.expenses || 0)), 1) : 1;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-6 space-y-6">
      {/* CO art. 957 legal disclaimer */}
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
          Ce module est un outil d'aide à la gestion. Il ne remplace pas une comptabilité tenue conformément au CO art. 957 et à l'OLICO.
          Pour la tenue officielle de vos comptes, consultez un fiduciaire agréé.
        </p>
      </div>

      {/* LTVA art. 10: Revenue threshold warning */}
      {vatThresholdWarning && (
        <div className={`p-3 rounded-lg border ${
          vatThresholdWarning === 'critical' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
          vatThresholdWarning === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' :
          'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
        }`}>
          <p className={`text-xs ${
            vatThresholdWarning === 'critical' ? 'text-red-700 dark:text-red-400' :
            vatThresholdWarning === 'warning' ? 'text-amber-700 dark:text-amber-400' :
            'text-blue-700 dark:text-blue-400'
          }`}>
            <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
            {vatThresholdWarning === 'critical'
              ? `Votre CA annuel (${formatCurrency(annualRevenue)}) dépasse CHF 100'000. Vous êtes soumis à l'assujettissement TVA obligatoire (LTVA art. 10).`
              : vatThresholdWarning === 'warning'
              ? `Votre CA annuel (${formatCurrency(annualRevenue)}) approche le seuil de CHF 100'000 pour l'assujettissement TVA (LTVA art. 10).`
              : `Votre CA annuel (${formatCurrency(annualRevenue)}) approche CHF 80'000. Anticipez l'assujettissement TVA (seuil: CHF 100'000, LTVA art. 10).`
            }
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comptabilité</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dépenses, résultat P&L et TVA nette — cliquez sur les graphiques pour le détail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Button icon={Download} variant="secondary" size="sm" onClick={() => setShowExportModal(true)}>
            Export
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Period */}
        <FilterSelect
          icon={Calendar}
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />

        {/* Revenue Mode */}
        <FilterSelect
          icon={DollarSign}
          value={revenueMode}
          onChange={setRevenueMode}
          options={REVENUE_MODE_OPTIONS}
        />

        {/* Projection Toggle */}
        <button
          onClick={() => setShowProjection(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
            showProjection
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Projections
        </button>

        {/* VAT Year */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">TVA :</span>
          <select
            value={vatYear}
            onChange={e => setVatYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={period === 'year' ? 'Revenus YTD' : 'Revenus 12M'}
          value={formatCurrency(plTotals?.revenue || 0)}
          icon={TrendingUp}
          iconColor="text-emerald-500"
        />
        <KpiCard
          label={period === 'year' ? 'Dépenses YTD' : 'Dépenses 12M'}
          value={formatCurrency(expenses?.ytd || 0)}
          icon={TrendingDown}
          iconColor="text-red-500"
        />
        <KpiCard
          label="Résultat net"
          value={formatCurrency(plTotals?.profit || 0)}
          icon={DollarSign}
          iconColor={(plTotals?.profit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}
          valueColor={(plTotals?.profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
        <KpiCard
          label="TVA nette"
          value={formatCurrency(vatDetail?.totals?.vatNet || 0)}
          icon={FileText}
          iconColor="text-blue-500"
          subtitle={`${vatDetail?.totals?.vatCollected ? formatCurrency(vatDetail.totals.vatCollected) : '0'} collectée`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi label="Dépenses ce mois" value={formatCurrency(expenses?.mtd || 0)} />
        <MiniKpi label="Non catégorisées" value={`${expenses?.uncategorized || 0} tx`} warn={expenses?.uncategorized > 0} />
        <MiniKpi label="TVA collectée" value={formatCurrency(vatDetail?.totals?.vatCollected || 0)} />
        <MiniKpi label="TVA déductible" value={formatCurrency(vatDetail?.totals?.vatDeductible || 0)} />
      </div>

      {/* P&L Chart — clickable bars */}
      {profitLoss && profitLoss.length > 0 && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Résultat mensuel (P&L)</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 dark:bg-emerald-400" /> Revenus
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-400 dark:bg-red-500" /> Dépenses
              </span>
              {showProjection && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800 border border-dashed border-red-400" /> Projection
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end gap-1 h-48">
            {profitLoss.map((m, i) => {
              const revenueH = (m.revenue / maxMonthlyVal) * 100;
              const expenseH = (m.expenses / maxMonthlyVal) * 100;
              const projH = showProjection && m.projectedExpenses ? ((m.projectedExpenses) / maxMonthlyVal) * 100 : 0;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  onClick={() => openMonthDetail(m)}
                  title={`${m.month} ${m.year}\nRevenus: ${formatCurrency(m.revenue)}\nDépenses: ${formatCurrency(m.expenses)}\nRésultat: ${formatCurrency(m.profit)}`}
                >
                  <div className="w-full flex items-end justify-center gap-0.5 h-40">
                    <div
                      className="w-2/5 bg-emerald-500 dark:bg-emerald-400 rounded-t group-hover:bg-emerald-600 dark:group-hover:bg-emerald-300 transition-colors"
                      style={{ height: `${Math.max(revenueH, 1)}%` }}
                    />
                    <div className="w-2/5 flex flex-col justify-end">
                      {projH > 0 && (
                        <div
                          className="w-full bg-red-200 dark:bg-red-900/50 border border-dashed border-red-400 rounded-t"
                          style={{ height: `${projH}%` }}
                        />
                      )}
                      <div
                        className="w-full bg-red-400 dark:bg-red-500 rounded-t group-hover:bg-red-500 dark:group-hover:bg-red-400 transition-colors"
                        style={{ height: `${Math.max(expenseH, 1)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-primary-500 transition-colors block">{m.month}</span>
                    <span className={`text-[9px] font-medium ${m.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {m.profit >= 0 ? '+' : ''}{formatCurrency(m.profit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* P&L Summary Row */}
          {plTotals && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total revenus</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(plTotals.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total dépenses</p>
                <p className="text-sm font-bold text-red-500 dark:text-red-400">{formatCurrency(plTotals.expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Résultat net</p>
                <p className={`text-sm font-bold ${plTotals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {plTotals.profit >= 0 ? '+' : ''}{formatCurrency(plTotals.profit)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses by Category — clickable rows */}
      {expenses?.byCategory && expenses.byCategory.length > 0 && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dépenses par catégorie</h2>
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {formatCurrency(expenses.ytd)} total
            </span>
          </div>
          <div className="space-y-3">
            {expenses.byCategory.map((cat, i) => {
              const pct = expenses.ytd > 0 ? (cat.total / expenses.ytd) * 100 : 0;
              return (
                <div
                  key={i}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                  onClick={() => openCategoryDetail(cat)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{cat.categoryName}</span>
                      {cat.accountNumber && (
                        <span className="text-xs text-slate-400 font-mono">{cat.accountNumber}</span>
                      )}
                      <span className="text-xs text-slate-400">{cat.count} tx</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(cat.total)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-500 transition-colors" />
                    </div>
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

      {/* Monthly Expense Breakdown */}
      {expenses?.monthly && expenses.monthly.length > 0 && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Évolution des dépenses</h2>
          </div>
          <div className="flex items-end gap-1 h-36">
            {expenses.monthly.map((m, i) => {
              const maxExpMonth = Math.max(...expenses.monthly.map(x => x.total || 0), 1);
              const h = ((m.total || 0) / maxExpMonth) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex justify-center h-28">
                    <div className="w-3/4 flex flex-col justify-end">
                      {m.byCategory && m.byCategory.length > 0 ? (
                        m.byCategory.map((cat, ci) => {
                          const catH = m.total > 0 ? (cat.total / maxExpMonth) * 100 : 0;
                          return (
                            <div
                              key={ci}
                              style={{ height: `${catH}%`, backgroundColor: cat.categoryColor }}
                              className={ci === 0 ? 'rounded-t' : ''}
                              title={`${cat.categoryName}: ${formatCurrency(cat.total)}`}
                            />
                          );
                        })
                      ) : (
                        <div
                          className="bg-slate-300 dark:bg-slate-600 rounded-t"
                          style={{ height: `${Math.max(h, 1)}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{m.month}</span>
                  <span className="text-[9px] text-slate-400">{formatCurrency(m.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VAT Detail — clickable rows */}
      {vatDetail && (
        <div className="p-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">TVA par trimestre ({vatDetail.year})</h2>
            <span className="text-xs text-slate-400">
              Mode: {revenueMode === 'invoiced' ? 'facturé' : 'encaissé'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Trimestre</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CA HT</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">TVA collectée</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Dépenses</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">TVA déductible</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 font-bold">TVA nette</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vatDetail.quarters.map(q => (
                  <tr
                    key={q.quarter}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => openVatQuarterDetail(q)}
                  >
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">{q.label}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrency(q.revenueHT || 0)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(q.vatCollected)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrency(q.expensesTotal || 0)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(q.vatDeductible)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(q.vatNet)}</td>
                    <td className="px-4 py-2"><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td className="px-4 py-2 text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(vatDetail.totals.revenueHT || 0)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(vatDetail.totals.vatCollected)}</td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(vatDetail.totals.expensesTotal || 0)}</td>
                  <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(vatDetail.totals.vatDeductible)}</td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(vatDetail.totals.vatNet)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-Down Panel */}
      {drillDown && (
        <DrillDownPanel drillDown={drillDown} onClose={() => setDrillDown(null)} />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <FiduciaryExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}

/* ─── Filter Select ─── */
function FilterSelect({ icon: Icon, value, onChange, options }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent text-slate-700 dark:text-slate-300 outline-none cursor-pointer pr-4 appearance-none"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 -ml-3 pointer-events-none" />
      </div>
    </div>
  );
}

/* ─── Drill-Down Panel ─── */
function DrillDownPanel({ drillDown, onClose }) {
  const { type, title, loading, data } = drillDown;

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl bg-white dark:bg-dark-card shadow-2xl overflow-y-auto animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : type === 'category' ? (
            <CategoryDetail data={data} formatDate={formatDate} />
          ) : (
            <MonthOrVatDetail data={data} formatDate={formatDate} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Month / VAT Quarter Detail ─── */
function MonthOrVatDetail({ data, formatDate }) {
  if (!data) return null;
  const { invoices = [], transactions = [] } = data;

  const totalInvoices = invoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const totalTransactions = transactions.reduce((s, tx) => s + (tx.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Revenue / Invoices */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Revenus ({invoices.length} facture{invoices.length !== 1 ? 's' : ''})
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalInvoices)}</span>
        </h4>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune facture</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{inv.number}</span>
                  <span className="text-xs text-slate-500 ml-2">{inv.clientName}{inv.company ? ` (${inv.company})` : ''}</span>
                  {inv.projectName && <span className="text-xs text-slate-400 ml-1">· {inv.projectName}</span>}
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatDate(inv.date)}
                    {inv.status && <span className="ml-2 capitalize">{inv.status}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.total)}</span>
                  {inv.vatAmount > 0 && (
                    <div className="text-xs text-slate-400">TVA: {formatCurrency(inv.vatAmount)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expenses / Transactions */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Dépenses ({transactions.length} transaction{transactions.length !== 1 ? 's' : ''})
          </span>
          <span className="text-red-600 dark:text-red-400">{formatCurrency(totalTransactions)}</span>
        </h4>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune transaction</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{tx.counterpartyName || 'Inconnu'}</span>
                  {tx.categoryName && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.categoryColor }} />
                      {tx.categoryName}
                    </span>
                  )}
                  <div className="text-xs text-slate-400 mt-0.5">{formatDate(tx.date)}</div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(tx.amount)}</span>
                  {tx.vatAmount > 0 && (
                    <div className="text-xs text-slate-400">TVA: {formatCurrency(tx.vatAmount)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Category Detail ─── */
function CategoryDetail({ data, formatDate }) {
  if (!data || !Array.isArray(data)) return <p className="text-sm text-slate-400">Aucune donnée</p>;

  const total = data.reduce((s, tx) => s + (tx.amount || 0), 0);

  return (
    <div className="space-y-3">
      {data.length > 0 && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-500">{data.length} transaction{data.length !== 1 ? 's' : ''}</span>
          <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(total)}</span>
        </div>
      )}
      {data.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune transaction dans cette catégorie</p>
      ) : (
        data.map(tx => (
          <div key={tx._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{tx.counterpartyName || 'Inconnu'}</span>
              {tx.reference && <span className="text-xs text-slate-400 ml-2 font-mono">{tx.reference}</span>}
              {tx.notes && <div className="text-xs text-slate-400 mt-0.5">{tx.notes}</div>}
              <div className="text-xs text-slate-400 mt-0.5">
                {formatDate(tx.date)}
                {tx.attachmentCount > 0 && <span className="ml-2">📎 {tx.attachmentCount}</span>}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(tx.amount)}</span>
              {tx.vatAmount > 0 && (
                <div className="text-xs text-slate-400">TVA: {formatCurrency(tx.vatAmount)}{tx.vatRate ? ` (${tx.vatRate}%)` : ''}</div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, icon: Icon, iconColor, valueColor, subtitle }) {
  return (
    <div className="p-5 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className={`text-2xl font-bold ${valueColor || 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

/* ─── Mini KPI ─── */
function MiniKpi({ label, value, warn }) {
  return (
    <div className="px-4 py-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-slate-700">
      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

/* ─── Fiduciary Export Modal ─── */
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
