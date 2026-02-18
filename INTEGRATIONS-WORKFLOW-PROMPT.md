# Prompt Intégrations & Outils Complémentaires — SWIGS Workflow

Tu es un développeur full-stack senior chargé d'implémenter des intégrations et outils complémentaires pour **swigs-workflow**. Tu travailles en 4 phases séquentielles.

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
- **Librairies clés** : PDFKit (PDF), Nodemailer (email), @dnd-kit, @xyflow/react, Recharts, date-fns, node-cron
- **Auth** : SSO via SWIGS Hub (PKCE OAuth 2.0), tokens JWT 7j
- **Multi-tenant** : Données isolées par `userId`
- **Monnaie** : CHF (francs suisses)
- **TVA par défaut** : 8.1% (taux suisse)

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
│       └── services/               # pdf.service, email.service, historyService, eventBus, automation engine
│           ├── pdf.service.js       # Génération PDF (PDFKit)
│           ├── email.service.js     # Envoi email (Nodemailer)
│           └── automation/          # scheduler, executor, trigger, email, cmsPoller
└── frontend/
    └── src/
        ├── pages/                   # 5 pages (Workflow, Planning, Analytics, Automations, Settings)
        ├── components/              # 45+ composants React
        ├── stores/                  # 7 stores Zustand
        └── services/api.js          # Client API axios
```

### État V2 actuel (déjà implémenté)
Les fonctionnalités suivantes sont **déjà en place** — ne PAS les recréer :

1. **PDF Generation** (`backend/src/services/pdf.service.js`)
   - `generateInvoicePDF(invoice, project, settings)` → Buffer
   - `generateQuotePDF(quote, project, settings)` → Buffer
   - Headers entreprise, tableau lignes, totaux HT/TVA/TTC, notes, footer
   - Gestion page breaks automatique
   - Logo entreprise supporté

2. **Email Sending** (`backend/src/services/email.service.js`)
   - `sendInvoiceEmail(invoice, project, settings, pdfBuffer)` → résultat
   - `sendQuoteEmail(quote, project, settings, pdfBuffer)` → résultat
   - Templates Handlebars avec variables : `{clientName}`, `{number}`, `{projectName}`, `{total}`, `{companyName}`, `{paymentTerms}`
   - Config SMTP dans Settings

3. **Facturation partielle** — Devis facturables en plusieurs fois (invoicedAmount, quotePartials)
4. **Factures custom** — Lignes libres sans events/quotes (invoiceType: 'custom', customLines[])
5. **Automation engine** — Triggers, actions, conditions, waits (visual builder @xyflow/react)
6. **Analytics dashboard** — Revenue, heures, clients, projets

### Modèles clés (schémas complets)

#### Invoice
```javascript
{
  project: ObjectId (ref: Project),
  number: String (unique, "FAC-YYYY-XXX"),
  invoiceType: 'standard' | 'custom',
  events: [{ eventId, description, type, hours, hourlyRate, amount, date }],  // snapshots
  quotes: [{ quoteId, number, lines[], subtotal, invoicedAmount, isPartial, signedAt }],  // snapshots
  customLines: [{ description, quantity, unitPrice, total }],
  subtotal: Number, vatRate: Number, vatAmount: Number, total: Number,
  status: 'draft' | 'sent' | 'paid' | 'cancelled',
  issueDate: Date, dueDate: Date, paidAt: Date,
  notes: String
}
```

#### Quote
```javascript
{
  project: ObjectId (ref: Project),
  number: String (unique, "DEV-YYYY-XXX"),
  lines: [{ description, quantity, unitPrice, total }],
  subtotal: Number, vatRate: Number, vatAmount: Number, total: Number,
  status: 'draft' | 'sent' | 'signed' | 'refused' | 'expired' | 'partial' | 'invoiced',
  invoicedAmount: Number,
  invoices: [{ invoice: ObjectId, amount, invoicedAt }],
  issueDate: Date, validUntil: Date, signedAt: Date, invoicedAt: Date,
  notes: String
}
```

#### Settings
```javascript
{
  userId: ObjectId,
  company: { name, address, siret, vatNumber, email, phone, logo },
  invoicing: { invoicePrefix, quotePrefix, defaultVatRate, defaultPaymentTerms, defaultHourlyRate },
  personalization: { cardStyle, cardSize },
  emailTemplates: { quoteSubject, quoteBody, invoiceSubject, invoiceBody },
  smtp: { host, port, secure, user, pass },
  cmsIntegration: { enabled, apiUrl, serviceToken, pollInterval, lastPolledAt }
}
```

#### Client (embedded dans Project + standalone)
```javascript
{
  userId: ObjectId,
  name: String, email: String, phone: String,
  address: String, company: String, siret: String, notes: String
}
```

#### Project
```javascript
{
  userId: ObjectId,
  name: String, description: String,
  client: { name, email, phone, address, company },  // embedded copy
  clientId: ObjectId (ref: Client),  // link to standalone
  status: ObjectId (ref: Status),
  startDate: Date, deadline: Date,
  hourlyRate: Number,
  position: { x, y }
}
```

### Routes API existantes
```
# Auth
POST   /api/auth/callback              # SSO callback
POST   /api/auth/refresh               # Refresh token
GET    /api/auth/me                     # Current user
POST   /api/auth/logout                 # Logout

