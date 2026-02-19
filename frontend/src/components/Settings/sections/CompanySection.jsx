import React, { useState, useEffect } from 'react';
import { Building2, Save } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function CompanySection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    siret: '',
    vatNumber: '',
    address: '',
    iban: '',
    qrIban: ''
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.company) {
      setFormData({
        name: settings.company.name || '',
        email: settings.company.email || '',
        phone: settings.company.phone || '',
        siret: settings.company.siret || '',
        vatNumber: settings.company.vatNumber || '',
        address: settings.company.address || '',
        iban: settings.company.iban || '',
        qrIban: settings.company.qrIban || ''
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
      const { data } = await settingsApi.update({ company: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Informations entreprise sauvegardées' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Entreprise</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Ces informations apparaîtront sur vos devis et factures.
      </p>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nom de l'entreprise"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="ACME SA"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="contact@acme.ch"
          />

          <Input
            label="Téléphone"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+41 22 123 45 67"
          />

          <Input
            label="N° IDE"
            value={formData.siret}
            onChange={(e) => updateField('siret', e.target.value)}
            placeholder="CHE-123.456.789"
          />

          <Input
            label="N° TVA"
            value={formData.vatNumber}
            onChange={(e) => updateField('vatNumber', e.target.value)}
            placeholder="CHE-123.456.789 TVA"
          />

          <Input
            label="Adresse"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="Rue de la Poste 1, 1200 Genève"
          />

          <Input
            label="IBAN"
            value={formData.iban}
            onChange={(e) => updateField('iban', e.target.value)}
            placeholder="CHxx xxxx xxxx xxxx xxxx x"
          />

          <Input
            label="QR-IBAN (optionnel)"
            value={formData.qrIban}
            onChange={(e) => updateField('qrIban', e.target.value)}
            placeholder="CHxx xxxx xxxx xxxx xxxx x"
          />
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border flex justify-end">
          <Button
            onClick={handleSave}
            icon={Save}
            loading={saving}
            disabled={saving || !hasChanges}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
