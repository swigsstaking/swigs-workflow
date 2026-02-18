import { useState, useEffect } from 'react';
import { Bell, Save, Edit2, X } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';

export default function RemindersSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    enabled: false,
    schedule: [
      {
        days: 7,
        subject: 'Rappel facture {number}',
        body: 'Bonjour,\n\nNous vous rappelons que la facture {number} arrive à échéance.'
      },
      {
        days: 14,
        subject: 'Relance facture {number}',
        body: 'Bonjour,\n\nVotre facture {number} est en retard de paiement.'
      },
      {
        days: 30,
        subject: 'Relance urgente facture {number}',
        body: 'Bonjour,\n\nNous vous relançons pour la facture {number} impayée.'
      }
    ]
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings?.reminders) {
      setFormData({
        enabled: settings.reminders.enabled || false,
        schedule: settings.reminders.schedule || formData.schedule
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleEditRule = (index) => {
    const rule = formData.schedule[index];
    setEditingRule({
      index,
      days: rule.days,
      subject: rule.subject,
      body: rule.body
    });
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    const newSchedule = [...formData.schedule];
    newSchedule[editingRule.index] = {
      days: editingRule.days,
      subject: editingRule.subject,
      body: editingRule.body
    };

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    setHasChanges(true);
    setEditingRule(null);
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ reminders: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Configuration des relances enregistrée avec succès' });
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
          <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Relances automatiques
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Envoyez automatiquement des rappels pour les factures en retard.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            Activer les relances automatiques
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Les emails seront envoyés automatiquement selon les règles
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

      {/* Schedule Rules */}
      <div className={`space-y-3 ${!formData.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
          Règles de relance
        </h3>

        {formData.schedule.map((rule, index) => (
          <div
            key={index}
            className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900 dark:text-white">
                    J+{rule.days} : {rule.subject}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                  {rule.body.split('\n')[0]}...
                </p>
              </div>
              <button
                onClick={() => handleEditRule(index)}
                className="flex-shrink-0 p-2 text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Les relances sont envoyées automatiquement après la date d'échéance selon les règles configurées.
          Vous pouvez aussi envoyer une relance manuelle depuis la liste des factures.
        </p>
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

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Modifier la règle
              </h3>
              <button
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de jours après échéance
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingRule.days}
                  onChange={(e) => setEditingRule(prev => ({ ...prev, days: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Objet de l'email
                </label>
                <input
                  type="text"
                  value={editingRule.subject}
                  onChange={(e) => setEditingRule(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Rappel facture {number}"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Corps de l'email
                </label>
                <textarea
                  value={editingRule.body}
                  onChange={(e) => setEditingRule(prev => ({ ...prev, body: e.target.value }))}
                  rows={6}
                  placeholder="Bonjour,&#10;&#10;Nous vous rappelons..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent outline-none transition-colors resize-none"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Variables disponibles : {'{number}'}, {'{clientName}'}, {'{total}'}, {'{dueDate}'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveRule}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
