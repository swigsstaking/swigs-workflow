import { useState, useEffect } from 'react';
import { Link2, Save, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';

export default function AbaNinjaSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    enabled: false,
    apiKey: '',
    autoSync: false,
    syncInvoices: true,
    syncQuotes: true,
    syncClients: true
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.abaninja) {
      setFormData({
        enabled: settings.abaninja.enabled || false,
        apiKey: settings.abaninja.apiKey || '',
        autoSync: settings.abaninja.autoSync || false,
        syncInvoices: settings.abaninja.syncInvoices !== false,
        syncQuotes: settings.abaninja.syncQuotes !== false,
        syncClients: settings.abaninja.syncClients !== false
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleTestAbaNinja = async () => {
    if (!formData.apiKey) {
      setTestResult({ success: false, message: 'Clé API requise' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/abaninja/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: 'Connexion OK' });
      } else {
        setTestResult({ success: false, message: data.error || 'Erreur de connexion' });
      }
    } catch (error) {
      setTestResult({ success: false, message: `Erreur: ${error.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/abaninja/sync/all', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        addToast({
          type: 'success',
          message: `Sync terminée: ${data.data?.synced || 0} éléments`
        });
      } else {
        addToast({ type: 'error', message: data.error || 'Erreur de synchronisation' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur de synchronisation' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ abaninja: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Configuration AbaNinja enregistrée avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Intégration AbaNinja
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Synchronisez vos factures, devis et clients avec AbaNinja.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            Activer l'intégration AbaNinja
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Synchroniser automatiquement avec AbaNinja
          </div>
        </div>
        <button
          onClick={() => updateField('enabled', !formData.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            formData.enabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              formData.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Configuration Fields */}
      <div className={`space-y-4 ${!formData.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Clé API
          </label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => updateField('apiKey', e.target.value)}
            placeholder="Votre clé API AbaNinja"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors"
          />
        </div>

        {/* Sync Options */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">
            Options de synchronisation
          </h3>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoSync || false}
              onChange={(e) => updateField('autoSync', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Synchronisation automatique
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncInvoices || false}
              onChange={(e) => updateField('syncInvoices', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Synchroniser les factures
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncQuotes || false}
              onChange={(e) => updateField('syncQuotes', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Synchroniser les devis
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.syncClients || false}
              onChange={(e) => updateField('syncClients', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:focus:ring-primary-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Synchroniser les clients
            </span>
          </label>
        </div>

        {/* Test Connection */}
        <div>
          <Button
            variant="secondary"
            onClick={handleTestAbaNinja}
            loading={testing}
            disabled={!formData.apiKey}
          >
            Tester la connexion
          </Button>

          {testResult && (
            <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Manual Sync */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                Synchronisation manuelle
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Synchroniser toutes les données maintenant
              </p>
            </div>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={handleSyncAll}
              loading={syncing}
              disabled={!formData.apiKey}
            >
              Synchroniser
            </Button>
          </div>

          {/* Last Sync Status */}
          {settings?.abaninja?.lastSyncAt && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Dernière synchronisation :{' '}
                {new Date(settings.abaninja.lastSyncAt).toLocaleString('fr-CH')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          À propos de l'intégration
        </h3>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>• Les données sont synchronisées de SWIGS Workflow vers AbaNinja</li>
          <li>• La synchronisation automatique s'effectue toutes les heures</li>
          <li>• Vous pouvez aussi lancer une synchronisation manuelle à tout moment</li>
        </ul>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            icon={Save}
            onClick={handleSave}
            loading={saving}
          >
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}
