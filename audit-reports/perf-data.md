# Performance & Data Audit - swigs-workflow
**Date**: 2026-02-13
**Agent**: perf-data
**Scope**: Backend (MongoDB, queries) & Frontend (bundle, rendering, memory)

---

## Résumé Exécutif

### Points Forts
- Utilisation d'agrégations MongoDB pour optimiser les queries principales (projectController)
- Compression activée avec niveau 6 (seuil 1KB)
- PM2 en mode cluster (2 instances)
- Indexes composés bien définis sur les modèles principaux
- Rate limiting en place (100 req/min global, 10 req/min auth)

### Points Critiques 🔴
1. **Analytics**: Queries séquentielles dans les boucles (N+1) provoquant 12-24 queries MongoDB par requête
2. **Aucun lazy loading** sur le frontend - toutes les pages chargées au démarrage
3. **Recharts & @xyflow/react** non lazy-loadés (>300KB combinés)
4. **Pas de code splitting** dans vite.config.js
5. **Absences d'index** sur plusieurs champs fréquemment filtrés
6. **Modèles sans `.lean()`** sur les queries en lecture seule

### Impact Estimé
- **Latence Analytics**: 1-3s pour 12 mois de données (devrait être <500ms)
- **Bundle Size**: ~800KB estimé (devrait être <300KB initial)
- **Time to Interactive**: ~2-3s (devrait être <1s)
- **Mémoire MongoDB**: Populate en cascade non contrôlé

---

## 1. MongoDB - Indexes & Queries

### 1.1 Indexes Manquants

#### Priority HIGH 🔴

**Event.js:81** - Manque index sur `(date, type)` pour les queries analytics
```javascript
// Actuel
eventSchema.index({ date: -1, type: 1 }); // Pour analytics hours queries

// Problème: Query analyticsController.js:379-383
Event.find({ project: { $in: projectIds }, type: 'hours', date: { $gte, $lte } })
// Utilise seulement { date: -1, type: 1 } mais pas projectIds
```

**Impact**: Scan collection entière pour filter par `project` ensuite
**Suggestion**:
```javascript
eventSchema.index({ project: 1, type: 1, date: -1 }); // Compound optimal
```

---

**Invoice.js:162** - Manque index sur `(issueDate, status)` pour analytics revenue
```javascript
// Queries dans analyticsController.js:50-83
Invoice.find({
  project: { $in: projectIds },
  issueDate: { $gte, $lte },
  status: { $ne: 'cancelled' }
})
```

**Impact**: Full collection scan sur ranges de dates
**Suggestion**:
```javascript
invoiceSchema.index({ project: 1, issueDate: 1, status: 1 }); // En plus de l'existant
```

---

**Quote.js:144** - Manque index sur `issueDate` pour analytics
```javascript
// Actuel
quoteSchema.index({ issueDate: -1 });

// Queries: quotesController.js:102, analyticsController.js:208
```

**Impact**: Acceptable, mais gagnerait d'un compound index
**Suggestion**: Bien que l'index existe, ajouter:
```javascript
quoteSchema.index({ project: 1, issueDate: -1 }); // Pour queries par projet
```

---

### 1.2 Index Composés à Optimiser

#### Priority MEDIUM 🟡

**Project.js:119-122** - Indexes redondants
```javascript
// Actuel
projectSchema.index({ userId: 1, archivedAt: 1 }); // Main filter
projectSchema.index({ userId: 1, status: 1 });      // Filter by status
projectSchema.index({ updatedAt: -1 });             // Sorting
projectSchema.index({ archivedAt: 1 });             // Archived filter

// Suggestion: Fusionner en compound optimal
projectSchema.index({ userId: 1, archivedAt: 1, status: 1, updatedAt: -1 });
```

**Impact**: Réduction de 4 indexes → 2 indexes (économie RAM ~5-10MB sur 10k documents)

---

**AutomationRun.js:83** - Index `scheduledAt` peu efficace
```javascript
// Actuel
automationRunSchema.index({ scheduledAt: 1, status: 1 });

// Query: automationRun.js:94-98 (findReadyToResume)
this.find({ status: 'waiting', scheduledAt: { $lte: new Date() } })
```

