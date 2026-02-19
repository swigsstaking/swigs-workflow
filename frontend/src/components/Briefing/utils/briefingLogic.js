// Pure logic for the briefing interface
// No React imports — all functions are pure data transforms

const fmt = (n) =>
  new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(n || 0);

const fmtShort = (n) => {
  if (!n && n !== 0) return '0';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
};

const relDate = (d) => {
  if (!d) return '-';
  const diff = Math.floor((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 0) return `Dans ${diff}j`;
  return `Il y a ${Math.abs(diff)}j`;
};

const reminderLabels = {
  reminder_1: '1er rappel',
  reminder_2: '2e rappel',
  reminder_3: '3e rappel',
  final_notice: 'Mise en demeure',
};

function getGreeting(user) {
  const h = new Date().getHours();
  const firstName = user?.name?.split(' ')[0] || '';
  const base = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return firstName ? `${base}, ${firstName}` : base;
}

function buildSummary(urgent, watch) {
  const parts = [];
  if (urgent.length > 0) parts.push(`${urgent.length} action${urgent.length > 1 ? 's' : ''} urgente${urgent.length > 1 ? 's' : ''}`);
  if (watch.length > 0) parts.push(`${watch.length} point${watch.length > 1 ? 's' : ''} à surveiller`);
  if (parts.length === 0) return 'Tout est en ordre. Aucune action requise.';
  return parts.join(' · ');
}

function buildChips(overview) {
  const o = overview || {};
  const chips = [];

  if (o.totalOverdue > 0) {
    chips.push({
      id: 'overdue',
      label: 'En retard',
      value: `CHF ${fmtShort(o.totalOverdue)}`,
      color: 'red',
    });
  }

  chips.push({
    id: 'recovery',
    label: 'Recouvrement',
    value: `${o.recoveryRate ?? 100}%`,
    color: (o.recoveryRate ?? 100) >= 80 ? 'green' : (o.recoveryRate ?? 100) >= 60 ? 'amber' : 'red',
  });

  if (o.unbilledTotal > 0) {
    chips.push({
      id: 'unbilled',
      label: 'Non facturé',
      value: `CHF ${fmtShort(o.unbilledTotal)}`,
      color: 'amber',
    });
  }

  if (o.globalAvgPaymentDays != null) {
    chips.push({
      id: 'avgDays',
      label: 'Délai moyen',
      value: `${o.globalAvgPaymentDays}j`,
      color: o.globalAvgPaymentDays <= 30 ? 'green' : o.globalAvgPaymentDays <= 45 ? 'amber' : 'red',
    });
  }

  if (o.vatCollected > 0) {
    chips.push({
      id: 'vat',
      label: `TVA ${o.vatQuarter || ''}`,
      value: `CHF ${fmtShort(o.vatCollected)}`,
      color: 'violet',
    });
  }

  return chips;
}

function buildUrgentItems(data) {
  const items = [];
  const reminderInvoiceIds = new Set();

  // 1) Reminders due — highest priority
  for (const r of data.remindersDue || []) {
    reminderInvoiceIds.add(String(r.invoiceId));
    items.push({
      id: `rem-${r.invoiceId}`,
      type: 'reminder_due',
      icon: 'bell',
      title: r.clientName,
      subtitle: r.company || null,
      detail: `${r.invoiceNumber} · ${r.daysOverdue}j de retard`,
      badge: reminderLabels[r.reminderType] || r.reminderType,
      amount: r.total,
      actionType: 'send',
      invoiceId: r.invoiceId,
    });
  }

  // 2) Critical overdue (>30j) — exclude those already in reminders
  for (const inv of data.criticalOverdue || []) {
    if (reminderInvoiceIds.has(String(inv._id))) continue;
    items.push({
      id: `overdue-${inv._id}`,
      type: 'critical_overdue',
      icon: 'alert',
      title: inv.clientName,
      subtitle: inv.company || null,
      detail: `${inv.number} · ${inv.daysOverdue}j de retard`,
      badge: inv.reminderCount > 0 ? `${inv.reminderCount} rappel${inv.reminderCount > 1 ? 's' : ''}` : null,
      amount: inv.total,
      daysOverdue: inv.daysOverdue,
    });
  }

  // Sort by days overdue descending
  items.sort((a, b) => {
    const da = a.daysOverdue || parseInt((a.detail || '').match(/(\d+)j/)?.[1]) || 0;
    const db = b.daysOverdue || parseInt((b.detail || '').match(/(\d+)j/)?.[1]) || 0;
    return db - da;
  });

  return items;
}

function buildWatchItems(data) {
  const items = [];
  const o = data.overview || {};

  // 1) Upcoming reminders (next 14 days)
  for (const r of data.upcomingReminders || []) {
    items.push({
      id: `upcoming-${r.invoiceNumber}-${r.reminderType}`,
      type: 'upcoming_reminder',
      icon: 'calendar',
      title: r.clientName,
      detail: `${r.invoiceNumber} · ${reminderLabels[r.reminderType] || r.reminderType}`,
      badge: relDate(r.date),
      amount: r.total,
      sortKey: r.daysUntil ?? 999,
    });
  }

  // 2) Pending quotes
  for (const q of data.pendingQuotesList || []) {
    items.push({
      id: `quote-${q._id}`,
      type: 'pending_quote',
      icon: 'file',
      title: q.clientName,
      subtitle: q.company || null,
      detail: `Devis ${q.number} · en attente de signature`,
      amount: q.total,
      sortKey: 50,
    });
  }

  // 3) Unbilled work — only if significant (>5000 CHF or >20h)
  if ((o.unbilledTotal > 5000) || (o.unbilledHours > 20)) {
    items.push({
      id: 'unbilled-work',
      type: 'unbilled_work',
      icon: 'receipt',
      title: 'Travail non facturé',
      detail: `${o.unbilledHours || 0}h · ${fmt(o.unbilledTotal)}`,
      sortKey: 80,
    });
  }

  items.sort((a, b) => (a.sortKey ?? 50) - (b.sortKey ?? 50));

  return items;
}

function buildStatusItems(data) {
  const items = [];
  const pw = data.paymentsThisWeek || {};

  // 1) Payments received this week
  if (pw.total > 0) {
    items.push({
      id: 'payments-week',
      type: 'payments',
      icon: 'credit',
      title: 'Paiements reçus cette semaine',
      detail: `${pw.count || 0} paiement${(pw.count || 0) > 1 ? 's' : ''} · ${fmt(pw.total)}`,
      amount: pw.total,
      children: (pw.invoices || []).slice(0, 4).map((inv) => ({
        id: `pay-${inv.number}`,
        label: inv.clientName,
        sub: inv.number,
        amount: inv.total,
      })),
    });
  }

  // 2) Recovery rate
  const rate = data.overview?.recoveryRate;
  if (rate != null) {
    items.push({
      id: 'recovery-rate',
      type: 'recovery',
      icon: 'shield',
      title: 'Taux de recouvrement',
      detail: `${rate}% des factures envoyées ont été payées`,
    });
  }

  // 3) Recent actions (reminders sent)
  if (data.recentActions?.length > 0) {
    items.push({
      id: 'recent-actions',
      type: 'recent_actions',
      icon: 'arrow',
      title: 'Actions récentes',
      detail: `${data.recentActions.length} rappel${data.recentActions.length > 1 ? 's' : ''} envoyé${data.recentActions.length > 1 ? 's' : ''}`,
      children: data.recentActions.slice(0, 5).map((a) => ({
        id: `action-${a.invoiceNumber}-${a.sentAt}`,
        label: `${reminderLabels[a.type] || a.type} — ${a.clientName}`,
        sub: relDate(a.sentAt),
        sent: a.emailSent,
      })),
    });
  }

  return items;
}

export function computeBriefing(data, user) {
  if (!data) {
    return {
      greeting: getGreeting(user),
      summary: 'Chargement des données...',
      chips: [],
      urgent: [],
      watch: [],
      status: [],
      allClear: false,
      overview: {},
      clientIntelligence: [],
      cashFlowForecast: [],
    };
  }

  const urgent = buildUrgentItems(data);
  const watch = buildWatchItems(data);
  const status = buildStatusItems(data);

  return {
    greeting: getGreeting(user),
    summary: buildSummary(urgent, watch),
    chips: buildChips(data.overview),
    urgent,
    watch,
    status,
    allClear: urgent.length === 0 && watch.length === 0,
    overview: data.overview || {},
    clientIntelligence: data.clientIntelligence || [],
    cashFlowForecast: data.cashFlowForecast || [],
  };
}

export { fmt, fmtShort, relDate, reminderLabels };
