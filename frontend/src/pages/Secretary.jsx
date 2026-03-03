import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, X, ChevronRight, Check } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { remindersApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { trackEvent, trackBusinessEvent } from '../lib/posthog';
import { computeBriefing } from '../components/Briefing/utils/briefingLogic';
import BriefingHeader from '../components/Briefing/BriefingHeader';
import BriefingFeed from '../components/Briefing/BriefingFeed';
import BriefingSidebar from '../components/Briefing/sidebar/BriefingSidebar';

const ONBOARDING_STEPS = [
  {
    key: 'company',
    label: 'Mon entreprise',
    href: '/settings?section=company',
    description: 'Nom, adresse, contact',
    check: (s) => !!s?.company?.name
  },
  {
    key: 'banking',
    label: 'Coordonnées bancaires',
    href: '/settings?section=company',
    description: 'IBAN pour factures QR',
    check: (s) => !!s?.company?.iban
  },
  {
    key: 'design',
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
      trackEvent('onboarding_completed', { app: 'swigs-pro' });
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
      trackBusinessEvent('reminder_sent', { invoice_id: invoiceId });
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
    trackBusinessEvent('reminders_bulk_sent', { count: sent });
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
        {/* Onboarding card */}
        {showOnboarding && (
          <div className="mb-6 relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-800/60 bg-gradient-to-br from-primary-50 via-white to-primary-50/50 dark:from-primary-950/40 dark:via-dark-card dark:to-primary-950/20 shadow-lg shadow-primary-500/5 dark:shadow-primary-500/10">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Configurez votre espace
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    3 étapes pour commencer à facturer
                  </p>
                </div>
                <button
                  onClick={handleDismissOnboarding}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(completedSteps.length / ONBOARDING_STEPS.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                  {completedSteps.length}/{ONBOARDING_STEPS.length}
                </span>
              </div>

              {/* Steps */}
              <div className="grid sm:grid-cols-3 gap-3">
                {ONBOARDING_STEPS.map((step, index) => {
                  const done = step.check(settings);
                  return (
                    <Link
                      key={step.key}
                      to={step.href}
                      className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-200 ${
                        done
                          ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md hover:shadow-primary-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/60'
                        }`}>
                          {done ? <Check className="w-4 h-4" /> : <span className="text-sm font-bold">{index + 1}</span>}
                        </div>
                        <span className={`text-sm font-semibold ${
                          done
                            ? 'text-emerald-700 dark:text-emerald-300 line-through opacity-70'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${
                        done
                          ? 'text-emerald-600 dark:text-emerald-400/70'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {step.description}
                      </p>
                      {!done && (
                        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Configurer <ChevronRight className="w-3 h-3" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Onboarding complete celebration (shows once) */}
        {settings && allStepsDone && !onboardingDismissed && !localStorage.getItem('onboarding_celebration_seen') && (() => {
          setTimeout(() => localStorage.setItem('onboarding_celebration_seen', 'true'), 0);
          return (
            <div className="mb-6 relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/40 dark:via-dark-card dark:to-emerald-950/20 p-5">
              <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                Configuration terminée !
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                Votre espace est prêt. Créez votre premier projet et commencez à facturer.
              </p>
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
