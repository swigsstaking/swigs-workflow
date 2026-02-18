import { useState, useEffect } from 'react';
import { Link2, Save, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input from '../../ui/Input';

export default function CmsSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    enabled: false,
    apiUrl: '',
    serviceToken: '',
    pollInterval: 60000
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.cmsIntegration) {
      setFormData({
        enabled: settings.cmsIntegration.enabled || false,
        apiUrl: settings.cmsIntegration.apiUrl || '',
        serviceToken: settings.cmsIntegration.serviceToken || '',
        pollInterval: settings.cmsIntegration.pollInterval || 60000
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleTestCmsConnection = async () => {
    if (!formData.apiUrl || !formData.serviceToken) {
      setTestResult({ success: false, message: 'URL et token requis' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${formData.apiUrl}/api/orders?limit=1`, {
        headers: {
          'Authorization': `Bearer ${formData.serviceToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connexion OK - ${data.pagination?.total || 0} commandes trouvées`
        });
      } else {
        const error = await response.text();
        setTestResult({
          success: false,
          message: `Erreur ${response.status}: ${error}`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Erreur de connexion: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ cmsIntegration: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Configuration CMS enregistrée avec succès' });
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
            Connexion CMS E-commerce
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Connectez votre instance SWIGS CMS pour synchroniser les commandes et clients.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            Activer l'intégration CMS
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Synchroniser automatiquement les données du CMS
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
        <Input
          label="URL de l'API CMS"
          value={formData.apiUrl}
          onChange={(e) => updateField('apiUrl', e.target.value)}
          placeholder="https://api.monsite.com ou http://192.168.110.73:3000"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Token de service
          </label>
          <input
            type="password"
            value={formData.serviceToken}
            onChange={(e) => updateField('serviceToken', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Générez un token via POST /api/auth/generate-token sur le CMS
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Intervalle de polling
          </label>
          <select
            value={formData.pollInterval}
            onChange={(e) => updateField('pollInterval', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors"
          >
            <option value="30000">30 secondes</option>
            <option value="60000">1 minute</option>
            <option value="120000">2 minutes</option>
            <option value="300000">5 minutes</option>
            <option value="600000">10 minutes</option>
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Fréquence de vérification des nouvelles commandes/clients
          </p>
        </div>

        {/* Test Connection */}
        <div>
          <Button
            variant="secondary"
            onClick={handleTestCmsConnection}
            loading={testing}
            disabled={!formData.apiUrl || !formData.serviceToken}
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

        {/* Last Polled Status */}
        {settings?.cmsIntegration?.lastPolledAt && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              Dernière synchronisation :{' '}
              {new Date(settings.cmsIntegration.lastPolledAt).toLocaleString('fr-CH')}
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Comment configurer ?
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>Générez un token de service sur votre CMS backend</li>
          <li>Entrez l'URL de votre API CMS et le token ci-dessus</li>
          <li>Testez la connexion pour vérifier la configuration</li>
          <li>Activez l'intégration pour démarrer la synchronisation automatique</li>
        </ol>
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
