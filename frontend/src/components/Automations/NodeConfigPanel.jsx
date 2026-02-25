import { useState, useEffect } from 'react';
import { X, Trash2, Mail, Clock, GitBranch, Zap, ClipboardList, Globe } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAutomationStore } from '../../stores/automationStore';

const NODE_ICONS = {
  trigger: Zap,
  action: Mail,
  condition: GitBranch,
  wait: Clock
};

// Static class lookup to avoid Tailwind purge issues with dynamic class names
const NODE_COLOR_CLASSES = {
  trigger: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400'
  },
  action: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400'
  },
  condition: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400'
  },
  wait: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400'
  }
};

export default function NodeConfigPanel({ node, onClose, onUpdateConfig, onDelete, automationTriggerType }) {
  const { emailTemplates, fetchEmailTemplates } = useAutomationStore();
  const [config, setConfig] = useState(node.data.config || {});

  useEffect(() => {
    setConfig(node.data.config || {});
  }, [node.id, node.data.config]);

  useEffect(() => {
    if (node.type === 'action' && node.data.subType === 'send_email') {
      fetchEmailTemplates();
    }
  }, [node.type, node.data.subType]);

  const handleConfigChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdateConfig(newConfig);
  };

  const Icon = NODE_ICONS[node.type] || Zap;
  const colorClasses = NODE_COLOR_CLASSES[node.type] || { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' };

  const renderTriggerConfig = () => {
    const isCmsTrigger = automationTriggerType?.startsWith('order.') || automationTriggerType?.startsWith('customer.');
    const isProjectTrigger = automationTriggerType === 'project.status_changed';
    const isInvoiceQuoteTrigger = automationTriggerType?.startsWith('invoice.') || automationTriggerType?.startsWith('quote.');

    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <p className="text-sm text-violet-700 dark:text-violet-300">
            Configurez les filtres pour ce déclencheur.
          </p>
        </div>

        {/* CMS trigger: siteId filter */}
        {isCmsTrigger && (
          <Input
            label="Site ID (filtrer par site CMS)"
            value={config.siteId || ''}
            onChange={(e) => handleConfigChange('siteId', e.target.value)}
            placeholder="Laisser vide pour tous les sites"
          />
        )}

        {/* Project trigger: status filters */}
        {isProjectTrigger && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Statuts à surveiller
            </label>
            <Input
              value={(config.statusFilters || []).join(', ')}
              onChange={(e) => handleConfigChange('statusFilters', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="Ex: en cours, terminé, en pause"
            />
            <p className="mt-1 text-xs text-slate-500">Séparez les statuts par des virgules</p>
          </div>
        )}

        {/* Invoice/quote trigger: amount filters */}
        {isInvoiceQuoteTrigger && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Montant min (CHF)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.amountMin || ''}
                onChange={(e) => handleConfigChange('amountMin', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Montant max (CHF)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.amountMax || ''}
                onChange={(e) => handleConfigChange('amountMax', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Illimité"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActionConfig = () => {
    if (node.data.subType === 'send_email') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Template d'email
            </label>
            <select
              value={config.templateId || ''}
              onChange={(e) => handleConfigChange('templateId', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Sélectionner un template</option>
              {emailTemplates.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Destinataire
            </label>
            {(() => {
              // Backwards compat: derive 'to' from old recipientType/customEmail format
              const toValue = config.to || (config.recipientType === 'custom' ? (config.customEmail || '') : 'customer');
              const isCustom = toValue && toValue !== 'customer';
              return (
                <>
                  <select
                    value={isCustom ? 'custom' : 'customer'}
                    onChange={(e) => handleConfigChange('to', e.target.value === 'customer' ? 'customer' : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="customer">Client (depuis le trigger)</option>
                    <option value="custom">Email personnalisé</option>
                  </select>
                  {isCustom && (
                    <div className="mt-4">
                      <Input
                        label="Email personnalisé"
                        type="email"
                        value={toValue === 'customer' ? '' : toValue}
                        onChange={(e) => handleConfigChange('to', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      );
    }

    if (node.data.subType === 'create_task') {
      return (
        <div className="space-y-4">
          <Input
            label="Titre de la tâche"
            value={config.taskTitle || ''}
            onChange={(e) => handleConfigChange('taskTitle', e.target.value)}
            placeholder="Ex: Traiter la commande {{number}}"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={config.taskDescription || ''}
              onChange={(e) => handleConfigChange('taskDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Description de la tâche..."
            />
          </div>
          <Input
            label="Assigner à"
            value={config.assignTo || ''}
            onChange={(e) => handleConfigChange('assignTo', e.target.value)}
            placeholder="Email ou nom de l'assigné"
          />
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              La tâche sera créée dans swigs-task via l'Event Bus.
            </p>
          </div>
        </div>
      );
    }

    if (node.data.subType === 'webhook') {
      return (
        <div className="space-y-4">
          <Input
            label="URL du webhook"
            value={config.webhookUrl || ''}
            onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
            placeholder="https://example.com/webhook"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Méthode HTTP
            </label>
            <select
              value={config.webhookMethod || 'POST'}
              onChange={(e) => handleConfigChange('webhookMethod', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Le contexte de l'automation sera envoyé en JSON dans le body (POST).
            </p>
          </div>
        </div>
      );
    }

    if (node.data.subType === 'update_record') {
      return (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Bientôt disponible
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Cette action permettra de mettre à jour des enregistrements automatiquement.
          </p>
        </div>
      );
    }

    return (
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <p className="text-sm text-slate-500">Configuration non disponible pour ce type d'action.</p>
      </div>
    );
  };

  const renderConditionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Champ à vérifier
        </label>
        <select
          value={config.field || ''}
          onChange={(e) => handleConfigChange('field', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Sélectionner un champ</option>
          <optgroup label="Commande">
            <option value="order.total">Total commande</option>
            <option value="order.status">Statut commande</option>
            <option value="order.itemsCount">Nombre d'articles</option>
          </optgroup>
          <optgroup label="Client">
            <option value="customer.ordersCount">Nombre de commandes</option>
            <option value="customer.isNew">Nouveau client</option>
          </optgroup>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Opérateur
        </label>
        <select
          value={config.operator || ''}
          onChange={(e) => handleConfigChange('operator', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Sélectionner</option>
          <option value="equals">Égal à</option>
          <option value="not_equals">Différent de</option>
          <option value="greater_than">Supérieur à</option>
          <option value="less_than">Inférieur à</option>
          <option value="contains">Contient</option>
        </select>
      </div>

      <Input
        label="Valeur"
        value={config.value || ''}
        onChange={(e) => handleConfigChange('value', e.target.value)}
        placeholder="Valeur à comparer"
      />
    </div>
  );

  const renderWaitConfig = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Durée
          </label>
          <input
            type="number"
            min="1"
            value={config.duration || ''}
            onChange={(e) => handleConfigChange('duration', parseInt(e.target.value) || '')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Unité
          </label>
          <select
            value={config.unit || 'hours'}
            onChange={(e) => handleConfigChange('unit', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Heures</option>
            <option value="days">Jours</option>
          </select>
        </div>
      </div>

      {config.duration && config.unit && (
        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            L'automation attendra{' '}
            <strong>
              {config.duration} {config.unit === 'minutes' ? 'minute(s)' : config.unit === 'hours' ? 'heure(s)' : 'jour(s)'}
            </strong>{' '}
            avant de continuer.
          </p>
        </div>
      )}
    </div>
  );

  const renderConfig = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerConfig();
      case 'action':
        return renderActionConfig();
      case 'condition':
        return renderConditionConfig();
      case 'wait':
        return renderWaitConfig();
      default:
        return null;
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-dark-card border-l border-slate-200 dark:border-dark-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${colorClasses.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${colorClasses.text}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {node.data.label}
            </p>
            <p className="text-xs text-slate-500 capitalize">{node.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Config */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderConfig()}
      </div>

      {/* Actions */}
      {node.type !== 'trigger' && (
        <div className="p-4 border-t border-slate-200 dark:border-dark-border">
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={onDelete}
            className="w-full !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
          >
            Supprimer ce nœud
          </Button>
        </div>
      )}
    </div>
  );
}
