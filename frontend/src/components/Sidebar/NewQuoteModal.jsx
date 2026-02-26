import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import ServicePicker from './invoice/ServicePicker';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/format';

/** Split stored "title\ndescription" into separate parts */
function splitDescription(desc) {
  if (!desc) return { title: '', detail: '' };
  const idx = desc.indexOf('\n');
  if (idx < 0) return { title: desc, detail: '' };
  return { title: desc.substring(0, idx), detail: desc.substring(idx + 1) };
}

/** Join title + detail back into stored format */
function joinDescription(title, detail) {
  const t = title || '';
  const d = detail || '';
  return d ? `${t}\n${d}` : t;
}

/** Auto-growing textarea */
function AutoTextarea({ value, onChange, placeholder, className, ariaLabel }) {
  const resize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const setRef = useCallback((el) => {
    if (el) resize(el);
  }, [resize]);

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={(e) => { onChange(e); resize(e.target); }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={`w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none overflow-hidden ${className || ''}`}
    />
  );
}

// Statuses that allow full editing
const FULL_EDIT_STATUSES = ['draft', 'sent', 'refused', 'expired'];
// Statuses that only allow notes editing
const NOTES_ONLY_STATUSES = ['signed', 'partial', 'invoiced'];

export default function NewQuoteModal({ project, isOpen, onClose, editQuote = null }) {
  const { createQuote, updateQuote } = useProjectStore();
  const { addToast } = useToastStore();
  const { settings } = useSettingsStore();

  const isEditMode = !!editQuote;
  const canFullEdit = !isEditMode || FULL_EDIT_STATUSES.includes(editQuote?.status);
  const isNotesOnly = isEditMode && NOTES_ONLY_STATUSES.includes(editQuote?.status);

  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([
    { description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [statusChangeWarning, setStatusChangeWarning] = useState(null);

  const statusTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (editQuote) {
        // Pre-fill form with quote data
        setLines(editQuote.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice
        })));
        setNotes(editQuote.notes || '');
        setDiscountType(editQuote.discountType || '');
        setDiscountValue(editQuote.discountValue || '');
      } else {
        // Reset form for new quote
        setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
        setNotes('');
        setDiscountType('');
        setDiscountValue('');
      }
      setStatusChangeWarning(null);
    }
    return () => {
      // Clear timeout on unmount or close
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [isOpen, editQuote]);

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const addServiceLine = (service) => {
    const newLine = {
      description: service.description
        ? `${service.name}\n${service.description}`
        : service.name,
      quantity: service.defaultQuantity || 1,
      unitPrice: service.priceType === 'hourly' && service.estimatedHours
        ? service.unitPrice * service.estimatedHours
        : service.unitPrice
    };
    setLines([...lines.filter(l => l.description || l.unitPrice), newLine]);
  };

  const removeLine = (index) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const getSubtotal = () => {
    return lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  };

  const getDiscountAmount = () => {
    const sub = getSubtotal();
    const val = parseFloat(discountValue) || 0;
    if (!discountType || val <= 0) return 0;
    return discountType === 'percentage' ? sub * (val / 100) : Math.min(val, sub);
  };

  const getNetTotal = () => {
    return getSubtotal() - getDiscountAmount();
  };

  const getVatRate = () => {
    if (editQuote?.vatRate) return editQuote.vatRate;
    return settings?.invoicing?.defaultVatRate || 8.1;
  };

  const handleSubmit = async () => {
    const validLines = lines.filter(l => l.description && l.quantity && l.unitPrice);

    // For notes-only mode, we don't need valid lines
    if (!isNotesOnly && validLines.length === 0) return;

    setLoading(true);
    try {
      if (isEditMode) {
        const payload = isNotesOnly
          ? { notes }
          : { lines: validLines, notes, discountType: discountType || undefined, discountValue: discountValue ? parseFloat(discountValue) : undefined };

        const result = await updateQuote(editQuote._id, payload);

        // Show warning if status changed
        if (result.statusChanged) {
          setStatusChangeWarning(`Le devis est repassé en brouillon (était: ${result.previousStatus})`);
          statusTimeoutRef.current = setTimeout(() => {
            onClose();
            setStatusChangeWarning(null);
            statusTimeoutRef.current = null;
          }, 2000);
          return;
        }
      } else {
        await createQuote(project._id, {
          lines: validLines,
          notes,
          discountType: discountType || undefined,
          discountValue: discountValue ? parseFloat(discountValue) : undefined
        });
      }
      onClose();
      setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
      setNotes('');
    } catch (error) {
      console.error('Error saving quote:', error);
      addToast({
        type: 'error',
        message: 'Erreur lors de la mise à jour du devis'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      signed: 'Signé',
      refused: 'Refusé',
      expired: 'Expiré',
      partial: 'Partiellement facturé',
      invoiced: 'Facturé'
    };
    return labels[status] || status;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `Modifier le devis ${editQuote?.number}` : 'Créer un devis'}
      size="lg"
    >
      <div className="space-y-6">
        {/* Status warning for edit mode */}
        {isEditMode && (
          <div className={`p-3 rounded-lg text-sm ${
            isNotesOnly
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
              : editQuote.status !== 'draft'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                : 'bg-slate-50 dark:bg-dark-bg text-slate-600 dark:text-slate-400'
          }`}>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Statut actuel : {getStatusLabel(editQuote.status)}</p>
                {isNotesOnly ? (
                  <p className="mt-1">Ce devis est signé ou facturé. Seules les notes peuvent être modifiées.</p>
                ) : editQuote.status !== 'draft' ? (
                  <p className="mt-1">Si vous modifiez le contenu, le devis repassera en brouillon.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Status change warning */}
        {statusChangeWarning && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 text-sm">
            {statusChangeWarning}
          </div>
        )}

        {/* Service picker - only show for full edit */}
        {canFullEdit && (
          <ServicePicker onSelectService={addServiceLine} />
        )}

        {/* Lines - only show for full edit */}
        {canFullEdit && (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-center">Qté</div>
              <div className="col-span-2 text-center">Prix</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {lines.map((line, index) => {
              const { title, detail } = splitDescription(line.description);
              const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
              return (
              <div key={index} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30">
                <div className="col-span-6 space-y-1">
                  <input
                    value={title}
                    onChange={(e) => {
                      updateLine(index, 'description', joinDescription(e.target.value, detail));
                    }}
                    placeholder="Titre..."
                    aria-label={`Titre ligne ${index + 1}`}
                    className="w-full px-2 py-1.5 text-sm font-medium rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <AutoTextarea
                    value={detail}
                    onChange={(e) => {
                      updateLine(index, 'description', joinDescription(title, e.target.value));
                    }}
                    placeholder="Description (optionnel)..."
                    ariaLabel={`Description ligne ${index + 1}`}
                    className="text-slate-600 dark:text-slate-300"
                  />
                </div>
                <div className="col-span-2 pt-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.quantity === '' ? '' : (line.quantity || '')}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 1)}
                    aria-label={`Quantité ligne ${index + 1}`}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 pt-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice === '' ? '' : (line.unitPrice || '')}
                    onChange={(e) => updateLine(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    aria-label={`Prix ligne ${index + 1}`}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1 pt-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(lineTotal)}
                  </span>
                  <button
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={addLine}
            >
              Ajouter une ligne
            </Button>
          </div>
        )}

        {/* Read-only lines display for locked quotes */}
        {isNotesOnly && editQuote?.lines && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Lignes du devis (lecture seule)</p>
            <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-3 space-y-2">
              {editQuote.lines.map((line, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{line.description}</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {line.quantity} x {formatCurrency(line.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discount */}
        {canFullEdit && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Rabais</p>
            <div className="flex items-center gap-2">
              <select
                value={discountType}
                onChange={(e) => { setDiscountType(e.target.value); if (!e.target.value) setDiscountValue(''); }}
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white"
              >
                <option value="">Aucun</option>
                <option value="percentage">%</option>
                <option value="fixed">CHF</option>
              </select>
              {discountType && (
                <Input
                  type="number"
                  min="0"
                  step={discountType === 'percentage' ? '1' : '0.01'}
                  max={discountType === 'percentage' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '10' : '100.00'}
                />
              )}
              {discountType && discountValue && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  -{formatCurrency(getDiscountAmount())}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <Textarea
          label="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Conditions particulières, remarques..."
        />

        {/* Total */}
        <div className="bg-slate-50 dark:bg-dark-bg rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">{getVatRate() > 0 ? 'Sous-total HT' : 'Sous-total'}</span>
            <span className="font-medium dark:text-slate-200">
              {formatCurrency(isNotesOnly ? editQuote.subtotal : getSubtotal())}
            </span>
          </div>
          {getDiscountAmount() > 0 && !isNotesOnly && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">Rabais{discountType === 'percentage' ? ` (${discountValue}%)` : ''}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -{formatCurrency(getDiscountAmount())}
              </span>
            </div>
          )}
          {isNotesOnly && editQuote.discountAmount > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">Rabais</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -{formatCurrency(editQuote.discountAmount)}
              </span>
            </div>
          )}
          {getVatRate() > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-600 dark:text-slate-400">TVA ({getVatRate()}%)</span>
              <span className="font-medium dark:text-slate-200">
                {formatCurrency(isNotesOnly ? editQuote.vatAmount : getNetTotal() * (getVatRate() / 100))}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-dark-border text-lg font-bold dark:text-white">
            <span>{getVatRate() > 0 ? 'Total TTC' : 'Total'}</span>
            <span className="text-primary-600">
              {formatCurrency(isNotesOnly ? editQuote.total : Math.round(getNetTotal() * (1 + getVatRate() / 100) / 0.05) * 0.05)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
          <Button variant="secondary" onClick={() => {
            if (statusTimeoutRef.current) {
              clearTimeout(statusTimeoutRef.current);
              statusTimeoutRef.current = null;
            }
            onClose();
          }}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!isNotesOnly && lines.every(l => !l.description || !l.unitPrice)}
          >
            {isEditMode ? 'Enregistrer' : 'Créer le devis'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
