import { useState, useEffect } from 'react';
import { X, Trash2, Mail, Clock, GitBranch, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAutomationStore } from '../../stores/automationStore';

const NODE_ICONS = {
  trigger: Zap,
  action: Mail,
  condition: GitBranch,
  wait: Clock
};

const NODE_COLORS = {
  trigger: 'violet',
  action: 'blue',
  condition: 'amber',
  wait: 'indigo'
};

export default function NodeConfigPanel({ node, onClose, onUpdateConfig, onDelete }) {
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
  const colorClass = NODE_COLORS[node.type] || 'slate';

  const renderTriggerConfig = () => (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
        <p className="text-sm text-violet-700 dark:text-violet-300">
          Le déclencheur est configuré automatiquement lors de la création de l'automation.
        </p>
      </div>
    </div>
  );

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
            <select
              value={config.recipientType || 'customer'}
              onChange={(e) => handleConfigChange('recipientType', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="customer">Client (depuis le trigger)</option>
              <option value="custom">Email personnalisé</option>
            </select>
          </div>

          {config.recipientType === 'custom' && (
            <Input
              label="Email personnalisé"
              type="email"
              value={config.customEmail || ''}
              onChange={(e) => handleConfigChange('customEmail', e.target.value)}
              placeholder="email@example.com"
            />
          )}
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
          <div className={`w-8 h-8 rounded-lg bg-${colorClass}-100 dark:bg-${colorClass}-900/30 flex items-center justify-center`}>
            <Icon className={`w-4 h-4 text-${colorClass}-600 dark:text-${colorClass}-400`} />
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
