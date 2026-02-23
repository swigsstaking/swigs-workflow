import EmailTemplatesTab from '../EmailTemplatesTab';

export default function EmailsSection() {
  return (
    <div className="space-y-4">
      {/* Info banner — clarify which system is active */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>Système actif :</strong> les templates ci-dessous sont utilisés par le moteur
          d'automations (envois déclenchés automatiquement). Créez un template par type d'email
          (devis, facture, rappel…) en utilisant les variables{' '}
          <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded font-mono text-xs">
            {'{{clientName}}'}
          </code>{' '}
          <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded font-mono text-xs">
            {'{{number}}'}
          </code>{' '}
          etc.
        </div>
      </div>

      <EmailTemplatesTab />
    </div>
  );
}
