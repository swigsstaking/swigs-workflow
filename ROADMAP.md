# Swigs Workflow - Roadmap & Spécifications

## Vue d'ensemble

**Swigs Workflow** est une application de gestion de projets et de facturation centrée sur une vue unique appelée "Workflow". Cette planche visuelle permet de piloter l'ensemble des projets sur le long terme.

---

## 1. Architecture Technique

### Stack

| Composant | Technologie |
|-----------|-------------|
| **Backend** | Node.js + Express |
| **Base de données** | MongoDB |
| **Frontend** | React + Vite |
| **Styling** | Tailwind CSS |
| **État** | Zustand |
| **Icônes** | Lucide React |

### Déploiement (Serveur .59)

| Élément | Valeur |
|---------|--------|
| **Port backend** | 3003 |
| **URL** | https://workflow.swigs.online |
| **Chemin backend** | ~/swigs-workflow/ |
| **Chemin frontend** | /var/www/swigs-workflow/ |
| **PM2** | swigs-workflow |

---

## 2. Modèles de Données

### Project

```javascript
{
  _id: ObjectId,
  name: String,                    // Nom du projet
  description: String,             // Description courte
  client: {
    name: String,                  // Nom du client
    email: String,                 // Email
    phone: String,                 // Téléphone
    address: String,               // Adresse
    company: String,               // Société (optionnel)
    siret: String                  // SIRET (optionnel)
  },
  status: ObjectId (ref: Status),  // Statut actuel
  tags: [String],                  // Tags/catégories
  notes: String,                   // Notes internes
  createdAt: Date,
  updatedAt: Date,
  archivedAt: Date                 // null si actif
}
```

### Status

```javascript
{
  _id: ObjectId,
  name: String,          // "Devis", "En cours", "Facturé", "Payé"...
  color: String,         // Code couleur hex (#3B82F6)
  order: Number,         // Ordre d'affichage
  isDefault: Boolean,    // Statut par défaut pour nouveaux projets
  createdAt: Date
}
```

### Event (Événements)

```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: Project),
  type: String,          // 'hours' | 'action' | 'expense'
  description: String,   // Description de l'événement
  date: Date,            // Date de l'événement

  // Pour type 'hours'
  hours: Number,         // Nombre d'heures
  hourlyRate: Number,    // Taux horaire (€)

  // Pour type 'expense'
  amount: Number,        // Montant du frais

  // Facturation
  billed: Boolean,       // Facturé ou non
  invoice: ObjectId,     // Référence facture (si facturé)

  createdAt: Date,
  updatedAt: Date
}
```

### Invoice (Factures)

```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: Project),
  number: String,        // Numéro facture (FAC-2026-001)

  // Événements inclus (snapshot)
  events: [{
    eventId: ObjectId,
    description: String,
    type: String,
    hours: Number,
    hourlyRate: Number,
    amount: Number,
    date: Date
  }],

  // Totaux
  subtotal: Number,      // Sous-total HT
  vatRate: Number,       // Taux TVA (20)
  vatAmount: Number,     // Montant TVA
  total: Number,         // Total TTC

  // Status
  status: String,        // 'draft' | 'sent' | 'paid' | 'cancelled'

  // Dates
  issueDate: Date,       // Date d'émission
  dueDate: Date,         // Date d'échéance
  paidAt: Date,          // Date de paiement

  // PDF
  pdfPath: String,       // Chemin vers le PDF généré

  createdAt: Date,
  updatedAt: Date
}
```

### Quote (Devis)

```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: Project),
  number: String,        // Numéro devis (DEV-2026-001)

  // Lignes du devis
  lines: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],

  // Totaux
  subtotal: Number,
  vatRate: Number,
  vatAmount: Number,
  total: Number,

  // Status
  status: String,        // 'draft' | 'sent' | 'signed' | 'refused' | 'expired'

  // Dates
  issueDate: Date,
  validUntil: Date,      // Date de validité
  signedAt: Date,

  // PDF
  pdfPath: String,

  createdAt: Date,
  updatedAt: Date
}
```

### History (Historique immuable)

