import React, { useState, useEffect } from 'react';
import { Receipt, Save } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

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

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Receipt className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Facturation</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Paramètres par défaut pour vos devis et factures.
      </p>

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
    </div>
  );
}
