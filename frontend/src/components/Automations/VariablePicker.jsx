import { useState, useRef } from 'react';
import { Braces, Copy, Check, Search, X } from 'lucide-react';
import Modal from '../ui/Modal';

/**
 * Variables disponibles par type de trigger.
 * Chaque groupe contient des variables avec leur path (dot notation) et label FR.
 */
const TRIGGER_VARIABLES = {
  // --- Projet ---
  'project.created': [
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
      { path: 'projectId', label: 'ID du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
      { path: 'client.phone', label: 'Téléphone' },
      { path: 'client.company', label: 'Entreprise' },
      { path: 'client.street', label: 'Rue' },
      { path: 'client.zip', label: 'Code postal' },
      { path: 'client.city', label: 'Ville' },
      { path: 'client.country', label: 'Pays' },
    ]},
  ],
  'project.status_changed': [
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
      { path: 'projectId', label: 'ID du projet' },
      { path: 'oldStatus', label: 'Ancien statut' },
      { path: 'newStatus', label: 'Nouveau statut' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
      { path: 'client.company', label: 'Entreprise' },
    ]},
  ],
  'project.archived': [
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
      { path: 'projectId', label: 'ID du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
      { path: 'client.company', label: 'Entreprise' },
    ]},
  ],

  // --- Facture ---
  'invoice.created': [
    { group: 'Facture', vars: [
      { path: 'invoiceNumber', label: 'Numéro de facture' },
      { path: 'invoiceId', label: 'ID de la facture' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
      { path: 'projectId', label: 'ID du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
      { path: 'client.company', label: 'Entreprise' },
    ]},
  ],
  'invoice.sent': [
    { group: 'Facture', vars: [
      { path: 'invoiceNumber', label: 'Numéro de facture' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],
  'invoice.paid': [
    { group: 'Facture', vars: [
      { path: 'invoiceNumber', label: 'Numéro de facture' },
      { path: 'total', label: 'Montant total (CHF)' },
      { path: 'paidAt', label: 'Date de paiement' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],

  // --- Devis ---
  'quote.created': [
    { group: 'Devis', vars: [
      { path: 'quoteNumber', label: 'Numéro du devis' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],
  'quote.sent': [
    { group: 'Devis', vars: [
      { path: 'quoteNumber', label: 'Numéro du devis' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],
  'quote.signed': [
    { group: 'Devis', vars: [
      { path: 'quoteNumber', label: 'Numéro du devis' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],

  // --- Client ---
  'client.created': [
    { group: 'Client', vars: [
      { path: 'clientName', label: 'Nom du client' },
      { path: 'email', label: 'Email' },
      { path: 'company', label: 'Entreprise' },
      { path: 'clientId', label: 'ID du client' },
    ]},
  ],
  'client.updated': [
    { group: 'Client', vars: [
      { path: 'clientName', label: 'Nom du client' },
      { path: 'email', label: 'Email' },
      { path: 'changedFields', label: 'Champs modifiés' },
      { path: 'clientId', label: 'ID du client' },
    ]},
  ],

  // --- Événement ---
  'event.created': [
    { group: 'Événement', vars: [
      { path: 'eventType', label: 'Type (hours/expense)' },
      { path: 'description', label: 'Description' },
      { path: 'amount', label: 'Montant' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
      { path: 'projectId', label: 'ID du projet' },
    ]},
  ],

  // --- Rappel ---
  'reminder.sent': [
    { group: 'Rappel', vars: [
      { path: 'reminderType', label: 'Type (first/second/final)' },
      { path: 'daysOverdue', label: 'Jours de retard' },
    ]},
    { group: 'Facture', vars: [
      { path: 'invoiceNumber', label: 'Numéro de facture' },
      { path: 'total', label: 'Montant total (CHF)' },
    ]},
    { group: 'Projet', vars: [
      { path: 'projectName', label: 'Nom du projet' },
    ]},
    { group: 'Client', vars: [
      { path: 'client.name', label: 'Nom du client' },
      { path: 'client.email', label: 'Email' },
    ]},
  ],

  // --- CMS ---
  'order.created': [
    { group: 'Commande', vars: [
      { path: 'orderNumber', label: 'Numéro de commande' },
      { path: 'total', label: 'Montant total' },
      { path: 'currency', label: 'Devise' },
      { path: 'status', label: 'Statut' },
    ]},
    { group: 'Client (CMS)', vars: [
      { path: 'customer.email', label: 'Email' },
      { path: 'customer.firstName', label: 'Prénom' },
      { path: 'customer.lastName', label: 'Nom' },
      { path: 'customer.phone', label: 'Téléphone' },
    ]},
  ],
};

// Aliases pour triggers CMS similaires
TRIGGER_VARIABLES['order.paid'] = TRIGGER_VARIABLES['order.created'];
TRIGGER_VARIABLES['order.shipped'] = TRIGGER_VARIABLES['order.created'];
TRIGGER_VARIABLES['order.delivered'] = TRIGGER_VARIABLES['order.created'];
TRIGGER_VARIABLES['customer.created'] = [
  { group: 'Client (CMS)', vars: [
    { path: 'email', label: 'Email' },
    { path: 'firstName', label: 'Prénom' },
    { path: 'lastName', label: 'Nom' },
    { path: 'customerId', label: 'ID client' },
  ]},
];
TRIGGER_VARIABLES['customer.updated'] = [
  { group: 'Client (CMS)', vars: [
    { path: 'email', label: 'Email' },
    { path: 'changedFields', label: 'Champs modifiés' },
    { path: 'customerId', label: 'ID client' },
  ]},
];

/**
 * VariablePicker — Bouton + modal pour insérer des variables {{path}} dans un champ.
 *
 * Props:
 *  - triggerType: string — le triggerType de l'automation
 *  - onInsert: (variableTag: string) => void — appelé avec "{{path}}" à insérer
 *  - className: string — classes supplémentaires sur le bouton
 */
export default function VariablePicker({ triggerType, onInsert, className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);

  const groups = TRIGGER_VARIABLES[triggerType] || [];

  // Flat search filter
  const filteredGroups = groups
    .map(g => ({
      ...g,
      vars: g.vars.filter(v =>
        !search ||
        v.label.toLowerCase().includes(search.toLowerCase()) ||
        v.path.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(g => g.vars.length > 0);

  const handleSelect = (path) => {
    const tag = `{{${path}}}`;
    onInsert(tag);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  if (groups.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-700 transition-colors ${className}`}
        title="Insérer une variable"
      >
        <Braces className="w-3.5 h-3.5" />
        Variables
      </button>

      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); setSearch(''); }}
        title="Variables disponibles"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cliquez sur une variable pour l'insérer dans le champ actif.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Variable list */}
          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-3">
            {filteredGroups.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Aucune variable trouvée</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.group}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-1">
                  {group.group}
                </p>
                <div className="space-y-1">
                  {group.vars.map((v) => (
                    <button
                      key={v.path}
                      type="button"
                      onClick={() => handleSelect(v.path)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {v.label}
                        </p>
                        <code className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          {`{{${v.path}}}`}
                        </code>
                      </div>
                      {copiedPath === v.path ? (
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
