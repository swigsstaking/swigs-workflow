# Prompt Analyse Fonctionnelle & Améliorations — SWIGS Workflow

Tu es un product manager / architecte fonctionnel chargé d'analyser en profondeur toutes les **fonctionnalités** de l'application **swigs-workflow**, comprendre comment elles s'interconnectent, et proposer des améliorations fonctionnelles en vue d'une **V1 stable**. Tu travailles en 4 phases séquentielles.

---

## CONTEXTE

### L'application
**swigs-workflow** est un outil tout-en-un de gestion de projets et facturation pour freelances et petites agences suisses. C'est **déjà en production et utilisé quotidiennement** — toute modification doit être **non-breaking** et **backward compatible**.

- **URL** : https://workflow.swigs.online
- **Serveur** : 192.168.110.59 (SSH: `ssh swigs@192.168.110.59`)
- **Port** : 3003
- **PM2** : `swigs-workflow` (2 instances cluster)
- **DB** : MongoDB locale (`swigs-workflow`)
- **Auth** : SSO via SWIGS Hub (PKCE OAuth 2.0)

### Stack technique
- **Backend** : Node.js (ESM), Express 4.21, Mongoose 8.9, JWT, pdfkit, nodemailer, node-cron, ws
- **Frontend** : React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5, React Router 7, @dnd-kit, @xyflow/react, Recharts, date-fns, framer-motion
- **Multi-tenant** : Données isolées par `userId`

### Déploiement
```bash
# Backend
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.env' backend/ swigs@192.168.110.59:/home/swigs/swigs-workflow/backend/
ssh swigs@192.168.110.59 'pm2 restart swigs-workflow'

# Frontend
cd frontend && npm run build
rsync -avz --delete frontend/dist/ swigs@192.168.110.59:/home/swigs/swigs-workflow/frontend/dist/
```

### Contraintes ABSOLUES
1. **ZERO breaking change** — l'app est utilisée quotidiennement en production
2. **Backward compatible** — les nouveaux champs doivent avoir des `default` values
3. **Snapshots factures** — ne JAMAIS modifier events/quotes déjà facturés
4. **Tester localement** avant tout déploiement

---

## CARTOGRAPHIE FONCTIONNELLE ACTUELLE

Voici ce que l'app fait aujourd'hui. Ton audit doit **vérifier, compléter et corriger** cette cartographie en lisant le code réel.

### Page 1 : Workflow (route `/`)
**Concept** : Kanban board de gestion de projets

- **Statuts custom** : L'utilisateur crée ses propres colonnes (ex: Prospect, En cours, Terminé, Archivé). Chaque statut a un nom, une couleur, un ordre.
- **Cartes projet** : Chaque projet est une carte avec nom, client (embedded), description, montant estimé, dates
- **Drag & drop** : Déplacer les projets entre colonnes (@dnd-kit)
- **Sidebar détails** : Clic sur un projet → panneau latéral avec 4 onglets :
  - **Info** : Détails projet, client, notes
  - **Events** : Heures travaillées, dépenses, actions (type: hours/expense/action)
  - **Documents** : Devis (Quotes) et Factures (Invoices) liés au projet
  - **Historique** : Audit trail de tous les changements
- **Filtres** : Par statut, recherche texte, toggle archives
- **Positions** : Les projets ont des positions X/Y sauvegardées (localStorage + API)

### Page 2 : Planning (route `/planning`)
**Concept** : Calendrier de planification du temps

- **Vues** : Semaine et jour
- **Blocs planifiés** : Créer des blocs horaires sur le calendrier (projet, durée, notes)
- **Drag & drop** : Déplacer/redimensionner les blocs
- **Tier list** : Liste des projets à gauche pour drag vers le calendrier
- **Navigation** : Semaine précédente/suivante, aujourd'hui

### Page 3 : Analytics (route `/analytics`)
**Concept** : Dashboard de suivi business

- **KPIs** : Revenue total, heures travaillées, nombre de projets, taux de conversion devis
- **Graphiques** :
  - Revenue mensuel (bar chart)
  - Évolution mensuelle (line chart)
  - Pipeline devis (funnel/bar)
  - Répartition par statut projet (pie/bar)
  - Top clients (classement)
  - Heures par projet (bar)
