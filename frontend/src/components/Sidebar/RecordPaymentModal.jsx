import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { formatCurrency } from '../../utils/format';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'card', label: 'Carte' },
  { value: 'other', label: 'Autre' }
];

export default function RecordPaymentModal({ invoice, isOpen, onClose }) {
  const { recordInvoicePayment } = useProjectStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  const remaining = invoice ? invoice.total - (invoice.paidAmount || 0) : 0;

  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(remaining.toFixed(2));
      setDate(new Date().toISOString().slice(0, 10));
      setMethod('bank_transfer');
      setNotes('');
    }
  }, [isOpen, invoice?._id]);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      addToast({ type: 'error', message: 'Montant invalide' });
      return;
    }

    setLoading(true);
    try {
      await recordInvoicePayment(invoice._id, {
        amount: parsedAmount,
        date,
        method,
        notes: notes || undefined
      });
      addToast({ type: 'success', message: `Paiement de ${formatCurrency(Math.min(parsedAmount, remaining))} enregistré` });
      onClose();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de l\'enregistrement du paiement' });
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Paiement — ${invoice.number}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Total facture</span>
            <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(invoice.total)}</span>
          </div>
          {(invoice.paidAmount || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Déjà payé</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(invoice.paidAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-slate-200 dark:border-slate-700 pt-1.5">
            <span className="text-slate-700 dark:text-slate-300">Reste à payer</span>
            <span className="text-slate-900 dark:text-white">{formatCurrency(remaining)}</span>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Montant du paiement (CHF)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={remaining}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Date du paiement
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Méthode de paiement
          </label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Notes (optionnel)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Référence bancaire, remarques..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!parseFloat(amount) || parseFloat(amount) <= 0}
          >
            Enregistrer le paiement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