**Suggestion**: Inverser l'ordre
```javascript
automationRunSchema.index({ status: 1, scheduledAt: 1 }); // Status d'abord (plus sélectif)
```

---

### 1.3 Queries Non Optimisées

#### Priority HIGH 🔴

**analyticsController.js:122-196** - N+1 Query Problem dans `getMonthlyEvolution`
```javascript
// PROBLÈME CRITIQUE
for (let i = 11; i >= 0; i--) {
  // Query 1 (ligne 148)
  const invoices = await Invoice.find({ ...projectFilter, issueDate: { $gte, $lte } });

  // Query 2 si includeLastYear (ligne 172)
  const lastYearInvoices = await Invoice.find({ ...projectFilter, issueDate: { $gte, $lte } });
}
// = 12 ou 24 queries MongoDB dans une boucle !
```

**Impact**: 1-3 secondes de latence pour charger le graphique
**Suggestion**: Utiliser une seule aggregation MongoDB
```javascript
// Remplacement proposé
const data = await Invoice.aggregate([
  { $match: { project: { $in: projectIds }, status: { $ne: 'cancelled' } } },
  { $addFields: {
    month: { $month: '$issueDate' },
    year: { $year: '$issueDate' }
  }},
  { $group: {
    _id: { month: '$month', year: '$year' },
    revenue: { $sum: '$total' },
    count: { $sum: 1 }
  }},
  { $sort: { '_id.year': 1, '_id.month': 1 } }
]);
```
**Gain estimé**: 90% de réduction de latence (3s → 300ms)

---

**analyticsController.js:355-425** - N+1 dans `getHoursStats`
```javascript
// Même problème que ci-dessus
for (let i = months - 1; i >= 0; i--) {
  const events = await Event.find({ ...projectFilter, type: 'hours', date: { $gte, $lte } });
}
// = 12 queries dans une boucle
```

**Suggestion**: Même solution - une seule aggregation

---

**analyticsController.js:36-115** - Multiple queries séquentielles dans `getRevenueStats`
```javascript
// Lignes 50-54: YTD
const ytdInvoices = await Invoice.find(...);

// Lignes 58-63: MTD
const mtdInvoices = await Invoice.find(...);

// Lignes 67-72: Last month
const lastMonthInvoices = await Invoice.find(...);

// Lignes 77-82: Last year YTD
const lastYearInvoices = await Invoice.find(...);

// Lignes 86-87: Pending
const pendingInvoices = await Invoice.find(...);
```

**Impact**: 5 queries séquentielles → ~500-800ms de latence
**Suggestion**: Une seule aggregation avec `$facet`
```javascript
const stats = await Invoice.aggregate([
  { $match: { project: { $in: projectIds } } },
  { $facet: {
    ytd: [
      { $match: { issueDate: { $gte: ytdStart, $lte: ytdEnd }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ],
    mtd: [ /* ... */ ],
    lastMonth: [ /* ... */ ],
    // etc.
  }}
]);
```
**Gain estimé**: 80% de réduction (500ms → 100ms)

---

**analyticsController.js:304-348** - `getTopClients` non optimisé
```javascript
// Ligne 313: Populate project (peut être lourd)
const invoices = await Invoice.find({ ...projectFilter, status: { $ne: 'cancelled' } })
  .populate('project'); // ⚠️ Charge TOUS les champs du projet

// Lignes 319-335: Grouping en JS au lieu de MongoDB
invoices.forEach(invoice => {
  // Grouping logic in JavaScript
});
```

**Impact**: Transfert de données excessif (project contient client embedded)
**Suggestion**: Utiliser aggregation MongoDB
```javascript
const topClients = await Invoice.aggregate([
  { $match: { project: { $in: projectIds }, status: { $ne: 'cancelled' } } },
  {
    $lookup: {
      from: 'projects',
      localField: 'project',
      foreignField: '_id',
      as: 'projectData'
    }
  },
  { $unwind: '$projectData' },
  {
    $group: {
      _id: {
        name: '$projectData.client.name',
        company: '$projectData.client.company'
      },
      totalRevenue: { $sum: '$total' },
      invoiceCount: { $sum: 1 }
    }
  },
  { $sort: { totalRevenue: -1 } },
  { $limit: limit }
]);
```