- **Périodes** : Filtrage par période (mois, trimestre, année)

### Page 4 : Automations (route `/automations`)
**Concept** : Workflow builder visuel pour automatiser des actions

- **Visual editor** : Canvas @xyflow/react avec nodes connectables
- **Types de nodes** :
  - **Trigger** : Déclencheur (temps, événement CMS, événement interne)
  - **Action** : Envoyer email, webhook, mise à jour enregistrement
  - **Condition** : Branchement IF/ELSE
  - **Wait** : Délai d'attente
- **Templates email** : Handlebars avec variables dynamiques
- **CMS Polling** : Écoute des événements externes (commandes, clients) via polling API
- **Event Bus** : WebSocket vers SWIGS Hub pour événements inter-apps
- **Exécution** : Logs par node, retry, historique des runs

### Page 5 : Settings (route `/settings`)
**Concept** : Configuration de l'entreprise

- **Onglet Personnalisation** :
  - Infos entreprise (nom, adresse, SIRET, TVA, email, téléphone)
  - Logo upload
  - Config facturation (préfixe, TVA %, conditions paiement, mentions légales)
  - Config email (SMTP, templates)
- **Onglet Services** :
  - Catalogue de services (nom, description, taux horaire)
  - Réordonnement drag & drop
  - Toggle actif/inactif

### Système de Facturation
**Flow complet** : Projet → Events/Quotes → Invoice

1. **Events** : L'utilisateur log ses heures/dépenses/actions sur un projet
2. **Quotes** (Devis) : Créer un devis avec des lignes (description, quantité, prix unitaire)
   - Workflow : `draft` → `sent` → `signed` → `invoiced`
3. **Invoices** (Factures) :
   - **Standard** : Générée à partir d'events non facturés + quotes signés
   - **Custom** : Lignes libres (customLines) sans lien projet
   - **Snapshots** : Copie immuable des events/quotes au moment de la création
   - **Numérotation** : FAC-YEAR-### auto-incrémenté
   - **TVA** : 8.1% par défaut (Suisse), configurable
   - **Statuts** : draft → sent → paid (+ overdue, cancelled)
   - **PDF** : Génération via pdfkit

### Interconnexions entre fonctionnalités
```
Workflow ──── Events ──────┐
    │                      ├──→ Invoice (snapshots)
    │         Quotes ──────┘
    │            │
    ├──── Planning (blocs liés aux projets)
    │
    ├──── Analytics (agrège events, invoices, quotes, projets)
    │
    └──── History (audit trail par projet)

Settings ──── Services (taux horaires → Events)
    │
    └──── Email Config (→ Automations, → Invoice envoi)

Automations ──── CMS Events (polling externe)
    │
    └──── Event Bus (WebSocket SWIGS Hub)
```

---

## PHASE 1 : ANALYSE FONCTIONNELLE COMPLÈTE

Crée une équipe de **3 agents** pour analyser en parallèle :

### Agent 1 : `feature-mapper` (Cartographie fonctionnelle)
Lire le code de CHAQUE page et composant pour cartographier :

- **Pour chaque page** :
  - Quels composants sont utilisés ?
  - Quels stores Zustand sont consommés ?
  - Quelles API sont appelées ?
  - Quels états/interactions existent ?
  - Quel est le flow utilisateur complet ?

- **Pour chaque modèle backend** :
  - Quels champs existent (types, defaults, validations) ?
  - Quels indexes ?
  - Quelles relations avec les autres modèles ?
  - Quels virtual/methods/statics ?

- **Interconnexions** :
  - Dessiner la carte complète des dépendances fonctionnelles
  - Identifier les fonctionnalités orphelines (non connectées)
  - Identifier les fonctionnalités incomplètes (UI sans backend ou inversement)
  - Identifier les données qui pourraient être mieux exploitées

