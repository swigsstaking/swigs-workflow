import React, { useState, useEffect } from 'react';
import { Server, Save, Send } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function SmtpSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: ''
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.smtp) {
      setFormData({
        host: settings.smtp.host || '',
        port: settings.smtp.port || 587,
        secure: settings.smtp.secure || false,
        user: settings.smtp.user || '',
        pass: settings.smtp.pass || ''
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
      const { data } = await settingsApi.update({ smtp: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Configuration SMTP sauvegardée' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      await settingsApi.update({ smtp: formData });
      addToast({
        type: 'success',
        message: 'Configuration SMTP sauvegardée. Envoyez un email de test depuis les templates.'
      });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Server className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Configuration SMTP</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Configurez le serveur d'envoi d'emails pour les notifications et relances.
      </p>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Serveur SMTP"
            value={formData.host}
            onChange={(e) => updateField('host', e.target.value)}
            placeholder="smtp.example.com"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Port
            </label>
            <select
              value={formData.port}
              onChange={(e) => updateField('port', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={587}>587 (STARTTLS)</option>
              <option value={465}>465 (SSL)</option>
              <option value={25}>25 (Non sécurisé)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Connexion sécurisée (SSL/TLS)
            </label>
            <button
              type="button"
              onClick={() => updateField('secure', !formData.secure)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.secure ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.secure ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <Input
            label="Utilisateur"
            value={formData.user}
            onChange={(e) => updateField('user', e.target.value)}
            placeholder="user@example.com"
          />

          <Input
            label="Mot de passe"
            type="password"
            value={formData.pass}
            onChange={(e) => updateField('pass', e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {hasChanges && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border flex justify-end gap-3">
            <Button
              onClick={handleTestEmail}
              variant="secondary"
              icon={Send}
            >
              Envoyer un email de test
            </Button>
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

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          La configuration SMTP est nécessaire pour l'envoi automatique d'emails (relances, notifications).
        </p>
      </div>
    </div>
  );
}
