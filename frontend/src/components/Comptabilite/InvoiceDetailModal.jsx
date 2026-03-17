import { useState, useEffect } from 'react';
import { FileText, Calendar, CreditCard, Mail, AlertTriangle, ExternalLink, Loader2, Clock, Bell, Pencil, Check, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { invoicesApi, settingsApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import { formatCurrency, roundRemaining } from '../../utils/format';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const toInputDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400' },
  sent: { label: 'Envoyée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  partial: { label: 'Partiel', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  paid: { label: 'Payée', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' }
};

const paymentMethodLabels = {
  bank_transfer: 'Virement',
  cash: 'Espèces',
  card: 'Carte',
  other: 'Autre'
};

const reminderTypeLabels = {
  reminder1: '1er rappel',
  reminder2: '2e rappel',
  reminder3: '3e rappel',
  final: 'Mise en demeure'
};

export default function InvoiceDetailModal({ invoice, onClose, onUpdated }) {
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState([]);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!invoice?._id) return;

    // If we only have partial data (from drill-down), fetch full invoice
    if (!invoice.payments && !invoice.events) {
      setLoading(true);
      invoicesApi.getOne(invoice._id)
        .then(({ data }) => setInv(data.data || data))
        .catch(() => setInv(invoice))
        .finally(() => setLoading(false));
    } else {
      setInv(invoice);
    }

    // Fetch reminder schedule from settings
    settingsApi.get()
      .then(({ data }) => {
        const schedule = data.data?.reminders?.schedule || [];
        setReminderSchedule(schedule);
      })
      .catch(() => {});
  }, [invoice]);

  if (!invoice) return null;

  const data = inv || invoice;
  const status = statusConfig[data.status] || statusConfig.draft;
  const clientName = data.project?.client?.name || data.clientName || data.clientSnapshot?.name || 'Inconnu';
  const remaining = roundRemaining((data.total || 0) - (data.paidAmount || 0));
  const isOverdue = ['sent', 'partial'].includes(data.status) && data.dueDate && new Date(data.dueDate) < new Date();

  // Compute upcoming reminders for overdue invoices
  const sentTypes = new Set((data.reminders || []).map(r => r.type));
  const upcomingReminders = isOverdue && reminderSchedule.length > 0
    ? reminderSchedule
        .filter(s => !sentTypes.has(s.type))
        .map(s => {
          const reminderDate = new Date(data.dueDate);
          reminderDate.setDate(reminderDate.getDate() + s.days);
          return { ...s, date: reminderDate, isPast: reminderDate < new Date() };
        })
        .sort((a, b) => a.date - b.date)
    : [];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Facture ${data.number || ''}`} size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header info */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{data.number}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                {isOverdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> En retard
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{clientName}</p>
              {data.project?.name && (
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Projet: {data.project.name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(data.total || 0)}</p>
              {data.documentType === 'credit_note' && (
                <p className="text-xs text-red-500 font-medium">Avoir</p>
              )}
            </div>
          </div>

          {/* Amounts breakdown */}
          <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Sous-total HT</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(data.subtotal || 0)}</span>
            </div>
            {(data.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Remise {data.discountType === 'percentage' ? `(${data.discountValue}%)` : ''}
                </span>
                <span className="font-medium text-red-500">-{formatCurrency(data.discountAmount)}</span>
              </div>
            )}
            {data.vatBreakdown?.length > 0 ? (
              data.vatBreakdown.map((vb, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">TVA {vb.rate}% (base: {formatCurrency(vb.base)})</span>
                  <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(vb.amount)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">TVA {data.vatRate || 0}%</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(data.vatAmount || 0)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 dark:border-white/[0.06] pt-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-900 dark:text-white">Total TTC</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(data.total || 0)}</span>
            </div>
            {data.paidAmount > 0 && data.status !== 'paid' && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">Montant payé</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(data.paidAmount)}</span>
              </div>
            )}
            {remaining > 0 && data.status !== 'paid' && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400 font-medium">Restant dû</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <EditableDateBox
              icon={Calendar} label="Émission" date={data.issueDate}
              onSave={async (val) => {
                const { data: res } = await invoicesApi.update(data._id, { issueDate: val });
                const updated = res.data || res;
                setInv(prev => ({ ...prev, issueDate: updated.issueDate, dueDate: updated.dueDate }));
                addToast({ type: 'success', message: 'Date d\'émission mise à jour (échéance recalculée)' });
                onUpdated?.();
              }}
            />
            <EditableDateBox
              icon={Clock} label="Échéance" date={data.dueDate} warn={isOverdue}
              onSave={async (val) => {
                await invoicesApi.update(data._id, { dueDate: val });
                setInv(prev => ({ ...prev, dueDate: val }));
                addToast({ type: 'success', message: 'Échéance mise à jour' });
                onUpdated?.();
              }}
            />
            {data.paidAt && (
              <EditableDateBox
                icon={CreditCard} label="Payée le" date={data.paidAt} success
                onSave={async (val) => {
                  await invoicesApi.update(data._id, { paidAt: val });
                  setInv(prev => ({ ...prev, paidAt: val }));
                  addToast({ type: 'success', message: 'Date de paiement mise à jour' });
                  onUpdated?.();
                }}
              />
            )}
            {data.createdAt && <DateBox icon={Calendar} label="Créée le" value={fmtDate(data.createdAt)} />}
          </div>

          {/* Lines (custom or events/quotes) */}
          {data.customLines?.length > 0 && (
            <Section title="Lignes">
              <div className="space-y-1">
                {data.customLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-800 dark:text-white">{line.description}</span>
                      <span className="text-slate-400 ml-2">{line.quantity} x {formatCurrency(line.unitPrice)}</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white ml-4">{formatCurrency(line.total)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {data.events?.length > 0 && (
            <Section title="Heures / Événements">
              <div className="space-y-1">
                {data.events.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-800 dark:text-white">{ev.description}</span>
                      {ev.hours && <span className="text-slate-400 ml-2">{ev.hours}h x {formatCurrency(ev.hourlyRate)}/h</span>}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white ml-4">{formatCurrency(ev.amount)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {data.quotes?.length > 0 && (
            <Section title="Devis facturés">
              <div className="space-y-1">
                {data.quotes.map((q, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-800 dark:text-white">{q.number}</span>
                      {q.isPartial && <span className="text-amber-500 text-xs ml-2">(partiel)</span>}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white ml-4">{formatCurrency(q.invoicedAmount || q.subtotal)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Payments history */}
          {data.payments?.length > 0 && (
            <Section title={`Paiements (${data.payments.length})`}>
              <div className="space-y-2">
                {data.payments.map((p, i) => (
                  <div key={p._id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-100 dark:border-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtDate(p.date)} — {paymentMethodLabels[p.method] || p.method}
                        </p>
                      </div>
                    </div>
                    {p.notes && <span className="text-xs text-slate-500 dark:text-slate-400 italic">{p.notes}</span>}
                  </div>
                ))}
                {/* Progress bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{formatCurrency(data.paidAmount || 0)} payé</span>
                    <span>{formatCurrency(data.total || 0)} total</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(((data.paidAmount || 0) / (data.total || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Reminders */}
          {data.reminders?.length > 0 && (
            <Section title={`Rappels (${data.reminders.length})`}>
              <div className="space-y-1.5">
                {data.reminders.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                    <Mail className={`w-4 h-4 flex-shrink-0 ${r.emailSent ? 'text-blue-500' : 'text-red-400'}`} />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-white">
                        {reminderTypeLabels[r.type] || r.type}
                      </span>
                      <span className="text-slate-400 ml-2">{fmtDateTime(r.sentAt)}</span>
                    </div>
                    {r.emailSent ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Envoyé</span>
                    ) : (
                      <span className="text-xs text-red-500">{r.error || 'Erreur'}</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Upcoming reminders */}
          {upcomingReminders.length > 0 && (
            <Section title="Rappels à venir">
              <div className="space-y-1.5">
                {upcomingReminders.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 py-2 px-3 text-sm rounded-lg border ${
                    r.isPast
                      ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06]'
                      : 'border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]'
                  }`}>
                    <Bell className={`w-4 h-4 flex-shrink-0 ${r.isPast ? 'text-amber-500' : 'text-slate-400'}`} />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-white">
                        {reminderTypeLabels[r.type] || r.type}
                      </span>
                      <span className="text-slate-400 ml-2">J+{r.days}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium ${r.isPast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {fmtDate(r.date)}
                      </span>
                      {r.isPast && (
                        <p className="text-[10px] text-amber-500">En attente d'envoi</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Notes */}
          {data.notes && (
            <Section title="Notes">
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{data.notes}</p>
            </Section>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
            {data._id && (
              <button
                onClick={() => {
                  invoicesApi.getPdf(data._id).then(({ data: blob }) => {
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                  }).catch(() => {});
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Voir PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}

function DateBox({ icon: Icon, label, value, warn, success }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${
      warn ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06]' :
      success ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06]' :
      'border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]'
    }`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${warn ? 'text-red-500' : success ? 'text-emerald-500' : 'text-slate-400'}`} />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className={`text-sm font-medium ${warn ? 'text-red-600 dark:text-red-400' : success ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function EditableDateBox({ icon: Icon, label, date, warn, success, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setValue(toInputDate(date));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const borderCls = warn ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06]' :
    success ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06]' :
    'border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]';
  const textCls = warn ? 'text-red-600 dark:text-red-400' : success ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white';
  const iconCls = warn ? 'text-red-500' : success ? 'text-emerald-500' : 'text-slate-400';

  return (
    <div className={`px-3 py-2 rounded-lg border group relative ${borderCls}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {!editing && (
          <button onClick={handleEdit} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-all" title="Modifier">
            <Pencil className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 text-sm bg-white dark:bg-dark-bg border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
          />
          <button onClick={handleSave} disabled={saving} className="p-0.5 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="p-0.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className={`text-sm font-medium ${textCls}`}>{fmtDate(date)}</p>
      )}
    </div>
  );
}
