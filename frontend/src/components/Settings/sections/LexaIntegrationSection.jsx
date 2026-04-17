import React, { useState, useEffect } from 'react';
import { BookOpen, Save, Activity } from 'lucide-react';
import Button from '../../ui/Button';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function LexaIntegrationSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    enabled: true,
    publishInvoices: true,
    publishExpenses: true,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  const lastPublishedAt = settings?.lexaIntegration?.lastPublishedAt;
  const failureCount = settings?.lexaIntegration?.failureCount ?? 0;

  useEffect(() => {
    if (settings?.lexaIntegration) {
      setFormData({
        enabled: settings.lexaIntegration.enabled ?? true,
        publishInvoices: settings.lexaIntegration.publishInvoices ?? true,
        publishExpenses: settings.lexaIntegration.publishExpenses ?? true,
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
      const { data } = await settingsApi.update({ lexaIntegration: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Intégration Lexa sauvegardée' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange, disabled = false }) => (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Intégration Lexa</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Contrôlez la synchronisation des données vers Lexa, votre logiciel fiscal-comptable.
      </p>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6 space-y-5">
        {/* Toggle principal */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-white">
              Activer l'intégration Lexa
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Publie automatiquement vos factures et dépenses vers Lexa
            </p>
          </div>
          <Toggle
            checked={formData.enabled}
            onChange={(val) => updateField('enabled', val)}
          />
        </div>

        <hr className="border-slate-200 dark:border-dark-border" />

        {/* Sous-options — désactivées si integration disabled */}
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${formData.enabled ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
              Publier les factures
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              invoice.created, invoice.sent, invoice.paid
            </p>
          </div>
          <Toggle
            checked={formData.publishInvoices}
            onChange={(val) => updateField('publishInvoices', val)}
            disabled={!formData.enabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${formData.enabled ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
              Publier les notes de frais
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              expense.submitted
            </p>
          </div>
          <Toggle
            checked={formData.publishExpenses}
            onChange={(val) => updateField('publishExpenses', val)}
            disabled={!formData.enabled}
          />
        </div>
      </div>

      {/* Statut */}
      {(lastPublishedAt || failureCount > 0) && (
        <div className={`mt-4 rounded-xl border p-4 flex items-start gap-3 ${
          failureCount > 0
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        }`}>
          <Activity className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            failureCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`} />
          <div className="text-sm">
            {failureCount > 0 && (
              <p className="text-amber-800 dark:text-amber-200 font-medium">
                {failureCount} erreur{failureCount > 1 ? 's' : ''} de publication récente{failureCount > 1 ? 's' : ''}
              </p>
            )}
            {lastPublishedAt && (
              <p className={failureCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-200'}>
                Dernière publication :{' '}
                {new Date(lastPublishedAt).toLocaleString('fr-CH', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      {hasChanges && (
        <div className="mt-6 flex justify-end">
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

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Lexa reçoit les événements via un webhook HMAC sécurisé. Désactiver l'intégration
          arrête immédiatement la publication — les données existantes dans Lexa ne sont pas supprimées.
        </p>
      </div>
    </div>
  );
}
