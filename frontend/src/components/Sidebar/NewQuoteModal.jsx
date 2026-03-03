import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import ServicePicker from './invoice/ServicePicker';
import TemplatePicker from './invoice/TemplatePicker';
import LinesEditor from './invoice/LinesEditor';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/format';

/** Compute per-line discount CHF amount from type + value */
function computeLineDiscount(line) {
  const gross = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
  const val = parseFloat(line.discountValue) || 0;
  if (!line.discountType || val <= 0) return 0;
  if (line.discountType === 'percentage') return Math.min(gross, gross * (val / 100));
  return Math.min(val, gross);
}

const EMPTY_LINE = { description: '', quantity: 1, unitPrice: 0, discountType: '', discountValue: 0, isInfoLine: false };

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
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [statusChangeWarning, setStatusChangeWarning] = useState(null);

  const statusTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (editQuote) {
        setLines(editQuote.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountType: l.discountType || '',
          discountValue: l.discountValue || 0,
          isInfoLine: l.isInfoLine || false
        })));
        setNotes(editQuote.notes || '');
        setDiscountType(editQuote.discountType || '');
        setDiscountValue(editQuote.discountValue || '');
      } else {
        setLines([{ ...EMPTY_LINE }]);
        setNotes('');
        setDiscountType('');
        setDiscountValue('');
      }
      setStatusChangeWarning(null);
    }
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [isOpen, editQuote]);

  const addLine = () => {
    setLines([...lines, { ...EMPTY_LINE }]);
  };

  const addServiceLine = (service) => {
    const newLine = {
      description: service.description
        ? `${service.name}\n${service.description}`
        : service.name,
      quantity: service.defaultQuantity || 1,
      unitPrice: service.priceType === 'hourly' && service.estimatedHours
        ? service.unitPrice * service.estimatedHours
        : service.unitPrice,
      discountType: '',
      discountValue: 0,
      isInfoLine: false
    };
    setLines([...lines.filter(l => l.description || l.unitPrice), newLine]);
  };

  const removeLine = (index) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    setLines(prev => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], [field]: value };
      return newLines;
    });
  };

  const getSubtotal = () => {
    return lines.filter(l => !l.isInfoLine).reduce((sum, line) => {
      const gross = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
      const discount = computeLineDiscount(line);
      return sum + Math.max(0, gross - discount);
    }, 0);
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
    const validLines = lines.filter(l => l.description && (l.isInfoLine || (l.quantity && l.unitPrice)));

    if (!isNotesOnly && validLines.length === 0) return;

    setLoading(true);
    try {
      if (isEditMode) {
        const payload = isNotesOnly
          ? { notes }
          : {
              lines: validLines.map(l => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountType: l.discountType || undefined,
                discountValue: l.discountValue || undefined,
                isInfoLine: l.isInfoLine || undefined
              })),
              notes,
              discountType: discountType || undefined,
              discountValue: discountValue ? parseFloat(discountValue) : undefined
            };

        const result = await updateQuote(editQuote._id, payload);

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
          lines: validLines.map(l => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountType: l.discountType || undefined,
            discountValue: l.discountValue || undefined,
            isInfoLine: l.isInfoLine || undefined
          })),
          notes,
          discountType: discountType || undefined,
          discountValue: discountValue ? parseFloat(discountValue) : undefined
        });
      }
      onClose();
      setLines([{ ...EMPTY_LINE }]);
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

        {/* Template picker - only show for new quote creation */}
        {canFullEdit && !isEditMode && (
          <TemplatePicker onSelectTemplate={(template) => {
            setLines(template.lines.map(l => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountType: l.discountType || '',
              discountValue: l.discountValue || 0,
              isInfoLine: l.isInfoLine || false
            })));
            if (template.discountType) {
              setDiscountType(template.discountType);
              setDiscountValue(template.discountValue || '');
            }
            if (template.notes) {
              setNotes(template.notes);
            }
          }} />
        )}

        {/* Service picker - only show for full edit */}
        {canFullEdit && (
          <ServicePicker onSelectService={addServiceLine} />
        )}

        {/* Lines editor */}
        {canFullEdit && (
          <LinesEditor
            lines={lines}
            updateLine={updateLine}
            removeLine={removeLine}
            addLine={addLine}
            showInfoToggle
          />
        )}

        {/* Read-only lines display for locked quotes */}
        {isNotesOnly && editQuote?.lines && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Lignes du devis (lecture seule)</p>
            <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-3 space-y-2">
              {editQuote.lines.filter(l => !l.isInfoLine).map((line, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{line.description}</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {line.quantity} x {formatCurrency(line.unitPrice)}
                  </span>
                </div>
              ))}
              {editQuote.lines.filter(l => l.isInfoLine).map((line, index) => (
                <div key={`info-${index}`} className="flex justify-between text-sm border-t border-blue-100 dark:border-blue-800/30 pt-2 mt-2">
                  <span className="text-blue-600 dark:text-blue-400">{line.description}</span>
                  <span className="text-xs font-medium text-blue-500 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30">Info</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Discount */}
        {canFullEdit && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Remise globale</p>
            <div className="flex items-center gap-2">
              <select
                value={discountType}
                onChange={(e) => { setDiscountType(e.target.value); if (!e.target.value) setDiscountValue(''); }}
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white"
              >
                <option value="">Aucune</option>
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
              <span className="text-emerald-600 dark:text-emerald-400">Remise{discountType === 'percentage' ? ` (${discountValue}%)` : ''}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -{formatCurrency(getDiscountAmount())}
              </span>
            </div>
          )}
          {isNotesOnly && editQuote.discountAmount > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">Remise</span>
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
          {/* Info lines summary */}
          {lines.some(l => l.isInfoLine && l.description) && !isNotesOnly && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/50">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Informations de paiement</p>
              {lines.filter(l => l.isInfoLine && l.description).map((l, i) => (
                <div key={i} className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                  <span>{l.description.split('\n')[0]}</span>
                  <span>{l.quantity} x {formatCurrency(l.unitPrice)}</span>
                </div>
              ))}
            </div>
          )}
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
            disabled={!isNotesOnly && lines.every(l => !l.description || (!l.isInfoLine && !l.unitPrice))}
          >
            {isEditMode ? 'Enregistrer' : 'Créer le devis'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