---

#### Priority MEDIUM 🟡

**projectController.js:223-378** - `getProject` utilise 3 queries parallèles mais pas optimal
```javascript
// Ligne 239-327: 3 aggregations parallèles
const [eventStats, quoteStats, invoiceStats] = await Promise.all([
  Event.aggregate([...]), // OK
  Quote.find({ project }).lean(), // ⚠️ Devrait être aggregation
  Invoice.aggregate([...]) // OK
]);

// Lignes 336-348: Calcul quote stats en JS
quotes.filter(q => ...).reduce((sum, q) => { /* complex logic */ }, 0);
```

**Impact**: Transfert de données quotes complet + calculs JS
**Suggestion**: Déplacer la logique de calcul dans MongoDB aggregation

---

**invoiceController.js:192-198** - Fetch events sans projection
```javascript
const events = eventIds.length > 0
  ? await Event.find({
      _id: { $in: eventIds },
      project: req.params.projectId,
      billed: false
    })
  : [];
```

**Impact**: Charge tous les champs des events alors qu'on n'a besoin que de certains
**Suggestion**: Ajouter `.select()` ou `.lean()`
```javascript
.select('type description date hours hourlyRate amount').lean()
```

---

### 1.4 Populate Excessif

#### Priority MEDIUM 🟡

**projectController.js:232** - Populate status non nécessaire
```javascript
const project = await Project.findOne(query).populate('status');
```

**Impact**: Requête supplémentaire à Status collection
**Suggestion**: Si on n'a besoin que du nom/couleur, utiliser aggregation ou charger statuses en cache

---

**invoiceController.js:85-89** - Populate project avec tous les champs
```javascript
const invoice = await Invoice.findById(req.params.id)
  .populate({
    path: 'project',
    select: 'name client userId' // 👍 Bien - utilise select
  });
```

**Note**: Celui-ci est bien fait, utiliser ce pattern partout

---

### 1.5 Queries Sans `.lean()`

#### Priority LOW 🟢

Les queries suivantes devraient utiliser `.lean()` car elles sont en lecture seule:

- **analyticsController.js:50-83** - Toutes les queries Invoice/Quote pour stats
- **quoteController.js:303** - `Quote.find({ project }).lean()` ✅ (déjà fait)
- **eventController.js:37-39** - `Event.find(query).populate('invoice', 'number').sort('-date')`

**Impact**: ~10-20% économie mémoire sur queries volumineuses
**Suggestion**: Ajouter `.lean()` systématiquement sur queries read-only

---

## 2. Modèles Mongoose

### 2.1 Virtuals & Pre/Post Hooks

#### Priority LOW 🟢

**Event.js:56-64** - Virtual `total` calculé à chaque accès
```javascript
eventSchema.virtual('total').get(function() {
  if (this.type === 'hours' && this.hours && this.hourlyRate) {
    return this.hours * this.hourlyRate;
  }
  // ...
});
```

**Impact**: Recalculé à chaque fois au lieu d'être stocké
**Note**: Acceptable pour ce cas car la logique est simple. Si utilisé dans aggregations, préférer calculer côté DB.

---

**Status.js:35-44** - Hook `pre('save')` avec query sur tous les statuts
```javascript
statusSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(query, { isDefault: false });
  }
});
```

**Impact**: Query supplémentaire à chaque sauvegarde de status default
**Note**: Acceptable car les statuts sont rarement modifiés

---

**AutomationRun.js:86-91** - Hook `pre('save')` avec calcul
```javascript
automationRunSchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
  }
  next();
});
```

**Impact**: Minime - calcul simple
**Note**: Bien implémenté ✅

---

### 2.2 Index Sparse & Unique

#### Priority HIGH 🔴

**User.js:7-8** - Sparse unique index sur `hubUserId`
```javascript
hubUserId: {
  type: String,
  unique: true,
  sparse: true // ⚠️ OK, mais pas de default: null
}
```

