# Prompt Redesign Page Paramètres — SWIGS Workflow

Tu es un développeur frontend senior chargé de **refondre complètement la page Paramètres** de swigs-workflow. Le but est de passer d'un composant monolithique de 1297 lignes avec 10 tabs horizontaux à une architecture propre avec sidebar de navigation par catégories.

---

## CONTEXTE

### L'application
**swigs-workflow** est un outil de gestion de projets et facturation pour freelances/PME suisses. Il est **déjà en production et utilisé quotidiennement** — toute modification doit être **non-breaking** et garder **exactement les mêmes fonctionnalités**.

- **URL** : https://workflow.swigs.online
- **Serveur** : 192.168.110.59 (SSH: `ssh swigs@192.168.110.59`)
- **Port** : 3003
- **PM2** : `swigs-workflow` (2 instances cluster)

### Stack technique
- **Frontend** : React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5, React Router 7
- **UI Components** : `components/ui/Button.jsx`, `Input.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`, `Badge.jsx`, `Toast.jsx`
- **Icons** : lucide-react
- **Drag & Drop** : @dnd-kit (pour les statuts)
- **Dark mode** : Supporté partout (classes `dark:`)

### Fichiers actuels à refondre

```
frontend/src/
├── pages/
│   └── Settings.jsx                           # 1297 LIGNES — LE PROBLÈME
└── components/
    └── Settings/
        ├── PersonnalisationTab.jsx            # 184 lignes — BIEN (garder le pattern)
        ├── ServicesTab.jsx                    # 415 lignes — BIEN (garder le pattern)
        └── EmailTemplatesTab.jsx              # 328 lignes — BIEN (garder le pattern)
```

### Problèmes actuels à corriger

1. **Composant monolithique** : 1297 lignes, 7 tabs inline sur 10 au total
2. **10 tabs horizontaux** qui overflow → illisible, pas scalable
3. **Incohérence de sauvegarde** :
   - `Entreprise` : appel API à CHAQUE frappe de clavier (`handleUpdateSettings` dans `onChange`) — désastreux
   - `Facturation` : même problème (API call par keystroke)
   - `CMS`, `AbaNinja`, `Relances` : local state + bouton "Sauvegarder" — correct
   - `Emails legacy` : local state + bouton conditionnel — correct
4. **State management chaotique** : 15+ useState dans le composant parent
5. **Duplicate email systems** : Legacy templates (dans Settings.emailTemplates) + Advanced templates (EmailTemplatesTab avec modèle EmailTemplate séparé)
6. **Aucune validation de formulaire**
7. **Pas de feedback visuel** pendant la sauvegarde sur les tabs Company/Invoicing

---

## OBJECTIF : NOUVELLE ARCHITECTURE

### Layout cible

