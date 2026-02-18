import { useState } from 'react';
import { Plus, Trash2, FileText, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useProjectStore } from '../../stores/projectStore';

export default function NewCustomInvoiceModal({ project, isOpen, onClose }) {
  const { createInvoice } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([
    { description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customIssueDate, setCustomIssueDate] = useState('');

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLine = (index) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
  };

  const getLineTotal = (line) => {
    return (line.quantity || 0) * (line.unitPrice || 0);
  };

  const getSubtotal = () => {
    return lines.reduce((sum, line) => sum + getLineTotal(line), 0);
  };

  const getVatAmount = () => {
    return getSubtotal() * 0.081;
  };

  const getTotal = () => {
    return getSubtotal() + getVatAmount();
  };

  const isValid = () => {
    return lines.every(line =>
      line.description.trim() !== '' &&
      line.quantity > 0 &&
      line.unitPrice > 0
    );
  };

  const handleSubmit = async () => {
    if (!isValid()) return;

    setLoading(true);
    try {
      const invoiceData = {
        invoiceType: 'custom',
        customLines: lines.map(line => ({
          description: line.description,
          quantity: parseFloat(line.quantity) || 1,
          unitPrice: parseFloat(line.unitPrice) || 0
        })),
        notes: notes || undefined
      };

      // Add custom issue date if specified
      if (customIssueDate) {
        invoiceData.issueDate = customIssueDate;
      }

      await createInvoice(project._id, invoiceData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
    setNotes('');
    setCustomIssueDate('');
    setShowAdvanced(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Facture libre"
      size="lg"
    >
      <div className="flex flex-col -m-6">
        {/* Description */}
        <div className="px-6 pt-6 pb-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Créez une facture avec des lignes personnalisées, sans événements ni devis préalables.
          </p>
        </div>

        {/* Lines form */}
        <div className="flex-1 overflow-y-auto px-6 py-3 max-h-[45vh]">
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-center">Qté</div>
              <div className="col-span-2 text-center">Prix unit.</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {/* Lines */}
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="col-span-6">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                    placeholder="Description du service..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                    className="w-full px-3 py-2 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {formatCurrency(getLineTotal(line))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add line button */}
            <button
              type="button"
              onClick={addLine}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-500 dark:hover:border-primary-400 dark:hover:text-primary-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Ajouter une ligne</span>
            </button>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Notes (optionnel)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques, conditions particulières..."
                rows={2}
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </label>
          </div>
        </div>

        {/* Advanced options */}
        <div className="mx-6 mt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Options avancées</span>
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Date d'émission
                </span>
                <input
                  type="date"
                  value={customIssueDate}
                  onChange={(e) => setCustomIssueDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Laissez vide pour utiliser la date du jour
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mx-6 mb-4 mt-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-4">
          {!isValid() ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
              Remplissez toutes les lignes pour continuer
            </p>
          ) : (
            <div className="space-y-3">
              {/* Lines count */}
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                <span className="text-slate-600 dark:text-slate-400">
                  {lines.length} ligne{lines.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Totals */}
              <div className="flex items-end justify-between pt-3 border-t border-slate-200/80 dark:border-slate-700/50">
                <div className="space-y-0.5">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Total HT: <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(getSubtotal())}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    TVA 8.1%: {formatCurrency(getVatAmount())}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Total TTC</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {formatCurrency(getTotal())}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!isValid()}
          >
            Créer la facture
          </Button>
        </div>
      </div>
    </Modal>
  );
}