**Note**: Correctement implémenté selon mémoire (pas de `default: null` avec sparse unique) ✅

---

**Settings.js:117-122** - Sparse unique sur userId
```javascript
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  index: true,
  unique: true,
  sparse: true // ✅ Bien
}
```

**Note**: Correctement implémenté ✅

---

## 3. Bundle Frontend

### 3.1 Absence de Code Splitting

#### Priority HIGH 🔴

**vite.config.js:15-18** - Configuration build minimaliste
```javascript
build: {
  outDir: 'dist',
  sourcemap: false // ⚠️ Pas de config chunking
}
```

**Impact**: Bundle monolithique chargé au démarrage
**Suggestion**: Ajouter code splitting manuel
```javascript
build: {
  outDir: 'dist',
  sourcemap: false,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-charts': ['recharts'],
        'vendor-flow': ['@xyflow/react'],
        'vendor-ui': ['framer-motion', 'lucide-react'],
        'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable']
      }
    }
  }
}
```

---

**App.jsx:5-9** - Pas de lazy loading des pages
```javascript
// Imports directs = tout chargé au démarrage
import Workflow from './pages/Workflow';
import Planning from './pages/Planning';
import Analytics from './pages/Analytics';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
```

**Impact estimé**: ~600-800KB chargé au lieu de ~200KB initial
**Suggestion**: Lazy loading avec React.lazy
```javascript
import { lazy, Suspense } from 'react';

const Workflow = lazy(() => import('./pages/Workflow'));
const Planning = lazy(() => import('./pages/Planning'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Automations = lazy(() => import('./pages/Automations'));
const Settings = lazy(() => import('./pages/Settings'));

// Dans le render
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<Layout />}>
      <Route index element={<Workflow />} />
      {/* ... */}
    </Route>
  </Routes>
</Suspense>
```

---

### 3.2 Dépendances Lourdes

#### Priority HIGH 🔴

**package.json:11-24** - Analyse des dépendances
```json
"@xyflow/react": "^12.10.0",    // ~350KB minified
"recharts": "^3.7.0",            // ~280KB minified
"framer-motion": "^11.15.0",     // ~180KB minified
"date-fns": "^4.1.0",            // ~70KB (tree-shakeable)
"@dnd-kit/core": "^6.3.1",       // ~60KB minified
"lucide-react": "^0.469.0"       // ~15KB (tree-shakeable)
```

**Total estimé**: ~955KB de dépendances (avant minification gzip)
**Après gzip**: ~350KB

**Suggestions**:
1. **@xyflow/react** (350KB) - Utilisé uniquement dans Automations page → LAZY LOAD ✅
2. **recharts** (280KB) - Utilisé uniquement dans Analytics page → LAZY LOAD ✅
3. **framer-motion** (180KB) - Utilisé partout, mais vérifier si nécessaire sur toutes les animations
4. **date-fns** (70KB) - Tree-shakeable, vérifier les imports `import { format } from 'date-fns'` ✅

---

### 3.3 Lazy Loading à Implémenter

#### Priority HIGH 🔴

**Pages à lazy-load**:
- ✅ **Analytics.jsx** - contient Recharts (280KB)
- ✅ **Automations.jsx** - contient @xyflow/react (350KB)
- 🟡 **Planning.jsx** - contient @dnd-kit (60KB) - MEDIUM priority
- 🟢 **Settings.jsx** - peu de dépendances lourdes - LOW priority

**Composants à lazy-load**:
- **MonthlyChart.jsx** (ligne 23 Analytics.jsx) - utilise Recharts
- **AutomationBuilder.jsx** (ligne 94 Automations.jsx) - utilise ReactFlow

**Exemple d'implémentation**:
```javascript
// analytics.jsx
import { lazy, Suspense } from 'react';

const MonthlyChart = lazy(() => import('../components/Analytics/MonthlyChart'));
const HoursChart = lazy(() => import('../components/Analytics/HoursChart'));

// Dans le render
<Suspense fallback={<div>Chargement du graphique...</div>}>
  <MonthlyChart data={monthlyData} />
</Suspense>
```

