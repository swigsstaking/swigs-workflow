import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, Save, FileText, Send, FileDown, Clock,
  AlertTriangle, CheckCircle, CreditCard, FileSignature
} from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { InvoiceStatusBadge, QuoteStatusBadge } from '../../ui/Badge';
import { settingsApi, invoicesApi, quotesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { formatCurrency } from '../../../utils/format';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function KpiCard({ icon: Icon, label, count, amount, color }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  };
  const iconBg = {
    blue: 'bg-blue-100 dark:bg-blue-900/40',
    green: 'bg-emerald-100 dark:bg-emerald-900/40',
    red: 'bg-red-100 dark:bg-red-900/40',
    violet: 'bg-violet-100 dark:bg-violet-900/40',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium opacity-80 truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{count}</p>
          <p className="text-xs font-semibold opacity-70">{formatCurrency(amount)}</p>
        </div>
      </div>
    </div>
  );
}

const INVOICE_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'draft', label: 'Brouillon' },
  { key: 'sent', label: 'Envoyées' },
  { key: 'paid', label: 'Payées' },
  { key: 'overdue', label: 'En retard' },
];

const QUOTE_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'draft', label: 'Brouillon' },
  { key: 'sent', label: 'Envoyés' },
  { key: 'signed', label: 'Signés' },
  { key: 'refused', label: 'Refusés' },
];