```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: Project),
  action: String,        // 'status_change' | 'quote_created' | 'invoice_created' | 'event_added'...
  description: String,   // Description lisible
  metadata: Object,      // Données associées (ancien/nouveau statut, etc.)
  user: String,          // Utilisateur (pour futur multi-user)
  createdAt: Date        // Immuable
}
```

### Settings

```javascript
{
  _id: ObjectId,
  company: {
    name: String,
    address: String,
    siret: String,
    vatNumber: String,
    email: String,
    phone: String,
    logo: String         // Path vers le logo
  },
  invoicing: {
    numberPrefix: String,      // "FAC-"
    quotePrefix: String,       // "DEV-"
    defaultVatRate: Number,    // 20
    defaultPaymentTerms: Number, // 30 jours
    defaultHourlyRate: Number  // Taux horaire par défaut
  },
  statuses: [ObjectId]   // Ordre des statuts
}
```

---

## 3. API Endpoints

### Projects

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects` | Liste tous les projets |
| GET | `/api/projects/:id` | Détail d'un projet |
| POST | `/api/projects` | Créer un projet |
| PUT | `/api/projects/:id` | Modifier un projet |
| PATCH | `/api/projects/:id/status` | Changer le statut |
| DELETE | `/api/projects/:id` | Archiver un projet |

### Statuses

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/statuses` | Liste des statuts |
| POST | `/api/statuses` | Créer un statut |
| PUT | `/api/statuses/:id` | Modifier un statut |
| PUT | `/api/statuses/reorder` | Réordonner les statuts |
| DELETE | `/api/statuses/:id` | Supprimer un statut |

### Events

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects/:id/events` | Événements d'un projet |
| POST | `/api/projects/:id/events` | Ajouter un événement |
| PUT | `/api/events/:id` | Modifier un événement |
| DELETE | `/api/events/:id` | Supprimer un événement |

### Invoices

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects/:id/invoices` | Factures d'un projet |
| POST | `/api/projects/:id/invoices` | Créer une facture |
| PUT | `/api/invoices/:id` | Modifier une facture |
| PATCH | `/api/invoices/:id/status` | Changer le statut |
| GET | `/api/invoices/:id/pdf` | Télécharger le PDF |
| POST | `/api/invoices/:id/send` | Envoyer par email |

### Quotes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects/:id/quotes` | Devis d'un projet |
| POST | `/api/projects/:id/quotes` | Créer un devis |
| PUT | `/api/quotes/:id` | Modifier un devis |
| PATCH | `/api/quotes/:id/status` | Changer le statut |
| GET | `/api/quotes/:id/pdf` | Télécharger le PDF |
| POST | `/api/quotes/:id/send` | Envoyer par email |

### History

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects/:id/history` | Historique d'un projet |

### Settings

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/settings` | Récupérer les paramètres |
| PUT | `/api/settings` | Modifier les paramètres |