```
┌─────────────────────────────────────────────────────────────────────┐
│  Swigs Workflow    Workflow  Planning  Analytics  Automations  ⚙    │
├──────────────────┬──────────────────────────────────────────────────┤
│                  │                                                  │
│  Paramètres      │   Entreprise                                    │
│                  │                                                  │
│  ─── Général     │   Informations qui apparaissent sur vos         │
│  ● Entreprise    │   devis et factures.                            │
│    Facturation   │                                                  │
│    Personnalisation│  ┌─────────────────┬─────────────────┐        │
│                  │   │ Nom entreprise   │ Email            │        │
│  ─── Données     │   │ [SWIGS         ] │ [info@swigs.ch ] │        │
│    Clients       │   ├─────────────────┼─────────────────┤        │
│    Services      │   │ Téléphone       │ SIRET            │        │
│    Statuts       │   │ [+41...       ] │ [CHE-...       ] │        │
│                  │   ├─────────────────┼─────────────────┤        │
│  ─── Communication│  │ N° TVA          │ Adresse          │        │
│    SMTP          │   │ [CHE-...      ] │ [Rue...        ] │        │
│    Templates     │   ├─────────────────┼─────────────────┤        │
│    Relances      │   │ IBAN            │ QR-IBAN          │        │
│                  │   │ [CHxx...      ] │ [CHxx...       ] │        │
│  ─── Intégrations│   └─────────────────┴─────────────────┘        │
│    AbaNinja      │                                                  │
│    CMS           │                        [Sauvegarder]            │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

### Sidebar de navigation

**Catégories et items** :

```javascript
const settingsNav = [
  {
    category: 'Général',
    items: [
      { id: 'company', label: 'Entreprise', icon: Building2 },
      { id: 'invoicing', label: 'Facturation', icon: Receipt },
      { id: 'personalization', label: 'Personnalisation', icon: Palette },
    ]
  },
  {
    category: 'Données',
    items: [
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'services', label: 'Services', icon: Package },
      { id: 'statuses', label: 'Statuts', icon: Tag },
    ]
  },
  {
    category: 'Communication',
    items: [
      { id: 'smtp', label: 'SMTP', icon: Server },
      { id: 'emails', label: 'Templates email', icon: Mail },
      { id: 'reminders', label: 'Relances', icon: Bell },
    ]
  },
  {
    category: 'Intégrations',
    items: [
      { id: 'abaninja', label: 'AbaNinja', icon: Link2 },
      { id: 'cms', label: 'CMS E-commerce', icon: Link2 },
    ]
  }
];
```

### Architecture fichiers cible

```
frontend/src/
├── pages/
│   └── Settings.jsx                           # ~80 lignes (layout + router)
└── components/
    └── Settings/
        ├── SettingsLayout.jsx                 # Sidebar + content area (~100 lignes)
        ├── SettingsNav.jsx                    # Navigation sidebar (~80 lignes)
        │
        │── sections/                          # Chaque section = 1 composant autonome
        │   ├── CompanySection.jsx             # Infos entreprise + IBAN (~120 lignes)
        │   ├── InvoicingSection.jsx           # TVA, taux, délais (~80 lignes)
        │   ├── SmtpSection.jsx                # Config SMTP (NOUVEAU, extrait de Emails) (~100 lignes)
        │   ├── ClientsSection.jsx             # CRUD clients (~200 lignes)
        │   ├── StatusesSection.jsx            # CRUD + drag & drop statuts (~180 lignes)
        │   ├── CmsSection.jsx                 # Intégration CMS (~120 lignes)
        │   ├── RemindersSection.jsx           # Relances automatiques (~150 lignes)
        │   └── AbaNinjaSection.jsx            # Intégration AbaNinja (~150 lignes)
        │
        ├── PersonnalisationTab.jsx            # GARDER TEL QUEL (184 lignes)
        ├── ServicesTab.jsx                    # GARDER TEL QUEL (415 lignes)
        └── EmailTemplatesTab.jsx              # GARDER TEL QUEL (328 lignes)
```

---

## RÈGLES D'IMPLÉMENTATION

### 1. Pattern de section standard

Chaque section doit suivre ce pattern :

```jsx
// CompanySection.jsx
import { useState, useEffect } from 'react';
import { Building2, Save } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input from '../../ui/Input';

