import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Package, ChevronDown, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { servicesApi } from '../../services/api';

const CATEGORIES = {
  development: { label: 'Développement', color: 'bg-blue-500' },
  design: { label: 'Design', color: 'bg-purple-500' },
  maintenance: { label: 'Maintenance', color: 'bg-green-500' },
  hosting: { label: 'Hébergement', color: 'bg-orange-500' },
  consulting: { label: 'Consulting', color: 'bg-yellow-500' },
  other: { label: 'Autre', color: 'bg-gray-500' }
};

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
  const [services, setServices] = useState([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [statusChangeWarning, setStatusChangeWarning] = useState(null);

  const servicePickerRef = useRef(null);
  const statusTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadServices();
      if (editQuote) {
        // Pre-fill form with quote data
        setLines(editQuote.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice
        })));
        setNotes(editQuote.notes || '');
      } else {
        // Reset form for new quote
        setLines([{ description: '', quantity: 1, unitPrice: 0 }]);
        setNotes('');
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

  // Click outside to close service picker
  useEffect(() => {
    if (!showServicePicker) return;

    const handleClickOutside = (e) => {
      if (servicePickerRef.current && !servicePickerRef.current.contains(e.target)) {
        setShowServicePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showServicePicker]);

  const loadServices = async () => {
    try {
      const { data } = await servicesApi.getAll({ active: true });
      setServices(data.data.filter(s => s.isActive));
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const addServiceLine = (service) => {
    const newLine = {
      description: service.description
        ? `${service.name} - ${service.description}`
        : service.name,
      quantity: service.defaultQuantity || 1,
      unitPrice: service.priceType === 'hourly' && service.estimatedHours
        ? service.unitPrice * service.estimatedHours
        : service.unitPrice
    };
    setLines([...lines.filter(l => l.description || l.unitPrice), newLine]);
    setShowServicePicker(false);
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
          : { lines: validLines, notes };

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
          notes
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const cat = service.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

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
        {canFullEdit && services.length > 0 && (
          <div className="relative" ref={servicePickerRef}>
            <button
              type="button"
              onClick={() => setShowServicePicker(!showServicePicker)}
              className="flex items-center gap-2 px-4 py-2.5 w-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
            >
              <Package className="w-4 h-4" />
              <span>Ajouter depuis mes services</span>
              <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showServicePicker ? 'rotate-180' : ''}`} />
            </button>

            {showServicePicker && (
              <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border max-h-80 overflow-y-auto">
                {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                  <div key={category}>
                    <div className="px-3 py-2 bg-slate-50 dark:bg-dark-bg sticky top-0">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${CATEGORIES[category]?.color || 'bg-gray-500'}`}>
                        {CATEGORIES[category]?.label || category}
                      </span>
                    </div>
                    {categoryServices.map(service => (
                      <button
                        key={service._id}
                        type="button"
                        onClick={() => addServiceLine(service)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center justify-between border-b border-slate-100 dark:border-dark-border last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{service.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {service.unitPrice.toLocaleString('fr-CH')} CHF
                          {service.priceType === 'hourly' && '/h'}
                          {service.priceType === 'monthly' && '/mois'}
                          {service.priceType === 'yearly' && '/an'}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lines - only show for full edit */}
        {canFullEdit && (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              <div className="col-span-6">Description</div>
              <div className="col-span-2">Qté</div>
              <div className="col-span-3">Prix unit.</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                    placeholder="Description..."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={line.quantity || ''}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice || ''}
                    onChange={(e) => updateLine(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-1 flex justify-center pt-2">
                  <button
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

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
            <span className="text-slate-600 dark:text-slate-400">Sous-total HT</span>
            <span className="font-medium dark:text-slate-200">
              {formatCurrency(isNotesOnly ? editQuote.subtotal : getSubtotal())}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-slate-600 dark:text-slate-400">TVA ({getVatRate()}%)</span>
            <span className="font-medium dark:text-slate-200">
              {formatCurrency(isNotesOnly ? editQuote.vatAmount : getSubtotal() * (getVatRate() / 100))}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-dark-border text-lg font-bold dark:text-white">
            <span>Total TTC</span>
            <span className="text-primary-600">
              {formatCurrency(isNotesOnly ? editQuote.total : getSubtotal() * (1 + getVatRate() / 100))}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
          <Button variant="secondary" onClick={onClose}>
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