# Projects
GET    /api/projects                    # List all
POST   /api/projects                    # Create
GET    /api/projects/:id                # Get one
PUT    /api/projects/:id                # Update
DELETE /api/projects/:id                # Delete
PUT    /api/projects/:id/status         # Change status
POST   /api/projects/positions          # Save positions

# Events (nested under project)
GET    /api/projects/:id/events         # List
POST   /api/projects/:id/events         # Create
GET    /api/projects/:id/events/unbilled  # Unbilled only
PUT    /api/events/:id                  # Update
DELETE /api/events/:id                  # Delete

# Invoices
GET    /api/invoices                    # List all
GET    /api/invoices/:id                # Get one
POST   /api/projects/:id/invoices       # Create
PUT    /api/invoices/:id                # Update
DELETE /api/invoices/:id                # Delete
PATCH  /api/invoices/:id/status         # Change status
GET    /api/invoices/:id/pdf            # Download PDF
POST   /api/invoices/:id/send           # Send by email

# Quotes
GET    /api/quotes                      # List all
GET    /api/quotes/:id                  # Get one
POST   /api/projects/:id/quotes         # Create
PUT    /api/quotes/:id                  # Update
DELETE /api/quotes/:id                  # Delete
PATCH  /api/quotes/:id/status           # Change status
GET    /api/quotes/:id/pdf              # Download PDF
POST   /api/quotes/:id/send             # Send by email
GET    /api/projects/:id/quotes/invoiceable  # Quotes ready to invoice

# Clients
GET    /api/clients                     # List all
POST   /api/clients                     # Create
PUT    /api/clients/:id                 # Update
DELETE /api/clients/:id                 # Delete

# Settings
GET    /api/settings                    # Get
PUT    /api/settings                    # Update
GET    /api/settings/stats              # Stats

# Analytics
GET    /api/analytics/revenue           # Revenue data
GET    /api/analytics/monthly           # Monthly breakdown
GET    /api/analytics/quotes            # Quote stats
GET    /api/analytics/projects          # Project stats
GET    /api/analytics/top-clients       # Top clients
GET    /api/analytics/hours             # Hours tracking

# Planning, Statuses, Services, Automations, Email Templates...
```

### Déploiement
```bash
# Backend
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.env' backend/ swigs@192.168.110.59:/home/swigs/swigs-workflow/backend/
ssh swigs@192.168.110.59 'cd /home/swigs/swigs-workflow/backend && npm install && pm2 restart swigs-workflow'

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
7. **Pas de nouvelles dépendances** sans validation utilisateur (sauf `swissqrbill` pour QR-facture)

---

## INTÉGRATIONS À IMPLÉMENTER

