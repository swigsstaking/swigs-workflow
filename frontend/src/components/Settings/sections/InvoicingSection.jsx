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
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.invoicing) {
      setFormData({
        defaultHourlyRate: settings.invoicing.defaultHourlyRate || 50,
        defaultVatRate: settings.invoicing.defaultVatRate || 8.1,
        defaultPaymentTerms: settings.invoicing.defaultPaymentTerms || 30
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        invoicing: {
          defaultHourlyRate: parseFloat(formData.defaultHourlyRate),
          defaultVatRate: parseFloat(formData.defaultVatRate),
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
            label="TVA par défaut (%)"
            type="number"
            value={formData.defaultVatRate}
            onChange={(e) => updateField('defaultVatRate', e.target.value)}
            placeholder="8.1"
          />

          <Input
            label="Délai de paiement (jours)"
            type="number"
            value={formData.defaultPaymentTerms}
            onChange={(e) => updateField('defaultPaymentTerms', e.target.value)}
            placeholder="30"
          />
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
