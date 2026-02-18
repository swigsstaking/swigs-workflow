import { useState, useEffect } from 'react';
import { Mail, Receipt, Save } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';
import EmailTemplatesTab from '../EmailTemplatesTab';

export default function EmailsSection({ settings, onSettingsUpdate }) {
  const [emailTemplates, setEmailTemplates] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (settings) {
      setEmailTemplates(settings.emailTemplates || {
        quoteSubject: 'Devis {number} - {projectName}',
        quoteBody: 'Bonjour {clientName},\n\nVeuillez trouver ci-joint le devis {number} d\'un montant de {total} CHF.\n\nN\'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{companyName}',
        invoiceSubject: 'Facture {number} - {projectName}',
        invoiceBody: 'Bonjour {clientName},\n\nVeuillez trouver ci-joint la facture {number} d\'un montant de {total} CHF.\n\nMerci de procéder au règlement dans un délai de {paymentTerms} jours.\n\nCordialement,\n{companyName}'
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setEmailTemplates(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ emailTemplates });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Templates email enregistrés avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  if (!emailTemplates) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Email Templates Tab (Advanced) */}
      <EmailTemplatesTab />

      {/* Legacy Simple Templates */}
      <div className="space-y-6">
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Templates email simples (legacy)
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Configuration simplifiée pour les emails de devis et factures.
          </p>
        </div>

        {/* Variables Help */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            <strong>Variables disponibles :</strong>
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{number}'}
            </code>
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{projectName}'}
            </code>
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{clientName}'}
            </code>
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{total}'}
            </code>
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{companyName}'}
            </code>
            <code className="px-2 py-1 bg-white dark:bg-dark-card rounded border border-amber-200 dark:border-amber-700">
              {'{paymentTerms}'}
            </code>
          </div>
        </div>

        {/* Quote Template */}
        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="font-medium text-slate-900 dark:text-white">
            Modèle pour les devis
          </h3>

          <Input
            label="Objet de l'email"
            value={emailTemplates.quoteSubject}
            onChange={(e) => updateField('quoteSubject', e.target.value)}
            placeholder="Devis {number} - {projectName}"
          />

          <Textarea
            label="Corps de l'email"
            value={emailTemplates.quoteBody}
            onChange={(e) => updateField('quoteBody', e.target.value)}
            rows={6}
            placeholder="Bonjour {clientName},&#10;&#10;Veuillez trouver ci-joint..."
          />
        </div>

        {/* Invoice Template */}
        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="font-medium text-slate-900 dark:text-white">
            Modèle pour les factures
          </h3>

          <Input
            label="Objet de l'email"
            value={emailTemplates.invoiceSubject}
            onChange={(e) => updateField('invoiceSubject', e.target.value)}
            placeholder="Facture {number} - {projectName}"
          />

          <Textarea
            label="Corps de l'email"
            value={emailTemplates.invoiceBody}
            onChange={(e) => updateField('invoiceBody', e.target.value)}
            rows={6}
            placeholder="Bonjour {clientName},&#10;&#10;Veuillez trouver ci-joint..."
          />
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Comment ça marche ?</strong> Cliquez sur l'icône{' '}
              <Mail className="w-4 h-4 inline-block" /> sur un devis ou une facture pour ouvrir
              votre client mail avec le template pré-rempli.
            </div>
          </div>
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
    </div>
  );
}
