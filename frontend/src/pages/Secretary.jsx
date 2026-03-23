import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
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
import WelcomeModal from '../components/WelcomeModal';
import { useAIStore } from '../stores/aiStore';


export default function Secretary() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { user } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { addToast } = useToastStore();
  const aiSuggestions = useAIStore(s => s.suggestions);
  const navigate = useNavigate();

  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && localStorage.getItem('swigs-pro-welcome-done') !== 'true') {
      const timer = setTimeout(() => setShowWelcome(true), 600);
      return () => clearTimeout(timer);
    }
  }, [user]);

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
    let failed = 0;
    for (const r of data.remindersDue) {
      try {
        await remindersApi.send(r.invoiceId);
        sent++;
      } catch {
        failed++;
      }
    }
    trackBusinessEvent('reminders_bulk_sent', { count: sent, failed });
    if (failed > 0) {
      addToast({ type: 'warning', message: `${sent} rappel(s) envoyé(s), ${failed} échec(s)` });
    } else {
      addToast({ type: 'success', message: `${sent} rappel(s) envoyé(s)` });
    }
    fetchDashboard(true);
  };

  const handleItemClick = (item) => {
    if (item.type === 'unbilled_work') {
      navigate('/workflow');
      return;
    }
    if (item.type === 'pending_quote' && item.projectId) {
      navigate(`/workflow?project=${item.projectId}&tab=quotes`);
      return;
    }
    if (item.type === 'upcoming_recurring') {
      navigate('/recurring');
      return;
    }
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
      <AnimatePresence>
        {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      </AnimatePresence>
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-primary-600/8 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[320px] h-[320px] bg-violet-600/6 rounded-full blur-[60px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
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
              suggestions={aiSuggestions}
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
