# Prompt Audit & Améliorations V1 — SWIGS Workflow

Tu es un architecte logiciel senior chargé d'auditer l'application **swigs-workflow** et de proposer des améliorations en vue d'une release **V1 stable**. Tu travailles en 4 phases séquentielles.

---

## CONTEXTE

### L'application
**swigs-workflow** est un outil de gestion de projets et facturation pour freelances/PME suisses. Il est **déjà en production et utilisé quotidiennement** — toute modification doit être **non-breaking**.

- **URL** : https://workflow.swigs.online
- **Serveur** : 192.168.110.59 (SSH: `ssh swigs@192.168.110.59`)
- **Port** : 3003
- **PM2** : `swigs-workflow` (2 instances cluster)
- **DB** : MongoDB locale (`swigs-workflow`)

### Stack technique
- **Backend** : Node.js (ESM), Express 4.21, Mongoose 8.9, JWT auth
- **Frontend** : React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5, React Router 7
- **Librairies clés** : @dnd-kit (drag & drop), @xyflow/react (automation builder), Recharts, date-fns, pdfkit, nodemailer, node-cron
- **Auth** : SSO via SWIGS Hub (PKCE OAuth 2.0), tokens JWT 7j
- **Multi-tenant** : Données isolées par `userId`

### Architecture fichiers
```
swigs-workflow/
├── backend/
│   ├── server.js                    # Express app (port 3003)
│   ├── ecosystem.config.cjs         # PM2 config (2 instances)
│   └── src/
│       ├── config/                  # DB connection
│       ├── controllers/             # 12 controllers
│       ├── middleware/              # auth.js (requireAuth/optionalAuth), errorHandler.js
│       ├── models/                  # 18 models Mongoose
│       ├── routes/                  # 13 route files (~40+ endpoints)
│       └── services/               # historyService, eventBus, automation engine
│           └── automation/          # scheduler, executor, trigger, email, cmsPoller
└── frontend/
    └── src/
        ├── pages/                   # 5 pages (Workflow, Planning, Analytics, Automations, Settings)
        ├── components/              # 45+ composants React
        │   ├── Analytics/           # 6 composants charts
        │   ├── Automations/         # 6 composants (visual node editor)
        │   ├── Layout/              # Header, Layout
        │   ├── Planning/            # 5 composants calendrier
        │   ├── Settings/            # 2 tabs
        │   ├── Sidebar/             # 8 composants (détails projet)
        │   ├── Workflow/            # 4 composants (kanban grid)
        │   └── ui/                  # 4 composants réutilisables
        ├── stores/                  # 7 stores Zustand
        └── services/api.js          # Client API axios
```

### Modèles principaux (18)
| Modèle | Rôle |
|--------|------|
| **Project** | Projets avec client embedded, position canvas, statut |
| **Invoice** | Factures avec snapshots events/quotes + customLines |
| **Quote** | Devis avec lines[], statut (draft→sent→signed→invoiced) |
| **Event** | Heures, dépenses, actions trackées sur projets |
| **Client** | Clients (embedded dans Project + standalone) |
| **Status** | Statuts workflow custom par utilisateur |
| **Settings** | Config entreprise, TVA (8.1%), templates email |
| **Service** | Catalogue de services (dev, design, etc.) |
| **PlannedBlock** | Blocs planning calendrier |
| **History** | Audit trail immuable |
| **Automation** | Workflows avec nodes trigger/action/condition/wait |
| **AutomationRun** | Logs d'exécution automation |
| **EmailTemplate** | Templates Handlebars |
| **CmsEventCache** | Cache polling CMS |
| **Session** | Sessions refresh token |
| **User** | Utilisateurs avec hubUserId (SSO) |

### Routes API (13 fichiers, ~40+ endpoints)
- `/api/auth` : SSO login/callback, refresh, me, logout
- `/api/projects` : CRUD + status change + positions + nested events/invoices/quotes
- `/api/events` : CRUD heures/dépenses/actions
- `/api/invoices` : CRUD + génération + statut + PDF
- `/api/quotes` : CRUD + workflow statut
- `/api/clients` : CRUD standalone
- `/api/statuses` : CRUD + reorder + seed
- `/api/settings` : Get/update + stats
- `/api/planning` : CRUD blocs calendrier
- `/api/analytics` : Revenue, monthly, quotes, projects, clients, hours
- `/api/services` : CRUD catalogue
- `/api/automations` : CRUD + toggle + run + history
- `/api/email-templates` : Variables, defaults, preview, send-test

### Pages frontend (5)
| Page | Route | Description |
|------|-------|-------------|
| Workflow | `/` | Kanban board — projets drag & drop entre statuts |
| Planning | `/planning` | Calendrier semaine/jour avec blocs planifiés |
| Analytics | `/analytics` | Dashboard KPIs, graphiques revenue/heures/clients |
| Automations | `/automations` | Visual workflow builder (@xyflow/react) |
| Settings | `/settings` | Personnalisation entreprise + catalogue services |

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
2. **Pas de migration destructive** — pas de drop/rename de champs existants
3. **Backward compatible** — les nouveaux champs doivent avoir des `default` values
4. **Tester localement** avant tout déploiement
5. **Snapshots factures** — ne JAMAIS modifier events/quotes déjà facturés
6. **MongoDB** : ne pas mettre `default: null` avec `unique: true, sparse: true`

