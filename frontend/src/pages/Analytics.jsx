import { useEffect, useState } from 'react';
import {
  DollarSign,
  Clock,
  FileText,
  TrendingUp,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Download,
  ChevronDown
} from 'lucide-react';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useToastStore } from '../stores/toastStore';
import { exportsApi } from '../services/api';
import KPICard from '../components/Analytics/KPICard';
import MonthlyChart from '../components/Analytics/MonthlyChart';
import ProjectStatusChart from '../components/Analytics/ProjectStatusChart';
import QuotePipelineChart from '../components/Analytics/QuotePipelineChart';
import TopClientsChart from '../components/Analytics/TopClientsChart';
import HoursChart from '../components/Analytics/HoursChart';
import { SkeletonKPI, SkeletonChart } from '../components/ui/Skeleton';

export default function Analytics() {
  const {
    revenue,
    monthly,
    quotes,
    projects,
    clients,
    hours,
    loading,
    showLastYear,
    fetchAll,
    refreshWithLastYear
  } = useAnalyticsStore();
  const { addToast } = useToastStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchAll();
      } catch (error) {
        console.error('Error loading analytics:', error);
        addToast({
          type: 'error',
          message: 'Erreur lors du chargement des analytics'
        });
      }
    };
    loadData();
  }, []);

  const handleToggleLastYear = () => {
    refreshWithLastYear(!showLastYear);
  };

  const handleRefresh = () => {
    fetchAll();
  };

  const downloadBlob = async (apiCall, filename) => {
    try {
      const response = await apiCall();
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      addToast({ type: 'success', message: 'Export téléchargé avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'export' });
    }
  };

  const handleExportJournal = () => {
    const year = new Date().getFullYear();
    downloadBlob(() => exportsApi.journal(), `journal-${year}.csv`);
    setShowExportMenu(false);
  };

  const handleExportClients = () => {
    downloadBlob(() => exportsApi.clients(), `clients-${new Date().getFullYear()}.csv`);
    setShowExportMenu(false);
  };

  const handleExportRevenue = () => {
    const year = new Date().getFullYear();
    downloadBlob(() => exportsApi.revenueReport(), `rapport-revenus-${year}.pdf`);
    setShowExportMenu(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue d'ensemble de votre activité
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Exporter
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-20">
                  <button
                    onClick={handleExportJournal}
                    className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Journal comptable (CSV)
                  </button>
                  <button
                    onClick={handleExportClients}
                    className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Liste clients (CSV)
                  </button>
                  <button
                    onClick={handleExportRevenue}
                    className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Rapport revenus (PDF)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Toggle Last Year */}
          <button
            onClick={handleToggleLastYear}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              transition-all
              ${showLastYear
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }
            `}
          >
            {showLastYear ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            Comparer N-1
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !revenue && (
        <div className="space-y-6">
          {/* KPI Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonKPI key={i} />
            ))}
          </div>

          {/* Monthly Chart Skeleton */}
          <SkeletonChart className="h-80" />

          {/* Two Column Grid Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>

          {/* Two Column Grid Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      )}

      {/* Content */}
      {revenue && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Chiffre d'affaires YTD"
              value={revenue.ytd}
              change={revenue.growth.yearly}
              changeLabel="vs année dernière"
              icon={DollarSign}
              color="#10B981"
              format="currency"
            />
            <KPICard
              title="Ce mois"
              value={revenue.mtd}
              change={revenue.growth.monthly}
              changeLabel="vs mois dernier"
              icon={TrendingUp}
              color="#3B82F6"
              format="currency"
            />
            <KPICard
              title="En attente de paiement"
              value={revenue.pending}
              changeLabel={`${revenue.pendingCount} facture${revenue.pendingCount > 1 ? 's' : ''}`}
              icon={FileText}
              color="#F59E0B"
              format="currency"
            />
            <KPICard
              title="Heures ce mois"
              value={hours?.currentMonth || 0}
              change={hours?.monthlyChange}
              changeLabel="vs mois dernier"
              icon={Clock}
              color="#8B5CF6"
              format="hours"
            />
          </div>

          {/* Monthly Chart - Full Width */}
          <MonthlyChart data={monthly} showLastYear={showLastYear} />

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quote Pipeline */}
            <QuotePipelineChart data={quotes} />

            {/* Project Status */}
            <ProjectStatusChart data={projects?.byStatus} />
          </div>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Clients */}
            <TopClientsChart data={clients} />

            {/* Hours Chart */}
            <HoursChart data={hours} />
          </div>

          {/* Additional Stats Row */}
          {quotes && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Projets actifs</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {projects?.active || 0}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {projects?.archived || 0} archivés
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Devis signés</p>
                <p className="text-3xl font-bold text-emerald-500">
                  {quotes?.byStatus?.signed || 0}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Taux de conversion: {quotes?.conversionRate}%
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Valeur totale devis</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {new Intl.NumberFormat('fr-CH', {
                    style: 'currency',
                    currency: 'CHF',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(quotes?.totalValue || 0)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {quotes?.total || 0} devis au total
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
