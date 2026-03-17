import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, TrendingDown, TrendingUp, AlertCircle, FileText, Download,
  PieChart, BarChart3, X, ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw,
  Tag, PlusCircle, Repeat
} from 'lucide-react';
import { analyticsApi, exportsApi, bankApi, expenseCategoriesApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import UpgradePrompt from '../components/ui/UpgradePrompt';
import Button from '../components/ui/Button';
import { formatCurrency } from '../utils/format';
import TransactionDetailModal from '../components/Comptabilite/TransactionDetailModal';
import AddExpenseModal from '../components/Comptabilite/AddExpenseModal';
import InvoiceDetailModal from '../components/Comptabilite/InvoiceDetailModal';
import RecurringInvoiceDetailModal from '../components/Comptabilite/RecurringInvoiceDetailModal';
import AISuggestionBanner from '../components/AI/AISuggestionBanner';
import AIQuickAction from '../components/AI/AIQuickAction';
import { useAIStore } from '../stores/aiStore';

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';

export default function Comptabilite() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const aiSuggestions = useAIStore(s => s.suggestions);

  // Core data
  const [expenses, setExpenses] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [vatDetail, setVatDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  // Filters
  const [period, setPeriod] = useState('year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [revenueMode, setRevenueMode] = useState('invoiced');
  const [showProjection, setShowProjection] = useState(true);

  // Categories & recurring & uncategorized
  const [categories, setCategories] = useState([]);
  const [recurringCharges, setRecurringCharges] = useState(null);
  const [uncategorized, setUncategorized] = useState([]);
  const [loadingUncat, setLoadingUncat] = useState(false);

  // Inline drill-downs
  const [expandedMonth, setExpandedMonth] = useState(null); // { index, data, loading }
  const [expandedCategory, setExpandedCategory] = useState(null); // { index, data, loading }
  const [expandedVat, setExpandedVat] = useState(null); // { quarter, data, loading }

  // Modals
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedRecurring, setSelectedRecurring] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const hasComptaPlus = user?.hasComptaPlus;

  // ─── Data loaders ───
  const loadData = useCallback(async () => {
    if (!hasComptaPlus) { setLoading(false); return; }
    try {
      const params = { period, revenueMode };
      if (period === 'year') params.year = selectedYear;
      const plParams = { ...params, projection: showProjection ? 'true' : undefined };
      const [expRes, plRes, vatRes] = await Promise.all([
        analyticsApi.getExpenses(params).catch(() => ({ data: { data: null } })),
        analyticsApi.getProfitLoss(plParams).catch(() => ({ data: { data: null } })),
        analyticsApi.getVatDetail(params).catch(() => ({ data: { data: null } }))
      ]);
      setExpenses(expRes.data.data);
      setProfitLoss(plRes.data.data);
      setVatDetail(vatRes.data.data);
    } catch {
      addToast({ type: 'error', message: 'Erreur de chargement des données comptables' });
    }
    finally { setLoading(false); }
  }, [hasComptaPlus, period, selectedYear, revenueMode, showProjection]);

  const loadCategories = useCallback(async () => {
    if (!hasComptaPlus) return;
    try {
      const { data } = await expenseCategoriesApi.getAll();
      setCategories(data.data || []);
    } catch { /* silent */ }
  }, [hasComptaPlus]);

  const loadRecurring = useCallback(async () => {
    if (!hasComptaPlus) return;
    try {
      const { data } = await bankApi.getRecurringCharges();
      setRecurringCharges(data.data || { charges: [], summary: {} });
    } catch { /* silent */ }
  }, [hasComptaPlus]);

  const loadUncategorized = useCallback(async () => {
    if (!hasComptaPlus) return;
    setLoadingUncat(true);
    try {
      const { data } = await bankApi.getTransactions({ creditDebit: 'DBIT', category: 'none', limit: 50 });
      setUncategorized(data.data || []);
    } catch { setUncategorized([]); }
    finally { setLoadingUncat(false); }
  }, [hasComptaPlus]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadCategories(); loadRecurring(); loadUncategorized(); }, [loadCategories, loadRecurring, loadUncategorized]);

  // ─── Inline drill-down toggles ───
  const toggleMonthDrillDown = async (index, month) => {
    if (expandedMonth?.index === index) { setExpandedMonth(null); return; }
    const label = month.month || monthNames[month.monthIndex] || `Mois ${index + 1}`;
    setExpandedMonth({ index, label, data: null, loading: true });
    try {
      const year = month.year || new Date().getFullYear();
      const m = month.monthNum || (month.monthIndex != null ? month.monthIndex + 1 : index + 1);
      const { data } = await analyticsApi.getProfitLossDetail(year, m, { revenueMode });
      // Merge projection data from the P&L month into drill-down
      const detail = data.data;
      if (showProjection && month.projectedRevenue) {
        detail.projectedRevenue = month.projectedRevenue;
        detail.projectedRevenueSources = month.projectedRevenueSources || [];
      }
      if (showProjection && month.projectedExpenses) {
        detail.projectedExpenses = month.projectedExpenses;
        detail.projectedCharges = month.projectedCharges || [];
      }
      setExpandedMonth({ index, label, data: detail, loading: false });
    } catch {
      addToast({ type: 'error', message: 'Erreur chargement détail mois' });
      setExpandedMonth(null);
    }
  };

  const toggleCategoryDrillDown = async (index, cat) => {
    if (expandedCategory?.index === index) { setExpandedCategory(null); return; }
    setExpandedCategory({ index, data: null, loading: true });
    try {
      const drillParams = { period };
      if (period === 'year') drillParams.year = selectedYear;
      const { data } = await analyticsApi.getExpenseCategoryDetail(cat.categoryId, drillParams);
      setExpandedCategory({ index, data: data.data, loading: false });
    } catch {
      addToast({ type: 'error', message: 'Erreur chargement détail catégorie' });
      setExpandedCategory(null);
    }
  };

  const toggleVatDrillDown = async (quarter) => {
    if (expandedVat?.quarter === quarter.quarter) { setExpandedVat(null); return; }
    setExpandedVat({ quarter: quarter.quarter, data: null, loading: true });
    try {
      const { data } = await analyticsApi.getVatQuarterDetail(quarter.quarter, { year: vatDetail?.year });
      setExpandedVat({ quarter: quarter.quarter, data: data.data, loading: false });
    } catch {
      addToast({ type: 'error', message: 'Erreur chargement détail TVA' });
      setExpandedVat(null);
    }
  };

  const handleRefreshAll = () => {
    setLoading(true);
    setExpandedMonth(null);
    setExpandedCategory(null);
    setExpandedVat(null);
    loadData();
    loadRecurring();
    loadUncategorized();
  };

  // ─── Guards ───
  if (!hasComptaPlus) {
    return <div className="p-6"><UpgradePrompt feature="La comptabilité avancée" /></div>;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Computed values ───
  const plData = Array.isArray(profitLoss) ? profitLoss : profitLoss?.months || [];
  const maxPLValue = plData.length > 0
    ? Math.max(...plData.map(m => Math.max((m.revenue || 0) + (m.projectedRevenue || 0), (m.expenses || 0) + (m.projectedExpenses || 0))), 1)
    : 1;
  const totalRevenue = plData.reduce((s, m) => s + (m.revenue || 0), 0);
  const totalExpenses = plData.reduce((s, m) => s + (m.expenses || 0), 0);
  const netResult = totalRevenue - totalExpenses;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comptabilité</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            P&L, dépenses par catégorie, TVA et charges récurrentes
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {period === 'year' ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedYear(y => y - 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <ToggleBtn active onClick={() => setPeriod('rolling')}>
                {selectedYear}
              </ToggleBtn>
              <button
                onClick={() => setSelectedYear(y => y + 1)}
                disabled={selectedYear >= new Date().getFullYear()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <ToggleBtn active onClick={() => setPeriod('year')}>
              12 derniers mois
            </ToggleBtn>
          )}
          <ToggleBtn active onClick={() => setRevenueMode(revenueMode === 'invoiced' ? 'paid' : 'invoiced')}>
            {revenueMode === 'invoiced' ? 'Facturé' : 'Encaissé'}
          </ToggleBtn>
          <ToggleBtn active={showProjection} onClick={() => setShowProjection(!showProjection)}>
            Projection
          </ToggleBtn>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.08]" />
          <Button icon={PlusCircle} size="sm" onClick={() => setShowAddModal(true)}>
            Ajouter
          </Button>
          <Button icon={Download} variant="secondary" size="sm" onClick={() => setShowExportModal(true)}>
            Export
          </Button>
          <button onClick={handleRefreshAll} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══ AI Suggestions ═══ */}
      <AISuggestionBanner
        suggestions={aiSuggestions}
        filter={(s) => s.type === 'warning' && ['view_overdue', 'check_vat'].includes(s.action)}
      />

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Revenus" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="emerald" />
        <KpiCard label="Dépenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} color="red" />
        <KpiCard label="Résultat net" value={formatCurrency(netResult)} icon={Calculator} color={netResult >= 0 ? 'emerald' : 'red'} />
        <KpiCard label="TVA nette" value={formatCurrency(vatDetail?.totals?.vatNet || 0)} icon={FileText} color="blue" />
      </div>

      {/* ═══ P&L Chart ═══ */}
      {plData.length > 0 && (
        <section className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-0">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Résultat mensuel (P&L)</h2>
          </div>
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-end gap-1 h-48">
              {plData.map((m, i) => {
                const revH = ((m.revenue || 0) / maxPLValue) * 100;
                const projRevH = showProjection && m.projectedRevenue ? (m.projectedRevenue / maxPLValue) * 100 : 0;
                const expH = ((m.expenses || 0) / maxPLValue) * 100;
                const projExpH = showProjection && m.projectedExpenses ? (m.projectedExpenses / maxPLValue) * 100 : 0;
                const label = m.month || monthNames[m.monthIndex] || `M${i + 1}`;
                const isExpanded = expandedMonth?.index === i;

                return (
                  <div
                    key={i}
                    className={`flex-1 flex flex-col items-center gap-1 cursor-pointer group ${isExpanded ? 'opacity-100' : ''}`}
                    onClick={() => toggleMonthDrillDown(i, m)}
                  >
                    <div className="w-full flex items-end justify-center gap-0.5 h-40">
                      {/* Revenue bar (solid + projected) */}
                      <div className="w-2/5 flex flex-col-reverse" style={{ height: `${Math.max(revH + projRevH, 1)}%` }}>
                        <div
                          className="w-full bg-emerald-500 dark:bg-emerald-400 rounded-t group-hover:bg-emerald-600 dark:group-hover:bg-emerald-300 transition-colors"
                          style={{ height: revH + projRevH > 0 ? `${(revH / (revH + projRevH)) * 100}%` : '100%' }}
                          title={`Revenus: ${formatCurrency(m.revenue || 0)}`}
                        />
                        {projRevH > 0 && (
                          <div
                            className="w-full bg-emerald-200/60 dark:bg-emerald-900/40 rounded-t border border-dashed border-emerald-300 dark:border-emerald-700"
                            style={{ height: `${(projRevH / (revH + projRevH)) * 100}%` }}
                            title={`Projection revenus: ${formatCurrency(m.projectedRevenue)}`}
                          />
                        )}
                      </div>
                      {/* Expense bar (solid + projected) */}
                      <div className="w-2/5 flex flex-col-reverse" style={{ height: `${Math.max(expH + projExpH, 1)}%` }}>
                        <div
                          className="w-full bg-red-400 dark:bg-red-500 rounded-t group-hover:bg-red-500 dark:group-hover:bg-red-400 transition-colors"
                          style={{ height: expH + projExpH > 0 ? `${(expH / (expH + projExpH)) * 100}%` : '100%' }}
                        />
                        {projExpH > 0 && (
                          <div
                            className="w-full bg-red-200/60 dark:bg-red-900/40 rounded-t border border-dashed border-red-300 dark:border-red-700"
                            style={{ height: `${(projExpH / (expH + projExpH)) * 100}%` }}
                            title={`Projection dépenses: ${formatCurrency(m.projectedExpenses)}`}
                          />
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] transition-colors ${isExpanded ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
                      {label}
                    </span>
                    {isExpanded && <div className="w-1 h-1 rounded-full bg-primary-500" />}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Revenus</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400" /> Dépenses</span>
              {showProjection && (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-dashed border-emerald-300" /> Proj. revenus</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-200 border border-dashed border-red-300" /> Proj. dépenses</span>
                </>
              )}
            </div>
          </div>

          {/* ── Inline month detail ── */}
          {expandedMonth && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/[0.02]">
              {expandedMonth.loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
              ) : (
                <InlineMonthDetail data={expandedMonth.data} monthLabel={expandedMonth.label} onClickTx={(tx) => setSelectedTx({ _id: tx._id || tx.id })} onClickInvoice={(inv) => setSelectedInvoice(inv)} onClickRecurring={(id) => setSelectedRecurring(id)} />
              )}
            </div>
          )}
        </section>
      )}

      {/* ═══ Expenses by Category ═══ */}
      {expenses?.byCategory?.length > 0 && (
        <section className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <PieChart className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dépenses par catégorie</h2>
          </div>
          <div className="px-5 pb-5 space-y-1">
            {expenses.byCategory.map((cat, i) => {
              const pct = expenses.ytd > 0 ? (cat.total / expenses.ytd) * 100 : 0;
              const isExpanded = expandedCategory?.index === i;
              return (
                <div key={i}>
                  <div
                    className={`cursor-pointer rounded-lg px-3 py-2.5 transition-colors ${isExpanded ? 'bg-slate-100 dark:bg-white/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'}`}
                    onClick={() => toggleCategoryDrillDown(i, cat)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{cat.categoryName}</span>
                        {cat.accountNumber && <span className="text-xs text-slate-400 font-mono flex-shrink-0">{cat.accountNumber}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(cat.total)}</span>
                        <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.categoryColor }} />
                    </div>
                  </div>

                  {/* ── Inline category detail ── */}
                  {isExpanded && (
                    <div className="mx-3 mt-1 mb-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] overflow-hidden">
                      {expandedCategory.loading ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary-500" /></div>
                      ) : (
                        <InlineCategoryDetail data={expandedCategory.data} onClickTx={(tx) => setSelectedTx({ _id: tx._id || tx.id })} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ VAT Detail ═══ */}
      {vatDetail && (
        <section className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">TVA par trimestre ({vatDetail.year})</h2>
            <AIQuickAction label="Calculer avec l'AI" prompt={`Aide-moi à comprendre ma situation TVA. TVA nette : ${formatCurrency(vatDetail?.totals?.vatNet || 0)} CHF pour ${vatDetail.year}.`} />
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Trimestre</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Collectée</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Déductible</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Nette</th>
                  <th className="px-3 py-2 w-6" />
                </tr>
              </thead>
              <tbody>
                {vatDetail.quarters.map(q => {
                  const isExpanded = expandedVat?.quarter === q.quarter;
                  return (
                    <VatQuarterRow
                      key={q.quarter}
                      q={q}
                      isExpanded={isExpanded}
                      expandedVat={expandedVat}
                      onToggle={() => toggleVatDrillDown(q)}
                      onClickTx={(tx) => setSelectedTx({ _id: tx._id || tx.id })}
                      onClickInvoice={(inv) => setSelectedInvoice(inv)}
                    />
                  );
                })}
                <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td className="px-3 py-2 text-slate-900 dark:text-white">Total</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(vatDetail.totals.vatCollected)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{formatCurrency(vatDetail.totals.vatDeductible)}</td>
                  <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(vatDetail.totals.vatNet)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ Recurring Charges ═══ */}
      <RecurringChargesPanel
        recurringCharges={recurringCharges}
        categories={categories}
        onRefresh={loadRecurring}
        onDataChanged={() => { loadRecurring(); loadData(); }}
      />

      {/* ═══ Uncategorized ═══ */}
      {uncategorized.length > 0 && (
        <UncategorizedPanel
          transactions={uncategorized}
          categories={categories}
          loading={loadingUncat}
          onCategorized={() => { loadUncategorized(); loadData(); }}
          onClickTx={(tx) => setSelectedTx(tx)}
        />
      )}

      {/* ═══ Transaction Detail Modal ═══ */}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          categories={categories}
          recurringCharges={recurringCharges}
          onTransactionUpdated={() => { loadData(); loadUncategorized(); setSelectedTx(null); }}
          onRecurringChanged={() => { loadRecurring(); loadData(); }}
        />
      )}

      {/* ═══ Invoice Detail Modal ═══ */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={loadData}
        />
      )}

      {/* ═══ Recurring Invoice Detail Modal ═══ */}
      {selectedRecurring && (
        <RecurringInvoiceDetailModal
          recurringId={selectedRecurring}
          onClose={() => setSelectedRecurring(null)}
        />
      )}

      {/* ═══ Add Expense/Entry Modal ═══ */}
      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        categories={categories}
        onSuccess={() => { loadData(); loadUncategorized(); }}
      />

      {/* ═══ Export Modal ═══ */}
      {showExportModal && <FiduciaryExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sub-components
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        active
          ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-500/10 dark:text-primary-400 dark:border-primary-500/20'
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.06] dark:hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, icon: Icon, color }) {
  const colors = {
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    red: 'text-red-500 bg-red-50 dark:bg-red-500/10',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="p-4 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <div className={`p-1.5 rounded-lg ${c}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/* ─── Inline Month Drill-Down ─── */
function InlineMonthDetail({ data, monthLabel, onClickTx, onClickInvoice, onClickRecurring }) {
  if (!data) return <p className="text-sm text-slate-500 p-4">Aucune donnée</p>;

  const txs = data.transactions || data.expenseTransactions || [];
  const invoices = data.invoices || [];
  const totalRev = data.revenue ?? invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalExp = data.expenses ?? txs.reduce((s, t) => s + (t.amount || 0), 0);
  const net = totalRev - totalExp;
  const projRev = data.projectedRevenue || 0;
  const projExp = data.projectedExpenses || 0;
  const projRevSources = data.projectedRevenueSources || [];
  const projCharges = data.projectedCharges || [];
  const hasProjection = projRev > 0 || projExp > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Month header + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {monthLabel && (
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{monthLabel}</h3>
        )}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            Revenus: {formatCurrency(totalRev)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-red-500 dark:text-red-400 font-medium">
            Dépenses: {formatCurrency(totalExp)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className={`font-semibold ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            Résultat: {formatCurrency(net)}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left — Invoices */}
        {invoices.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Factures ({invoices.length})
            </h4>
            <div className="space-y-1">
              {invoices.map(inv => (
                <div
                  key={inv._id}
                  onClick={() => onClickInvoice?.(inv)}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white dark:hover:bg-white/[0.03] text-sm transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 dark:text-white">{inv.number}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">{inv.clientSnapshot?.name || inv.clientName}</span>
                    {inv.status && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : inv.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400'}`}>{inv.status}</span>}
                  </div>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{formatCurrency(inv.total || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right — Expense transactions */}
        {txs.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Dépenses ({txs.length})
            </h4>
            <TxList transactions={txs} onClickTx={onClickTx} />
          </div>
        )}
      </div>

      {/* Projections */}
      {hasProjection && (
        <div className="border-t border-dashed border-slate-200 dark:border-white/[0.06] pt-3 space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" /> Projections
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Projected Revenue */}
            {projRev > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Revenus projetés</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(projRev)}</span>
                </div>
                <div className="space-y-0.5">
                  {projRevSources.map((s, i) => {
                    const isClickable = !!s._id;
                    const handleClick = () => {
                      if (!s._id) return;
                      if (s.type === 'open_invoice') onClickInvoice?.({ _id: s._id });
                      else if (s.type === 'recurring_invoice') onClickRecurring?.(s._id);
                    };
                    return (
                      <div
                        key={i}
                        onClick={handleClick}
                        className={`flex items-center justify-between py-1 px-2.5 text-xs rounded bg-emerald-50/60 dark:bg-emerald-500/[0.04] border border-dashed border-emerald-200 dark:border-emerald-500/15 ${isClickable ? 'cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-500/[0.08] transition-colors' : ''}`}
                      >
                        <span className="text-slate-600 dark:text-slate-400">
                          {s.type === 'open_invoice'
                            ? `${s.number} (restant dû)${s.estimatedByAvgDays != null ? ` · ~${s.estimatedByAvgDays}j` : ''}`
                            : `Récurrence — ${s.clientName || 'Client'}`}
                        </span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">{formatCurrency(s.remaining || s.amount || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Projected Expenses */}
            {projExp > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-red-500 dark:text-red-400">Charges projetées</span>
                  <span className="text-xs font-semibold text-red-500 dark:text-red-400">{formatCurrency(projExp)}</span>
                </div>
                <div className="space-y-0.5">
                  {projCharges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2.5 text-xs rounded bg-red-50/60 dark:bg-red-500/[0.04] border border-dashed border-red-200 dark:border-red-500/15">
                      <span className="text-slate-600 dark:text-slate-400">{c.counterpartyName}</span>
                      <span className="font-medium text-red-700 dark:text-red-300">{formatCurrency(c.expectedAmount || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Inline Category Drill-Down ─── */
function InlineCategoryDetail({ data, onClickTx }) {
  if (!data) return <p className="text-sm text-slate-500 p-3">Aucune donnée</p>;
  // API returns either an array directly or { transactions: [...] }
  const txs = Array.isArray(data) ? data : (data.transactions || []);
  const total = Array.isArray(data) ? txs.reduce((s, t) => s + (t.amount || 0), 0) : (data.total ?? txs.reduce((s, t) => s + (t.amount || 0), 0));
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
        <span>{txs.length} transactions</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(total)}</span>
      </div>
      {txs.length > 0 && <TxList transactions={txs} onClickTx={onClickTx} />}
    </div>
  );
}

/* ─── VAT Quarter Row with inline expand ─── */
function VatQuarterRow({ q, isExpanded, expandedVat, onToggle, onClickTx, onClickInvoice }) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{q.label}</td>
        <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(q.vatCollected)}</td>
        <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{formatCurrency(q.vatDeductible)}</td>
        <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(q.vatNet)}</td>
        <td className="px-3 py-2">
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-slate-50/80 dark:bg-white/[0.02] border-t border-b border-slate-100 dark:border-white/[0.04]">
              {expandedVat.loading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary-500" /></div>
              ) : (
                <InlineVatDetail data={expandedVat.data} onClickTx={onClickTx} onClickInvoice={onClickInvoice} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InlineVatDetail({ data, onClickTx, onClickInvoice }) {
  if (!data) return <p className="text-sm text-slate-500 p-3">Aucune donnée</p>;
  const invoices = data.invoices || [];
  const txs = data.transactions || data.expenseTransactions || [];
  const vatCollected = data.vatCollected ?? invoices.reduce((s, i) => s + (i.vatAmount || 0), 0);
  const vatDeductible = data.vatDeductible ?? txs.reduce((s, t) => s + (t.vatAmount || 0), 0);
  const vatNet = data.vatNet ?? (vatCollected - vatDeductible);

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
          Collectée: {formatCurrency(vatCollected)}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 font-medium">
          Déductible: {formatCurrency(vatDeductible)}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
          Nette: {formatCurrency(vatNet)}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {invoices.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Factures</span>
            <div className="mt-1 space-y-0.5">
              {invoices.map(inv => (
                <div
                  key={inv._id}
                  onClick={() => onClickInvoice?.(inv)}
                  className="flex items-center justify-between py-1 px-2 text-xs rounded hover:bg-white dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="text-slate-700 dark:text-slate-300">{inv.number} — {inv.clientSnapshot?.name || inv.clientName}</span>
                  <span className="text-emerald-600 font-medium">{formatCurrency(inv.vatAmount || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {txs.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dépenses (TVA déductible)</span>
            <div className="mt-1">
              <TxList transactions={txs} onClickTx={onClickTx} compact />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared Transaction List ─── */
function TxList({ transactions, onClickTx, compact }) {
  return (
    <div className="space-y-0.5">
      {transactions.map(tx => (
        <div
          key={tx._id || tx.id}
          className={`flex items-center justify-between rounded-lg hover:bg-white dark:hover:bg-white/[0.04] cursor-pointer transition-colors ${compact ? 'py-1 px-2 text-xs' : 'py-1.5 px-3 text-sm'}`}
          onClick={() => onClickTx(tx)}
        >
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {tx.categoryColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tx.categoryColor }} />}
            <div className="min-w-0">
              <span className="font-medium text-slate-800 dark:text-white truncate block">{tx.counterpartyName || tx.description || '-'}</span>
              {!compact && (
                <span className="text-[11px] text-slate-400">
                  {fmtDate(tx.bookingDate || tx.date)}
                  {tx.categoryName && <span className="ml-1.5 text-slate-500">· {tx.categoryName}</span>}
                </span>
              )}
            </div>
          </div>
          <span className={`font-semibold text-red-500 dark:text-red-400 flex-shrink-0 ml-2 ${compact ? 'text-xs' : ''}`}>
            -{formatCurrency(tx.amount || 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══ Recurring Charges Panel ═══ */
function RecurringChargesPanel({ recurringCharges, categories, onRefresh, onDataChanged }) {
  const { addToast } = useToastStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ counterpartyName: '', frequency: 'monthly', expectedAmount: '', expenseCategory: '' });
  const [creating, setCreating] = useState(false);

  const charges = recurringCharges?.charges || [];
  const summary = recurringCharges?.summary || {};

  const handleCreate = async () => {
    if (!form.counterpartyName.trim() || !form.expectedAmount) {
      addToast({ type: 'error', message: 'Nom et montant requis' }); return;
    }
    setCreating(true);
    try {
      await bankApi.createRecurringCharge({
        counterpartyName: form.counterpartyName.trim(),
        frequency: form.frequency,
        expectedAmount: parseFloat(form.expectedAmount),
        expenseCategory: form.expenseCategory || undefined
      });
      addToast({ type: 'success', message: 'Charge récurrente créée' });
      setShowAddForm(false);
      setForm({ counterpartyName: '', frequency: 'monthly', expectedAmount: '', expenseCategory: '' });
      onDataChanged?.();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.status === 409 ? 'Cette charge existe déjà' : 'Erreur création' });
    } finally { setCreating(false); }
  };

  const handleToggle = async (charge) => {
    try {
      await bankApi.updateRecurringCharge(charge._id, { isActive: !charge.isActive });
      onRefresh?.();
    } catch { addToast({ type: 'error', message: 'Erreur mise à jour' }); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette charge récurrente ?')) return;
    try {
      await bankApi.deleteRecurringCharge(id);
      addToast({ type: 'success', message: 'Charge supprimée' });
      onDataChanged?.();
    } catch { addToast({ type: 'error', message: 'Erreur suppression' }); }
  };

  if (!recurringCharges) return null;

  const freqLabels = { monthly: '/mois', quarterly: '/trim.', yearly: '/an' };

  return (
    <section className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Charges récurrentes</h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500">{charges.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Ajouter
          </button>
          <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {summary.estimatedMonthly > 0 && (
        <div className="mx-5 mb-3 flex items-center gap-4 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] rounded-lg text-xs text-slate-500 dark:text-slate-400">
          <span>Mensuel: <b className="text-slate-700 dark:text-slate-300">{formatCurrency(summary.estimatedMonthly)}</b></span>
          {summary.estimatedAnnual > 0 && <span>Annuel: <b className="text-slate-700 dark:text-slate-300">{formatCurrency(summary.estimatedAnnual)}</b></span>}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="mx-5 mb-3 p-3 bg-primary-50/50 dark:bg-primary-500/5 rounded-lg border border-primary-200 dark:border-primary-500/20">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="text" placeholder="Fournisseur" value={form.counterpartyName} onChange={e => setForm(p => ({ ...p, counterpartyName: e.target.value }))}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500" />
            <input type="number" placeholder="Montant" value={form.expectedAmount} onChange={e => setForm(p => ({ ...p, expectedAmount: e.target.value }))}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500" />
            <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500">
              <option value="monthly">Mensuel</option><option value="quarterly">Trimestriel</option><option value="yearly">Annuel</option>
            </select>
            {categories.length > 0 && (
              <select value={form.expenseCategory} onChange={e => setForm(p => ({ ...p, expenseCategory: e.target.value }))}
                className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500">
                <option value="">Catégorie</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">Annuler</button>
            <button onClick={handleCreate} disabled={creating}
              className="px-3 py-1 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-5 pb-5">
        {charges.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Aucune charge récurrente</p>
        ) : (
          <div className="space-y-1.5">
            {charges.map(ch => (
              <div key={ch._id} className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${ch.isActive ? 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]' : 'bg-slate-50 dark:bg-white/[0.01] border-slate-100 dark:border-white/[0.03] opacity-50'}`}>
                {/* Toggle */}
                <button onClick={() => handleToggle(ch)} className={`w-10 h-[22px] rounded-full flex-shrink-0 relative transition-colors ${ch.isActive ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${ch.isActive ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800 dark:text-white truncate block">{ch.counterpartyName}</span>
                  {ch.expenseCategory?.name && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ch.expenseCategory.color }} />
                      {ch.expenseCategory.name}
                    </span>
                  )}
                </div>
                {/* Amount */}
                <span className="text-sm font-semibold text-slate-900 dark:text-white flex-shrink-0">
                  {formatCurrency(ch.expectedAmount)}<span className="text-xs text-slate-400 font-normal">{freqLabels[ch.frequency] || ''}</span>
                </span>
                {ch.detectionConfidence != null && ch.detectionConfidence < 100 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">{ch.detectionConfidence}%</span>
                )}
                <button onClick={() => handleDelete(ch._id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══ Uncategorized Transactions ═══ */
function UncategorizedPanel({ transactions, categories, loading, onCategorized, onClickTx }) {
  const { addToast } = useToastStore();
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleCategorize = async (txId, catId) => {
    try {
      await bankApi.categorizeTransaction(txId, catId);
      addToast({ type: 'success', message: 'Catégorie assignée' });
      setOpenDropdown(null);
      onCategorized?.();
    } catch { addToast({ type: 'error', message: 'Erreur catégorisation' }); }
  };

  return (
    <section className="bg-white dark:bg-dark-card rounded-xl border border-amber-200 dark:border-amber-500/20 overflow-hidden">
      <div className="flex items-center gap-2 p-5 pb-3">
        <AlertCircle className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Non catégorisées</h2>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{transactions.length}</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-auto" />}
      </div>
      <div className="px-5 pb-5 space-y-1">
        {transactions.slice(0, 25).map(tx => (
          <div
            key={tx._id}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors text-sm"
            onClick={() => onClickTx(tx)}
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-slate-800 dark:text-white truncate block">{tx.counterpartyName || tx.description || '-'}</span>
              <span className="text-[11px] text-slate-400">{fmtDate(tx.bookingDate)}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="font-semibold text-red-500 dark:text-red-400">{formatCurrency(tx.amount)}</span>
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === tx._id ? null : tx._id); }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-400 hover:text-slate-600"
                  title="Catégoriser"
                >
                  <Tag className="w-3.5 h-3.5" />
                </button>
                {openDropdown === tx._id && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 max-h-52 overflow-y-auto">
                    {categories.map(cat => (
                      <button
                        key={cat._id}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/[0.06] flex items-center gap-2"
                        onClick={e => { e.stopPropagation(); handleCategorize(tx._id, cat._id); }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate text-slate-700 dark:text-slate-300">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {transactions.length > 25 && <p className="text-xs text-slate-400 text-center pt-1">+{transactions.length - 25} autres</p>}
      </div>
    </section>
  );
}

/* ═══ Export Modal ═══ */
function FiduciaryExportModal({ onClose }) {
  const { addToast } = useToastStore();
  const [exporting, setExporting] = useState(false);
  const yr = new Date().getFullYear();
  const [from, setFrom] = useState(`${yr}-01-01`);
  const [to, setTo] = useState(`${yr}-12-31`);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportsApi.fiduciary(from, to);
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `fiduciaire_${from}_${to}.csv`; a.click();
      window.URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Export téléchargé' });
      onClose();
    } catch { addToast({ type: 'error', message: 'Erreur export' }); }
    finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Export fiduciaire</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Rapport CSV : revenus, dépenses par catégorie, résumé TVA et résultat.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Du</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Au</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button icon={Download} size="sm" onClick={handleExport} loading={exporting}>Télécharger CSV</Button>
        </div>
      </div>
    </div>
  );
}
