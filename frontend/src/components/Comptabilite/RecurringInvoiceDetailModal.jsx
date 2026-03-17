import { useState, useEffect } from 'react';
import { Repeat, Calendar, FileText, Loader2, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import { recurringInvoicesApi } from '../../services/api';
import { formatCurrency } from '../../utils/format';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

const freqLabels = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle'
};

const statusConfig = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  paused: { label: 'En pause', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' }
};

export default function RecurringInvoiceDetailModal({ recurringId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recurringId) return;
    setLoading(true);
    recurringInvoicesApi.getById(recurringId)
      .then(({ data: res }) => setData(res.data || res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [recurringId]);

  if (!recurringId) return null;

  const status = data ? (statusConfig[data.status] || statusConfig.active) : null;
  const clientName = data?.project?.client?.name || 'Client';
  const projectName = data?.project?.name || '';

  // Calculate totals from customLines
  const lines = data?.customLines || [];
  const subtotal = lines.reduce((sum, l) => {
    const qty = l.quantity || 1;
    const base = qty * (l.unitPrice || 0);
    const disc = l.discountType === 'percentage'
      ? base * ((l.discountValue || 0) / 100)
      : (l.discountValue || 0);
    return sum + (base - disc);
  }, 0);
  const vatRate = data?.vatRate || 0;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  // Days until next generation
  const nextDate = data?.nextGenerationDate ? new Date(data.nextGenerationDate) : null;
  const daysUntil = nextDate ? Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Facture récurrente" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-500 py-8 text-center">Récurrence introuvable</p>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{clientName}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
              </div>
              {projectName && <p className="text-sm text-slate-500 dark:text-slate-400">Projet: {projectName}</p>}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Fréquence: {freqLabels[data.frequency] || data.frequency}
                {data.dayOfMonth && ` — Jour ${data.dayOfMonth}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</p>
              <p className="text-xs text-slate-400">par facturation</p>
            </div>
          </div>

          {/* Next generation highlight */}
          {nextDate && (
            <div className={`flex items-center justify-between p-4 rounded-lg border ${
              daysUntil !== null && daysUntil <= 3
                ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06]'
                : 'border-primary-200 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-500/[0.06]'
            }`}>
              <div className="flex items-center gap-3">
                <Calendar className={`w-5 h-5 ${daysUntil !== null && daysUntil <= 3 ? 'text-amber-500' : 'text-primary-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Prochaine facturation</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(nextDate)}</p>
                </div>
              </div>
              {daysUntil !== null && (
                <span className={`text-sm font-bold ${
                  daysUntil <= 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-primary-600 dark:text-primary-400'
                }`}>
                  {daysUntil <= 0 ? 'Aujourd\'hui' : daysUntil === 1 ? 'Demain' : `Dans ${daysUntil} jours`}
                </span>
              )}
            </div>
          )}

          {/* Amounts breakdown */}
          <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Sous-total HT</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">TVA {vatRate}%</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-white/[0.06] pt-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-900 dark:text-white">Total TTC</span>
              <span className="text-slate-900 dark:text-white">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Lines */}
          {lines.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Lignes de facturation</h4>
              <div className="space-y-1">
                {lines.map((line, i) => {
                  const qty = line.quantity || 1;
                  const lineTotal = qty * (line.unitPrice || 0);
                  const disc = line.discountType === 'percentage'
                    ? lineTotal * ((line.discountValue || 0) / 100)
                    : (line.discountValue || 0);
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-800 dark:text-white">{line.description}</span>
                        <span className="text-slate-400 ml-2">{qty} x {formatCurrency(line.unitPrice || 0)}</span>
                        {disc > 0 && <span className="text-red-400 ml-1">(-{formatCurrency(disc)})</span>}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white ml-4">{formatCurrency(lineTotal - disc)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dates & stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoBox icon={Calendar} label="Début" value={fmtDate(data.startDate)} />
            <InfoBox icon={Clock} label="Fin" value={data.endDate ? fmtDate(data.endDate) : 'Illimitée'} />
            <InfoBox icon={FileText} label="Générées" value={`${data.totalGenerated || 0} factures`} />
            <InfoBox icon={Repeat} label="Auto-envoi" value={data.autoSend ? 'Oui' : 'Non'} />
          </div>

          {/* Notes */}
          {data.notes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}

          {/* Payment terms */}
          {data.paymentTermsDays && (
            <p className="text-xs text-slate-400">Délai de paiement: {data.paymentTermsDays} jours</p>
          )}

          {/* Close */}
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/[0.06]">
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

function InfoBox({ icon: Icon, label, value }) {
  return (
    <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
