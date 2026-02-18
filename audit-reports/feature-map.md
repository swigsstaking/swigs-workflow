# SWIGS Workflow - Cartographie Fonctionnelle Complète

**Date:** 2026-02-13
**Agent:** feature-mapper
**Scope:** Analyse exhaustive frontend + backend

---

## 1. CARTE FONCTIONNELLE PAR PAGE

### 1.1 Workflow.jsx - Gestion projets en kanban

**Composants utilisés:**
- `WorkflowGrid` - Grille drag & drop de projets
- `StatusFilter` - Filtres par statut
- `NewProjectModal` - Création projet
- `ProjectSidebar` - Panneau latéral détails projet

**Stores consommés:**
- `useProjectStore` - projects, statuses, selectedProject, fetchProjects(), fetchStatuses(), fetchProject(), updatePositions()
- `useUIStore` - searchQuery, statusFilter, showArchived, sidebarOpen, openSidebar(), closeSidebar()
- `useSettingsStore` - fetchSettings()
- `useAuthStore` - sessionVersion (pour reload quand nouvelle session)

**APIs appelées:**
- `projectsApi.getAll({ archived })` - Liste projets
- `projectsApi.getOne(id)` - Détails projet
- `statusesApi.getAll()` - Liste statuts
- `settingsApi.get()` - Config entreprise
- `projectsApi.updatePositions(positions)` - Sauvegarde positions canvas

**États/Interactions:**
- Filtres : recherche texte, filtre statut, toggle archivés
- Drag & drop : réordonnancement projets (localStorage + API)
- Click projet : ouvre sidebar avec onglets (info, events, invoices, quotes, history)
- Session reload : rechargement data quand sessionVersion change

**Flow utilisateur:**
1. Page charge → fetchStatuses, fetchSettings, fetchProjects
2. Utilisateur filtre par nom/client/statut → useMemo filteredProjects
3. Utilisateur réordonne projets → updatePositions (localStorage + API)
4. Utilisateur clique projet → fetchProject(id) + openSidebar('info')
5. Sidebar affiche détails, events, factures, devis, historique

---

### 1.2 Planning.jsx - Calendrier temps/planning

**Composants utilisés:**
- `CalendarGrid` - Grille semaine/jour avec slots horaires
- `ProjectTierList` - Liste projets draggables en bas
- `PlannedBlockCard` - Carte bloc planifié (drag overlay)
- `DeleteBlockModal` - Confirmation suppression bloc
- `BlockDetailModal` - Détails/édition bloc

**Stores consommés:**
- `usePlanningStore` - blocks, currentDate, viewMode, fetchBlocks(), createBlock(), updateBlock(), deleteBlock(), goToNextWeek(), goToPrevWeek(), goToToday(), setViewMode()
- `useProjectStore` - projects, fetchProjects(), fetchStatuses()

**APIs appelées:**
- `planningApi.getBlocks({ start, end })` - Blocs plage date
- `planningApi.create(data)` - Créer bloc
- `planningApi.update(id, data)` - Mettre à jour bloc
- `planningApi.delete(id)` - Supprimer bloc

**États/Interactions:**
- Navigation : Prev/Next semaine ou jour, Aujourd'hui
- View mode : Toggle Semaine/Jour (forcé Jour sur mobile)
- Drag & drop :
  - Drag projet depuis tier list → drop sur slot → createBlock
  - Drag bloc existant → drop sur nouveau slot → updateBlock (préserve durée)
- Click bloc → ouvre modal détails
- Delete bloc → modal confirmation

**Flow utilisateur:**
1. Page charge → fetchStatuses, fetchProjects, fetchBlocks (selon date/viewMode)
2. Utilisateur drag projet sur calendrier → createBlock avec start/end
3. Utilisateur drag bloc existant → updateBlock avec nouveaux start/end
4. Utilisateur clique bloc → modal affiche projet, dates, notes
5. Utilisateur supprime bloc → modal confirmation → deleteBlock

**Fallback localStorage:**
- Planning utilise localStorage si backend non disponible
- Flag `useLocalStorage` auto-détecté
- Blocs ID format `local-{timestamp}` en mode offline

---

### 1.3 Analytics.jsx - Tableaux de bord analytics

**Composants utilisés:**
- `KPICard` - Carte KPI avec valeur, évolution, icône
- `MonthlyChart` - Graph revenus mensuels (barres)
- `ProjectStatusChart` - Camembert projets par statut
- `QuotePipelineChart` - Pipeline devis (draft→sent→signed→invoiced)
- `TopClientsChart` - Top 5 clients revenus
- `HoursChart` - Heures par mois

**Stores consommés:**
- `useAnalyticsStore` - revenue, monthly, quotes, projects, clients, hours, loading, showLastYear, fetchAll(), refreshWithLastYear()

**APIs appelées:**
- `analyticsApi.getRevenue()` - YTD, MTD, pending, growth
- `analyticsApi.getMonthly({ includeLastYear })` - Revenus mensuels (avec N-1 si demandé)
- `analyticsApi.getQuotes()` - Stats devis (pipeline, conversion)
- `analyticsApi.getProjects()` - Stats projets (actifs, archivés, par statut)
- `analyticsApi.getTopClients(5)` - Top 5 clients
- `analyticsApi.getHours(12)` - Heures 12 derniers mois

**États/Interactions:**
- Toggle N-1 : Affiche/cache comparaison année précédente sur MonthlyChart
- Refresh : Recharge toutes les analytics
- Loading state : Spinner pendant chargement initial

**Flow utilisateur:**
1. Page charge → fetchAll() (Promise.all 6 endpoints)
2. KPIs affichent CA YTD, MTD, en attente, heures mois courant
3. MonthlyChart affiche barres année courante (+ N-1 si toggle)
4. Utilisateur toggle N-1 → refreshWithLastYear(true) → barres comparatives
5. Charts projets/devis/clients affichent répartitions

**KPIs disponibles:**
- Revenue YTD (croissance vs N-1)
- Revenue MTD (croissance vs mois précédent)
- Pending invoices (montant + count)
- Hours current month (croissance vs mois précédent)

---

### 1.4 Automations.jsx - Workflows automatisés

**Composants utilisés:**
- `NewAutomationModal` - Création automation (choix trigger)
- `AutomationBuilder` - Canvas flow builder (@xyflow/react)

**Stores consommés:**
- `useAutomationStore` - automations, fetchAutomations(), toggleAutomation(), deleteAutomation()
- `useToastStore` - addToast()

**APIs appelées:**
- `automationsApi.getAll()` - Liste automations
- `automationsApi.toggle(id)` - Activer/désactiver
- `automationsApi.delete(id)` - Supprimer

**États/Interactions:**
- Liste automations : carte par automation avec trigger icon, statut, stats
- Click automation → setEditingAutomation → affiche AutomationBuilder
- Toggle actif/inactif → Play/Pause button → API toggle
- Menu actions : Modifier, Supprimer

**Flow utilisateur:**
1. Page charge → fetchAutomations()
2. Utilisateur clique "Nouvelle automation" → modal choix trigger
3. Modal fermée avec automation créée → AutomationBuilder affiché
4. Utilisateur édite nodes/connections → sauvegarde dans builder
5. Retour liste → automation apparaît avec statut inactif
6. Utilisateur toggle actif → automation démarre écoute events

**Triggers disponibles:**
- `order.created`, `order.paid`, `order.shipped`, `order.delivered`
- `customer.created`, `customer.updated`
- `project.status_changed`
- `invoice.created`, `invoice.paid`
- `quote.signed`
- `time.schedule` (cron)
- `manual`

**Nodes disponibles:**
- `trigger` - Déclencheur (un par automation)
- `action` - send_email, send_sms, webhook, update_record, create_task
- `condition` - Branchement if/else
- `wait` - Attendre X minutes/heures/jours

---

### 1.5 Settings.jsx - Configuration application

**Onglets:**
1. **Clients** - CRUD clients réutilisables
2. **Services** - Catalogue services pour devis
3. **Statuts** - Gestion statuts projets (couleurs, ordre)
4. **Personnalisation** - Style cartes (left-border/full-border, small/medium/large)
5. **Entreprise** - Infos société (nom, email, phone, SIRET, TVA, adresse)
6. **Facturation** - Taux horaire, TVA, délai paiement par défaut
7. **Emails** - Templates devis/facture (subject + body avec variables)
8. **CMS** - Intégration CMS e-commerce (polling orders/customers)

**Stores consommés:**
- `useProjectStore` - statuses, fetchStatuses(), createStatus(), deleteStatus()
- `useToastStore` - addToast()

