import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { remindersApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { computeBriefing } from '../components/Briefing/utils/briefingLogic';
import BriefingHeader from '../components/Briefing/BriefingHeader';
import BriefingFeed from '../components/Briefing/BriefingFeed';
import BriefingSidebar from '../components/Briefing/sidebar/BriefingSidebar';

export default function Secretary() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const briefing = useMemo(() => computeBriefing(data), [data]);

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

  return (
    <div className="min-h-screen bg-[#0a0e1a] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-emerald-600/6 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-8">
        <BriefingHeader
          greeting={briefing.greeting}
          summary={briefing.summary}
          chips={briefing.chips}
          loading={loading}
          onRefresh={() => fetchDashboard(true)}
        />

        <div className="flex gap-8">
          {/* Main feed */}
          <main className="flex-1 max-w-[900px] mx-auto">
            <BriefingFeed
              briefing={briefing}
              onSendReminder={handleSendReminder}
              onSendAll={handleSendAllReminders}
            />
          </main>

          {/* Sidebar — xl: only */}
          <BriefingSidebar
            clientIntelligence={briefing.clientIntelligence}
            cashFlowForecast={briefing.cashFlowForecast}
          />
        </div>
      </div>
    </div>
  );
}