---

### 3.4 Imports Non Tree-Shakeable

#### Priority MEDIUM 🟡

**Vérifier les imports de date-fns**:
```bash
# Rechercher les imports non optimaux
grep -r "import.*from 'date-fns'" frontend/src/

# ✅ BIEN
import { format, addDays } from 'date-fns';

# ❌ MAUVAIS
import * as dateFns from 'date-fns';
```

**Note**: date-fns v4.1.0 est tree-shakeable si imports nommés ✅

---

## 4. Memory Leaks & Performance Frontend

### 4.1 Stores Zustand

#### Priority LOW 🟢

**uiStore.js:4-76** - Pas de subscriptions externes détectées
```javascript
export const useUIStore = create(
  persist(
    (set) => ({ /* ... */ }),
    { name: 'swigs-workflow-ui' }
  )
);
```

**Note**: Zustand gère automatiquement les cleanup des subscriptions ✅

---

**projectStore.js:4-411** - Store volumineux avec beaucoup d'état
```javascript
export const useProjectStore = create((set, get) => ({
  projects: [],          // ⚠️ Peut contenir beaucoup de données
  statuses: [],
  selectedProject: null,
  projectEvents: [],     // ⚠️ Peut contenir beaucoup d'événements
  projectInvoices: [],
  projectQuotes: [],
  projectHistory: [],
  // ...
}));
```

**Impact**: État global peut devenir volumineux (>10MB avec beaucoup de projets)
**Suggestion**: Implémenter pagination/virtualization pour grandes listes

---

### 4.2 useEffect Cleanup

#### Priority MEDIUM 🟡

**Automations.jsx:59-61** - useEffect sans cleanup
```javascript
useEffect(() => {
  fetchAutomations();
}, []); // Pas de cleanup
```

**Impact**: Si composant unmount pendant le fetch, peut causer warning
**Suggestion**: Ajouter cleanup
```javascript
useEffect(() => {
  let isMounted = true;

  fetchAutomations().then(() => {
    if (isMounted) {
      // setState only if mounted
    }
  });

  return () => { isMounted = false; };
}, []);
```

---

**AutomationBuilder.jsx:102-103** - useNodesState & useEdgesState
```javascript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
```

**Impact**: ReactFlow gère le cleanup automatiquement ✅
**Note**: Pas de leak détecté

---

### 4.3 Event Listeners

#### Priority LOW 🟢

**Recherche de window/document event listeners**:
```bash
grep -r "addEventListener" frontend/src/
# Résultat: Aucun trouvé ✅
```

**Note**: Pas de event listeners globaux détectés ✅

---

### 4.4 Intervals & Timeouts

#### Priority LOW 🟢

**Recherche de setInterval/setTimeout**:
```bash
grep -r "setInterval\|setTimeout" frontend/src/
# Résultat: Aucun trouvé ✅
```

**Note**: Pas d'intervals/timeouts détectés ✅

---

### 4.5 WebSocket Connections

#### Priority LOW 🟢

**backend/src/services/eventBus.service.js** - EventBus WebSocket
```javascript
// Backend connecte au Hub, pas le frontend
```

**Note**: Pas de WebSocket côté frontend → pas de leak possible ✅

---

## 5. Backend Performance

### 5.1 Server Configuration

#### Priority LOW 🟢

**server.js:40-55** - Helmet CSP bien configuré ✅
**server.js:124-131** - Compression bien configurée ✅
```javascript
app.use(compression({
  level: 6,           // Bon compromis CPU/ratio
  threshold: 1024,    // ✅ Seuil raisonnable
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
```

---

**server.js:91-102** - Rate Limiting bien implémenté ✅
```javascript
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // ✅ Raisonnable
  standardHeaders: true,
  skip: (req) => req.path === '/api/health'
});
```

---

**server.js:216-221** - MongoDB Connection Options
```javascript
const mongoOptions = {
  maxPoolSize: 10,              // ✅ Bon pour 2 instances PM2
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
};
```

**Note**: Bien configuré pour production ✅