export default function CompanySection({ settings, onSettingsUpdate }) {
  const { addToast } = useToastStore();
  const [formData, setFormData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Init form data from settings
  useEffect(() => {
    if (settings?.company) {
      setFormData({ ...settings.company });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ company: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Informations entreprise enregistrées' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Entreprise</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ces informations apparaîtront sur vos devis et factures.
        </p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <div className="grid grid-cols-2 gap-4">
          {/* ... inputs ... */}
        </div>

        {/* Save button - TOUJOURS en bas, visible seulement si changements */}
        {hasChanges && (
          <div className="pt-4 mt-6 border-t border-slate-200 dark:border-dark-border flex justify-end">
            <Button onClick={handleSave} icon={Save} loading={saving}>
              Sauvegarder
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2. Règles strictes

1. **CHAQUE section a un bouton "Sauvegarder"** — JAMAIS d'auto-save sur keystroke
2. **Local state** dans chaque section — pas de state remonté au parent
3. **`settings` et `onSettingsUpdate`** passés en props depuis le layout
4. **Dark mode** : Toujours inclure les classes `dark:` correspondantes
5. **Composants UI** : Utiliser les composants existants (`Button`, `Input`, `Textarea`, `Modal`, `ConfirmDialog`)
6. **Style** : Garder exactement le même style Tailwind que l'existant (rounded-xl, border-slate-200, etc.)
7. **Fonctionnalités** : 100% des fonctionnalités actuelles doivent être conservées
8. **Pas de nouvelles dépendances npm**

### 3. SMTP — Extraction nécessaire

Actuellement, il n'y a **pas de section SMTP visible dans l'UI**. La config SMTP est dans le modèle Settings mais il n'y a aucun formulaire pour la configurer !

→ Créer `SmtpSection.jsx` avec les champs : host, port (select: 587/465/25), secure (toggle), user, pass (password field), + bouton "Tester l'envoi" qui envoie un email de test à l'adresse de l'entreprise.

Le backend accepte déjà ces champs via `PUT /api/settings` avec `{ smtp: { host, port, secure, user, pass } }`.

### 4. Sidebar responsive

- **Desktop** (≥1024px) : Sidebar fixe à gauche (w-64), contenu à droite
- **Mobile** (<1024px) : Sidebar en haut comme un menu déroulant ou en mode "select" déroulant, puis contenu en dessous
- Pattern recommandé : utiliser un `<select>` sur mobile pour la navigation

### 5. URL routing (optionnel mais recommandé)

Si possible, utiliser des query params pour la section active :
- `/settings?section=company`
- `/settings?section=clients`
- etc.

Cela permet de partager un lien direct vers une section et de garder la section active au refresh.

### 6. Animations de transition

Ajouter une animation subtile lors du changement de section :
- Fade in du contenu (`opacity 0 → 1`, durée 150ms)
- Pas de transition complexe, rester sobre

---

## ÉTAT ACTUEL DÉTAILLÉ DE CHAQUE TAB

### Tab "Clients" (inline, ~130 lignes de JSX)
- Liste de clients avec cards
- Bouton "+ Nouveau client" → formulaire inline
- Édition inline par client (toggle)
- Suppression avec `confirm()`
- Champs : name*, email, phone, company, address
- API : `clientsApi.getAll()`, `.create()`, `.update()`, `.delete()`

### Tab "Services" (composant séparé, 415 lignes)
- **GARDER TEL QUEL** — `ServicesTab.jsx` est déjà propre
- Juste changer l'import et l'endroit d'affichage

### Tab "Statuts" (inline, ~70 lignes de JSX)
- Liste de statuts avec drag & drop (@dnd-kit)
- Suppression avec `confirm()`
- Formulaire d'ajout : nom + sélecteur couleur (palette de 20 couleurs)
- API : via `useProjectStore` → `fetchStatuses()`, `createStatus()`, `deleteStatus()`
- API : `statusesApi.reorder()`
- Composant helper : `SortableStatusItem` (dans Settings.jsx, ~45 lignes) → à déplacer dans `StatusesSection.jsx`

### Tab "Personnalisation" (composant séparé, 184 lignes)
- **GARDER TEL QUEL** — `PersonnalisationTab.jsx`
- Utilise le settingsStore Zustand (localStorage seulement)

### Tab "Entreprise" (inline, ~55 lignes de JSX)
- Grille 2 colonnes de champs
- Champs : name, email, phone, siret, vatNumber, address, iban, qrIban
- **BUG** : `handleUpdateSettings` appelé dans `onChange` → API call par keystroke
- → Corriger en utilisant le pattern local state + bouton "Sauvegarder"

### Tab "Facturation" (inline, ~35 lignes de JSX)
- Champs : defaultHourlyRate, defaultVatRate, defaultPaymentTerms
- **BUG** : Même problème d'API call par keystroke
- → Corriger

### Tab "Emails" (hybride, ~80 lignes de JSX + EmailTemplatesTab composant)
- EmailTemplatesTab (composant séparé, 328 lignes) — GARDER
- Section "Templates email simples (legacy)" — inline
  - 2 sous-sections : template devis + template facture
  - Champs : quoteSubject, quoteBody, invoiceSubject, invoiceBody
  - Local state + bouton "Sauvegarder" conditionnel
  - Info box en bas
- → Garder EmailTemplatesTab comme section "Templates"
- → Déplacer les templates legacy dans la même section (ou les supprimer si l'utilisateur confirme)

### Tab "CMS" (inline, ~130 lignes de JSX)
- Toggle enabled
- Champs : apiUrl, serviceToken (password), pollInterval (select)
- Bouton "Tester la connexion" avec feedback
- Local state + bouton "Sauvegarder"
- Info box + dernier polling

### Tab "Relances" (inline, ~75 lignes de JSX)
- Toggle enabled
- Liste de règles (schedule[])
- Édition via modal custom (inline div, pas le composant Modal)
- Champs par règle : days, subject, body
- Local state + bouton "Sauvegarder"
- Info box

### Tab "AbaNinja" (inline, ~130 lignes de JSX)
- Toggle enabled
- Champ : apiKey (password)
- 4 checkboxes : autoSync, syncInvoices, syncQuotes, syncClients
- Boutons : "Tester la connexion", "Synchronisation complète"
- Feedback test
- Local state + bouton "Sauvegarder"
- Dernière sync

---

## API BACKEND (ne PAS modifier)

```javascript
// Settings API - Déjà fonctionnel
GET  /api/settings                    → { data: Settings }
PUT  /api/settings { company, invoicing, emailTemplates, smtp, cmsIntegration, reminders, abaninja }
GET  /api/settings/stats              → Stats dashboard

// Clients API
GET    /api/clients                   → { data: Client[] }
POST   /api/clients                   → { data: Client }
PUT    /api/clients/:id               → { data: Client }
DELETE /api/clients/:id

// Statuses - via projectStore
GET    /api/statuses                  → { data: Status[] }
POST   /api/statuses                  → { data: Status }
DELETE /api/statuses/:id
PUT    /api/statuses/reorder          → body: { orderedIds: string[] }

// Services
GET    /api/services                  → { data: Service[] }
POST   /api/services                  → { data: Service }
PUT    /api/services/:id              → { data: Service }
DELETE /api/services/:id
PUT    /api/services/reorder          → body: { orderedIds: string[] }
PATCH  /api/services/:id/toggle       → toggle active

// Email Templates
GET    /api/email-templates           → { data: EmailTemplate[] }
POST   /api/email-templates           → { data: EmailTemplate }
PUT    /api/email-templates/:id       → { data: EmailTemplate }
DELETE /api/email-templates/:id
POST   /api/email-templates/:id/preview
POST   /api/email-templates/:id/send-test
GET    /api/email-templates/variables/:category
POST   /api/email-templates/create-defaults
```

---

## PLAN D'IMPLÉMENTATION

### Phase 1 : Créer la structure (Settings.jsx + SettingsLayout + SettingsNav)

1. **Créer `SettingsNav.jsx`** — Sidebar avec catégories et items actifs
2. **Créer `SettingsLayout.jsx`** — Layout sidebar + content avec responsive
3. **Refactorer `Settings.jsx`** — Devenir un simple wrapper qui :
   - Charge les settings une fois
   - Route vers la bonne section selon l'état
   - Passe `settings` et `onSettingsUpdate` aux sections

### Phase 2 : Extraire les sections inline

4. **Créer `sections/CompanySection.jsx`** — Extraire de Settings.jsx + corriger le bug API/keystroke
5. **Créer `sections/InvoicingSection.jsx`** — Extraire + corriger bug
6. **Créer `sections/ClientsSection.jsx`** — Extraire (clients state + CRUD)
7. **Créer `sections/StatusesSection.jsx`** — Extraire (avec SortableStatusItem + dnd-kit)
8. **Créer `sections/SmtpSection.jsx`** — NOUVEAU (config SMTP manquante dans l'UI)
9. **Créer `sections/CmsSection.jsx`** — Extraire
10. **Créer `sections/RemindersSection.jsx`** — Extraire (avec modal édition règle)
11. **Créer `sections/AbaNinjaSection.jsx`** — Extraire

### Phase 3 : Intégrer les sections existantes

12. Déplacer `PersonnalisationTab.jsx` pour qu'il s'intègre dans le nouveau layout
13. Déplacer `ServicesTab.jsx` pour qu'il s'intègre
14. Déplacer `EmailTemplatesTab.jsx` pour qu'il s'intègre (avec les templates legacy fusionnés)

### Phase 4 : Polish

15. Responsive mobile (select navigation en <1024px)
16. Animation de transition entre sections
17. Tester toutes les fonctionnalités (CRUD clients, statuts, services, save company, etc.)

---

## STYLE GUIDE

### Couleurs et classes Tailwind existantes
```
Fond page :        bg-slate-50 dark:bg-dark-bg
Fond carte :       bg-white dark:bg-dark-card
Bordure :          border-slate-200 dark:border-dark-border
Texte principal :  text-slate-900 dark:text-white
Texte secondaire : text-slate-500 dark:text-slate-400
Texte label :      text-slate-700 dark:text-slate-300
Hover fond :       hover:bg-slate-100 dark:hover:bg-dark-hover
Accent :           text-primary-600, bg-primary-600
Danger :           text-red-500, bg-red-50 dark:bg-red-900/20
Success :          text-emerald-600
Rounded :          rounded-xl (cartes), rounded-lg (inputs, badges)
```

### Sidebar active item
```jsx
// Item actif
<button className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 w-full text-left">
  <Icon className="w-4 h-4" />
  Label
</button>

// Item inactif
<button className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover w-full text-left transition-colors">
  <Icon className="w-4 h-4" />
  Label
</button>

// Catégorie header
<div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
  Général
</div>
```

---

## CONTRAINTES ABSOLUES

1. **ZERO breaking change** — toutes les fonctionnalités existantes doivent continuer de marcher
2. **Pas de modification backend** — le backend ne change pas
3. **Pas de nouvelles dépendances npm** — utiliser uniquement ce qui est déjà installé
4. **Dark mode** — chaque élément doit avoir ses classes `dark:`
5. **Même composants UI** — réutiliser Button, Input, Textarea, Modal, ConfirmDialog existants
6. **Garder le style existant** — ne pas changer les couleurs, les arrondis, les espacements
7. **Les 3 composants existants** (PersonnalisationTab, ServicesTab, EmailTemplatesTab) ne doivent PAS être réécrits — juste intégrés dans le nouveau layout

---

## DÉPLOIEMENT

```bash
# Build frontend
cd frontend && npm run build

# Deploy
rsync -avz --delete frontend/dist/ swigs@192.168.110.59:/home/swigs/swigs-workflow/frontend/dist/
```

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **Chrome DevTools MCP** : Seul le thread principal peut l'utiliser, pas les subagents
- **L'utilisateur parle français** — communiquer en français
- **Pas besoin de phases de validation** pour ce prompt — l'objectif est clair, implémente directement
- **Tester visuellement** après implémentation via Chrome DevTools MCP (naviguer vers https://workflow.swigs.online/settings)
- **Ne PAS supprimer les templates legacy** — les garder dans la section Emails pour le moment
- **La route React Router** pour Settings est déjà `/settings` — ne pas changer