### Import

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/import` | Importer des données (CSV/Excel) |
| GET | `/api/import/template` | Télécharger le template d'import |

---

## 4. Interface Utilisateur

### Vue Workflow (Page principale)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔷 Swigs Workflow                    [+ Nouveau]  [Filtres]  [⚙️]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Projet1 │ │ Projet2 │ │ Projet3 │ │ Projet4 │ │ Projet5 │          │
│  │ Client  │ │ Client  │ │ Client  │ │ Client  │ │ Client  │          │
│  │ 2.5k€   │ │ 800€    │ │ 1.2k€   │ │ 450€    │ │ 3k€     │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                   │
│  │ Projet6 │ │ Projet7 │ │ Projet8 │                                   │
│  │ Client  │ │ Client  │ │ Client  │                                   │
│  │ 600€    │ │ 1.8k€   │ │ 950€    │                                   │
│  └─────────┘ └─────────┘ └─────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Carte Projet

```
┌──────────────────────────┐
│ ░░░░░ (bordure couleur)  │
│                          │
│  Nom du Projet           │
│  Client Name             │
│                          │
│  💰 2,500€ non facturé   │
│  ⏱️ 12h ce mois          │
│                          │
└──────────────────────────┘
```

### Sidebar Projet

```
┌──────────────────────────────────────────────┐
│  ← Fermer              Nom du Projet         │
├──────────────────────────────────────────────┤
│  [Infos] [Événements] [Historique] [Docs]    │
├──────────────────────────────────────────────┤
│                                              │
│  (Contenu de l'onglet actif)                 │
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 5. Phases de Développement

### Phase 1 : Fondations (Backend)

- [x] Initialisation du projet
- [ ] Configuration Express + MongoDB
- [ ] Modèles Mongoose
- [ ] CRUD Projects
- [ ] CRUD Statuses
- [ ] CRUD Events
- [ ] Health check API

### Phase 2 : Interface de Base (Frontend)

- [ ] Setup React + Vite + Tailwind
- [ ] Layout principal
- [ ] Vue Workflow (grille de cartes)
- [ ] Composant ProjectCard
- [ ] Sidebar basique
- [ ] Store Zustand

### Phase 3 : Sidebar Complète

- [ ] Onglet Infos
- [ ] Onglet Événements (CRUD)
- [ ] Onglet Historique
- [ ] Onglet Documents (liste)

### Phase 4 : Facturation

- [ ] CRUD Devis
- [ ] CRUD Factures
- [ ] Sélection événements pour facturation
- [ ] Génération PDF
- [ ] Envoi email

### Phase 5 : Polish & Déploiement

- [ ] Animations et transitions
- [ ] Responsive design
- [ ] Tests
- [ ] Déploiement serveur .59
- [ ] SSL + Nginx

### Phase 6 : Import de Données

- [ ] Parser CSV/Excel
- [ ] Mapping des champs
- [ ] Import projets/clients
- [ ] Import événements
- [ ] Réconciliation devis/factures

---

## 6. Structure des Fichiers

```
swigs-workflow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   ├── Project.js
│   │   │   ├── Status.js
│   │   │   ├── Event.js
│   │   │   ├── Invoice.js
│   │   │   ├── Quote.js
│   │   │   ├── History.js
│   │   │   └── Settings.js
│   │   ├── controllers/
│   │   │   ├── projectController.js
│   │   │   ├── statusController.js
│   │   │   ├── eventController.js
│   │   │   ├── invoiceController.js
│   │   │   ├── quoteController.js
│   │   │   └── settingsController.js
│   │   ├── routes/
│   │   │   ├── projects.js
│   │   │   ├── statuses.js
│   │   │   ├── events.js
│   │   │   ├── invoices.js
│   │   │   ├── quotes.js
│   │   │   └── settings.js
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   ├── historyService.js
│   │   │   ├── pdfService.js
│   │   │   └── emailService.js
│   │   └── utils/
│   │       └── helpers.js
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── ecosystem.config.cjs
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Workflow/
│   │   │   │   ├── ProjectCard.jsx
│   │   │   │   └── WorkflowGrid.jsx
│   │   │   ├── Sidebar/
│   │   │   │   ├── ProjectSidebar.jsx
│   │   │   │   ├── InfoTab.jsx
│   │   │   │   ├── EventsTab.jsx
│   │   │   │   ├── HistoryTab.jsx
│   │   │   │   └── DocumentsTab.jsx
│   │   │   └── ui/
│   │   │       ├── Button.jsx
│   │   │       ├── Input.jsx
│   │   │       ├── Modal.jsx
│   │   │       └── Badge.jsx
│   │   ├── pages/
│   │   │   ├── Workflow.jsx
│   │   │   └── Settings.jsx
│   │   ├── stores/
│   │   │   ├── projectStore.js
│   │   │   └── uiStore.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
│
├── ROADMAP.md
└── README.md
```

---

## 7. Conventions

### Code

- ES Modules (import/export)
- Async/await pour l'asynchrone
- Nommage camelCase pour JS
- Nommage kebab-case pour les fichiers
- Composants React en PascalCase

### Git

- Commits conventionnels : `feat:`, `fix:`, `docs:`, `refactor:`
- Branches : `main`, `feature/xxx`, `fix/xxx`

### API

- Réponses JSON standardisées
- Codes HTTP appropriés
- Gestion d'erreurs centralisée

---

**Version : 1.0 - Janvier 2026**