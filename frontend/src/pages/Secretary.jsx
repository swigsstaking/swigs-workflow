import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Sparkles, X, Building2, FileText, Palette, ChevronRight } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { remindersApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { computeBriefing } from '../components/Briefing/utils/briefingLogic';
import BriefingHeader from '../components/Briefing/BriefingHeader';
import BriefingFeed from '../components/Briefing/BriefingFeed';
import BriefingSidebar from '../components/Briefing/sidebar/BriefingSidebar';

const ONBOARDING_STEPS = [
  {
    icon: Building2,
    label: 'Mon entreprise',
    href: '/settings?tab=company',
    description: 'Nom, adresse, contact'
  },
  {
    icon: FileText,
    label: 'Facturation',
    href: '/settings?tab=invoicing',
    description: 'TVA, IBAN, conditions'
  },
  {
    icon: Palette,
    label: 'Design PDF',
    href: '/settings?tab=design',
    description: 'Logo, couleurs, template'
  }
];

export default function Secretary() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { user } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem('onboarding_dismissed') === 'true'
  );

  useEffect(() => {
    fetchDashboard();
    if (!settings) fetchSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showOnboarding = !onboardingDismissed && settings && !settings?.company?.name;

  const handleDismissOnboarding = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setOnboardingDismissed(true);
  };

  const briefing = useMemo(() => computeBriefing(data, user), [data, user]);

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

  const handleItemClick = (item) => {
    if (item.projectId) {
      navigate(`/workflow?project=${item.projectId}&tab=documents`);
    } else {
      navigate('/workflow');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 41px)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-white/40" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ minHeight: 'calc(100vh - 41px)' }}>
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-primary-600/8 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[320px] h-[320px] bg-violet-600/6 rounded-full blur-[60px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-6">
        {/* Onboarding banner */}
        {showOnboarding && (
          <div className="mb-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-1">
                    Bienvenue ! Configurez votre espace en 3 étapes
                  </h3>
                  <p className="text-xs text-primary-700 dark:text-primary-300 mb-3">
                    Complétez votre profil pour générer des factures professionnelles.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_STEPS.map(({ icon: Icon, label, href, description }) => (
                      <Link
                        key={href}
                        to={href}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-lg text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{label}</span>
                        <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismissOnboarding}
                className="p-1.5 rounded-lg text-primary-500 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors flex-shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <BriefingHeader
          greeting={briefing.greeting}
          summary={briefing.summary}
          chips={briefing.chips}
          loading={loading}
          onRefresh={() => fetchDashboard(true)}
        />

        <div className="flex gap-6">
          {/* Main feed */}
          <main className="flex-1 max-w-[900px] mx-auto">
            <BriefingFeed
              briefing={briefing}
              onSendReminder={handleSendReminder}
              onSendAll={handleSendAllReminders}
              onItemClick={handleItemClick}
            />
          </main>

          {/* Sidebar — lg: visible */}
          <BriefingSidebar
            clientIntelligence={briefing.clientIntelligence}
            cashFlowForecast={briefing.cashFlowForecast}
          />
        </div>
      </div>
    </div>
  );
}