Fichiers à lire impérativement :
```
frontend/src/pages/*.jsx
frontend/src/stores/*.js
frontend/src/services/api.js
frontend/src/App.jsx
frontend/src/components/**/*.jsx
backend/src/models/*.js
backend/src/controllers/*.js
backend/src/routes/*.js
backend/src/services/**/*.js
```

### Agent 2 : `flow-tester` (Test des flows utilisateur)
Tester via Chrome DevTools MCP (ou analyse de code si MCP indisponible) les flows complets :

1. **Flow Projet** : Créer projet → Ajouter client → Changer statut → Drag entre colonnes → Archiver
2. **Flow Temps** : Ouvrir projet → Ajouter event heures → Ajouter event dépense → Voir total
3. **Flow Devis** : Ouvrir projet → Créer devis → Ajouter lignes → Envoyer → Signer
4. **Flow Facture Standard** : Projet avec events/quotes → Générer facture → Vérifier snapshots → Envoyer → Marquer payée
5. **Flow Facture Custom** : Créer facture custom → Lignes libres → Envoyer
6. **Flow Planning** : Naviguer calendrier → Créer bloc → Drag bloc → Modifier → Supprimer
7. **Flow Analytics** : Vérifier que les KPIs reflètent les données réelles → Changer période → Comparer
8. **Flow Automations** : Créer automation → Ajouter nodes → Connecter → Activer → Vérifier exécution
9. **Flow Settings** : Modifier infos entreprise → Modifier TVA → Vérifier impact sur nouvelles factures
10. **Flow Services** : Ajouter service → Modifier taux → Réordonner → Toggle actif

Pour chaque flow, noter :
- Ce qui fonctionne bien
- Ce qui est buggé ou manquant
- Ce qui est confus pour l'utilisateur
- Ce qui pourrait être plus rapide/fluide

### Agent 3 : `data-analyzer` (Analyse des données réelles)
Se connecter via SSH pour analyser la base de données réelle :

```bash
ssh swigs@192.168.110.59
mongosh
use swigs-workflow
```

