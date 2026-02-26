import { useState, useEffect } from 'react';
import { X, Trash2, Mail, Clock, GitBranch, Zap, ClipboardList, Globe, User, UserPlus, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { useAutomationStore } from '../../stores/automationStore';
import { useAuthStore } from '../../stores/authStore';

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
  const { user } = useAuthStore();
  const [config, setConfig] = useState(node.data.config || {});
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [pendingAssignEmail, setPendingAssignEmail] = useState('');

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
    const isDateRelative = automationTriggerType === 'date.relative';

    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <p className="text-sm text-violet-700 dark:text-violet-300">
            {isDateRelative
              ? 'Configurez la source de date et le délai.'
              : 'Configurez les filtres pour ce déclencheur.'}
          </p>
        </div>

        {/* Date relative trigger config */}
        {isDateRelative && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Source de la date
              </label>
              <select
                value={config.dateSource || ''}
                onChange={(e) => handleConfigChange('dateSource', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Sélectionner</option>
                <option value="planned_block">Bloc planifié (date de début)</option>
                <option value="invoice_due">Échéance facture</option>
                <option value="quote_expiry">Expiration devis</option>
                <option value="custom">Date personnalisée (one-shot)</option>
              </select>
            </div>

            {/* Custom one-shot: datetime picker */}
            {config.dateSource === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Date et heure de déclenchement
                </label>
                <input
                  type="datetime-local"
                  value={config.scheduledDate ? new Date(config.scheduledDate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => handleConfigChange('scheduledDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Standard offset config (hidden for custom) */}
            {config.dateSource && config.dateSource !== 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Direction
                  </label>
                  <select
                    value={config.dateOffsetDirection || ''}
                    onChange={(e) => handleConfigChange('dateOffsetDirection', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner</option>
                    <option value="before">Avant la date</option>
                    <option value="after">Après la date</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Délai
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.dateOffset || ''}
                      onChange={(e) => handleConfigChange('dateOffset', parseInt(e.target.value) || '')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Unité
                    </label>
                    <select
                      value={config.dateOffsetUnit || 'hours'}
                      onChange={(e) => handleConfigChange('dateOffsetUnit', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Heures</option>
                      <option value="days">Jours</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Summary for custom one-shot */}
            {config.dateSource === 'custom' && config.scheduledDate && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <p className="text-sm text-violet-700 dark:text-violet-300">
                  Déclenchement unique le{' '}
                  <strong>{new Date(config.scheduledDate).toLocaleString('fr-CH')}</strong>.
                  <br />
                  <span className="text-xs opacity-75">Vérifié toutes les 5 minutes.</span>
                </p>
              </div>
            )}

            {/* Summary for standard offset */}
            {config.dateSource && config.dateSource !== 'custom' && config.dateOffset && config.dateOffsetDirection && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <p className="text-sm text-violet-700 dark:text-violet-300">
                  Déclenchement{' '}
                  <strong>
                    {config.dateOffset} {config.dateOffsetUnit === 'minutes' ? 'minute(s)' : config.dateOffsetUnit === 'hours' ? 'heure(s)' : 'jour(s)'}
                  </strong>{' '}
                  <strong>{config.dateOffsetDirection === 'before' ? 'avant' : 'après'}</strong>{' '}
                  {config.dateSource === 'planned_block' ? 'le bloc planifié' : config.dateSource === 'invoice_due' ? "l'échéance facture" : "l'expiration du devis"}.
                  <br />
                  <span className="text-xs opacity-75">Vérifié toutes les 5 minutes.</span>
                </p>
              </div>
            )}
          </>
        )}

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
              const recipientMode = toValue === 'customer' ? 'customer' : toValue === 'admin' ? 'admin' : 'custom';
              return (
                <>
                  <select
                    value={recipientMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      if (mode === 'customer') handleConfigChange('to', 'customer');
                      else if (mode === 'admin') handleConfigChange('to', 'admin');
                      else handleConfigChange('to', (toValue && toValue !== 'customer' && toValue !== 'admin') ? toValue : '');
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="customer">Client (depuis le trigger)</option>
                    <option value="admin">Admin (email entreprise)</option>
                    <option value="custom">Email personnalisé</option>
                  </select>
                  {recipientMode === 'custom' && (
                    <div className="mt-4">
                      <Input
                        label="Email personnalisé"
                        type="email"
                        value={toValue === 'customer' || toValue === 'admin' ? '' : (toValue || '')}
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
      // Determine assignee mode from config
      const assignMode = config.assignMode || (config.assignTo ? 'other' : 'self');
      const currentUserEmail = user?.email || '';

      const handleAssignModeChange = (mode) => {
        if (mode === 'self') {
          // Assign to current user — apply immediately
          const updated = { ...config, assignMode: 'self', assignTo: currentUserEmail };
          setConfig(updated);
          onUpdateConfig(updated);
        } else if (mode === 'none') {
          // No assignee
          const updated = { ...config, assignMode: 'none', assignTo: '' };
          setConfig(updated);
          onUpdateConfig(updated);
        } else {
          // Switch to "other" mode — clear email, user will type it
          const updated = { ...config, assignMode: 'other', assignTo: '' };
          setConfig(updated);
          onUpdateConfig(updated);
        }
      };

      const handleOtherEmailConfirm = () => {
        // Apply the pending email after confirmation
        const updated = { ...config, assignMode: 'other', assignTo: pendingAssignEmail };
        setConfig(updated);
        onUpdateConfig(updated);
        setShowAssignConfirm(false);
        setPendingAssignEmail('');
      };

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

          {/* Assignee selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Assigner à
            </label>
            <div className="space-y-2">
              {/* Option: myself */}
              <button
                type="button"
                onClick={() => handleAssignModeChange('self')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  assignMode === 'self'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  assignMode === 'self'
                    ? 'bg-primary-100 dark:bg-primary-900/40'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <User className={`w-4 h-4 ${
                    assignMode === 'self'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${
                    assignMode === 'self'
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    Moi-même
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {currentUserEmail || 'Email non disponible'}
                  </p>
                </div>
                {assignMode === 'self' && (
                  <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400 ml-auto shrink-0" />
                )}
              </button>

              {/* Option: other person */}
              <button
                type="button"
                onClick={() => handleAssignModeChange('other')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  assignMode === 'other'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  assignMode === 'other'
                    ? 'bg-primary-100 dark:bg-primary-900/40'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <UserPlus className={`w-4 h-4 ${
                    assignMode === 'other'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${
                    assignMode === 'other'
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    Autre personne
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saisir un email
                  </p>
                </div>
                {assignMode === 'other' && config.assignTo && (
                  <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400 ml-auto shrink-0" />
                )}
              </button>

              {/* Option: no assignee */}
              <button
                type="button"
                onClick={() => handleAssignModeChange('none')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  assignMode === 'none'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  assignMode === 'none'
                    ? 'bg-primary-100 dark:bg-primary-900/40'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <X className={`w-4 h-4 ${
                    assignMode === 'none'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${
                    assignMode === 'none'
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    Non assignée
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    La tâche restera sans responsable
                  </p>
                </div>
                {assignMode === 'none' && (
                  <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400 ml-auto shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Email input for "other" mode */}
          {assignMode === 'other' && (
            <div className="space-y-3">
              <Input
                label="Email du destinataire"
                type="email"
                value={config.assignTo || ''}
                onChange={(e) => {
                  // Update config live for display, but require confirmation to finalize
                  const updated = { ...config, assignTo: e.target.value };
                  setConfig(updated);
                  onUpdateConfig(updated);
                }}
                placeholder="collaborateur@example.com"
              />

              {/* Confirmation prompt when email is entered */}
              {config.assignTo && config.assignTo.includes('@') && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingAssignEmail(config.assignTo);
                    setShowAssignConfirm(true);
                  }}
                  className="w-full p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Voir ce qui va se passer
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Cliquez pour voir les actions automatiques pour <strong>{config.assignTo}</strong>
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Summary badge */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {assignMode === 'self' && (
                <>La tâche sera créée dans Swigs Task et assignée à <strong>{currentUserEmail}</strong>.</>
              )}
              {assignMode === 'other' && config.assignTo && (
                <>La tâche sera créée et assignée à <strong>{config.assignTo}</strong>. Si ce compte n'existe pas, il sera créé automatiquement.</>
              )}
              {assignMode === 'other' && !config.assignTo && (
                <>Saisissez l'email de la personne à qui assigner la tâche.</>
              )}
              {assignMode === 'none' && (
                <>La tâche sera créée sans assignation dans le workspace Automations.</>
              )}
            </p>
          </div>

          {/* Confirmation modal for external email */}
          <Modal
            isOpen={showAssignConfirm}
            onClose={() => setShowAssignConfirm(false)}
            title="Confirmation d'assignation"
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <UserPlus className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {pendingAssignEmail}
                  </p>
                  <p className="text-xs text-slate-500">Sera le responsable de la tâche</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Voici ce qui se passera quand l'automation se déclenchera :
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">1</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Une tâche sera créée dans le workspace <strong>Automations</strong> de Swigs Task
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">2</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Si <strong>{pendingAssignEmail}</strong> n'a pas de compte Swigs Task, un compte sera <strong>créé automatiquement</strong>
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">3</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      La personne sera ajoutée au workspace et la tâche lui sera assignée
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Vérifiez que l'adresse email est correcte. Un compte sera créé à chaque déclenchement si l'utilisateur n'existe pas encore.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowAssignConfirm(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={handleOtherEmailConfirm}
                  className="flex-1"
                  icon={CheckCircle}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </Modal>
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
      const RECORD_FIELDS = {
        project: [
          { value: 'status', label: 'Statut' },
          { value: 'description', label: 'Description' },
          { value: 'notes', label: 'Notes' }
        ],
        invoice: [
          { value: 'status', label: 'Statut' },
          { value: 'notes', label: 'Notes' }
        ],
        quote: [
          { value: 'status', label: 'Statut' },
          { value: 'notes', label: 'Notes' }
        ]
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type d'enregistrement
            </label>
            <select
              value={config.recordType || ''}
              onChange={(e) => {
                const updated = { ...config, recordType: e.target.value, recordField: '', recordValue: '' };
                setConfig(updated);
                onUpdateConfig(updated);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Sélectionner</option>
              <option value="project">Projet</option>
              <option value="invoice">Facture</option>
              <option value="quote">Devis</option>
            </select>
          </div>

          {config.recordType && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Champ à modifier
              </label>
              <select
                value={config.recordField || ''}
                onChange={(e) => handleConfigChange('recordField', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Sélectionner</option>
                {(RECORD_FIELDS[config.recordType] || []).map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          )}

          {config.recordField && (
            <Input
              label="Nouvelle valeur"
              value={config.recordValue || ''}
              onChange={(e) => handleConfigChange('recordValue', e.target.value)}
              placeholder="Ex: terminé ou {{project.status}}"
            />
          )}

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Utilisez <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{variable}}'}</code> pour référencer des données du contexte.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <p className="text-sm text-slate-500">Configuration non disponible pour ce type d'action.</p>
      </div>
    );
  };

  const renderConditionConfig = () => {
    const needsValue = config.operator && config.operator !== 'is_empty' && config.operator !== 'is_not_empty';
    return (
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
            <optgroup label="Projet">
              <option value="projectName">Nom du projet</option>
              <option value="oldStatus">Ancien statut</option>
              <option value="newStatus">Nouveau statut</option>
            </optgroup>
            <optgroup label="Facture">
              <option value="invoiceNumber">Numéro</option>
              <option value="total">Montant total</option>
              <option value="status">Statut</option>
              <option value="daysOverdue">Jours de retard</option>
            </optgroup>
            <optgroup label="Devis">
              <option value="quoteNumber">Numéro</option>
              <option value="total">Montant total</option>
              <option value="status">Statut</option>
            </optgroup>
            <optgroup label="Client">
              <option value="clientName">Nom</option>
              <option value="email">Email</option>
              <option value="company">Entreprise</option>
              <option value="client.name">Nom (imbriqué)</option>
              <option value="client.email">Email (imbriqué)</option>
              <option value="client.company">Entreprise (imbriqué)</option>
              <option value="client.country">Pays</option>
            </optgroup>
            <optgroup label="Événement">
              <option value="eventType">Type</option>
              <option value="description">Description</option>
              <option value="amount">Montant</option>
            </optgroup>
            <optgroup label="Rappel">
              <option value="reminderType">Type de rappel</option>
              <option value="daysOverdue">Jours de retard</option>
              <option value="total">Montant</option>
            </optgroup>
            <optgroup label="Commande (CMS)">
              <option value="order.total">Total commande</option>
              <option value="order.status">Statut commande</option>
              <option value="order.itemsCount">Nombre d'articles</option>
            </optgroup>
            <optgroup label="Client (CMS)">
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
            <option value="is_empty">Est vide</option>
            <option value="is_not_empty">N'est pas vide</option>
          </select>
        </div>

        {needsValue && (
          <Input
            label="Valeur"
            value={config.value || ''}
            onChange={(e) => handleConfigChange('value', e.target.value)}
            placeholder="Valeur à comparer"
          />
        )}
      </div>
    );
  };

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