### 1. QR-Facture Suisse (Swiss QR-Bill) — PRIORITÉ HAUTE

La QR-facture est le standard suisse de paiement qui remplace les anciens bulletins de versement (BVR/ESR). **C'est obligatoire pour les factures suisses.**

#### Spécifications
- **Standard** : SIX Swiss QR-Bill (ISO 20022)
- **Format** : Section de paiement (payment part) en bas de la facture PDF
- **Taille** : 210mm × 105mm (intégrée en bas de page ou page séparée)
- **Contenu QR code** :
  - IBAN ou QR-IBAN du bénéficiaire
  - Montant + monnaie (CHF)
  - Référence structurée (QR-référence ou SCOR)
  - Informations du débiteur (client)
  - Informations du créancier (entreprise)
- **Librairie npm recommandée** : `swissqrbill` (https://github.com/schoero/SwissQRBill)

#### Implémentation attendue

**Backend — Nouveaux champs Settings**
```javascript
// Dans Settings.company, ajouter :
iban: String,          // IBAN suisse (CHxx xxxx xxxx xxxx xxxx x)
qrIban: String,        // QR-IBAN (optionnel, pour références QR)
```

**Backend — Service QR-Bill**
- Créer `backend/src/services/qrbill.service.js`
- Fonction `generateQRBillSection(invoice, project, settings)` → PDF section
- Intégrer dans `pdf.service.js` : ajouter la section QR-Bill en bas de chaque facture PDF
- Générer automatiquement une référence structurée par facture
- Fallback gracieux : si pas d'IBAN configuré, ne pas ajouter la section QR-Bill

**Frontend — Settings**
- Ajouter les champs IBAN/QR-IBAN dans le tab Settings > Entreprise
- Validation format IBAN suisse (CH + 2 chiffres + 17 caractères)
- Preview de la QR-Bill dans les Settings (optionnel)

#### Référence QR-Bill
```
SPC                          # Header
0200                         # Version
1                            # Coding (UTF-8)
CH4431999123000889012         # IBAN
S                            # Address type (structured)
Robert Schneider AG           # Name
Rue du Lac 1268              # Street
2501                         # Postal code
Biel                         # City
CH                           # Country
                             # (empty = no ultimate creditor)
                             #
                             #
                             #
                             #
                             #
1949.75                      # Amount
CHF                          # Currency
S                            # Address type debtor
Pia-Maria Rutschmann-Schnyder # Name
Grosse Marktgasse 28         # Street
9400                         # Postal code
Rorschach                    # City
CH                           # Country
QRR                          # Reference type (QR ref)
210000000003139471430009017   # Reference
Facture FAC-2026-001          # Additional info
EPD                          # Trailer
```

---

### 2. Intégration AbaNinja — PRIORITÉ HAUTE

**AbaNinja** est le logiciel de comptabilité suisse utilisé par le propriétaire. L'objectif est de **synchroniser** les données de facturation pour éviter la double saisie.

#### API AbaNinja
- **Base URL** : `https://api.abaninja.ch/v2`
- **Auth** : Bearer Token (clé API générée depuis AbaNinja)
- **Content-Type** : `application/json`
- **Rate Limit** : Respecter un délai raisonnable entre les requêtes

#### Endpoints AbaNinja utilisés

**Adresses (Clients)**
```
GET    /addresses                    # Liste des contacts
POST   /addresses                    # Créer un contact
PUT    /addresses/{id}               # Modifier un contact
GET    /addresses/{id}               # Détail d'un contact
```
Payload adresse :
```json
{
  "type": "company",              // ou "person"
  "name": "Entreprise SA",
  "firstName": "Jean",
  "lastName": "Dupont",
  "street": "Rue du Lac 1",
  "zip": "1000",
  "city": "Lausanne",
  "country": "CH",
  "email": "contact@entreprise.ch",
  "phone": "+41 21 123 45 67"
}
```

**Factures**
```
GET    /invoices                     # Liste des factures
POST   /invoices                     # Créer une facture
PUT    /invoices/{id}                # Modifier une facture
GET    /invoices/{id}                # Détail
POST   /invoices/{id}/send           # Envoyer par email
POST   /invoices/{id}/book           # Comptabiliser
GET    /invoices/{id}/pdf            # Télécharger PDF
```
Payload facture :
```json
{
  "addressId": 123,
  "title": "Facture FAC-2026-001",
  "date": "2026-02-13",
  "dueDate": "2026-03-15",
  "currency": "CHF",
  "items": [
    {
      "description": "Développement web",
      "quantity": 10,
      "unitPrice": 150.00,
      "vatRate": 8.1
    }
  ],
  "paymentType": "qr",
  "reference": "FAC-2026-001",
  "notes": "Merci pour votre confiance"
}
```

**Devis (Offers/Estimates)**
```
GET    /estimates                    # Liste des devis
POST   /estimates                    # Créer un devis
PUT    /estimates/{id}               # Modifier
GET    /estimates/{id}               # Détail
POST   /estimates/{id}/send          # Envoyer
GET    /estimates/{id}/pdf           # Télécharger PDF
```

**Comptes bancaires**
```
GET    /bank-accounts                # Liste des comptes (IBAN, etc.)
```

**Produits/Services**
```
GET    /products                     # Liste des produits
POST   /products                     # Créer
```

#### Implémentation attendue

**Backend — Configuration AbaNinja**
```javascript
// Nouveau dans Settings schema :
abaninja: {
  enabled: { type: Boolean, default: false },
  apiKey: { type: String, default: '' },          // Bearer token AbaNinja
  autoSync: { type: Boolean, default: false },     // Sync automatique
  syncInvoices: { type: Boolean, default: true },
  syncQuotes: { type: Boolean, default: true },
  syncClients: { type: Boolean, default: true },
  lastSyncAt: { type: Date, default: null }
}
```

**Backend — Service AbaNinja** (`backend/src/services/abaninja.service.js`)
```javascript
// Client API AbaNinja
class AbaNinjaService {
  constructor(apiKey) { ... }

  // Adresses
  async getAddresses() { ... }
  async createAddress(clientData) { ... }
  async updateAddress(id, clientData) { ... }
  async findAddressByEmail(email) { ... }

  // Factures
  async createInvoice(invoiceData) { ... }
  async getInvoice(id) { ... }
  async sendInvoice(id) { ... }
  async bookInvoice(id) { ... }

  // Devis
  async createEstimate(quoteData) { ... }
  async getEstimate(id) { ... }
  async sendEstimate(id) { ... }

  // Mappers workflow → abaninja
  mapClientToAddress(client) { ... }
  mapInvoiceToAbaNinja(invoice, project, addressId) { ... }
  mapQuoteToAbaNinja(quote, project, addressId) { ... }
}
```

**Backend — Modèles : tracking de sync**
```javascript
// Ajouter aux modèles existants (champs optionnels avec default) :

// Invoice schema - ajouter :
abaNinjaId: { type: Number, default: null },         // ID dans AbaNinja
abaNinjaSyncedAt: { type: Date, default: null },
abaNinjaSyncStatus: { type: String, enum: ['pending', 'synced', 'error', null], default: null }

// Quote schema - ajouter :
abaNinjaId: { type: Number, default: null },
abaNinjaSyncedAt: { type: Date, default: null },
abaNinjaSyncStatus: { type: String, enum: ['pending', 'synced', 'error', null], default: null }

// Client schema - ajouter :
abaNinjaId: { type: Number, default: null },
abaNinjaSyncedAt: { type: Date, default: null }
```

**Backend — Routes AbaNinja** (`backend/src/routes/abaninja.js`)
```
POST   /api/abaninja/test-connection        # Tester la connexion API
POST   /api/abaninja/sync/invoice/:id       # Sync une facture
POST   /api/abaninja/sync/quote/:id         # Sync un devis
POST   /api/abaninja/sync/client/:id        # Sync un client
POST   /api/abaninja/sync/all               # Sync complet
GET    /api/abaninja/status                  # Statut de sync global
GET    /api/abaninja/bank-accounts           # Liste comptes bancaires
```

**Backend — Auto-sync (optionnel)**
- Si `autoSync: true`, synchroniser automatiquement :
  - Quand une facture passe à status `sent` ou `paid` → push vers AbaNinja
  - Quand un devis passe à status `sent` → push vers AbaNinja
  - Quand un client est créé/modifié → push vers AbaNinja
- Utiliser le pattern événementiel existant (historyService) pour déclencher les syncs
- **Ne jamais bloquer** l'opération principale si la sync échoue (try/catch + log)

**Frontend — Settings tab AbaNinja**
- Nouveau tab dans Settings : "AbaNinja"
- Champs : API Key (password field), toggles auto-sync
- Bouton "Tester la connexion" avec feedback visuel
- Bouton "Synchronisation complète"
- Afficher le statut de dernière sync

**Frontend — Indicateurs de sync**
- Sur chaque facture/devis : icône de sync (✓ synced, ⟳ pending, ✗ error)
- Bouton "Sync vers AbaNinja" sur les pages détail facture/devis
- Toast notification après sync

---

### 3. Portail Client — PRIORITÉ MOYENNE

Un portail web public où les clients peuvent consulter et interagir avec leurs devis et factures **sans créer de compte**.

#### Concept
- URL unique par document : `https://workflow.swigs.online/portal/{token}`
- Token sécurisé (JWT ou hash unique) avec expiration configurable
- Le client peut :
  - **Voir** le devis/facture (rendu HTML, pas juste PDF)
  - **Télécharger** le PDF
  - **Signer** un devis (signature textuelle + date)
  - **Voir** le récapitulatif de tous ses documents (via token client)

#### Implémentation attendue

**Backend — Modèle PortalToken**
```javascript
// Nouveau modèle : PortalToken
{
  token: String (unique, index),           // Hash sécurisé (crypto.randomBytes)
  type: 'invoice' | 'quote' | 'client',   // Type de document
  documentId: ObjectId,                     // Ref vers Invoice, Quote ou Client
  userId: ObjectId (ref: User),            // Propriétaire du document
  expiresAt: Date,                          // Expiration (default: 30 jours)
  accessCount: Number (default: 0),        // Nombre de consultations
  lastAccessedAt: Date,
  isActive: Boolean (default: true)
}
```

**Backend — Routes Portal** (`backend/src/routes/portal.js`)
```
# Routes PUBLIQUES (pas d'auth requise)
GET    /api/portal/:token                  # Charger le document (invoice/quote)
GET    /api/portal/:token/pdf              # Télécharger le PDF
POST   /api/portal/:token/sign             # Signer un devis
GET    /api/portal/client/:token           # Voir tous les documents d'un client

# Routes PRIVÉES (auth requise, pour le propriétaire)
POST   /api/portal/generate                # Générer un lien portal
DELETE /api/portal/:id                      # Révoquer un lien
GET    /api/portal/links/:documentType/:documentId  # Liens actifs d'un document
```

**Backend — Sécurité Portal**
- Rate limiting strict sur les routes portal (10 req/min par IP)
- Tokens non-guessable (32 bytes minimum)
- Expiration automatique (cron job ou TTL index MongoDB)
- Log des accès dans History
- Validation que le token correspond bien au document demandé

**Frontend — Composants Portal**
- `PortalInvoiceView.jsx` — Vue publique facture (HTML responsive)
- `PortalQuoteView.jsx` — Vue publique devis + bouton signer
- `PortalClientView.jsx` — Liste documents client
- `PortalLayout.jsx` — Layout minimal avec branding entreprise
- Route : `/portal/:token` (page publique, sans auth)

**Frontend — Intégration dans l'app**
- Bouton "Générer lien portal" sur chaque facture/devis
- Modal avec le lien + bouton copier + QR code du lien
- Liste des liens actifs avec possibilité de révoquer

---

### 4. Relances automatiques factures — PRIORITÉ MOYENNE

Système de rappels automatiques pour les factures impayées.

#### Implémentation attendue

**Backend — Nouveaux champs Invoice**
```javascript
// Ajouter au schema Invoice :
reminders: [{
  sentAt: Date,
  type: String,          // 'reminder_1', 'reminder_2', 'reminder_3', 'final_notice'
  emailSent: Boolean
}],
nextReminderDate: Date,   // Prochaine date de relance calculée
reminderCount: Number      // Nombre de relances envoyées (default: 0)
```

**Backend — Nouveaux champs Settings**
```javascript
// Ajouter à Settings :
reminders: {
  enabled: { type: Boolean, default: false },
  schedule: [{
    days: Number,       // Jours après échéance (ex: 7, 14, 30, 45)
    type: String,       // 'reminder_1', 'reminder_2', 'reminder_3', 'final_notice'
    subject: String,    // Template sujet
    body: String        // Template corps
  }],
  defaultSchedule: [
    { days: 7, type: 'reminder_1' },
    { days: 14, type: 'reminder_2' },
    { days: 30, type: 'reminder_3' },
    { days: 45, type: 'final_notice' }
  ]
}
```

**Backend — Service relances** (`backend/src/services/reminder.service.js`)
- Cron job quotidien (ex: 8h00) via `node-cron`
- Cherche les factures : `status: 'sent', dueDate < today, reminderCount < maxReminders`
- Envoie l'email de relance correspondant au niveau
- Incrémente `reminderCount`, ajoute à `reminders[]`
- Log dans History

**Backend — Templates relances**
- `Relance 1` : Ton cordial, rappel simple
- `Relance 2` : Ton ferme, mention du retard
- `Relance 3` : Ton formel, mention de conséquences
- `Mise en demeure` : Ton juridique, dernière chance
- Variables : `{clientName}`, `{number}`, `{total}`, `{dueDate}`, `{daysOverdue}`, `{companyName}`

**Frontend — Settings relances**
- Dans Settings : section "Relances automatiques"
- Toggle activation + configuration des délais
- Édition des templates par niveau
- Preview avec variables remplacées

**Frontend — Vue factures**
- Indicateur visuel de relance (nombre de rappels envoyés)
- Historique des relances sur la page détail facture
- Bouton "Envoyer relance manuellement"

---

### 5. Export comptable — PRIORITÉ BASSE

Export des données financières dans des formats compatibles avec les outils comptables suisses.

#### Implémentation attendue

**Backend — Route export** (`backend/src/routes/exports.js`)
```
GET    /api/exports/journal            # Journal comptable (CSV)
GET    /api/exports/clients            # Liste clients (CSV)
GET    /api/exports/revenue-report     # Rapport revenus (PDF)
```

**Paramètres communs** : `?from=2026-01-01&to=2026-12-31&format=csv`

**Format journal comptable CSV**
```csv
Date,N° Pièce,Libellé,Débit,Crédit,Compte,Contrepartie,TVA
2026-01-15,FAC-2026-001,Facture Client SA,1949.75,,1100,3000,8.1%
2026-02-01,FAC-2026-001,Paiement reçu,,1949.75,1020,1100,
```

**Backend — Service export** (`backend/src/services/export.service.js`)
- `generateJournalCSV(invoices, dateRange)` → CSV string
- `generateClientListCSV(clients)` → CSV string
- `generateRevenueReportPDF(analytics, dateRange, settings)` → PDF Buffer

**Frontend — Page/Section Export**
- Accessible depuis Analytics ou Settings
- Sélecteur de période (année, trimestre, mois, custom)
- Boutons export par format
- Preview des données avant export

---

## PHASE 1 : ANALYSE TECHNIQUE

Crée une équipe de **2 agents** pour analyser en parallèle :

### Agent 1 : `integration-analyzer` (Backend Analysis)
- Lire les fichiers backend : models, controllers, services, routes
- Mapper les points d'intégration existants (PDF, email, SMTP, etc.)
- Identifier les patterns à réutiliser
- Analyser la faisabilité technique de chaque intégration
- Vérifier les dépendances npm nécessaires
- Produire un rapport technique par intégration

### Agent 2 : `frontend-analyzer` (Frontend Analysis)
- Lire les composants Settings, Sidebar (détails projet), stores
- Mapper les composants UI à modifier/créer
- Identifier les patterns UI existants à réutiliser
- Analyser les stores Zustand pour les nouvelles données
- Produire un rapport des changements frontend nécessaires

### Livrable Phase 1
Compiler les 2 rapports en un plan d'implémentation avec :
- Fichiers à modifier vs fichiers à créer
- Dépendances npm nécessaires
- Ordre d'implémentation recommandé
- Risques identifiés

---

## PHASE 2 : PROPOSITIONS D'IMPLÉMENTATION

À partir de l'analyse, propose un plan détaillé organisé par intégration :

Pour chaque intégration (QR-facture, AbaNinja, Portal, Relances, Export) :
- **Scope exact** des modifications
- **Fichiers impactés** (existants) et fichiers à créer
- **Nouvelles dépendances npm** nécessaires
- **Risque de breaking change** : aucun / faible / modéré
- **Estimation d'effort** : 30min / 1h / 2h / 4h
- **Dépendances entre intégrations** (ex: QR-Bill avant Export)

Présente ces propositions à l'utilisateur et **ATTENDS sa validation**. L'utilisateur acceptera ou refusera chaque intégration et chaque sous-point individuellement. NE COMMENCE PAS l'implémentation sans son accord.

---

## PHASE 3 : VALIDATION UTILISATEUR

Présente les propositions clairement. L'utilisateur répondra :
- "OK" / "OUI" → accepté
- "NON" / "SKIP" → refusé
- Il peut modifier/préciser une proposition

Compile la liste finale des items validés.

---

## PHASE 4 : IMPLÉMENTATION

Pour les items validés, crée une équipe d'agents selon les besoins :

### Organisation suggérée
- **Agent backend** : Models, services, controllers, routes
- **Agent frontend** : Components, stores, pages
- **Agent QR-Bill** (si validé) : Service QR-Bill + intégration PDF

### Règles d'implémentation
1. **Éditer les fichiers existants** quand possible — minimiser les nouveaux fichiers
2. **Nouveaux champs avec `default`** — backward compatible obligatoire
3. **Try/catch sur toutes les intégrations externes** — ne jamais bloquer l'app si AbaNinja/email échoue
4. **Garder le style de code existant** — ESM imports, async/await, patterns existants
5. **Frontend** : Tailwind CSS existant, composants ui/ réutilisables, Zustand stores
6. **Build frontend** : `cd frontend && npm run build`
7. **Déployer** : rsync + pm2 restart (voir section Déploiement)
8. **Valider visuellement** après déploiement
9. **Installer les dépendances** : `cd backend && npm install` puis déployer node_modules aussi

### Livrable Phase 4
- Code modifié et déployé
- Rapport de changements avec fichiers modifiés
- Liste des nouvelles dépendances installées
- Validation visuelle (screenshots si possible)
- Instructions de configuration (IBAN, clé API AbaNinja, etc.)

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **Chrome DevTools MCP** : Seul le thread principal peut l'utiliser, pas les subagents
- **SSH** : Disponible vers 192.168.110.59 pour vérifications DB/serveur
- **Pas de tests automatisés** existants — être prudent sur les changements
- **L'utilisateur parle français** — communiquer en français
- **AbaNinja API** : La documentation complète est sur https://abaninja.ch — consulter si besoin de détails sur les endpoints
- **swissqrbill** : Seule dépendance npm pré-approuvée — les autres doivent être validées
- **Monnaie** : Toujours CHF, pas EUR
- **Les routes Portal sont PUBLIQUES** : Sécurité critique (rate limit, tokens non-guessables, expiration)
