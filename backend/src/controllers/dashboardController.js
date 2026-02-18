import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Event from '../models/Event.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';

// Helper: Get user's project IDs
const getUserProjectIds = async (userId) => {
  if (!userId) return null;
  const projects = await Project.find({ userId }).select('_id');
  return projects.map(p => p._id);
};

/**
 * GET /api/dashboard
 * Returns all dashboard data in a single call
 */
export const getDashboard = async (req, res, next) => {
  try {
    // No user = return empty dashboard
    if (!req.user?._id) {
      return res.json({ success: true, data: {
        overview: { totalOverdue: 0, overdueCount: 0, recoveryRate: 100, unbilledTotal: 0, unbilledHours: 0, pendingQuotes: 0, pendingQuotesTotal: 0, globalAvgPaymentDays: null },
        criticalOverdue: [], remindersDue: [], upcomingReminders: [], paymentsThisWeek: { count: 0, total: 0, invoices: [] },
        clientIntelligence: [], cashFlowForecast: [], recentActions: [], pendingQuotesList: []
      }});
    }

    const projectIds = await getUserProjectIds(req.user._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};
    const now = new Date();

    // Run all queries in parallel
    const [
      overdueInvoices,
      recentPayments,
      pendingQuotes,
      unbilledEvents,
      allPaidInvoices,
      allSentInvoices,
      settings
    ] = await Promise.all([
      // Overdue invoices (sent, past due date)
      Invoice.find({
        ...projectFilter,
        status: 'sent',
        dueDate: { $lt: now }
      }).populate({ path: 'project', select: 'client name' }).lean(),

      // Payments received last 7 days
      Invoice.find({
        ...projectFilter,
        status: 'paid',
        paidAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) }
      }).populate({ path: 'project', select: 'client name' }).lean(),

      // Quotes awaiting signature
      Quote.find({
        ...projectFilter,
        status: 'sent'
      }).populate({ path: 'project', select: 'client name' }).lean(),

      // Unbilled events
      Event.find({
        ...projectFilter,
        billed: false
      }).lean(),

      // All paid invoices (for client intelligence)
      Invoice.find({
        ...projectFilter,
        status: 'paid',
        paidAt: { $ne: null }
      }).populate({ path: 'project', select: 'client name' }).lean(),

      // All sent invoices (for recovery rate)
      Invoice.find({
        ...projectFilter,
        status: { $in: ['sent', 'paid'] }
      }).lean(),

      // User settings (for reminder schedule)
      Settings.getSettings(req.user?._id || null)
    ]);

    // --- Compute dashboard sections ---

    // 1. Critical overdue (> 30 days)
    const criticalOverdue = overdueInvoices
      .map(inv => {
        const daysOverdue = Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
        return { ...inv, daysOverdue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // 2. Reminders due today
    const reminderSchedule = settings?.reminders?.schedule || [];
    const remindersDue = [];
    if (settings?.reminders?.enabled) {
      for (const inv of overdueInvoices) {
        const daysOverdue = Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
        const sentTypes = (inv.reminders || []).map(r => r.type);

        for (const sched of reminderSchedule) {
          if (daysOverdue >= sched.days && !sentTypes.includes(sched.type)) {
            remindersDue.push({
              invoice: inv,
              reminderType: sched.type,
              daysOverdue,
              scheduledDays: sched.days
            });
            break; // Only next reminder
          }
        }
      }
    }

    // 3. Upcoming reminders (next 14 days)
    const upcomingReminders = [];
    for (const inv of overdueInvoices) {
      const daysOverdue = Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
      const sentTypes = (inv.reminders || []).map(r => r.type);

      for (const sched of reminderSchedule) {
        if (!sentTypes.includes(sched.type) && sched.days > daysOverdue && sched.days - daysOverdue <= 14) {
          const reminderDate = new Date(inv.dueDate);
          reminderDate.setDate(reminderDate.getDate() + sched.days);
          upcomingReminders.push({
            invoiceNumber: inv.number,
            clientName: inv.project?.client?.name || 'Inconnu',
            reminderType: sched.type,
            date: reminderDate,
            daysUntil: sched.days - daysOverdue,
            total: inv.total
          });
          break;
        }
      }
    }
    upcomingReminders.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. Client intelligence
    const clientMap = new Map();

    // Build client data from paid invoices
    for (const inv of allPaidInvoices) {
      const clientKey = inv.project?.client?.company || inv.project?.client?.name || 'Inconnu';
      if (!clientMap.has(clientKey)) {
        clientMap.set(clientKey, {
          name: inv.project?.client?.name || clientKey,
          company: inv.project?.client?.company || '',
          email: inv.project?.client?.email || '',
          totalInvoiced: 0,
          totalPaid: 0,
          totalOverdue: 0,
          invoiceCount: 0,
          paymentDays: [],
          reminderCount: 0,
          lastInvoiceDate: null
        });
      }

      const client = clientMap.get(clientKey);
      client.totalPaid += inv.total;
      client.totalInvoiced += inv.total;
      client.invoiceCount++;

      // Calculate payment days (paidAt - issueDate)
      if (inv.paidAt && inv.issueDate) {
        const payDays = Math.floor((new Date(inv.paidAt) - new Date(inv.issueDate)) / (1000 * 60 * 60 * 24));
        if (payDays >= 0) client.paymentDays.push(payDays);
      }

      const invDate = new Date(inv.issueDate);
      if (!client.lastInvoiceDate || invDate > client.lastInvoiceDate) {
        client.lastInvoiceDate = invDate;
      }
    }

    // Add overdue data
    for (const inv of overdueInvoices) {
      const clientKey = inv.project?.client?.company || inv.project?.client?.name || 'Inconnu';
      if (!clientMap.has(clientKey)) {
        clientMap.set(clientKey, {
          name: inv.project?.client?.name || clientKey,
          company: inv.project?.client?.company || '',
          email: inv.project?.client?.email || '',
          totalInvoiced: 0,
          totalPaid: 0,
          totalOverdue: 0,
          invoiceCount: 0,
          paymentDays: [],
          reminderCount: 0,
          lastInvoiceDate: null
        });
      }
      const client = clientMap.get(clientKey);
      client.totalOverdue += inv.total;
      client.totalInvoiced += inv.total;
      client.invoiceCount++;
      client.reminderCount += (inv.reminders || []).length;
    }

    // Compute client intelligence metrics
    const clientIntelligence = Array.from(clientMap.entries()).map(([key, data]) => {
      const avgPaymentDays = data.paymentDays.length > 0
        ? Math.round(data.paymentDays.reduce((a, b) => a + b, 0) / data.paymentDays.length)
        : null;

      // Score: 100 = always on time (< 30 days), 0 = always very late (> 60 days)
      let reliabilityScore = null;
      if (data.paymentDays.length > 0) {
        const avgDays = data.paymentDays.reduce((a, b) => a + b, 0) / data.paymentDays.length;
        reliabilityScore = Math.max(0, Math.min(100, Math.round(100 - ((avgDays - 15) * 2))));
      }

      return {
        name: data.name,
        company: data.company,
        email: data.email,
        totalInvoiced: Math.round(data.totalInvoiced * 100) / 100,
        totalPaid: Math.round(data.totalPaid * 100) / 100,
        totalOverdue: Math.round(data.totalOverdue * 100) / 100,
        invoiceCount: data.invoiceCount,
        avgPaymentDays,
        reliabilityScore,
        reminderCount: data.reminderCount,
        lastInvoiceDate: data.lastInvoiceDate
      };
    }).sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    // 5. Payments this week summary
    const paymentsThisWeek = {
      count: recentPayments.length,
      total: recentPayments.reduce((sum, inv) => sum + inv.total, 0),
      invoices: recentPayments.map(inv => ({
        number: inv.number,
        total: inv.total,
        paidAt: inv.paidAt,
        clientName: inv.project?.client?.name || 'Inconnu',
        company: inv.project?.client?.company || ''
      }))
    };

    // 6. Recovery rate
    const totalSentAndPaid = allSentInvoices.length;
    const totalPaid = allSentInvoices.filter(i => i.status === 'paid').length;
    const recoveryRate = totalSentAndPaid > 0
      ? Math.round((totalPaid / totalSentAndPaid) * 1000) / 10
      : 100;

    // 7. Unbilled work
    const unbilledTotal = unbilledEvents.reduce((sum, event) => {
      if (event.type === 'hours') return sum + (event.hours * event.hourlyRate);
      if (event.type === 'expense') return sum + event.amount;
      return sum;
    }, 0);
    const unbilledHours = unbilledEvents
      .filter(e => e.type === 'hours')
      .reduce((sum, e) => sum + e.hours, 0);

    // 8. Cash flow forecast (next 30 days based on avg payment days)
    const pendingSent = overdueInvoices.concat(
      await Invoice.find({
        ...projectFilter,
        status: 'sent',
        dueDate: { $gte: now }
      }).populate({ path: 'project', select: 'client name' }).lean()
    );

    const globalAvgPaymentDays = clientIntelligence.length > 0
      ? Math.round(
          clientIntelligence
            .filter(c => c.avgPaymentDays !== null)
            .reduce((sum, c) => sum + c.avgPaymentDays, 0) /
          Math.max(1, clientIntelligence.filter(c => c.avgPaymentDays !== null).length)
        )
      : 30;

    const cashFlowForecast = pendingSent.map(inv => {
      const clientKey = inv.project?.client?.company || inv.project?.client?.name || 'Inconnu';
      const clientData = clientIntelligence.find(c =>
        c.company === clientKey || c.name === clientKey
      );
      const expectedDays = clientData?.avgPaymentDays || globalAvgPaymentDays;
      const expectedDate = new Date(inv.issueDate);
      expectedDate.setDate(expectedDate.getDate() + expectedDays);

      return {
        invoiceNumber: inv.number,
        clientName: inv.project?.client?.name || 'Inconnu',
        total: inv.total,
        issueDate: inv.issueDate,
        expectedPaymentDate: expectedDate,
        expectedDays,
        isOverdue: expectedDate < now
      };
    }).sort((a, b) => new Date(a.expectedPaymentDate) - new Date(b.expectedPaymentDate));

    // 9. Recent reminder actions
    const recentReminders = [];
    for (const inv of [...overdueInvoices, ...allPaidInvoices]) {
      for (const reminder of (inv.reminders || [])) {
        if (new Date(reminder.sentAt) > new Date(now - 14 * 24 * 60 * 60 * 1000)) {
          recentReminders.push({
            invoiceNumber: inv.number,
            clientName: inv.project?.client?.name || 'Inconnu',
            type: reminder.type,
            sentAt: reminder.sentAt,
            emailSent: reminder.emailSent
          });
        }
      }
    }
    recentReminders.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    // 10. Overdue totals
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const overdueCount = overdueInvoices.length;

    res.json({
      success: true,
      data: {
        overview: {
          totalOverdue,
          overdueCount,
          recoveryRate,
          unbilledTotal,
          unbilledHours,
          pendingQuotes: pendingQuotes.length,
          pendingQuotesTotal: pendingQuotes.reduce((sum, q) => sum + q.total, 0),
          globalAvgPaymentDays
        },
        criticalOverdue: criticalOverdue.slice(0, 10).map(inv => ({
          _id: inv._id,
          number: inv.number,
          total: inv.total,
          dueDate: inv.dueDate,
          daysOverdue: inv.daysOverdue,
          reminderCount: (inv.reminders || []).length,
          clientName: inv.project?.client?.name || 'Inconnu',
          company: inv.project?.client?.company || '',
          projectName: inv.project?.name || ''
        })),
        remindersDue: remindersDue.map(r => ({
          invoiceId: r.invoice._id,
          invoiceNumber: r.invoice.number,
          total: r.invoice.total,
          clientName: r.invoice.project?.client?.name || 'Inconnu',
          company: r.invoice.project?.client?.company || '',
          reminderType: r.reminderType,
          daysOverdue: r.daysOverdue
        })),
        upcomingReminders: upcomingReminders.slice(0, 10),
        paymentsThisWeek,
        clientIntelligence,
        cashFlowForecast: cashFlowForecast.slice(0, 15),
        recentActions: recentReminders.slice(0, 10),
        pendingQuotesList: pendingQuotes.slice(0, 5).map(q => ({
          _id: q._id,
          number: q.number,
          total: q.total,
          clientName: q.project?.client?.name || 'Inconnu',
          company: q.project?.client?.company || '',
          sentAt: q.updatedAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