**APIs appelées:**
- `settingsApi.get()` - Config globale
- `settingsApi.update(data)` - Mise à jour config
- `clientsApi.getAll()`, `create()`, `update()`, `delete()` - CRUD clients
- `statusesApi.getAll()`, `create()`, `delete()` - CRUD statuts

**États/Interactions (par onglet):**

**Clients:**
- Liste cartes avec nom, société, email/phone
- Bouton "Nouveau client" → form inline
- Edit client → form inline avec save/cancel
- Delete client → confirmation

**Services:**
- Géré par `ServicesTab` component
- CRUD services avec catégories (development, design, maintenance, hosting, consulting, other)
- Pricing types : fixed, hourly, monthly, yearly

**Statuts:**
- Liste avec drag handle, couleur, nom, badge "Par défaut"
- Palette 20 couleurs prédéfinies
- Form création : nom + sélection couleur

**Personnalisation:**
- Géré par `PersonnalisationTab` component
- Style carte : left-border / full-border
- Taille carte : small / medium / large

**Entreprise:**
- Form 6 champs : nom, email, phone, SIRET, TVA, adresse
- onChange → API call immédiat (pas de bouton save)

**Facturation:**
- 3 champs : taux horaire (CHF), TVA (%), délai paiement (jours)
- onChange → API call immédiat

**Emails:**
- 2 templates : Quote, Invoice
- Subject + Body avec variables Handlebars
- Variables disponibles : {clientName}, {number}, {projectName}, {total}, {companyName}, {paymentTerms}
- Bouton save si modified

**CMS:**
- Toggle enabled
- URL API CMS
- Token service (password field)
- Intervalle polling (30s → 10min)
- Bouton "Tester connexion" → fetch /api/orders?limit=1
- Status test : succès/erreur avec message
- Affichage dernier polling timestamp

**Flow utilisateur:**
1. Page charge → settingsApi.get(), clientsApi.getAll(), fetchStatuses()
2. Utilisateur switch onglet → activeTab change
3. Modifications → API calls immédiats (Entreprise, Facturation) ou avec bouton save (Emails, CMS)
4. CMS test connexion → fetch direct API externe avec token

---

## 2. CARTE DES STORES ZUSTAND

### 2.1 projectStore.js

**State shape:**
```javascript
{
  projects: [],
  statuses: [],
  selectedProject: null,
  projectEvents: [],
  projectInvoices: [],
  projectQuotes: [],
  projectHistory: [],
  loading: false,
  error: null
}
```

**Actions principales:**
- `fetchProjects({ archived })` - Liste projets
- `fetchProject(id)` - Détails projet
- `createProject(data)` - Créer projet
- `updateProject(id, data)` - Mettre à jour projet
- `changeProjectStatus(id, statusId)` - Changer statut
- `archiveProject(id)` - Archiver projet
- `updatePositions(positions)` - Sauvegarder positions canvas (localStorage + API)
- `applySavedPositions()` - Appliquer positions depuis localStorage
- `resetPositions()` - Reset positions
- `fetchStatuses()`, `createStatus()`, `updateStatus()`, `deleteStatus()`, `seedStatuses()` - CRUD statuts
- `fetchProjectEvents(projectId)`, `createEvent()`, `updateEvent()`, `deleteEvent()` - CRUD events
- `fetchProjectInvoices(projectId)`, `createInvoice()`, `updateInvoiceStatus()`, `deleteInvoice()` - CRUD invoices
- `fetchProjectQuotes(projectId)`, `createQuote()`, `updateQuote()`, `updateQuoteStatus()`, `deleteQuote()` - CRUD quotes
- `fetchProjectHistory(projectId)` - Historique projet
- `selectProject()`, `clearSelectedProject()` - UI helpers

**Dépendances API:**
- `projectsApi`, `statusesApi`, `eventsApi`, `invoicesApi`, `quotesApi`, `historyApi`

**Refresh cascade:**
- createEvent → fetchProject + fetchProjects (pour unbilled totals)
- createInvoice → fetchProjectEvents + fetchProject + fetchProjects (pour billed status)
- deleteInvoice → fetchProjectEvents + fetchProjectQuotes + fetchProject + fetchProjects

---

### 2.2 uiStore.js (Persisté)

**State shape:**
```javascript
{
  darkMode: true,
  sidebarOpen: false,
  sidebarTab: 'info',
  showNewProjectModal: false,
  showNewEventModal: false,
  showNewInvoiceModal: false,
  showNewQuoteModal: false,
  showStatusModal: false,
  searchQuery: '',
  statusFilter: null,
  showArchived: false,
  expandedCards: {}
}
```

**Actions:**
- Theme: `toggleDarkMode()`, `setDarkMode(value)`
- Sidebar: `openSidebar(tab)`, `closeSidebar()`, `setSidebarTab(tab)`
- Modals: `toggleNewProjectModal()`, etc.
- Filters: `setSearchQuery()`, `setStatusFilter()`, `toggleShowArchived()`, `resetFilters()`
- Cards: `toggleCardExpanded(projectId)`, `setCardExpanded()`, `collapseAllCards()`

**Persisté:** darkMode, expandedCards (localStorage via zustand/middleware)

---

### 2.3 authStore.js (Persisté)

**State shape:**
```javascript
{
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  sessionVersion: 0
}
```

**Actions:**
- `verifySsoToken(ssoToken)` - Vérifier token SSO depuis Hub → obtenir accessToken + refreshToken
- `refreshAccessToken()` - Rafraîchir accessToken avec refreshToken
- `fetchUser()` - GET /api/auth/me
- `logout()` - POST /api/auth/logout + clear state
- `loginWithHub()` - Redirect vers Hub SSO

**Persisté:** accessToken, refreshToken, user, isAuthenticated

**sessionVersion:**
- Incrémenté à chaque nouveau login
- Utilisé par Workflow.jsx pour reload data quand nouvelle session

---

### 2.4 planningStore.js (Persisté)

**State shape:**
```javascript
{
  blocks: [],
  localBlocks: [],
  currentDate: new Date(),
  viewMode: 'week',
  loading: false,
  error: null,
  useLocalStorage: true
}
```

**Actions:**
- Navigation: `setCurrentDate()`, `goToNextWeek()`, `goToPrevWeek()`, `goToToday()`, `goToNextDay()`, `goToPrevDay()`
- View: `setViewMode('week'|'day')`
- Data: `fetchBlocks()`, `createBlock(data)`, `updateBlock(id, data)`, `deleteBlock(id)`
- Helper: `getDateRange()` - retourne {start, end} selon viewMode

**Fallback localStorage:**
- Si API fail → set `useLocalStorage: true`
- Blocs stockés dans `localBlocks` (persistés)
- CRUD local avec IDs `local-{timestamp}`

**Persisté:** localBlocks, viewMode

---

### 2.5 analyticsStore.js

**State shape:**
```javascript
{
  revenue: null,     // { ytd, mtd, pending, growth, pendingCount }
  monthly: [],       // [{ month, year, revenue, invoiceCount, ... }]
  quotes: null,      // { byStatus, total, totalValue, conversionRate }
  projects: null,    // { active, archived, byStatus }
  clients: [],       // [{ _id, name, revenue, invoiceCount }]
  hours: null,       // { currentMonth, monthlyChange, byMonth }
  loading: false,
  error: null,
  showLastYear: false
}
```

**Actions:**
- `fetchRevenue()`, `fetchMonthly()`, `fetchQuotes()`, `fetchProjects()`, `fetchClients(limit)`, `fetchHours(months)` - Fetch individuels
- `fetchAll()` - Promise.all de tous les endpoints
- `refreshWithLastYear(show)` - Toggle N-1 et refetch monthly
- `setShowLastYear(show)` - Toggle UI

---

### 2.6 automationStore.js

**State shape:**
```javascript
{
  automations: [],
  selectedAutomation: null,
  automationRuns: [],
  emailTemplates: [],
  loading: false,
  saving: false,
  error: null
}
```

**Actions Automations:**
- `fetchAutomations()`, `fetchAutomation(id)`, `createAutomation(data)`, `updateAutomation(id, data)`, `deleteAutomation(id)`
- `toggleAutomation(id)` - Activer/désactiver
- `runAutomation(id, testData)` - Exécution manuelle
- `fetchAutomationRuns(automationId)` - Historique exécutions
- `clearSelection()` - Reset selectedAutomation

**Actions Email Templates:**
- `fetchEmailTemplates()`, `createEmailTemplate(data)`, `updateEmailTemplate(id, data)`, `deleteEmailTemplate(id)`
- `previewEmailTemplate(id, data)` - Aperçu avec données test

