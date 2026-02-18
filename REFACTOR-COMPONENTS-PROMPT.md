# Prompt Refactoring Composants & Améliorations UX — SWIGS Workflow

Tu es un développeur frontend senior chargé de **refactorer les gros composants** et d'**améliorer l'UX générale** de swigs-workflow. L'objectif est d'améliorer la maintenabilité et l'expérience utilisateur sans changer les fonctionnalités.

---

## CONTEXTE

### L'application
**swigs-workflow** est un outil de gestion de projets et facturation pour freelances/PME suisses. Il est **déjà en production et utilisé quotidiennement**.

- **URL** : https://workflow.swigs.online
- **Serveur** : 192.168.110.59 (SSH: `ssh swigs@192.168.110.59`)
- **Port** : 3003
- **PM2** : `swigs-workflow` (2 instances cluster)

### Stack technique
- **Frontend** : React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5, React Router 7
- **UI Components** : `components/ui/Button.jsx`, `Input.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`, `Badge.jsx`, `Toast.jsx`
- **Icons** : lucide-react
- **Drag & Drop** : @dnd-kit
- **Charts** : Recharts
- **Automation builder** : @xyflow/react
- **Animations** : framer-motion
- **Dark mode** : Supporté partout (classes `dark:`)

### Architecture frontend
```
frontend/src/
├── pages/
│   ├── Workflow.jsx              # Kanban board
│   ├── Planning.jsx              # Calendrier
│   ├── Analytics.jsx             # Dashboard KPIs
│   ├── Automations.jsx           # Visual workflow builder
│   ├── Settings.jsx              # Paramètres (1297 lignes — redesign séparé)
│   └── PortalView.jsx            # Vue publique portal client
├── components/
│   ├── Workflow/
│   │   ├── StatusFilter.jsx      # Filtres statuts
│   │   ├── WorkflowGrid.jsx      # Grille kanban
│   │   ├── ProjectCard.jsx       # Carte projet
│   │   └── NewProjectModal.jsx   # Modal nouveau projet
│   ├── Sidebar/
│   │   ├── ProjectSidebar.jsx    # Panel latéral détails projet
│   │   ├── InfoTab.jsx           # Infos projet
│   │   ├── EventsTab.jsx         # Heures/dépenses
│   │   ├── DocumentsTab.jsx      # Factures + Devis (604 LIGNES)
│   │   ├── HistoryTab.jsx        # Historique
│   │   ├── NewInvoiceModal.jsx   # Modal facture (843 LIGNES !)
│   │   ├── NewQuoteModal.jsx     # Modal devis
│   │   └── NewCustomInvoiceModal.jsx  # Modal facture custom
│   ├── Planning/
│   │   ├── CalendarGrid.jsx      # Grille calendrier (476 DOM elements)
│   │   ├── PlannedBlockCard.jsx  # Bloc planifié
│   │   ├── ProjectTierList.jsx   # Liste projets pour planning
│   │   ├── BlockDetailModal.jsx  # Détail bloc
│   │   └── DeleteBlockModal.jsx  # Confirmation suppression
│   ├── Analytics/
│   │   ├── KPICard.jsx           # Carte KPI
│   │   ├── MonthlyChart.jsx      # Graphique mensuel
│   │   ├── HoursChart.jsx        # Graphique heures
│   │   ├── ProjectStatusChart.jsx # Statut projets
│   │   ├── QuotePipelineChart.jsx # Pipeline devis
│   │   └── TopClientsChart.jsx   # Top clients
│   ├── Automations/
│   │   ├── AutomationBuilder.jsx # Éditeur visuel
│   │   └── AutomationRunsPanel.jsx # Historique runs
│   ├── Layout/
│   │   ├── Header.jsx            # Header avec navigation
│   │   └── Layout.jsx            # Layout principal
│   └── ui/
│       ├── Button.jsx
│       ├── Input.jsx
│       ├── Modal.jsx
│       ├── ConfirmDialog.jsx
│       ├── Badge.jsx
│       └── Toast.jsx
├── stores/
│   ├── projectStore.js
│   ├── analyticsStore.js
│   ├── planningStore.js
│   ├── automationStore.js
│   ├── settingsStore.js
│   ├── authStore.js
│   ├── uiStore.js
│   └── toastStore.js
└── services/
    └── api.js                    # Client axios
```

