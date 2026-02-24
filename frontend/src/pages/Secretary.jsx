import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Sparkles, X, Building2, Landmark, Palette, ChevronRight, Check, PartyPopper } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { remindersApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { trackEvent } from '../lib/posthog';
import { computeBriefing } from '../components/Briefing/utils/briefingLogic';
import BriefingHeader from '../components/Briefing/BriefingHeader';
import BriefingFeed from '../components/Briefing/BriefingFeed';
import BriefingSidebar from '../components/Briefing/sidebar/BriefingSidebar';

const ONBOARDING_STEPS = [
  {
    key: 'company',
    icon: Building2,
    label: 'Mon entreprise',
    href: '/settings?section=company',
    description: 'Nom, adresse, contact',
    check: (s) => !!s?.company?.name
  },
  {
    key: 'banking',
    icon: Landmark,
    label: 'Coordonnées bancaires',
    href: '/settings?section=company',
    description: 'IBAN pour factures QR',
    check: (s) => !!s?.company?.iban
  },
  {
    key: 'design',
    icon: Palette,
    label: 'Design PDF',
    href: '/settings?section=invoice-design',
    description: 'Logo, couleurs, template',
    check: (s) => !!s?.invoiceDesign?.logo
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
    fetchSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedSteps = ONBOARDING_STEPS.filter(step => step.check(settings));
  const allStepsDone = completedSteps.length === ONBOARDING_STEPS.length;
  const showOnboarding = !onboardingDismissed && settings && !allStepsDone;

  // Track onboarding completion
  useEffect(() => {
    if (settings && allStepsDone && !localStorage.getItem('onboarding_completed_tracked')) {
      trackEvent('onboarding_completed', { app: 'swigs-workflow' });
      localStorage.setItem('onboarding_completed_tracked', 'true');
    }
  }, [settings, allStepsDone]);

  const handleDismissOnboarding = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setOnboardingDismissed(true);
    trackEvent('onboarding_dismissed', { steps_completed: completedSteps.length, total_steps: ONBOARDING_STEPS.length });
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
          <div className="mb-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-1">
                    Bienvenue ! Configurez votre espace en 3 étapes
                  </h3>
                  <p className="text-xs text-primary-700 dark:text-primary-300 mb-3">
                    Complétez votre profil pour générer des factures professionnelles.
                  </p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-1.5 bg-primary-200 dark:bg-primary-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 dark:bg-primary-400 rounded-full transition-all duration-500"
                        style={{ width: `${(completedSteps.length / ONBOARDING_STEPS.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      {completedSteps.length}/{ONBOARDING_STEPS.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_STEPS.map((step) => {
                      const Icon = step.icon;
                      const done = step.check(settings);
                      return (
                        <Link
                          key={step.href}
                          to={step.href}
                          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-medium transition-colors group ${
                            done
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'bg-white dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:border-primary-300 dark:hover:border-primary-600'
                          }`}
                        >
                          {done ? (
                            <Check className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          <span className={done ? 'line-through opacity-70' : ''}>{step.label}</span>
                          {!done && <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />}
                        </Link>
                      );
                    })}
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

        {/* Onboarding complete celebration (shows once) */}
        {settings && allStepsDone && !onboardingDismissed && !localStorage.getItem('onboarding_celebration_seen') && (() => {
          // Show celebration briefly then auto-dismiss
          setTimeout(() => localStorage.setItem('onboarding_celebration_seen', 'true'), 0);
          return (
            <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                  <PartyPopper className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    Configuration terminée !
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Votre espace est prêt. Vous pouvez maintenant créer des projets et facturer vos clients.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

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