---

## PHASE 1 : AUDIT COMPLET

Crée une équipe de **4 agents** pour auditer en parallèle :

### Agent 1 : `code-quality` (Code Review)
- Lire TOUS les controllers, models, routes, middleware backend
- Lire TOUS les stores, pages, composants frontend
- Identifier : bugs, code mort, TODO, inconsistances, erreurs non gérées
- Vérifier : validation des inputs, gestion d'erreurs, edge cases
- Évaluer : patterns, DRY, complexité, maintenabilité
- Produire un rapport structuré par sévérité (CRITIQUE / IMPORTANT / MINEUR)

### Agent 2 : `security-audit` (Sécurité)
- Analyser auth middleware (JWT validation, token refresh)
- Vérifier : injection (NoSQL, XSS), rate limiting, CORS, helmet config
- Vérifier : autorisation (un user ne peut pas voir les données d'un autre)
- Analyser : gestion des secrets, token storage frontend
- Vérifier : validation/sanitization de tous les inputs API
- Produire un rapport OWASP Top 10

### Agent 3 : `ux-review` (UX/Frontend)
- Accéder à l'app via Chrome DevTools MCP (https://workflow.swigs.online)
- IMPORTANT : si Chrome DevTools MCP n'est pas disponible, analyser le code source frontend à la place
- Tester chaque page : Workflow, Planning, Analytics, Automations, Settings
- Vérifier : responsive, dark mode, loading states, error states
- Identifier : UX incohérences, textes manquants, i18n
- Vérifier : accessibilité de base (contraste, focus, aria)
- Produire un rapport par page

### Agent 4 : `perf-data` (Performance & Data)
- Analyser les queries MongoDB (indexes manquants, N+1, populate chaîné)
- Vérifier les modèles Mongoose (indexes, virtuals, lean queries)
- Analyser le bundle frontend (taille, lazy loading, code splitting)
- Vérifier : memory leaks potentiels, event listeners non nettoyés
- Analyser : caching, compression, rate limiting
- Produire un rapport avec métriques

### Livrable Phase 1
Compiler les 4 rapports en un seul document `AUDIT-WORKFLOW-V1.md` avec :
- Résumé exécutif par domaine
- Liste consolidée de tous les problèmes (numérotés)
- Sévérité : CRITIQUE / IMPORTANT / MINEUR / SUGGESTION
- Estimation d'effort pour chaque item

---

## PHASE 2 : PROPOSITIONS D'AMÉLIORATIONS

À partir de l'audit, propose **3 catégories** d'améliorations :

### A. Corrections obligatoires V1
- Bugs critiques et importants
- Failles de sécurité
- Problèmes de data integrity

### B. Améliorations UX recommandées
- Quick wins visuels/ergonomiques
- Cohérence de l'interface
- Responsive/dark mode fixes

### C. Améliorations techniques recommandées
- Performance
- Code quality
- Architecture

Pour chaque proposition, indique :
- **Description** claire du changement
- **Fichiers impactés**
- **Risque de breaking change** (aucun / faible / modéré)
- **Estimation d'effort** (15min / 30min / 1h / 2h / 4h)

Présente ces propositions à l'utilisateur et **ATTENDS sa validation**. Il acceptera ou refusera chaque point individuellement. NE COMMENCE PAS l'implémentation sans son accord.

---

## PHASE 3 : VALIDATION UTILISATEUR

Présente les propositions de manière claire et structurée. L'utilisateur répondra :
- "OK" / "OUI" → accepté
- "NON" / "SKIP" → refusé
- Il peut aussi modifier/préciser une proposition

Compile la liste finale des items validés.

---

## PHASE 4 : IMPLÉMENTATION

Pour les items validés, crée une nouvelle équipe d'agents selon les besoins :
- 1 agent par domaine (backend, frontend, ou full-stack)
- Chaque agent travaille sur ses items assignés
- Tester localement avant de proposer le déploiement

### Règles d'implémentation
1. **Éditer les fichiers existants** — ne pas créer de nouveaux fichiers sauf nécessité absolue
2. **Pas de refactoring non demandé** — ne toucher que ce qui est validé
3. **Pas de nouvelles dépendances** sauf si validé explicitement
4. **Garder le style de code existant** — pas de reformatage
5. **Build frontend** : `cd frontend && npm run build`
6. **Déployer** : rsync + pm2 restart (voir section Déploiement)
7. **Valider visuellement** après déploiement

### Livrable Phase 4
- Code modifié et déployé
- Rapport de changements avec fichiers modifiés
- Validation visuelle (screenshots si possible)
- Version bump si demandé par l'utilisateur

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **Chrome DevTools MCP** : Seul le thread principal peut l'utiliser, pas les subagents
- **SSH** : Disponible vers 192.168.110.59 pour vérifications DB/serveur
- **Pas de tests automatisés** existants — être prudent sur les changements
- **L'utilisateur parle français** — communiquer en français