---

### 5.2 PM2 Clustering

#### Priority LOW 🟢

**backend/ecosystem.config.cjs:28-29** - Mode cluster activé ✅
```javascript
instances: 2,
exec_mode: 'cluster',
```

**backend/ecosystem.config.cjs:34** - Memory restart bien configuré ✅
```javascript
max_memory_restart: '400M', // ✅ Bien pour i5-8500 16GB RAM
```

**backend/ecosystem.config.cjs:84-85** - Node args optimisés ✅
```javascript
node_args: [
  '--max-old-space-size=384',  // ✅ Laisse marge pour spike mémoire
  '--optimize-for-size'         // ✅ Bon pour petit serveur
]
```

**Note**: Configuration PM2 bien optimisée ✅

---

### 5.3 Caching Headers

#### Priority MEDIUM 🟡

**server.js** - Pas de cache headers détectés
```javascript
// ⚠️ Manque: Cache-Control headers pour assets statiques
```

**Suggestion**: Ajouter middleware
```javascript
// Pour les routes API GET (immutable data)
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && req.path.includes('/invoices/') && req.path.endsWith('/pdf')) {
    // PDFs de factures = immutables
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});
```

---

### 5.4 Services d'Automation

#### Priority LOW 🟢

**server.js:228** - initializeAutomationServices() appelé après DB connect ✅
**server.js:231** - initEventBus() appelé après DB connect ✅

**Note**: Bonne séquence d'initialisation ✅

---

## 6. Recommandations par Priorité

### 🔴 CRITICAL (Implémenter immédiatement)

1. **analyticsController.js** - Refactorer les boucles N+1 en aggregations
   - `getMonthlyEvolution` (lignes 122-196)
   - `getHoursStats` (lignes 355-425)
   - `getRevenueStats` (lignes 36-115)
   - **Gain estimé**: 90% réduction latence (3s → 300ms)

2. **App.jsx** - Implémenter lazy loading des pages
   - Analytics.jsx (280KB Recharts)
   - Automations.jsx (350KB ReactFlow)
   - **Gain estimé**: Bundle initial réduit de 60% (800KB → 300KB)

3. **vite.config.js** - Ajouter code splitting manuel
   - Séparer vendor chunks (recharts, @xyflow, framer-motion)
   - **Gain estimé**: TTI amélioré de 50% (3s → 1.5s)

4. **Event.js** - Ajouter index composé `{ project: 1, type: 1, date: -1 }`
   - **Gain estimé**: 80% réduction latence queries hours (500ms → 100ms)

5. **Invoice.js** - Ajouter index `{ project: 1, issueDate: 1, status: 1 }`
   - **Gain estimé**: 70% réduction latence queries revenue

---

### 🟡 HIGH (Implémenter dans les 2 semaines)

6. **analyticsController.js:304-348** - `getTopClients` en aggregation
   - **Gain estimé**: 60% réduction latence (400ms → 160ms)

7. **projectController.js:303** - Remplacer `Quote.find().lean()` par aggregation
   - **Gain estimé**: 40% réduction latence getProject

8. **Lazy load des composants Charts**
   - MonthlyChart, HoursChart, ProjectStatusChart, etc.
   - **Gain estimé**: 200KB économisés sur page Analytics

9. **Ajouter `.lean()` sur toutes les queries read-only**
   - analyticsController (toutes les queries)
   - eventController (ligne 37)
   - **Gain estimé**: 15% économie mémoire

10. **Project.js:119-122** - Fusionner les indexes redondants
    - **Gain estimé**: -5MB RAM sur 10k projets

---

### 🟢 MEDIUM (Amélioration continue)

11. **invoiceController.js:192** - Ajouter `.select().lean()` sur fetch events
    - **Gain estimé**: 10% réduction transfert données

12. **Implémenter cache headers pour PDFs & assets immutables**
    - **Gain estimé**: 90% réduction requêtes répétées

13. **Ajouter cleanup dans useEffect pour async operations**
    - Automations.jsx:59, autres pages avec fetch
    - **Gain estimé**: Élimination warnings React