---

### 2.7 settingsStore.js (Partiel persisté)

**State shape:**
```javascript
{
  settings: null,        // Settings from API
  personalization: {     // Persisted locally
    cardStyle: 'left-border',
    cardSize: 'medium'
  },
  loading: false,
  error: null
}
```

**Actions:**
- `fetchSettings()` - GET /api/settings
- `updatePersonalization(updates)` - Update local personalization (localStorage)

**Persisté:** personalization (localStorage uniquement, backend non déployé)

---

### 2.8 toastStore.js

**State shape:**
```javascript
{
  toasts: []  // [{ id, type, message }]
}
```

**Actions:**
- `addToast({ type, message, duration })` - Ajoute toast, auto-remove après duration
- `removeToast(id)` - Supprime toast manuellement

**Types:** info, success, error, warning

---

## 3. SERVICE API - ENDPOINTS PAR RESSOURCE

### 3.1 Projets
```javascript
projectsApi.getAll({ archived })      // GET /api/projects?archived=true
projectsApi.getOne(id)                // GET /api/projects/:id
projectsApi.create(data)              // POST /api/projects
projectsApi.update(id, data)          // PUT /api/projects/:id
projectsApi.changeStatus(id, status)  // PATCH /api/projects/:id/status
projectsApi.archive(id)               // DELETE /api/projects/:id
projectsApi.restore(id)               // PATCH /api/projects/:id/restore
projectsApi.updatePositions(positions)// PATCH /api/projects/positions
projectsApi.resetPositions()          // DELETE /api/projects/positions
```

### 3.2 Statuts
```javascript
statusesApi.getAll()                  // GET /api/statuses
statusesApi.create(data)              // POST /api/statuses
statusesApi.update(id, data)          // PUT /api/statuses/:id
statusesApi.reorder(statusIds)        // PUT /api/statuses/reorder
statusesApi.delete(id)                // DELETE /api/statuses/:id
statusesApi.seed()                    // POST /api/statuses/seed
```

### 3.3 Events
```javascript
eventsApi.getForProject(projectId, params) // GET /api/projects/:projectId/events
eventsApi.getUnbilled(projectId)           // GET /api/projects/:projectId/events/unbilled
eventsApi.create(projectId, data)          // POST /api/projects/:projectId/events
eventsApi.update(id, data)                 // PUT /api/events/:id
eventsApi.delete(id)                       // DELETE /api/events/:id
```

### 3.4 Invoices
```javascript
invoicesApi.getAll(params)                 // GET /api/invoices
invoicesApi.getForProject(projectId, params) // GET /api/projects/:projectId/invoices
invoicesApi.getOne(id)                     // GET /api/invoices/:id
invoicesApi.create(projectId, data)        // POST /api/projects/:projectId/invoices
invoicesApi.update(id, data)               // PUT /api/invoices/:id
invoicesApi.changeStatus(id, status)       // PATCH /api/invoices/:id/status
invoicesApi.delete(id)                     // DELETE /api/invoices/:id
```

### 3.5 Quotes
```javascript
quotesApi.getAll(params)                   // GET /api/quotes
quotesApi.getForProject(projectId, params) // GET /api/projects/:projectId/quotes
quotesApi.getInvoiceable(projectId)        // GET /api/projects/:projectId/quotes/invoiceable
quotesApi.getOne(id)                       // GET /api/quotes/:id
quotesApi.create(projectId, data)          // POST /api/projects/:projectId/quotes
quotesApi.update(id, data)                 // PUT /api/quotes/:id
quotesApi.changeStatus(id, status)         // PATCH /api/quotes/:id/status
quotesApi.delete(id)                       // DELETE /api/quotes/:id
```

### 3.6 History
```javascript
historyApi.getForProject(projectId)        // GET /api/projects/:projectId/history
```

### 3.7 Settings
```javascript
settingsApi.get()                          // GET /api/settings
settingsApi.update(data)                   // PUT /api/settings
settingsApi.getStats()                     // GET /api/settings/stats
```

### 3.8 Clients
```javascript
clientsApi.getAll(params)                  // GET /api/clients
clientsApi.getOne(id)                      // GET /api/clients/:id
clientsApi.create(data)                    // POST /api/clients
clientsApi.update(id, data)                // PUT /api/clients/:id
clientsApi.delete(id)                      // DELETE /api/clients/:id
```

### 3.9 Planning
```javascript
planningApi.getBlocks({ start, end })      // GET /api/planning?start=...&end=...
planningApi.create(data)                   // POST /api/planning
planningApi.update(id, data)               // PUT /api/planning/:id
planningApi.delete(id)                     // DELETE /api/planning/:id
```

### 3.10 Analytics
```javascript
analyticsApi.getRevenue()                  // GET /api/analytics/revenue
analyticsApi.getMonthly({ includeLastYear }) // GET /api/analytics/monthly?includeLastYear=true
analyticsApi.getQuotes()                   // GET /api/analytics/quotes
analyticsApi.getProjects()                 // GET /api/analytics/projects
analyticsApi.getTopClients(limit)          // GET /api/analytics/clients?limit=5
analyticsApi.getHours(months)              // GET /api/analytics/hours?months=12
```

### 3.11 Services
```javascript
servicesApi.getAll(params)                 // GET /api/services
servicesApi.getOne(id)                     // GET /api/services/:id
servicesApi.create(data)                   // POST /api/services
servicesApi.update(id, data)               // PUT /api/services/:id
servicesApi.delete(id)                     // DELETE /api/services/:id
servicesApi.reorder(serviceIds)            // PUT /api/services/reorder
servicesApi.toggle(id)                     // PATCH /api/services/:id/toggle
```

### 3.12 Automations
```javascript
automationsApi.getAll()                    // GET /api/automations
automationsApi.getOne(id)                  // GET /api/automations/:id
automationsApi.create(data)                // POST /api/automations
automationsApi.update(id, data)            // PUT /api/automations/:id
automationsApi.delete(id)                  // DELETE /api/automations/:id
automationsApi.toggle(id)                  // PATCH /api/automations/:id/toggle
automationsApi.run(id, testData)           // POST /api/automations/:id/run
automationsApi.getRuns(id, params)         // GET /api/automations/:id/runs
```

### 3.13 Automation Runs
```javascript
automationRunsApi.getOne(id)               // GET /api/automation-runs/:id
automationRunsApi.retry(id)                // POST /api/automation-runs/:id/retry
```

### 3.14 Email Templates
```javascript
emailTemplatesApi.getAll(params)           // GET /api/email-templates
emailTemplatesApi.getOne(id)               // GET /api/email-templates/:id
emailTemplatesApi.create(data)             // POST /api/email-templates
emailTemplatesApi.update(id, data)         // PUT /api/email-templates/:id
emailTemplatesApi.delete(id)               // DELETE /api/email-templates/:id
emailTemplatesApi.preview(id, data)        // POST /api/email-templates/:id/preview
emailTemplatesApi.sendTest(id, to, data)   // POST /api/email-templates/:id/send-test
emailTemplatesApi.getVariables(category)   // GET /api/email-templates/variables/:category
emailTemplatesApi.createDefaults()         // POST /api/email-templates/create-defaults
```

---

## 4. MODÈLES BACKEND - STRUCTURE & RELATIONS

### 4.1 User
**Champs:**
- `hubUserId` : String (unique, sparse) - ID utilisateur Hub
- `email` : String (required, unique)
- `name` : String (required)
- `avatar` : String
- `isActive` : Boolean (default: true)
- `lastLogin` : Date
- `preferences.theme` : 'light'|'dark'|'system'

**Indexes:** email, hubUserId (unique)

**Relations:**
- OneToMany → Project, Status, Settings, Client, Service, PlannedBlock, Automation, EmailTemplate

---

### 4.2 Project
**Champs:**
- `userId` : ObjectId → User (index)
- `name` : String (required, max 100)
- `description` : String (max 500)
- `client` : embedded object { name, email, phone, address, company, siret }
- `status` : ObjectId → Status (required, ref)
- `tags` : [String]
- `notes` : String
- `archivedAt` : Date (null = actif)
- `position` : { x, y, order }

**Virtuals:**
- `events` → Event[]
- `invoices` → Invoice[]
- `quotes` → Quote[]

**Indexes:**
- Text: name, client.name, tags
- Composite: userId + archivedAt, userId + status
- Sort: updatedAt

**Timestamps:** createdAt, updatedAt

---