### Contraintes ABSOLUES
1. **ZERO breaking change** — l'app est utilisée quotidiennement
2. **100% des fonctionnalités** doivent être conservées
3. **Pas de nouvelles dépendances npm** sauf absolue nécessité
4. **Dark mode** : Toujours inclure les classes `dark:` correspondantes
5. **Garder le style Tailwind existant** (couleurs, arrondis, espacements)
6. **Réutiliser les composants ui/** existants

### Déploiement
```bash
cd frontend && npm run build
rsync -avz --delete frontend/dist/ swigs@192.168.110.59:/home/swigs/swigs-workflow/frontend/dist/
```

### Style guide Tailwind
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

---

## PARTIE A : REFACTORING DES GROS COMPOSANTS

### A1. Split NewInvoiceModal.jsx (843 lignes → 5 composants)

C'est le plus gros composant de l'app. Il gère à la fois :
- Le choix du mode (standard vs custom)
- Le formulaire standard (sélection events + quotes + partials)
- Le formulaire custom (lignes libres)
- Le résumé avec calculs (colonne droite)
- Les options avancées (date, notes, TVA)

**Architecture cible** :
```
Sidebar/
├── NewInvoiceModal.jsx           # ~150 lignes (orchestrateur + modal wrapper)
├── invoice/
│   ├── InvoiceModeSelector.jsx   # ~60 lignes (boutons standard/custom)
│   ├── StandardInvoiceForm.jsx   # ~250 lignes (events, quotes, partials)
│   ├── CustomInvoiceForm.jsx     # ~120 lignes (lignes libres)
│   ├── InvoiceSummary.jsx        # ~150 lignes (colonne droite, totaux)
│   └── InvoiceAdvancedOptions.jsx # ~80 lignes (date, notes, TVA)
```

**Règles de refactoring** :
1. Lire le fichier actuel en entier avant de commencer
2. Le NewInvoiceModal garde le state global et les handlers de soumission
3. Chaque sous-composant reçoit les données et callbacks en props
4. Les calculs de totaux restent dans le parent (source de vérité unique)
5. Le `PartialInput` memo pattern existant doit être conservé (il résout un vrai bug de focus)
6. **Tester la création d'une facture standard, custom, et partielle après refactoring**

---

### A2. Split DocumentsTab.jsx (604 lignes → 3 composants)

Ce composant gère à la fois les factures ET les devis dans le même fichier.

**Architecture cible** :
```
Sidebar/
├── DocumentsTab.jsx              # ~80 lignes (tabs factures/devis + orchestration)
├── documents/
│   ├── InvoiceList.jsx           # ~250 lignes (liste factures + actions)
│   └── QuoteList.jsx             # ~250 lignes (liste devis + actions)
```

**Règles** :
1. DocumentsTab garde le state de sélection (tab factures/devis)
2. InvoiceList et QuoteList reçoivent `project`, `invoices`/`quotes` en props
3. Les actions (download PDF, send email, change status, delete, sync AbaNinja, portal link) restent dans chaque composant
4. Les modals de création restent gérés par le composant parent (ProjectSidebar)

---

### A3. Optimiser CalendarGrid.jsx (476 DOM elements)

Le calendrier crée 4 slots par heure × 17 heures × 7 jours = **476 éléments droppables**. C'est excessif.

**Optimisations** :
1. **Réduire les slots** : Créer des slots d'**1 heure** (pas 15 min) comme zones droppables. Snapper au quart d'heure au moment du drop, pas dans le DOM.
2. **Virtualiser les jours hors écran** : En vue semaine, seuls les jours visibles doivent rendre leurs slots
3. **Lazy render** : Ne rendre les slots d'une colonne que quand le drag est actif dans cette zone

**Résultat attendu** : ~17 slots × 7 jours = **119 éléments** au lieu de 476.

---

## PARTIE B : AMÉLIORATIONS UX

### B1. Loading Skeletons (toutes les pages)

Actuellement, les pages affichent un écran vide ou un simple spinner pendant le chargement. Ajouter des **skeleton loaders** pour chaque page.

**Créer un composant réutilisable** :
```
ui/Skeleton.jsx
```

```jsx
// Skeleton.jsx
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-dark-border rounded-lg ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-3 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
```

**Appliquer sur** :
- `Workflow.jsx` : Grille de 6-8 SkeletonCards en lieu du vide
- `Analytics.jsx` : Skeleton pour les 4 KPI cards + graphiques
- `Planning.jsx` : Skeleton pour la grille calendrier
- `Automations.jsx` : Skeleton pour la liste d'automations

---

### B2. Page 404

Créer une page 404 pour les routes invalides.

```
pages/NotFound.jsx
```

```jsx
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-7xl font-bold text-slate-200 dark:text-dark-border mb-4">404</p>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
        Page introuvable
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link to="/">
        <Button icon={Home}>Retour au workflow</Button>
      </Link>
    </div>
  );
}
```

Ajouter dans `App.jsx` :
```jsx
<Route path="*" element={<NotFound />} />
```

---

### B3. Global Error Boundary

Créer un error boundary React pour capturer les crashes de composants.

```
components/ErrorBoundary.jsx
```

```jsx
import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import Button from './ui/Button';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Une erreur est survenue
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            Le composant a rencontré un problème. Essayez de rafraîchir.
          </p>
          <Button onClick={this.handleReset} icon={RefreshCw}>
            Réessayer
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Appliquer** dans `App.jsx` autour de chaque route :
```jsx
<Route path="/" element={
  <ErrorBoundary>
    <Workflow />
  </ErrorBoundary>
} />
```

Ou mieux, wrapper le `Layout` entier.

---

### B4. Focus Trap pour les Modals

Le composant `Modal.jsx` actuel n'empêche pas le Tab de sortir du modal.

**Fix** : Ajouter un focus trap dans `Modal.jsx` sans nouvelle dépendance :

```jsx
// Ajouter dans Modal.jsx
import { useEffect, useRef } from 'react';

function useFocusTrap(ref, isOpen) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;

    const modal = ref.current;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKeyDown(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.key === 'Escape') {
        // Trouver le bouton fermer ou déclencher onClose
        modal.querySelector('[data-close]')?.click();
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    // Focus le premier élément focusable à l'ouverture
    setTimeout(() => first?.focus(), 50);

    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ref]);
}
```

Intégrer dans le composant Modal existant.

---

### B5. Client Searchable dans NewProjectModal

Le dropdown client dans `NewProjectModal.jsx` est un simple `<select>` inutilisable avec 50+ clients.

**Fix** : Remplacer par un input autocomplete custom :

```jsx
// Composant inline dans NewProjectModal.jsx ou dans ui/
function ClientAutocomplete({ clients, value, onChange, onCreateNew }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = clients.find(c => c._id === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Client
      </label>
      <input
        type="text"
        value={isOpen ? search : (selected?.name || '')}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        onFocus={() => { setIsOpen(true); setSearch(''); }}
        placeholder="Rechercher un client..."
        className="w-full px-4 py-2 text-sm bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(client => (
            <button
              key={client._id}
              type="button"
              onClick={() => { onChange(client._id); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center justify-between"
            >
              <span className="text-slate-900 dark:text-white">{client.name}</span>
              {client.company && (
                <span className="text-xs text-slate-400">{client.company}</span>
              )}
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              Aucun client trouvé
            </div>
          )}

          {onCreateNew && (
            <button
              type="button"
              onClick={() => { onCreateNew(search); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 border-t border-slate-100 dark:border-dark-border font-medium"
            >
              + Créer "{search || 'nouveau client'}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### B6. Empty States

Ajouter des empty states visuels pour les pages/sections sans données.

**Planning.jsx** — Quand aucun bloc n'existe pour la semaine :
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
  <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-1">
    Aucun bloc planifié
  </h3>
  <p className="text-sm text-slate-400 dark:text-slate-500">
    Glissez un projet depuis la liste pour planifier du temps.
  </p>
</div>
```

**Analytics.jsx** — Quand aucune facture/donnée n'existe :
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
  <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-1">
    Pas encore de données
  </h3>
  <p className="text-sm text-slate-400 dark:text-slate-500">
    Créez des factures et devis pour voir vos statistiques apparaître.
  </p>
</div>
```

**EventsTab.jsx** — Quand aucun event sur le projet :
```jsx
<div className="flex flex-col items-center py-8 text-center">
  <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
  <p className="text-sm text-slate-400">Aucune heure ou dépense enregistrée</p>
</div>
```

**HistoryTab.jsx** — Quand aucun historique :
```jsx
<div className="flex flex-col items-center py-8 text-center">
  <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
  <p className="text-sm text-slate-400">Aucune activité enregistrée</p>
</div>
```

---

### B7. Améliorer le Toast system

Le composant Toast actuel n'a pas de limite. Avec beaucoup d'actions, les toasts s'empilent.

**Fix dans `toastStore.js`** :
```javascript
// Limiter à 3 toasts max
addToast: (toast) => {
  const id = Date.now();
  set((state) => {
    const toasts = [...state.toasts, { ...toast, id }];
    // Garder seulement les 3 derniers
    return { toasts: toasts.slice(-3) };
  });
  setTimeout(() => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }, toast.duration || 4000);
}
```

---

### B8. Raccourci Escape pour fermer le Sidebar

`ProjectSidebar.jsx` ne se ferme pas avec Escape.

**Fix** : Ajouter un `useEffect` :
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

---

## PLAN D'IMPLÉMENTATION

### Phase 1 : Fondations UX (pas de refactoring, ajouts uniquement)
1. Créer `ui/Skeleton.jsx` — Composant skeleton réutilisable
2. Créer `pages/NotFound.jsx` — Page 404
3. Créer `components/ErrorBoundary.jsx` — Error boundary global
4. Modifier `App.jsx` — Ajouter 404 route + error boundaries
5. Ajouter loading skeletons aux 4 pages principales
6. Ajouter empty states (Planning, Analytics, EventsTab, HistoryTab)

### Phase 2 : Améliorations composants existants
7. Modifier `ui/Modal.jsx` — Focus trap + Escape
8. Modifier `stores/toastStore.js` — Limite 3 toasts
9. Modifier `Sidebar/ProjectSidebar.jsx` — Escape to close
10. Modifier `Workflow/NewProjectModal.jsx` — Client autocomplete searchable

### Phase 3 : Refactoring gros composants
11. Split `NewInvoiceModal.jsx` → 5 sous-composants dans `Sidebar/invoice/`
12. Split `DocumentsTab.jsx` → 3 composants dans `Sidebar/documents/`
13. Optimiser `CalendarGrid.jsx` — Réduire les slots à 1h

### Phase 4 : Validation
14. Tester toutes les fonctionnalités (créer projet, facture standard, facture custom, facture partielle, devis, planifier bloc, etc.)
15. Tester en dark mode
16. Tester sur mobile (responsive)
17. Build + déploiement

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **Chrome DevTools MCP** : Seul le thread principal peut l'utiliser, pas les subagents
- **L'utilisateur parle français** — communiquer en français
- **Le redesign Settings est géré par un autre prompt** (`REDESIGN-SETTINGS-PROMPT.md`) — ne PAS toucher à `Settings.jsx` ni aux composants dans `components/Settings/`
- **Le fix des bugs critiques est géré par un autre prompt** (`BUGFIX-CRITICAL-PROMPT.md`) — ne PAS corriger les bugs backend ici
- **Pas de tests automatisés** — tester manuellement chaque changement
- **Priorité** : Les phases 1 et 2 sont plus importantes que la phase 3. Si le temps manque, livrer les phases 1-2 d'abord.