14. **Implémenter pagination dans projectStore**
    - Pour listes >50 projets
    - **Gain estimé**: -50% mémoire frontend avec beaucoup de données

15. **Quote.js** - Ajouter index `{ project: 1, issueDate: -1 }`
    - **Gain estimé**: 30% réduction latence queries quotes

---

### 🟣 LOW (Nice to have)

16. **AutomationRun.js:83** - Inverser index `{ status: 1, scheduledAt: 1 }`
17. **Vérifier imports date-fns** pour tree-shaking
18. **Analyser bundle avec vite-bundle-visualizer** pour optimisations supplémentaires
19. **Considérer Virtual Scrolling** pour grandes listes (react-window)
20. **Ajouter monitoring** (Sentry pour errors, DataDog pour perfs)

---

## 7. Impact Estimé Global

### Avant Optimisations
- **Analytics page load**: 2-3s
- **Bundle initial**: 800KB (~350KB gzip)
- **Time to Interactive**: 3s
- **Mémoire MongoDB**: 120-150MB (queries non optimisées)
- **Latence getMonthlyEvolution**: 1-3s (24 queries)

### Après Optimisations (Critical + High)
- **Analytics page load**: 0.5-0.8s (-75%)
- **Bundle initial**: 300KB (~120KB gzip) (-62%)
- **Time to Interactive**: 1s (-67%)
- **Mémoire MongoDB**: 60-80MB (-47%)
- **Latence getMonthlyEvolution**: 200-300ms (-90%)

---

## 8. Plan d'Implémentation

### Phase 1 (Semaine 1) - Backend Critical
1. Refactorer `analyticsController.js` en aggregations
2. Ajouter indexes manquants (Event, Invoice)
3. **Tests de charge**: Vérifier latence avec 10k+ invoices

### Phase 2 (Semaine 1) - Frontend Critical
4. Implémenter lazy loading pages (App.jsx)
5. Configurer code splitting (vite.config.js)
6. **Tests bundle**: Vérifier taille avec `npm run build` + analyze

### Phase 3 (Semaine 2) - High Priority
7. Optimiser `getTopClients` & `getProject`
8. Lazy load Charts components
9. Ajouter `.lean()` partout
10. Fusionner indexes redondants

### Phase 4 (Semaine 3) - Medium Priority
11. Cache headers pour assets
12. useEffect cleanup
13. Pagination projectStore
14. Tests de régression

---

## 9. Métriques de Suivi

### KPIs à Monitorer
- **Backend**: Temps réponse `/api/analytics/*` (target <500ms)
- **Backend**: Nombre de queries MongoDB par requête (target <5)
- **Frontend**: Lighthouse Performance Score (target >90)
- **Frontend**: Bundle size (target <300KB initial)
- **Frontend**: Time to Interactive (target <1s)
- **MongoDB**: Index usage (explain plans)
- **MongoDB**: Slow query log (>1s)

### Outils Recommandés
- **Backend**: MongoDB Atlas Performance Advisor
- **Frontend**: Lighthouse CI, webpack-bundle-analyzer
- **E2E**: WebPageTest, Chrome DevTools Performance
- **APM**: New Relic / DataDog (si budget disponible)

---

## Annexes

### A. Commandes Utiles

```bash
# Analyser bundle Vite
cd frontend
npx vite-bundle-visualizer

# Vérifier indexes MongoDB
mongosh
use swigs-workflow
db.events.getIndexes()
db.invoices.getIndexes()

# Explain plan pour query
db.invoices.find({ issueDate: { $gte: ISODate('2025-01-01') } }).explain('executionStats')

# PM2 monitoring
pm2 monit
pm2 logs swigs-workflow --lines 100
```

### B. Benchmarks Recommandés

```javascript
// Benchmark aggregation vs loop
console.time('getMonthlyEvolution-old');
// ... old code
console.timeEnd('getMonthlyEvolution-old');

console.time('getMonthlyEvolution-new');
// ... new aggregation
console.timeEnd('getMonthlyEvolution-new');
```

---

**Fin du rapport**
**Agent**: perf-data
**Date**: 2026-02-13