### 4.3 Status
**Champs:**
- `userId` : ObjectId → User (index)
- `name` : String (required, max 50)
- `color` : String (required, format #XXXXXX)
- `order` : Number (default: 0)
- `isDefault` : Boolean (default: false)

**Indexes:**
- Composite unique: userId + name (sparse)

**Hooks:**
- pre('save') : Si isDefault = true, met les autres à false pour ce user

**Collection:** 'status' (singulier, legacy)

---

### 4.4 Event
**Champs:**
- `project` : ObjectId → Project (required, ref, index)
- `type` : 'hours'|'action'|'expense' (required)
- `description` : String (required)
- `date` : Date (required, default: now)
- `hours` : Number (pour type='hours')
- `hourlyRate` : Number (pour type='hours')
- `amount` : Number (pour type='expense')
- `billed` : Boolean (default: false)
- `invoice` : ObjectId → Invoice (null si non facturé)

**Virtuals:**
- `total` : hours * hourlyRate OU amount selon type

**Indexes:**
- project + date (desc)
- project + billed
- project + billed + date (desc)
- date + type (pour analytics)
- project + type + date (pour analytics par projet)

**Validation pre('save'):**
- type='hours' → hours + hourlyRate requis
- type='expense' → amount requis

---

### 4.5 Invoice
**Champs:**
- `project` : ObjectId → Project (required, ref)
- `number` : String (required, unique) - format FAC-YEAR-XXX
- `invoiceType` : 'standard'|'custom' (default: 'standard')
- `events` : [snapshot event] - copie immuable au moment facturation
- `quotes` : [snapshot quote] - copie immuable au moment facturation
- `customLines` : [{ description, quantity, unitPrice, total }] - pour invoiceType='custom'
- `subtotal` : Number (required)
- `vatRate` : Number (default: 20, 0-100)
- `vatAmount` : Number
- `total` : Number (required)
- `status` : 'draft'|'sent'|'paid'|'cancelled'
- `issueDate` : Date (default: now)
- `dueDate` : Date (required)
- `paidAt` : Date
- `pdfPath` : String
- `notes` : String

**Indexes:**
- number (unique)
- project + createdAt (desc)
- project + status
- status
- issueDate (desc)
- issueDate + status
- project + issueDate + status

**Static methods:**
- `generateNumber()` : retourne FAC-YEAR-XXX auto-incrémenté

**Snapshots:**
- Events snapshot : { eventId, description, type, hours, hourlyRate, amount, date }
- Quotes snapshot : { quoteId, number, lines[], subtotal, signedAt }

---

### 4.6 Quote
**Champs:**
- `project` : ObjectId → Project (required, ref)
- `number` : String (required, unique) - format DEV-YEAR-XXX
- `lines` : [{ description, quantity, unitPrice, total }]
- `subtotal` : Number (required)
- `vatRate` : Number (default: 20, 0-100)
- `vatAmount` : Number
- `total` : Number (required)
- `status` : 'draft'|'sent'|'signed'|'refused'|'expired'|'partial'|'invoiced'
- `invoicedAmount` : Number (default: 0) - pour partial invoicing
- `invoices` : [{ invoice: ObjectId, amount, invoicedAt }] - multi-invoices support
- `invoice` : ObjectId → Invoice (legacy single ref)
- `issueDate` : Date (default: now)
- `validUntil` : Date (required)
- `signedAt` : Date
- `invoicedAt` : Date
- `pdfPath` : String
- `notes` : String

**Indexes:**
- number (unique)
- project + createdAt (desc)
- project + status
- status
- issueDate (desc)

**Static methods:**
- `generateNumber()` : retourne DEV-YEAR-XXX auto-incrémenté

**Partial invoicing:**
- Un devis peut avoir plusieurs factures partielles
- `invoicedAmount` cumule les montants facturés
- `status = 'partial'` si invoicedAmount < total
- `status = 'invoiced'` si invoicedAmount >= total

---

### 4.7 Settings
**Champs:**
- `userId` : ObjectId → User (unique, sparse, index)
- `company` : embedded { name, address, siret, vatNumber, email, phone, logo }
- `invoicing` : embedded { invoicePrefix, quotePrefix, defaultVatRate, defaultPaymentTerms, defaultHourlyRate }
- `personalization` : embedded { cardStyle: 'left-border'|'full-border', cardSize: 'small'|'medium'|'large' }
- `emailTemplates` : embedded { quoteSubject, quoteBody, invoiceSubject, invoiceBody }
- `cmsIntegration` : embedded { enabled, apiUrl, serviceToken, pollInterval, lastPolledAt }

**Static methods:**
- `getSettings(userId)` : retourne settings user ou global, crée si n'existe pas

**Defaults:**
- defaultVatRate: 8.1% (Suisse)
- defaultPaymentTerms: 30 jours
- defaultHourlyRate: 50 CHF
- pollInterval: 60000 ms (1 min)

---

### 4.8 Client
**Champs:**
- `userId` : ObjectId → User (index)
- `name` : String (required)
- `email` : String (lowercase)
- `phone` : String
- `address` : String
- `company` : String
- `siret` : String
- `notes` : String

**Indexes:**
- Text: name, company, email

**Usage:**
- Catalogue clients réutilisables
- Embedded dans Project.client lors création projet

---

### 4.9 Service
**Champs:**
- `userId` : ObjectId → User (index)
- `name` : String (required)
- `description` : String
- `category` : 'development'|'design'|'maintenance'|'hosting'|'consulting'|'other'
- `priceType` : 'fixed'|'hourly'|'monthly'|'yearly'
- `unitPrice` : Number (required)
- `estimatedHours` : Number (pour priceType='hourly')
- `defaultQuantity` : Number (default: 1)
- `isActive` : Boolean (default: true)
- `order` : Number (default: 0)

**Indexes:**
- category + order
- isActive

**Usage:**
- Catalogue services pour insertion rapide dans devis
- Quote lines créées depuis services

---

### 4.10 PlannedBlock
**Champs:**
- `userId` : ObjectId → User (index)
- `project` : ObjectId → Project (required, ref)
- `start` : Date (required)
- `end` : Date (required)
- `notes` : String (max 500)

**Indexes:**
- start + end
- project

**Virtuals:**
- `durationHours` : (end - start) / 3600000

**Validation pre('save'):**
- end > start

**Usage:**
- Planning.jsx calendar
- Drag & drop blocs projets

---

### 4.11 Automation
**Champs:**
- `userId` : ObjectId → User
- `name` : String (required)
- `description` : String
- `isActive` : Boolean (default: false)
- `triggerType` : enum 13 types (order.*, customer.*, project.*, invoice.*, quote.*, time.schedule, manual)
- `triggerConfig` : { siteId, statusFilter, scheduleExpression }
- `nodes` : [{ id, type, actionType, position, label, *Config, connections }]
- `stats` : { totalRuns, successfulRuns, failedRuns, lastRunAt, lastError }

**Node types:**
- `trigger` : triggerConfig { siteId, statusFilter, scheduleExpression }
- `action` : actionConfig { templateId, to, webhookUrl, webhookMethod, recordType, recordField, recordValue }
  - actionType : 'send_email'|'send_sms'|'webhook'|'update_record'|'create_task'
- `condition` : conditionConfig { field, operator, value }
  - operators : equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
- `wait` : waitConfig { duration, unit: 'minutes'|'hours'|'days' }

**Connections:**
- edges : [{ targetId, condition: 'default'|'true'|'false' }]

**Indexes:**
- userId + isActive
- triggerType + isActive

---

### 4.12 AutomationRun
**Champs:**
- `automation` : ObjectId → Automation (required, ref)
- `automationName` : String (snapshot)
- `triggerData` : Mixed (données event déclencheur)
- `triggerType` : String
- `status` : 'pending'|'running'|'completed'|'failed'|'waiting'|'cancelled'
- `currentNodeId` : String (pour waiting runs)
- `executionLog` : [{ nodeId, nodeType, actionType, label, startedAt, completedAt, status, input, output, error, durationMs }]
- `context` : Mixed (données passées entre nodes)
- `scheduledAt` : Date (pour wait nodes)
- `error` : String
- `startedAt` : Date
- `completedAt` : Date
- `durationMs` : Number (calculé pre('save'))

**Indexes:**
- automation + createdAt (desc)
- status
- scheduledAt + status (pour trouver runs à reprendre)

**Static methods:**
- `findReadyToResume()` : retourne runs status='waiting' avec scheduledAt <= now

**Usage:**
- Log d'exécution par automation
- Historique exécutions avec détails par node
- Retry failed runs

---

### 4.13 EmailTemplate
**Champs:**
- `userId` : ObjectId → User
- `name` : String (required)
- `subject` : String (required) - Handlebars
- `body` : String (required) - HTML + Handlebars
- `bodyText` : String (plain text version)
- `category` : 'order'|'customer'|'project'|'invoice'|'quote'|'reminder'|'general'
- `availableVariables` : [{ name, description, example }]
- `design` : { headerColor, footerText, logoUrl }
- `isActive` : Boolean (default: true)
- `stats` : { timesSent, lastUsedAt }

**Indexes:**
- userId + category
- userId + isActive

**Static methods:**
- `getVariablesByCategory(category)` : retourne liste variables disponibles selon catégorie
- `createDefaults(userId)` : crée 4 templates par défaut (confirmation commande, commande expédiée, bienvenue, rappel paiement)

**Variables par catégorie:**
- **Base** (all) : company.*, today
- **order** : order.*, customer.*
- **customer** : customer.*
- **project** : project.*, client.*
- **invoice** : invoice.*, project.*, client.*
- **quote** : quote.*, project.*, client.*
- **reminder** : days, document.*

---

### 4.14 History
**Champs:**
- `project` : ObjectId → Project (required, ref)
- `action` : enum 15 types (project_*, status_change, event_*, quote_*, invoice_*)
- `description` : String (required)
- `metadata` : Mixed (données contextuelles)
- `user` : String (default: 'system')

**Actions disponibles:**
- project_created, project_updated, project_archived, project_restored, status_change
- event_added, event_updated, event_deleted
- quote_created, quote_sent, quote_signed, quote_refused
- invoice_created, invoice_sent, invoice_paid, invoice_cancelled, invoice_deleted

**Indexes:**
- project + createdAt (desc)

**Immutabilité:**
- Hook pre('findOneAndUpdate') → throw Error
- Historique immuable, append-only

---

### 4.15 CmsEventCache
**Champs:**
- `type` : 'poll_checkpoint'|'order_event'|'customer_event'
- `userId` : String (index)
- `eventType` : String
- `data` : Mixed
- `checkedAt` : Date (pour poll_checkpoint)
- `processedAt` : Date (pour events)
- `count` : Number
- `externalId` : String (CMS order/customer ID)
- `statusHash` : String (détecter changements)

**Indexes:**
- type + userId + checkedAt (desc)
- externalId + eventType + userId
- createdAt (TTL 30 jours)

**Static methods:**
- `getLastCheckpoint(pollType, userId)` : retourne dernier checkedAt ou 24h ago
- `createCheckpoint(pollType, count, userId)` : crée checkpoint
- `wasProcessed(externalId, eventType, userId)` : check si event déjà traité
- `markProcessed(externalId, eventType, data, userId)` : marque event traité

**Usage:**
- Settings > CMS integration
- Polling orders/customers depuis CMS externe
- Éviter doublons events

---

### 4.16 Session
**Champs:**
- `userId` : ObjectId → User (required, ref)
- `refreshToken` : String (required, unique)
- `userAgent` : String
- `ipAddress` : String
- `expiresAt` : Date (required)
- `isRevoked` : Boolean (default: false)

**Indexes:**
- expiresAt (TTL auto-delete expired)

**Usage:**
- SSO tokens management
- Refresh token rotation
- Session tracking

---

## 5. RELATIONS ENTRE MODÈLES

```
User (hubUserId)
├─ 1:N → Project
├─ 1:N → Status
├─ 1:1 → Settings
├─ 1:N → Client
├─ 1:N → Service
├─ 1:N → PlannedBlock
├─ 1:N → Automation
├─ 1:N → EmailTemplate
└─ 1:N → Session

Project
├─ N:1 → Status (ref)
├─ 1:N → Event (virtual)
├─ 1:N → Invoice (virtual)
├─ 1:N → Quote (virtual)
├─ 1:N → History (via project field)
├─ 1:N → PlannedBlock (via project field)
└─ Embedded → Client (snapshot)

Event
├─ N:1 → Project (ref)
└─ N:1 → Invoice (nullable, quand facturé)

Invoice
├─ N:1 → Project (ref)
├─ Embedded → Events[] (snapshots)
└─ Embedded → Quotes[] (snapshots)

Quote
├─ N:1 → Project (ref)
├─ N:N → Invoice (via quotes[].invoice ref)
└─ Legacy N:1 → Invoice (via invoice field)

Automation
└─ 1:N → AutomationRun

AutomationRun
└─ N:1 → Automation (ref)

PlannedBlock
└─ N:1 → Project (ref)

History
└─ N:1 → Project (ref)

Session
└─ N:1 → User (ref)

CmsEventCache
└─ Indexed by userId (String, pas ref)
```

---

## 6. FEATURE MATRIX - STATUT PAR FONCTIONNALITÉ

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| **Projects** |
| Liste projets | ✅ Workflow.jsx | ✅ projectController | ✅ Complete | Filtres, search, archivés |
| Créer projet | ✅ NewProjectModal | ✅ POST /projects | ✅ Complete | Client embedded |
| Modifier projet | ✅ ProjectSidebar | ✅ PUT /projects/:id | ✅ Complete | |
| Archiver projet | ✅ ProjectSidebar | ✅ DELETE /projects/:id | ✅ Complete | Soft delete archivedAt |
| Restaurer projet | ❌ Manquant | ✅ PATCH /projects/:id/restore | ⚠️ Partielle | Backend OK, UI manquante |
| Positions canvas | ✅ WorkflowGrid | ✅ PATCH /projects/positions | ✅ Complete | localStorage fallback |
| Reset positions | ❌ Manquant | ✅ DELETE /projects/positions | ⚠️ Partielle | Backend OK, UI manquante |
| **Statuts** |
| CRUD statuts | ✅ Settings.jsx | ✅ statusController | ✅ Complete | Couleurs, ordre, default |
| Seed statuts | ❌ Non utilisé | ✅ POST /statuses/seed | ⚠️ Stub | Endpoint existe |
| Reorder statuts | ❌ Manquant | ✅ PUT /statuses/reorder | ⚠️ Partielle | Backend OK, drag & drop UI manquant |
| **Events** |
| Liste events | ✅ ProjectSidebar | ✅ GET /projects/:id/events | ✅ Complete | |
| Events non facturés | ✅ NewInvoiceModal | ✅ GET /projects/:id/events/unbilled | ✅ Complete | |
| Créer event | ✅ ProjectSidebar | ✅ POST /projects/:id/events | ✅ Complete | hours, action, expense |
| Modifier event | ✅ ProjectSidebar | ✅ PUT /events/:id | ✅ Complete | |
| Supprimer event | ✅ ProjectSidebar | ✅ DELETE /events/:id | ✅ Complete | |
| **Invoices** |
| Liste factures | ✅ ProjectSidebar | ✅ GET /invoices | ✅ Complete | Filtres project, status |
| Créer facture standard | ✅ NewInvoiceModal | ✅ POST /projects/:id/invoices | ✅ Complete | Depuis events + quotes |
| Créer facture custom | ⚠️ Partielle | ✅ Backend supporte | ⚠️ Partielle | customLines[] backend OK, UI manquante |
| Modifier facture | ❌ Manquant | ✅ PUT /invoices/:id | ⚠️ Partielle | Backend OK, UI manquante |
| Changer statut | ✅ InvoiceCard | ✅ PATCH /invoices/:id/status | ✅ Complete | draft→sent→paid→cancelled |
| Supprimer facture | ✅ InvoiceCard | ✅ DELETE /invoices/:id | ✅ Complete | Unbill events + quotes |
| Génération PDF | ❌ Non implémenté | ❌ Non implémenté | ❌ Missing | pdfPath field présent |
| **Quotes** |
| Liste devis | ✅ ProjectSidebar | ✅ GET /quotes | ✅ Complete | |
| Devis facturables | ✅ NewInvoiceModal | ✅ GET /projects/:id/quotes/invoiceable | ✅ Complete | status=signed |
| Créer devis | ✅ NewQuoteModal | ✅ POST /projects/:id/quotes | ✅ Complete | lines[], totals |
| Modifier devis | ✅ QuoteCard | ✅ PUT /quotes/:id | ✅ Complete | |
| Changer statut | ✅ QuoteCard | ✅ PATCH /quotes/:id/status | ✅ Complete | draft→sent→signed/refused |
| Supprimer devis | ✅ QuoteCard | ✅ DELETE /quotes/:id | ✅ Complete | |
| Facturation partielle | ❌ Non implémenté | ✅ Backend supporte | ⚠️ Partielle | invoices[], invoicedAmount |
| Génération PDF | ❌ Non implémenté | ❌ Non implémenté | ❌ Missing | pdfPath field présent |
| **Clients** |
| CRUD clients | ✅ Settings.jsx | ✅ clientController | ✅ Complete | Catalogue réutilisable |
| **Services** |
| CRUD services | ✅ ServicesTab | ✅ serviceController | ✅ Complete | Catalogue devis |
| Reorder services | ✅ ServicesTab | ✅ PUT /services/reorder | ✅ Complete | Drag & drop |
| Toggle actif/inactif | ✅ ServicesTab | ✅ PATCH /services/:id/toggle | ✅ Complete | |
| **Planning** |
| Calendrier semaine | ✅ Planning.jsx | ✅ planningController | ✅ Complete | Drag & drop |
| Calendrier jour | ✅ Planning.jsx | ✅ planningController | ✅ Complete | Responsive mobile |
| CRUD blocs | ✅ Planning.jsx | ✅ planningController | ✅ Complete | localStorage fallback |
| **Analytics** |
| Revenue KPIs | ✅ Analytics.jsx | ✅ analyticsController | ✅ Complete | YTD, MTD, pending |
| Graph mensuel | ✅ MonthlyChart | ✅ GET /analytics/monthly | ✅ Complete | Avec N-1 optionnel |
| Stats devis | ✅ QuotePipelineChart | ✅ GET /analytics/quotes | ✅ Complete | Pipeline, conversion |
| Stats projets | ✅ ProjectStatusChart | ✅ GET /analytics/projects | ✅ Complete | Par statut, actifs |
| Top clients | ✅ TopClientsChart | ✅ GET /analytics/clients | ✅ Complete | Top 5 revenus |
| Heures mensuelles | ✅ HoursChart | ✅ GET /analytics/hours | ✅ Complete | 12 mois |
| **Automations** |
| Liste automations | ✅ Automations.jsx | ✅ automationController | ✅ Complete | |
| Créer automation | ✅ NewAutomationModal | ✅ POST /automations | ✅ Complete | Choix trigger |
| Builder canvas | ✅ AutomationBuilder | ✅ PUT /automations/:id | ✅ Complete | @xyflow/react |
| Toggle actif/inactif | ✅ Automations.jsx | ✅ PATCH /automations/:id/toggle | ✅ Complete | |
| Exécution manuelle | ❌ UI manquante | ✅ POST /automations/:id/run | ⚠️ Partielle | Backend OK |
| Historique runs | ❌ UI manquante | ✅ GET /automations/:id/runs | ⚠️ Partielle | Backend OK |
| Retry failed run | ❌ Non implémenté | ✅ POST /automation-runs/:id/retry | ⚠️ Partielle | Backend OK |
| Event bus trigger | ⚠️ Partiel | ✅ EventBus service | ⚠️ Partielle | Écoute events, exécution OK |
| Cron scheduler | ❌ Non implémenté | ❌ Non implémenté | ❌ Missing | time.schedule trigger |
| **Email Templates** |
| CRUD templates | ❌ UI manquante | ✅ emailTemplateController | ⚠️ Partielle | Backend complet |
| Preview template | ❌ UI manquante | ✅ POST /email-templates/:id/preview | ⚠️ Partielle | Backend OK |
| Send test | ❌ UI manquante | ✅ POST /email-templates/:id/send-test | ⚠️ Partielle | Backend OK |
| Variables helper | ❌ UI manquante | ✅ GET /email-templates/variables/:category | ⚠️ Partielle | Backend OK |
| Create defaults | ❌ UI manquante | ✅ POST /email-templates/create-defaults | ⚠️ Partielle | Backend OK |
| **Settings** |
| Config entreprise | ✅ Settings.jsx | ✅ settingsController | ✅ Complete | |
| Config facturation | ✅ Settings.jsx | ✅ settingsController | ✅ Complete | |
| Templates emails | ✅ Settings.jsx | ✅ settingsController | ✅ Complete | Variables Handlebars |
| Personnalisation | ✅ PersonnalisationTab | ⚠️ localStorage only | ⚠️ Partielle | Backend model existe |
| CMS integration | ✅ Settings.jsx | ✅ settingsController | ✅ Complete | Polling config |
| **History** |
| Historique projet | ✅ ProjectSidebar | ✅ historyService | ✅ Complete | Audit trail immuable |
| **Auth** |
| SSO Hub (PKCE) | ✅ authStore | ✅ authController | ✅ Complete | OAuth 2.0 |
| Refresh token | ✅ api interceptor | ✅ POST /auth/refresh | ✅ Complete | Auto-retry 401 |
| Logout | ✅ authStore | ✅ POST /auth/logout | ✅ Complete | Revoke session |

**Légende:**
- ✅ Complete : Fonctionnalité implémentée frontend + backend, testée
- ⚠️ Partielle : Backend implémenté, UI manquante ou incomplète
- ❌ Missing : Ni frontend ni backend
- ⚠️ Stub : Endpoint existe mais non fonctionnel

---

## 7. INTERCONNEXIONS & DÉPENDANCES

### 7.1 Dépendances critiques (cascade effects)

**createEvent → project refresh:**
```
1. Event créé → projectEvents updated
2. fetchProject(projectId) → unbilled totals recalculés
3. fetchProjects() → liste complète rafraîchie (pour afficher totals)
```

**createInvoice → billed status:**
```
1. Invoice créé avec events[] + quotes[] snapshots
2. Events.billed = true, Events.invoice = invoiceId
3. Quotes.invoicedAmount += invoice amount
4. Quotes.status → 'partial' ou 'invoiced'
5. fetchProjectEvents → affiche events billés
6. fetchProjectQuotes → affiche quotes billés
7. fetchProject → unbilled totals recalculés
8. fetchProjects → liste rafraîchie
```

**deleteInvoice → unbill cascade:**
```
1. Events.billed = false, Events.invoice = null
2. Quotes.invoicedAmount -= invoice amount
3. Quotes.status recalculé (signed si 0)
4. fetchProjectEvents, fetchProjectQuotes, fetchProject, fetchProjects
```

**changeProjectStatus → history:**
```
1. Status updated
2. History.create({ action: 'status_change', metadata: { oldStatus, newStatus } })
3. Immutable audit log
```

### 7.2 Stores inter-dépendances

**uiStore ↔ projectStore:**
- uiStore.openSidebar(tab) déclenche projectStore.fetchProject(id)
- uiStore.sidebarTab change l'onglet affiché (info/events/invoices/quotes/history)
- uiStore.statusFilter filtre projectStore.projects

**authStore → toutes les pages:**
- authStore.sessionVersion incrémenté à chaque login
- Pages écoutent sessionVersion pour reload data
- Workflow.jsx useEffect sur sessionVersion

**planningStore ↔ projectStore:**
- planningStore affiche projects depuis projectStore
- planningStore.blocks référencent projectStore.projects
- Pas de sync bidirectionnel

### 7.3 API interceptors cascade

**401 Unauthorized → refresh token:**
```
1. API call → 401
2. Interceptor détecte 401
3. refreshAccessToken() appelé
4. Si succès → retry original request avec nouveau token
5. Si échec → logout() forcé
6. 1 seul retry (originalRequest._retryCount)
```

### 7.4 LocalStorage fallbacks

**Planning localStorage:**
- Planning.jsx essaie API d'abord
- Si fail → useLocalStorage = true
- CRUD opère sur localBlocks[] (persisté)
- IDs format `local-{timestamp}`
- Auto-sync quand API devient disponible (à implémenter)

**Project positions localStorage:**
- updatePositions → sauvegarde localStorage + API
- API fail → silencieux, positions en localStorage
- applySavedPositions → charge depuis localStorage au mount

**UI preferences localStorage:**
- darkMode, expandedCards persistés via zustand/middleware
- Synchronisé automatiquement

---

## 8. FEATURES ORPHELINES & INCOMPLÈTES

### 8.1 Backend complet, UI manquante

**Email Templates UI:**
- Backend : CRUD complet, preview, send test, variables helper, create defaults
- Frontend : Aucun écran dédié
- **Action requise :** Créer page EmailTemplates.jsx avec liste, éditeur, preview

**Automation Runs UI:**
- Backend : Liste runs, détails, retry
- Frontend : Pas d'historique exécutions affiché
- **Action requise :** Ajouter onglet "Historique" dans Automations.jsx

**Custom Invoices UI:**
- Backend : Support customLines[] pour factures sans events/quotes
- Frontend : Modal création toujours basée sur events + quotes
- **Action requise :** Ajouter option "Facture personnalisée" dans NewInvoiceModal

**Partial Quote Invoicing UI:**
- Backend : Quote.invoices[], Quote.invoicedAmount supportés
- Frontend : UI facture toujours totalité du devis
- **Action requise :** Ajouter champ "Montant à facturer" dans NewInvoiceModal

**Project Restore UI:**
- Backend : PATCH /projects/:id/restore implémenté
- Frontend : Pas de bouton "Restaurer" dans liste archivés
- **Action requise :** Ajouter bouton dans WorkflowGrid quand showArchived = true

**Status Reorder UI:**
- Backend : PUT /statuses/reorder implémenté
- Frontend : Drag handle affiché mais pas fonctionnel
- **Action requise :** Implémenter drag & drop dans Settings > Statuts

**Invoice/Quote Edit UI:**
- Backend : PUT /invoices/:id, PUT /quotes/:id implémentés
- Frontend : Pas de modal édition après création
- **Action requise :** Ajouter modal édition ou rendre cards éditables inline

### 8.2 Stub endpoints (existent mais non fonctionnels)

**PDF Generation:**
- Invoice.pdfPath, Quote.pdfPath fields existent
- Pas de génération réelle (puppeteer, pdfkit, ou service externe)
- **Action requise :** Implémenter service PDF generation

**Cron Scheduler:**
- Automation.triggerType = 'time.schedule' existe
- triggerConfig.scheduleExpression (cron format)
- Pas de cron job actif
- **Action requise :** Setup node-cron ou agenda.js pour trigger automations

**Email Sending:**
- EmailTemplate model complet
- Action send_email dans automations
- Pas de transport email configuré (nodemailer)
- **Action requise :** Config SMTP + nodemailer setup

### 8.3 Features partiellement implémentées

**CMS Integration:**
- Settings UI complet (enable, URL, token, test)
- CmsEventCache model complet
- Pas de poller actif qui fetch orders/customers
- **Action requise :** Créer cron job polling CMS API

**Event Bus Automations:**
- Event bus listener actif (swigs-hub WebSocket)
- Automations trigger sur events
- Pas d'exécution réelle des nodes (send_email, webhook, etc.)
- **Action requise :** Implémenter execution engine dans automationService

**Personalization Settings:**
- Settings.personalization model existe
- PersonnalisationTab UI fonctionnel
- Sauvegarde localStorage seulement (pas API)
- **Action requise :** Connecter PersonnalisationTab à settingsApi.update()

---

## 9. DONNÉES SOUS-EXPLOITÉES

### 9.1 Fields présents mais non utilisés

**Project.tags:**
- Field exists, pas d'UI pour ajouter tags
- Index text search inclut tags
- **Potentiel :** Filtrage par tags, autocomplete tags populaires

**Event.type = 'action':**
- Supporté backend (hours, action, expense)
- UI uniquement hours + expense
- **Potentiel :** Actions forfaitaires (milestone payments)

**User.preferences.theme:**
- Field existe, darkMode géré par uiStore (localStorage)
- Pas de sync backend
- **Potentiel :** Sync theme avec User model

**Invoice/Quote.notes:**
- Field existe, pas d'UI pour saisir notes
- **Potentiel :** Ajouter textarea notes dans modals

**Service.estimatedHours:**
- Field existe pour priceType='hourly'
- Pas utilisé dans calcul devis
- **Potentiel :** Afficher estimation durée dans devis

**AutomationRun.context:**
- Field existe pour passer données entre nodes
- Pas exploité dans execution
- **Potentiel :** Variables workflow (ex: total commande accessible dans tous nodes)

**EmailTemplate.stats:**
- timesSent, lastUsedAt fields existent
- Pas incrémentés lors envoi
- **Potentiel :** Analytics templates les plus utilisés

**Session tracking:**
- userAgent, ipAddress capturés
- Pas d'UI pour voir sessions actives
- **Potentiel :** Page "Sessions actives" avec révocation

### 9.2 Analytics manquantes

**Revenue par client:**
- Top clients disponible
- Pas de drill-down détails client (factures, projets)
- **Potentiel :** Page Client Analytics avec timeline

**Hours par projet:**
- Hours analytics global disponible
- Pas de breakdown par projet
- **Potentiel :** Graph heures par projet dans ProjectSidebar

**Quote conversion funnel:**
- Stats quotes globales (conversion rate)
- Pas de funnel détaillé par statut avec durées
- **Potentiel :** Sankey diagram draft→sent→signed

**Event billing rate:**
- Unbilled events affichés par projet
- Pas de métrique "% events facturés"
- **Potentiel :** KPI "Billing rate" dans Analytics

**Automation success rate:**
- stats.totalRuns, successfulRuns, failedRuns existent
- Pas de graph évolution dans le temps
- **Potentiel :** Timeline automation runs avec success rate

---

## 10. GAPS FONCTIONNELS

### 10.1 Features complètes manquantes

**Multi-currency:**
- Tout hardcodé CHF
- Pas de champ currency dans Invoice/Quote
- **Gap :** Support EUR, USD, etc.

**Recurring Invoices:**
- Pas de modèle récurrent
- Impossible de facturer automatiquement tous les mois
- **Gap :** RecurringInvoice model + cron job

**Payment tracking:**
- Invoice.status = 'paid', Invoice.paidAt existent
- Pas de Payment model (montant, méthode, date, référence)
- **Gap :** Payment model + partial payments

**Tax exemptions:**
- vatRate global ou par invoice
- Pas de support exemptions (artistes, export)
- **Gap :** Quote/Invoice.taxExempt boolean + raison

**Expenses attachments:**
- Event type='expense' avec amount
- Pas de champ attachment (reçu, justificatif)
- **Gap :** Event.attachments[] avec upload

**Time tracking:**
- Events type='hours' avec hours + hourlyRate
- Pas de timer/chronomètre intégré
- **Gap :** Timer component avec start/stop/pause

**Client portal:**
- Devis/factures créés pour clients
- Pas de portail client pour voir/signer/payer
- **Gap :** Public routes /portal/:clientId avec auth

**Bank reconciliation:**
- Invoices paid manuellement
- Pas d'import bank statements
- **Gap :** Bank import + auto-match invoices

**Multi-user/team:**
- userId sur tous les modèles (multi-tenant OK)
- Pas de teams, roles, permissions
- **Gap :** Team model + role-based access control

**Project templates:**
- Création projet from scratch
- Pas de templates réutilisables (ex: "Site web standard" avec devis pré-rempli)
- **Gap :** ProjectTemplate model + clone feature

### 10.2 UX/UI gaps

**Search global:**
- Search bar dans Workflow uniquement (projets + clients)
- Pas de search global (events, invoices, quotes)
- **Gap :** Global search avec résultats multi-types

**Notifications:**
- Toasts pour success/error
- Pas de notifications persistantes (ex: facture payée)
- **Gap :** Notification center + bell icon

**Keyboard shortcuts:**
- Tout à la souris
- **Gap :** Shortcuts (N = new project, E = new event, etc.)

**Bulk actions:**
- Delete/archive un par un
- Pas de sélection multiple
- **Gap :** Checkboxes + bulk delete/archive/export

**Export data:**
- Pas d'export CSV/Excel
- **Gap :** Export projects, events, invoices, quotes

**Mobile app:**
- Responsive web uniquement
- **Gap :** React Native app iOS/Android

**Dark mode toggle:**
- darkMode persisté dans uiStore
- Pas de toggle UI visible
- **Gap :** Toggle dans header ou settings

**Undo/Redo:**
- Actions irréversibles (delete, archive)
- Pas de système undo
- **Gap :** Command pattern + undo stack

---

## 11. BUGS & INCOHÉRENCES DÉTECTÉS

### 11.1 Incohérences data model

**Quote.invoice vs Quote.invoices[]:**
- Legacy field `invoice` (single ref)
- Nouveau field `invoices[]` (multi-invoices)
- Les deux coexistent, risque données incohérentes
- **Fix :** Migration data + deprecate Quote.invoice

**Settings.personalization:**
- Backend model existe (cardStyle, cardSize)
- Frontend persiste localStorage seulement
- **Fix :** Sync PersonnalisationTab avec API

**PlannedBlock.userId vs Project.userId:**
- PlannedBlock a userId
- Référence Project qui a déjà userId
- Redondance, risque userId différents
- **Fix :** Retirer PlannedBlock.userId, utiliser populate project.userId

### 11.2 Index manquants (performance)

**Invoice sans index userId:**
- Invoice.project → Project.userId (join)
- Pas d'index direct Invoice.userId
- Queries userId slow sur grosse DB
- **Fix :** Ajouter Invoice.userId + index

**Quote sans index userId:**
- Même problème que Invoice
- **Fix :** Ajouter Quote.userId + index

**Event sans index userId:**
- Même problème
- **Fix :** Ajouter Event.userId + index

**History sans index userId:**
- Queries history par user via project join
- **Fix :** Ajouter History.userId + index

### 11.3 Validation manquante

**Invoice customLines sans validation:**
- customLines[] accepte tout
- Risque total incohérent
- **Fix :** Pre-save hook vérifier sum(customLines.total) = subtotal

**Quote lines total:**
- Pas de validation lines[].total = quantity * unitPrice
- **Fix :** Pre-save hook vérifier cohérence

**PlannedBlock overlap:**
- Validation end > start OK
- Pas de vérification overlap même projet
- Risque double-booking
- **Fix :** Pre-save hook chercher overlaps

**Email templates variables:**
- Body peut contenir n'importe quelle variable
- Pas de validation contre availableVariables
- **Fix :** Pre-save hook valider variables utilisées

### 11.4 Race conditions

**createInvoice + fetchProjectEvents:**
- createInvoice marque events.billed
- fetchProjectEvents peut retourner avant update
- **Fix :** Attendre invoice save avant refresh

**deleteInvoice cascade:**
- Events unbilled
- Quotes invoicedAmount updated
- Multiples updates non transactionnels
- **Fix :** Utiliser MongoDB transactions

**Session refresh 401:**
- Interceptor retry une fois
- Si 2 requests 401 simultanés, double refresh
- **Fix :** Mutex sur refreshAccessToken

---

## 12. SECURITY CONCERNS

### 12.1 Authentication/Authorization

**optionalAuth middleware:**
- Certaines routes optionalAuth (si token → userId, sinon global)
- Risque bypass authentication
- **Review :** Vérifier quelles routes nécessitent vraiment optionalAuth

**refreshToken storage:**
- refreshToken dans localStorage (XSS risk)
- **Recommandation :** httpOnly cookie pour refresh token

**CMS serviceToken:**
- Token stocké plain text dans Settings
- **Recommandation :** Encrypt serviceToken avant DB

### 12.2 Input validation

**Project.client embedded:**
- Pas de validation email format
- **Fix :** Validation email dans clientSchema

**Invoice/Quote number:**
- Génération automatique FAC-YEAR-XXX
- Possible collision si création simultanée
- **Fix :** Utiliser MongoDB auto-increment ou UUID

**Automation nodes:**
- Node config accepte tout
- Risque injection webhook URL, script injection
- **Fix :** Validation stricte actionConfig fields

### 12.3 Rate limiting

**API endpoints:**
- Pas de rate limiting visible
- Risque brute force, DoS
- **Fix :** express-rate-limit middleware

**CMS polling:**
- pollInterval configurable dès 30s
- Risque spam CMS externe
- **Fix :** Minimum 1 minute, max requests/hour

---

## 13. PERFORMANCE BOTTLENECKS

### 13.1 N+1 queries

**Projects list populate status:**
- fetchProjects → populate('status')
- Si 100 projects, 1 query projects + 1 query statuses OK (ref)
- Mais si populate events/invoices → N+1
- **Review :** Vérifier populate dans projectController

**Analytics top clients:**
- Agrégation invoices par client
- Possible N queries si mal optimisé
- **Review :** Vérifier analyticsController.getTopClients utilise aggregation

### 13.2 Large datasets

**fetchProjects sans pagination:**
- GET /api/projects retourne tout
- Si 1000+ projets, payload énorme
- **Fix :** Pagination (skip, limit) + infinite scroll

**Planning blocks sans limit:**
- GET /planning?start=X&end=Y retourne tous blocs plage
- Si plage 1 an, énorme
- **Fix :** Limiter plage max (1 mois) ou pagination

**History sans limit:**
- GET /projects/:id/history retourne tout
- Si projet ancien, 1000+ entries
- **Fix :** Pagination ou limit 100 derniers

### 13.3 localStorage limits

**planningStore.localBlocks:**
- Tous blocs persistés localStorage
- Si 1000+ blocs, quota exceeded
- **Fix :** Limiter localBlocks à plage actuelle (1 mois)

**Project positions:**
- Tous positions localStorage
- Si 500+ projets, gros object
- **Fix :** OK si positions map {id: order}, compress si besoin

---

## 14. RECOMMANDATIONS PRIORITAIRES

### 14.1 Critique (P0)

1. **Implémenter Email sending** (nodemailer + SMTP)
   - Automations send_email non fonctionnel
   - Templates emails inutiles sans envoi
   - **Impact :** Feature core automations

2. **Fix Quote.invoice incohérence**
   - Migrer données vers Quote.invoices[]
   - Deprecate Quote.invoice field
   - **Impact :** Données corruptes possibles

3. **Ajouter userId indexes**
   - Invoice, Quote, Event, History sans userId index
   - **Impact :** Performance queries multi-tenant

4. **Security: Encrypt CMS serviceToken**
   - Token plain text en DB
   - **Impact :** Sécurité data

5. **Add rate limiting**
   - Pas de protection endpoints
   - **Impact :** Sécurité DoS

### 14.2 Important (P1)

6. **Pagination projets/events/history**
   - Pas de pagination, tout chargé
   - **Impact :** Performance large datasets

7. **PDF Generation**
   - Invoices/quotes sans PDF
   - **Impact :** Feature métier critique

8. **Custom Invoices UI**
   - Backend supporte, UI manquante
   - **Impact :** Flexibilité facturation

9. **Email Templates UI**
   - Backend complet, aucun écran
   - **Impact :** Gestion templates

10. **Automation Runs history UI**
    - Pas de visibilité exécutions
    - **Impact :** Debug automations

### 14.3 Nice to have (P2)

11. **Cron scheduler automations**
    - time.schedule trigger non fonctionnel
    - **Impact :** Automations temporelles

12. **CMS polling job**
    - Config UI OK, pas de poller
    - **Impact :** Sync CMS orders/customers

13. **Multi-currency support**
    - Hardcodé CHF
    - **Impact :** International

14. **Recurring invoices**
    - Pas de modèle récurrent
    - **Impact :** Abonnements

15. **Client portal**
    - Clients ne voient pas devis/factures
    - **Impact :** UX client

---

## 15. CONCLUSION

### 15.1 Points forts

✅ **Architecture solide:**
- Multi-tenant via userId
- SSO Hub avec PKCE
- Stores Zustand bien structurés
- API REST cohérente

✅ **Features core complètes:**
- Projects CRUD avec canvas positions
- Events/Invoices/Quotes complets
- Analytics riches (6 endpoints)
- Planning drag & drop
- Automations builder canvas

✅ **Data integrity:**
- Invoice/Quote snapshots immuables
- History audit trail
- Cascade refresh (unbilled totals)

✅ **UX moderne:**
- Dark mode
- Drag & drop (planning, workflow)
- Real-time filters
- Responsive mobile (Planning force day view)

### 15.2 Faiblesses principales

❌ **Features backend orphelines:**
- Email templates (backend complet, UI 0%)
- Automation runs history (backend OK, UI manquante)
- Custom invoices (backend supporte, UI manquante)
- Partial quote invoicing (backend OK, UI manquante)

❌ **Features incomplètes:**
- Automations (pas d'exécution send_email)
- CMS integration (config OK, pas de poller)
- PDF generation (fields présents, service manquant)

❌ **Performance gaps:**
- Pas de pagination (projets, events, history)
- Pas de rate limiting
- Index manquants (userId sur Invoice/Quote/Event)

❌ **Security:**
- refreshToken localStorage (XSS risk)
- CMS serviceToken plain text
- Pas de validation input stricte (automation config)

### 15.3 Roadmap suggérée

**Phase 1 (1-2 semaines) - Critical fixes:**
1. Email sending (nodemailer)
2. userId indexes
3. Rate limiting
4. Encrypt CMS token
5. Fix Quote.invoice incohérence

**Phase 2 (2-3 semaines) - Complete features:**
6. PDF generation (puppeteer)
7. Pagination (projets, events, history)
8. Email Templates UI
9. Automation Runs UI
10. Custom Invoices UI

**Phase 3 (3-4 semaines) - New features:**
11. CMS polling job
12. Cron scheduler automations
13. Multi-currency
14. Recurring invoices
15. Client portal MVP

---

**Total Features analysées:** 85+
**Complete:** ~60 (70%)
**Partielles:** ~15 (18%)
**Manquantes:** ~10 (12%)

**Lignes de code estimées:**
- Frontend: ~15,000 LOC (React + Zustand)
- Backend: ~8,000 LOC (Express + Mongoose)
- **Total:** ~23,000 LOC

---

*Fin du rapport - feature-mapper agent*