- **Volumétrie** : `db.collection.countDocuments()` pour chaque collection
- **Utilisation** : Quelles fonctionnalités sont réellement utilisées ? (events? automations? planning?)
- **Patterns** : Comment l'utilisateur utilise l'app ? (types d'events les plus courants, statuts les plus utilisés, etc.)
- **Orphelins** : Données orphelines, incohérences, champs toujours vides
- **Schema réel** : Vérifier si le schéma Mongoose correspond aux données réelles
- **Suggestions** : Basé sur l'usage réel, quelles features méritent d'être améliorées vs ignorées

### Livrable Phase 1

Compiler en un document `FEATURES-WORKFLOW-ANALYSIS.md` :

1. **Carte fonctionnelle complète** avec toutes les interconnexions
2. **Feature matrix** : Pour chaque feature, statut (complète / partielle / stub / buggée)
3. **Flows utilisateur** : Résultats de chaque test avec screenshots/observations
4. **Données réelles** : Volumétrie et patterns d'utilisation
5. **Gaps identifiés** : Fonctionnalités manquantes ou incomplètes
6. **Opportunités** : Features à fort impact vs faible effort

---

## PHASE 2 : PROPOSITIONS D'AMÉLIORATIONS FONCTIONNELLES

À partir de l'analyse, propose des améliorations dans **4 catégories** :

### A. Corrections fonctionnelles (features cassées/incomplètes)
- Features qui existent mais ne marchent pas correctement
- Flows interrompus ou illogiques
- Données incohérentes

### B. Quick wins UX (améliorations rapides à fort impact)
- Raccourcis, actions rapides, meilleure ergonomie
- Informations manquantes mais faciles à ajouter
- Feedback utilisateur (toasts, confirmations, loading states)
- Meilleure exploitation des données existantes

### C. Améliorations fonctionnelles majeures
- Nouvelles capabilities sur des features existantes
- Meilleure intégration entre les modules
- Features demandées implicitement par l'usage réel
- Exemples possibles (à confirmer par l'audit) :
  - Export PDF des devis
  - Récurrence sur les events
  - Relance automatique factures impayées
  - Duplication de projets/devis
  - Dashboard client (vue par client de tous ses projets/factures)
  - Notifications / alertes
  - Recherche globale améliorée

### D. Suggestions V2 (hors scope V1, mais à noter)
- Idées pour plus tard
- Refactoring structurel
- Nouvelles pages/modules entiers

Pour chaque proposition, indique :
- **Titre** clair
- **Description** du changement et de la valeur ajoutée pour l'utilisateur
- **Fichiers impactés** (frontend et/ou backend)
- **Risque breaking** : aucun / faible / modéré
- **Effort estimé** : 15min / 30min / 1h / 2h / 4h / 1j
- **Priorité suggérée** : P1 (must have V1) / P2 (should have) / P3 (nice to have)

**IMPORTANT** : Présente les propositions à l'utilisateur et **ATTENDS sa validation**. NE COMMENCE PAS l'implémentation sans son accord explicite sur chaque point.

---

## PHASE 3 : VALIDATION UTILISATEUR

Présente les propositions de manière claire et structurée, regroupées par catégorie. L'utilisateur répondra pour chaque item :
- "OK" / "OUI" → accepté
- "NON" / "SKIP" → refusé
- Il peut modifier, préciser, ou fusionner des propositions
- Il peut changer les priorités

Compile la liste finale des items validés, ordonnés par priorité.

---

## PHASE 4 : IMPLÉMENTATION

Pour les items validés, crée une équipe d'agents adaptée :
- Grouper les items par zone (backend, frontend, full-stack)
- Assigner les items par agent selon la cohérence fonctionnelle
- Chaque agent travaille sur ses items, dans l'ordre de priorité

### Règles d'implémentation
1. **Éditer les fichiers existants** — ne pas créer de fichiers inutiles
2. **Backward compatible** — nouveaux champs avec defaults, pas de suppression
3. **Style existant** — garder le même style de code, même patterns
4. **Pas de nouvelles dépendances** sauf validation explicite
5. **Build** : `cd frontend && npm run build`
6. **Déployer** : rsync + pm2 restart
7. **Valider visuellement** chaque changement après déploiement

### Livrable Phase 4
- Liste des fichiers modifiés avec description des changements
- Validation visuelle (screenshots si possible)
- Rapport final avec items complétés vs skippés
- Si l'utilisateur le demande : version bump

---

## ARCHITECTURE FICHIERS DÉTAILLÉE

### Backend — Models (à lire en priorité)
```
backend/src/models/
├── Automation.js          # Workflow nodes, trigger config, active toggle
├── AutomationRun.js       # Run logs, per-node execution status
├── Client.js              # Standalone clients (also embedded in Project)
├── CmsEventCache.js       # External CMS event dedup cache
├── EmailTemplate.js       # Handlebars templates, category, variables
├── Event.js               # type: hours|expense|action, billed flag, invoiceRef
├── History.js             # Immutable audit trail (action, changes, userId)
├── Invoice.js             # events[] snapshots, quotes[] snapshots, customLines[], status, number
├── PlannedBlock.js        # projectId, start/end datetime, notes
├── Project.js             # client (embedded), statusId, userId, position, dates
├── Quote.js               # lines[], status (draft→sent→signed→invoiced), validUntil
├── Service.js             # name, rate, description, active, order
├── Session.js             # refreshToken, userId, expiresAt
├── Settings.js            # company info, invoicing config, email config
├── Status.js              # name, color, order, isDefault, userId
├── User.js                # email, hubUserId, name, isActive
```

### Backend — Controllers
```
backend/src/controllers/
├── analyticsController.js   # Revenue, monthly, quotes, projects, clients, hours
├── automationController.js  # CRUD, toggle, manual run, run history
├── clientController.js      # CRUD standalone clients
├── emailTemplateController.js # Template CRUD, variable injection, preview
├── eventController.js       # CRUD hours/expense/action, billing tracking
├── invoiceController.js     # Generation from events/quotes, custom, PDF, status
├── planningController.js    # CRUD planned blocks
├── projectController.js     # CRUD, status change, archive, positions
├── quoteController.js       # CRUD, status workflow, line management
├── serviceController.js     # CRUD service catalog, reorder, toggle
├── settingsController.js    # Get/update company settings, stats
├── statusController.js      # CRUD custom statuses, seed defaults, reorder
```

### Frontend — Stores Zustand
```
frontend/src/stores/
├── authStore.js        # Auth state, SSO flow, tokens, login/logout
├── projectStore.js     # Projects, statuses, events, invoices, quotes, history
├── uiStore.js          # Dark mode, search, filters, sidebar, archive toggle
├── analyticsStore.js   # Revenue data, monthly, quotes, hours, top clients
├── planningStore.js    # Calendar date, view mode, planned blocks
├── settingsStore.js    # Company settings, personalization
├── automationStore.js  # Automations CRUD, runs, templates
```

### Frontend — Pages & Composants clés
```
frontend/src/pages/
├── Workflow.jsx         # Kanban grid avec StatusFilter + WorkflowGrid + ProjectSidebar
├── Planning.jsx         # CalendarGrid + ProjectTierList + BlockDetailModal
├── Analytics.jsx        # KPICard + MonthlyChart + HoursChart + TopClientsChart + ...
├── Automations.jsx      # AutomationBuilder + NewAutomationModal + NodeConfigPanel
├── Settings.jsx         # PersonnalisationTab + ServicesTab

frontend/src/components/
├── Sidebar/
│   ├── ProjectSidebar.jsx      # Container avec tabs
│   ├── InfoTab.jsx             # Détails projet + client
│   ├── EventsTab.jsx           # Liste events + formulaire ajout
│   ├── DocumentsTab.jsx        # Devis + factures liés au projet
│   ├── HistoryTab.jsx          # Audit trail
│   ├── NewInvoiceModal.jsx     # Création facture standard
│   ├── NewCustomInvoiceModal.jsx # Création facture custom
│   └── NewQuoteModal.jsx       # Création devis
├── Workflow/
│   ├── WorkflowGrid.jsx        # Grille kanban avec colonnes statut
│   ├── ProjectCard.jsx         # Carte projet dans le kanban
│   ├── StatusFilter.jsx        # Filtres par statut
│   └── NewProjectModal.jsx     # Modal création projet
├── Planning/
│   ├── CalendarGrid.jsx        # Grille calendrier semaine/jour
│   ├── PlannedBlockCard.jsx    # Bloc sur le calendrier
│   ├── ProjectTierList.jsx     # Liste projets draggable
│   ├── BlockDetailModal.jsx    # Détails bloc
│   └── DeleteBlockModal.jsx    # Confirmation suppression
├── Analytics/
│   ├── KPICard.jsx             # Carte KPI
│   ├── MonthlyChart.jsx        # Graphique mensuel
│   ├── HoursChart.jsx          # Heures par projet
│   ├── TopClientsChart.jsx     # Top clients
│   ├── QuotePipelineChart.jsx  # Pipeline devis
│   └── ProjectStatusChart.jsx  # Répartition statuts
├── Automations/
│   ├── AutomationBuilder.jsx   # Canvas @xyflow/react
│   ├── NewAutomationModal.jsx  # Modal création
│   ├── NodeConfigPanel.jsx     # Config panel pour chaque node
│   └── nodes/                  # ActionNode, ConditionNode, TriggerNode, WaitNode
├── Settings/
│   ├── PersonnalisationTab.jsx # Config entreprise + facturation
│   └── ServicesTab.jsx         # Catalogue services
└── Layout/
    ├── Layout.jsx              # Wrapper avec nav
    └── Header.jsx              # Header avec nav links
```

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **Chrome DevTools MCP** : Seul le thread principal peut l'utiliser, pas les subagents
- **SSH** : `ssh swigs@192.168.110.59` pour accès DB et serveur
- **MongoDB** : `mongosh` puis `use swigs-workflow`
- **Pas de tests automatisés** existants
- **L'utilisateur parle français** — communiquer en français
- **L'utilisateur est le seul utilisateur actif** — ses patterns d'usage sont représentatifs
- **Priorité** : fiabilité et utilisabilité > nouvelles features
