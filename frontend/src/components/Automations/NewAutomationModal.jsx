import { useState } from 'react';
import {
  ShoppingCart, CreditCard, Package, CheckCircle,
  UserPlus, FileText, Receipt, PenTool, Clock, Hand, AlertCircle
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAutomationStore } from '../../stores/automationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';

// CMS trigger types that require CMS connection
const CMS_TRIGGERS = ['order.created', 'order.paid', 'order.shipped', 'order.delivered', 'customer.created', 'customer.updated'];

const TRIGGER_OPTIONS = [
  {
    category: 'E-commerce (CMS)',
    requiresCms: true,
    triggers: [
      { type: 'order.created', label: 'Nouvelle commande', icon: ShoppingCart, description: 'Quand une commande est créée' },
      { type: 'order.paid', label: 'Commande payée', icon: CreditCard, description: 'Quand le paiement est confirmé' },
      { type: 'order.shipped', label: 'Commande expédiée', icon: Package, description: 'Quand la commande est envoyée' },
      { type: 'order.delivered', label: 'Commande livrée', icon: CheckCircle, description: 'Quand la commande est livrée' },
      { type: 'customer.created', label: 'Nouveau client', icon: UserPlus, description: 'Quand un client s\'inscrit' }
    ]
  },
  {
    category: 'Workflow',
    triggers: [
      { type: 'invoice.created', label: 'Facture créée', icon: FileText, description: 'Quand une facture est créée' },
      { type: 'invoice.paid', label: 'Facture payée', icon: Receipt, description: 'Quand une facture est payée' },
      { type: 'quote.signed', label: 'Devis signé', icon: PenTool, description: 'Quand un devis est signé' }
    ]
  },
  {
    category: 'Autres',
    triggers: [
      { type: 'time.schedule', label: 'Planifié', icon: Clock, description: 'Exécuter à une heure précise (cron)' },
      { type: 'manual', label: 'Manuel', icon: Hand, description: 'Déclencher manuellement' }
    ]
  }
];

export default function NewAutomationModal({ isOpen, onClose, onCreated }) {
  const { createAutomation } = useAutomationStore();
  const { settings } = useSettingsStore();
  const { addToast } = useToastStore();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check if CMS is connected
  const isCmsConnected = Boolean(
    settings?.cmsIntegration?.enabled &&
    settings?.cmsIntegration?.apiUrl &&
    settings?.cmsIntegration?.serviceToken
  );

  // Check if a trigger requires CMS and is disabled
  const isTriggerDisabled = (triggerType) => {
    return CMS_TRIGGERS.includes(triggerType) && !isCmsConnected;
  };

  const handleCreate = async () => {
    if (!name.trim() || !selectedTrigger) return;

    setLoading(true);
    try {
      // Create with a basic trigger node (centered on 15px grid)
      const automation = await createAutomation({
        name: name.trim(),
        description: description.trim(),
        triggerType: selectedTrigger.type,
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            label: selectedTrigger.label,
            position: { x: 450, y: 150 }, // Better centered position
            connections: []
          }
        ]
      });

      resetForm();
      onCreated(automation);
    } catch (error) {
      console.error('Create error:', error);
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de la création de l\'automation' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSelectedTrigger(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Choisir un déclencheur' : 'Nommer l\'automation'}
      size="lg"
    >
      <div className="flex flex-col -m-6">
        {step === 1 ? (
          <>
            {/* Trigger selection */}
            <div className="px-6 pt-6 pb-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Qu'est-ce qui doit déclencher cette automation ?
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3 max-h-[50vh] space-y-6">
              {TRIGGER_OPTIONS.map((category) => (
                <div key={category.category}>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {category.category}
                    </h4>
                    {category.requiresCms && !isCmsConnected && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        CMS non connecté
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {category.triggers.map((trigger) => {
                      const Icon = trigger.icon;
                      const isSelected = selectedTrigger?.type === trigger.type;
                      const isDisabled = isTriggerDisabled(trigger.type);

                      return (
                        <button
                          key={trigger.type}
                          onClick={() => !isDisabled && setSelectedTrigger(trigger)}
                          disabled={isDisabled}
                          className={`
                            w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all
                            ${isDisabled
                              ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/20 border-2 border-transparent'
                              : isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                                : 'bg-slate-50/80 dark:bg-slate-800/30 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
                            }
                          `}
                        >
                          <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center
                            ${isDisabled
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                              : isSelected
                                ? 'bg-primary-500 text-white'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }
                          `}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${isDisabled ? 'text-slate-400 dark:text-slate-500' : isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'}`}>
                              {trigger.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {isDisabled ? 'Connectez le CMS dans les paramètres' : trigger.description}
                            </p>
                          </div>
                          {isDisabled && (
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50">
              <Button variant="secondary" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedTrigger}
              >
                Continuer
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Name and description */}
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  {selectedTrigger && <selectedTrigger.icon className="w-5 h-5 text-primary-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {selectedTrigger?.label}
                  </p>
                  <p className="text-xs text-slate-500">{selectedTrigger?.description}</p>
                </div>
              </div>

              <Input
                label="Nom de l'automation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Email de confirmation commande"
                autoFocus
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez ce que fait cette automation..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Retour
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleClose}>
                  Annuler
                </Button>
                <Button
                  onClick={handleCreate}
                  loading={loading}
                  disabled={!name.trim()}
                >
                  Créer
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