export default function InvoicingSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    defaultHourlyRate: 50,
    defaultVatRate: 8.1,
    defaultPaymentTerms: 30
  });
  const [vatEnabled, setVatEnabled] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  // Dashboard state
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [quoteFilter, setQuoteFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (settings?.invoicing) {
      const rate = settings.invoicing.defaultVatRate;
      setFormData({
        defaultHourlyRate: settings.invoicing.defaultHourlyRate || 50,
        defaultVatRate: rate > 0 ? parseFloat(rate.toFixed(2)) : 8.1,
        defaultPaymentTerms: settings.invoicing.defaultPaymentTerms || 30
      });
      setVatEnabled(rate > 0);
      setHasChanges(false);
    }
  }, [settings]);

  // Fetch invoices + quotes for dashboard
  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      setDashLoading(true);
      try {
        const [invRes, quoRes] = await Promise.all([
          invoicesApi.getAll(),
          quotesApi.getAll()
        ]);
        if (!cancelled) {
          setInvoices(invRes.data?.data || []);
          setQuotes(quoRes.data?.data || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    };
    fetchDashboard();
    return () => { cancelled = true; };
  }, []);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleVat = () => {
    setVatEnabled(prev => !prev);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        invoicing: {
          defaultHourlyRate: parseFloat(formData.defaultHourlyRate),
          defaultVatRate: vatEnabled ? parseFloat(formData.defaultVatRate) : 0,
          defaultPaymentTerms: parseInt(formData.defaultPaymentTerms, 10)
        }
      };
      const { data } = await settingsApi.update(payload);
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Paramètres de facturation sauvegardés' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  // KPI calculations
  const kpi = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const open = invoices.filter(i => ['draft', 'sent', 'partial'].includes(i.status));
    const paidThisMonth = invoices.filter(i => i.status === 'paid' && new Date(i.updatedAt || i.issueDate) >= monthStart);
    const overdue = invoices.filter(i => ['sent', 'partial'].includes(i.status) && i.dueDate && new Date(i.dueDate) < now);
    const pendingQuotes = quotes.filter(q => ['draft', 'sent'].includes(q.status));

    const sum = (arr) => arr.reduce((s, d) => s + (d.total || 0), 0);

    return {
      open: { count: open.length, amount: sum(open) },
      paid: { count: paidThisMonth.length, amount: sum(paidThisMonth) },
      overdue: { count: overdue.length, amount: sum(overdue) },
      pendingQuotes: { count: pendingQuotes.length, amount: sum(pendingQuotes) },
    };
  }, [invoices, quotes]);

  // Filtered documents
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let list = invoices;
    if (invoiceFilter === 'overdue') {
      list = invoices.filter(i => ['sent', 'partial'].includes(i.status) && i.dueDate && new Date(i.dueDate) < now);
    } else if (invoiceFilter !== 'all') {
      list = invoices.filter(i => i.status === invoiceFilter);
    }
    return list.slice(0, 20);
  }, [invoices, invoiceFilter]);

  const filteredQuotes = useMemo(() => {
    let list = quotes;
    if (quoteFilter !== 'all') {
      list = quotes.filter(q => q.status === quoteFilter);
    }
    return list.slice(0, 20);
  }, [quotes, quoteFilter]);

  // Quick actions
  const handleInvoiceAction = async (id, newStatus) => {
    setActionLoading(id);
    try {
      await invoicesApi.changeStatus(id, newStatus);
      setInvoices(prev => prev.map(i => i._id === id ? { ...i, status: newStatus } : i));
      addToast({ type: 'success', message: newStatus === 'sent' ? 'Facture marquée envoyée' : 'Facture marquée payée' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async (id, number, type = 'invoice') => {
    setActionLoading(id);
    try {
      const apiCall = type === 'invoice' ? invoicesApi.getPdf(id) : quotesApi.getPdf(id);
      const { data } = await apiCall;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du téléchargement' });
    } finally {
      setActionLoading(null);
    }
  };

  const getClientName = (doc) => {
    const c = doc.client || doc.project?.client;
    return c?.company || c?.name || '—';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Receipt className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Facturation</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Paramètres par défaut pour vos devis et factures.
        </p>
      </div>

      {/* Settings form */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Taux horaire par défaut (CHF)"
            type="number"
            value={formData.defaultHourlyRate}
            onChange={(e) => updateField('defaultHourlyRate', e.target.value)}
            placeholder="50"
          />

          <Input
            label="Délai de paiement (jours)"
            type="number"
            value={formData.defaultPaymentTerms}
            onChange={(e) => updateField('defaultPaymentTerms', e.target.value)}
            placeholder="30"
          />
        </div>

        {/* TVA toggle */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Assujetti à la TVA</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {vatEnabled ? 'La TVA sera affichée sur vos documents' : 'Aucune mention de TVA sur vos documents'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleVat}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                vatEnabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                vatEnabled ? 'translate-x-[22px]' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {vatEnabled && (
            <div className="max-w-xs">
              <Input
                label="TVA par défaut (%)"
                type="number"
                value={formData.defaultVatRate}
                onChange={(e) => updateField('defaultVatRate', e.target.value)}
                placeholder="8.1"
              />
            </div>
          )}
        </div>

        {hasChanges && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border flex justify-end">
            <Button
              onClick={handleSave}
              icon={Save}
              loading={saving}
              disabled={saving}
            >
              Enregistrer les modifications
            </Button>
          </div>
        )}
      </div>

      {/* ── Dashboard ── */}
      {dashLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={FileText}
              label="Factures ouvertes"
              count={kpi.open.count}
              amount={kpi.open.amount}
              color="blue"
            />
            <KpiCard
              icon={CheckCircle}
              label="Payées (ce mois)"
              count={kpi.paid.count}
              amount={kpi.paid.amount}
              color="green"
            />
            <KpiCard
              icon={AlertTriangle}
              label="En retard"
              count={kpi.overdue.count}
              amount={kpi.overdue.amount}
              color="red"
            />
            <KpiCard
              icon={FileSignature}
              label="Devis en attente"
              count={kpi.pendingQuotes.count}
              amount={kpi.pendingQuotes.amount}
              color="violet"
            />
          </div>

          {/* Documents table */}
          <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-dark-border">
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'invoices'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Factures ({invoices.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quotes')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'quotes'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <FileSignature className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Devis ({quotes.length})
              </button>
            </div>

            {/* Filter pills */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
              {(activeTab === 'invoices' ? INVOICE_FILTERS : QUOTE_FILTERS).map(f => {
                const isActive = activeTab === 'invoices' ? invoiceFilter === f.key : quoteFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => activeTab === 'invoices' ? setInvoiceFilter(f.key) : setQuoteFilter(f.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Invoice list */}
            {activeTab === 'invoices' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucune facture</p>
                  </div>
                ) : (
                  filteredInvoices.map(inv => (
                    <div key={inv._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[110px]">
                        {inv.number || '—'}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1 min-w-0">
                        {getClientName(inv)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                        {formatDate(inv.issueDate)}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[90px] text-right">
                        {formatCurrency(inv.total)}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                      <div className="flex items-center gap-0.5 ml-1">
                        {inv.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleInvoiceAction(inv._id, 'sent')}
                            disabled={actionLoading === inv._id}
                            title="Marquer envoyée"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            type="button"
                            onClick={() => handleInvoiceAction(inv._id, 'paid')}
                            disabled={actionLoading === inv._id}
                            title="Marquer payée"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv._id, inv.number, 'invoice')}
                          disabled={actionLoading === inv._id}
                          title="Télécharger PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quote list */}
            {activeTab === 'quotes' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredQuotes.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FileSignature className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun devis</p>
                  </div>
                ) : (
                  filteredQuotes.map(q => (
                    <div key={q._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[110px]">
                        {q.number || '—'}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1 min-w-0">
                        {getClientName(q)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                        {formatDate(q.issueDate || q.createdAt)}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[90px] text-right">
                        {formatCurrency(q.total)}
                      </span>
                      <QuoteStatusBadge status={q.status} />
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(q._id, q.number, 'quote')}
                          disabled={actionLoading === q._id}
                          title="Télécharger PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
