# SWIGS Workflow - Document d'Intégration

## Vue d'Ensemble

Ce document décrit l'intégration de deux nouvelles fonctionnalités majeures dans swigs-workflow :

1. **Factures Custom** - Créer des factures libres sans devis ni heures
2. **Automatisation Mails** - Système de workflows avec triggers (style n8n)
3. **Pont de Données** - Connexion sécurisée entre swigs-workflow, swigs-hub, et cms-backend

---

## 1. Architecture Globale SWIGS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SWIGS ECOSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                    ┌──────────────────┐              │
│  │  Serveur .73     │                    │  Serveur .59     │              │
│  │  (CMS Principal) │                    │  (Apps)          │              │
│  ├──────────────────┤                    ├──────────────────┤              │
│  │                  │                    │                  │              │
│  │ swigs-cms-backend│◄───── API ────────►│ swigs-workflow   │              │
│  │ :3000            │      Polling       │ :3003            │              │
│  │                  │                    │                  │              │
│  │ Sites e-commerce │                    │ swigs-task       │              │
│  │ Orders, Clients  │                    │ :3002            │              │
│  │ Products         │                    │                  │              │
│  │                  │                    │ ai-builder       │              │
│  │ MongoDB          │                    │ :3001            │              │
│  │ (swigs-cms)      │                    │                  │              │
│  │                  │                    │ swigs-hub (SSO)  │              │
│  │ swigs-cms-admin  │                    │ :3006            │              │
│  │ (Frontend)       │                    │                  │              │
│  └──────────────────┘                    │ MongoDB          │              │
│                                          │ (apps locales)   │              │
│        192.168.110.73                    └──────────────────┘              │
│                                                192.168.110.59              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Apps & Ports

| App | Serveur | Port | URL | Description |
|-----|---------|------|-----|-------------|
| **swigs-cms-backend** | .73 | 3000 | swigs.online/api | API CMS & E-commerce |
| **swigs-cms-admin** | .73 | - | admin.swigs.online | Panel admin sites |
| **swigs-workflow** | .59 | 3003 | workflow.swigs.online | Gestion projets & facturation |
| **swigs-hub** | .59 | 3006 | apps.swigs.online | SSO Central |
| **swigs-task** | .59 | 3002 | task.swigs.online | Gestion tâches |
| **ai-builder** | .59 | 3001 | ai-builder.swigs.online | Générateur sites IA |

---

## 2. Factures Custom (Sans Devis/Heures)

### 2.1 Problème Actuel

Le système actuel **exige** soit des events (heures/dépenses), soit des devis signés pour créer une facture.

```javascript
// invoiceController.js - Ligne actuelle
if (events.length === 0 && quotes.length === 0) {
  return res.status(400).json({
    message: 'Sélectionnez au moins un événement ou un devis à facturer'
  });
}
```

### 2.2 Solution : Factures Custom

Ajouter un nouveau type de facture : **"custom"** avec des lignes libres.

#### Nouveau Schéma Invoice

```javascript
// Invoice.js - Ajouter ces champs
{
  // ... champs existants ...

  // NOUVEAU : Type de facture
  invoiceType: {
    type: String,
    enum: ['standard', 'custom'],
    default: 'standard'
  },

  // NOUVEAU : Lignes custom (pour type='custom')
  customLines: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true }
  }]
}
```

#### API Endpoint

```
POST /api/projects/:projectId/invoices

// Body pour facture standard (existant)
{
  eventIds: ["..."],
  quoteIds: ["..."],
  notes: "...",
  dueDate: "2025-03-01"
}

// Body pour facture custom (NOUVEAU)
{
  invoiceType: "custom",
  customLines: [
    { description: "Prestation conseil", quantity: 1, unitPrice: 500 },
    { description: "Développement module X", quantity: 3, unitPrice: 150 }
  ],
  notes: "Facture pour services divers",
  dueDate: "2025-03-01"
}
```

#### Modifications Backend

```javascript
// invoiceController.js - createInvoice()
exports.createInvoice = async (req, res) => {
  const { invoiceType = 'standard', customLines, eventIds, quoteIds, notes, dueDate, issueDate } = req.body;

  // Facture Custom
  if (invoiceType === 'custom') {
    if (!customLines || customLines.length === 0) {
      return res.status(400).json({ message: 'Ajoutez au moins une ligne à la facture' });
    }

    // Calculer totaux
    const subtotal = customLines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
    const vatRate = settings.invoicing?.defaultVatRate || 8.1;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    // Créer facture custom
    const invoice = new Invoice({
      project: projectId,
      number: await Invoice.generateNumber(projectId),
      invoiceType: 'custom',
      customLines: customLines.map(line => ({
        ...line,
        total: line.quantity * line.unitPrice
      })),
      events: [],
      quotes: [],
      subtotal,
      vatRate,
      vatAmount,
      total,
      status: 'draft',
      issueDate: issueDate || new Date(),
      dueDate: dueDate || addDays(new Date(), 30),
      notes
    });

    await invoice.save();
    return res.status(201).json(invoice);
  }

  // Facture Standard (code existant)
  // ...
};
```

#### Modifications Frontend

Nouveau composant `NewCustomInvoiceModal.jsx` avec :
- Formulaire de lignes libres (description, quantité, prix unitaire)
- Bouton "Ajouter ligne"
- Calcul automatique des totaux
- Sélection TVA

---

## 3. Système d'Automatisation Mails

### 3.1 Concept

Un système visuel de création de workflows d'emails, inspiré de n8n/Zapier.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW BUILDER (Drag & Drop)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      │
│   │ TRIGGER  │─────►│ CONDITION│─────►│  WAIT    │─────►│  EMAIL   │      │
│   │ Commande │      │ Status=  │      │ 2 jours  │      │ Merci!   │      │
│   │ reçue    │      │ "payé"   │      │          │      │          │      │
│   └──────────┘      └──────────┘      └──────────┘      └──────────┘      │
│                                              │                              │
│                                              ▼                              │
│                                       ┌──────────┐      ┌──────────┐      │
│                                       │  WAIT    │─────►│  EMAIL   │      │
│                                       │ 7 jours  │      │ Review?  │      │
│                                       └──────────┘      └──────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Composants du Système

#### A. Triggers (Déclencheurs)

| Trigger | Source | Description |
|---------|--------|-------------|
| `order.created` | cms-backend | Nouvelle commande créée |
| `order.paid` | cms-backend | Commande payée (Stripe webhook) |
| `order.shipped` | cms-backend | Commande expédiée |
| `order.delivered` | cms-backend | Commande livrée |
| `customer.created` | cms-backend | Nouveau client |
| `time.delay` | workflow | X jours/heures après événement précédent |
| `time.schedule` | workflow | Heure/jour spécifique |
| `project.status_changed` | workflow | Changement statut projet |
| `invoice.created` | workflow | Nouvelle facture |
| `invoice.paid` | workflow | Facture payée |
| `manual` | workflow | Déclenchement manuel |

#### B. Actions

| Action | Description |
|--------|-------------|
| `send_email` | Envoyer un email (template) |
| `send_sms` | Envoyer SMS (future) |
| `wait` | Attendre X temps |
| `condition` | Branche conditionnelle |
| `update_record` | Mettre à jour une donnée |
| `webhook` | Appeler une URL externe |
| `create_task` | Créer une tâche (swigs-task) |

#### C. Conditions

| Condition | Description |
|-----------|-------------|
| `equals` | Champ = valeur |
| `not_equals` | Champ != valeur |
| `contains` | Champ contient |
| `greater_than` | Champ > valeur |
| `less_than` | Champ < valeur |
| `is_empty` | Champ vide |
| `is_not_empty` | Champ non vide |

### 3.3 Modèles de Données

#### Automation (Workflow)

```javascript
// models/Automation.js
const AutomationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  name: { type: String, required: true },
  description: String,

  // État
  isActive: { type: Boolean, default: false },

  // Trigger principal
  trigger: {
    type: {
      type: String,
      enum: ['order.created', 'order.paid', 'order.shipped', 'order.delivered',
             'customer.created', 'time.schedule', 'project.status_changed',
             'invoice.created', 'invoice.paid', 'manual'],
      required: true
    },
    config: {
      // Config spécifique au trigger
      siteId: mongoose.Schema.Types.ObjectId,  // Pour filtrer par site
      statusFilter: String,                     // Filtre optionnel
      scheduleExpression: String                // Pour time.schedule (cron)
    }
  },

  // Nodes du workflow (canvas)
  nodes: [{
    id: { type: String, required: true },       // UUID unique
    type: { type: String, enum: ['trigger', 'action', 'condition', 'wait'] },

    // Position sur le canvas
    position: {
      x: Number,
      y: Number
    },

    // Configuration selon le type
    config: mongoose.Schema.Types.Mixed,

    // Connexions sortantes
    connections: [{
      targetId: String,                         // ID du node cible
      condition: String                         // 'default', 'true', 'false'
    }]
  }],

  // Statistiques
  stats: {
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    lastRunAt: Date,
    lastError: String
  }
}, { timestamps: true });
```

#### AutomationRun (Exécution)

```javascript
// models/AutomationRun.js
const AutomationRunSchema = new mongoose.Schema({
  automation: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', required: true },

  // Données du trigger
  triggerData: mongoose.Schema.Types.Mixed,

  // État de l'exécution
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'waiting'],
    default: 'pending'
  },

  // Position actuelle dans le workflow
  currentNodeId: String,

  // Historique des nodes exécutés
  executionLog: [{
    nodeId: String,
    nodeType: String,
    startedAt: Date,
    completedAt: Date,
    status: { type: String, enum: ['success', 'failed', 'skipped'] },
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    error: String
  }],

  // Pour les nodes "wait"
  scheduledAt: Date,                           // Quand reprendre l'exécution

  error: String,
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });
```

#### EmailTemplate

```javascript
// models/EmailTemplate.js
const EmailTemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  name: { type: String, required: true },
  subject: { type: String, required: true },

  // Corps de l'email (HTML avec variables)
  body: { type: String, required: true },

  // Variables disponibles (documentation)
  availableVariables: [{
    name: String,              // {{customer.firstName}}
    description: String
  }],

  // Catégorie
  category: {
    type: String,
    enum: ['order', 'customer', 'project', 'invoice', 'general'],
    default: 'general'
  },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

### 3.4 Architecture du Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTOMATION ENGINE (swigs-workflow)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │  TRIGGER SERVICE │     │  EXECUTOR        │     │  SCHEDULER       │   │
│  ├──────────────────┤     ├──────────────────┤     ├──────────────────┤   │
│  │                  │     │                  │     │                  │   │
│  │ • Poll CMS API   │────►│ • Process nodes  │     │ • Cron jobs      │   │
│  │ • Check webhooks │     │ • Execute actions│◄────│ • Resume waits   │   │
│  │ • Schedule check │     │ • Log execution  │     │ • Scheduled runs │   │
│  │                  │     │                  │     │                  │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│           │                        │                        │              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         MONGODB                                      │  │
│  │  Automations | AutomationRuns | EmailTemplates | CmsEventCache      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Services Backend

```
backend/src/
├── services/
│   ├── automation/
│   │   ├── triggerService.js      # Gestion des triggers
│   │   ├── executorService.js     # Exécution des workflows
│   │   ├── schedulerService.js    # Planification (node-cron)
│   │   ├── emailService.js        # Envoi d'emails
│   │   └── cmsPollerService.js    # Polling CMS API
│   └── ...
├── routes/
│   ├── automations.js             # CRUD automations
│   ├── automationRuns.js          # Historique exécutions
│   └── emailTemplates.js          # Gestion templates
├── controllers/
│   ├── automationController.js
│   ├── automationRunController.js
│   └── emailTemplateController.js
└── models/
    ├── Automation.js
    ├── AutomationRun.js
    ├── EmailTemplate.js
    └── CmsEventCache.js           # Cache événements CMS
```

### 3.6 Interface Frontend (Drag & Drop)

Technologies recommandées :
- **React Flow** (`@xyflow/react`) - Pour le canvas drag & drop
- **Zustand** - State management (déjà utilisé)
- **Framer Motion** - Animations (déjà utilisé)

```
frontend/src/
├── pages/
│   └── Automations.jsx            # Page principale
├── components/
│   └── Automations/
│       ├── AutomationList.jsx     # Liste des automations
│       ├── AutomationBuilder.jsx  # Canvas React Flow
│       ├── nodes/
│       │   ├── TriggerNode.jsx    # Node trigger
│       │   ├── ActionNode.jsx     # Node action
│       │   ├── ConditionNode.jsx  # Node condition
│       │   └── WaitNode.jsx       # Node délai
│       ├── panels/
│       │   ├── NodeConfigPanel.jsx    # Config node sélectionné
│       │   └── VariablesPanel.jsx     # Variables disponibles
│       └── modals/
│           ├── SelectTriggerModal.jsx
│           ├── SelectActionModal.jsx
│           └── EmailTemplateModal.jsx
└── stores/
    └── automationStore.js         # État des automations
```

---

## 4. Pont de Données (Data Bridge)

### 4.1 Stratégie de Connexion

**Option Choisie : API Polling + Service Token**

Pourquoi ?
- ✅ Pas de modification de cms-backend
- ✅ Sécurisé (token permanent)
- ✅ Fiable (retry, cache)
- ✅ Simple à implémenter

```
┌─────────────────────┐                    ┌─────────────────────┐
│   cms-backend       │                    │   swigs-workflow    │
│   (.73)             │                    │   (.59)             │
├─────────────────────┤                    ├─────────────────────┤
│                     │   GET /api/orders  │                     │
│  Orders             │◄──────────────────┤  CMS Poller Service │
│  Customers          │   Token: Bearer    │                     │
│  Products           │   service-cascade  │  Cache événements   │
│                     │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

### 4.2 Service Token CMS

Créer un compte de service sur cms-backend :

```bash
# 1. Créer l'utilisateur
POST https://swigs.online/api/auth/register (via admin)
{
  "email": "workflow-service@swigs.online",
  "password": "[strong-password]",
  "name": "Workflow Service",
  "role": "admin"
}

# 2. Générer un token permanent
POST https://swigs.online/api/auth/generate-token
Authorization: Bearer [admin-token]

# Réponse : token permanent (ex: service-workflow-2025)
```

### 4.3 CMS Poller Service

```javascript
// services/automation/cmsPollerService.js
const axios = require('axios');
const CmsEventCache = require('../../models/CmsEventCache');

class CmsPollerService {
  constructor() {
    this.cmsApiUrl = process.env.CMS_API_URL || 'https://swigs.online/api';
    this.serviceToken = process.env.CMS_SERVICE_TOKEN;
    this.pollingInterval = 60000; // 1 minute
  }

  async start() {
    console.log('🔄 CMS Poller Service started');
    this.pollOrders();
    setInterval(() => this.pollOrders(), this.pollingInterval);
  }

  async pollOrders() {
    try {
      // Récupérer le dernier timestamp
      const lastCheck = await CmsEventCache.findOne().sort({ checkedAt: -1 });
      const since = lastCheck?.checkedAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Appeler l'API CMS
      const response = await axios.get(`${this.cmsApiUrl}/orders`, {
        headers: { Authorization: `Bearer ${this.serviceToken}` },
        params: {
          updatedSince: since.toISOString(),
          limit: 100
        }
      });

      const orders = response.data.data || response.data;

      for (const order of orders) {
        await this.processOrder(order);
      }

      // Mettre à jour le timestamp
      await CmsEventCache.create({ checkedAt: new Date(), type: 'orders', count: orders.length });

    } catch (error) {
      console.error('❌ CMS Polling error:', error.message);
    }
  }

  async processOrder(order) {
    // Vérifier si déjà traité
    const existing = await CmsEventCache.findOne({
      'data.orderId': order._id,
      'data.status': order.status
    });

    if (existing) return;

    // Créer l'événement
    const eventType = this.getOrderEventType(order);

    // Déclencher les automations correspondantes
    const triggerService = require('./triggerService');
    await triggerService.fireTrigger(eventType, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: order.customer,
      total: order.total,
      items: order.items,
      siteId: order.site
    });

    // Marquer comme traité
    await CmsEventCache.create({
      type: 'order_event',
      eventType,
      data: { orderId: order._id, status: order.status },
      processedAt: new Date()
    });
  }

  getOrderEventType(order) {
    // Déduire l'événement selon le status
    switch (order.status) {
      case 'pending': return 'order.created';
      case 'paid': return 'order.paid';
      case 'shipped': return 'order.shipped';
      case 'delivered': return 'order.delivered';
      default: return null;
    }
  }
}

module.exports = new CmsPollerService();
```

### 4.4 Variables d'Environnement

Ajouter au `.env` de swigs-workflow :

```env
# CMS Data Bridge
CMS_API_URL=https://swigs.online/api
CMS_SERVICE_TOKEN=service-workflow-xxxxx

# Polling Configuration
CMS_POLL_INTERVAL=60000
CMS_POLL_ENABLED=true
```

---

## 5. Sécurité

### 5.1 Authentification Inter-Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUX D'AUTHENTIFICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UTILISATEUR                                                                │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐    SSO Token    ┌─────────────┐                           │
│  │ SWIGS-HUB   │────────────────►│ WORKFLOW    │                           │
│  │ (SSO)       │                 │             │                           │
│  └─────────────┘                 └──────┬──────┘                           │
│                                         │                                   │
│                                   Service Token                             │
│                                         │                                   │
│                                         ▼                                   │
│                                  ┌─────────────┐                           │
│                                  │ CMS-BACKEND │                           │
│                                  │             │                           │
│                                  └─────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Bonnes Pratiques

1. **Tokens** : Utiliser des tokens de service dédiés (pas de credentials utilisateur)
2. **HTTPS** : Toutes les communications en HTTPS
3. **Rate Limiting** : Respecter les limites de l'API CMS (100 req/min)
4. **Logging** : Logger toutes les requêtes inter-services
5. **Secrets** : Stocker tokens dans `.env`, jamais en code
6. **Retry** : Implémenter exponential backoff pour les échecs

---

## 6. API Endpoints (Nouvelles Routes)

### 6.1 Automations

```
GET    /api/automations                    # Liste des automations
POST   /api/automations                    # Créer automation
GET    /api/automations/:id                # Détail automation
PUT    /api/automations/:id                # Modifier automation
DELETE /api/automations/:id                # Supprimer automation
PATCH  /api/automations/:id/toggle         # Activer/Désactiver
POST   /api/automations/:id/test           # Tester avec données sample
POST   /api/automations/:id/run            # Déclencher manuellement
```

### 6.2 Automation Runs

```
GET    /api/automations/:id/runs           # Historique exécutions
GET    /api/automation-runs/:id            # Détail exécution
POST   /api/automation-runs/:id/retry      # Relancer exécution échouée
DELETE /api/automation-runs/:id            # Supprimer exécution
```

### 6.3 Email Templates

```
GET    /api/email-templates                # Liste templates
POST   /api/email-templates                # Créer template
GET    /api/email-templates/:id            # Détail template
PUT    /api/email-templates/:id            # Modifier template
DELETE /api/email-templates/:id            # Supprimer template
POST   /api/email-templates/:id/preview    # Prévisualiser avec données
POST   /api/email-templates/:id/send-test  # Envoyer email test
```

### 6.4 Factures Custom

```
POST   /api/projects/:projectId/invoices   # (Modifié)
       Body: { invoiceType: 'custom', customLines: [...] }
```

---

## 7. Plan d'Implémentation

### Phase 1 : Factures Custom (1-2 jours)

1. ✅ Modifier modèle Invoice (customLines, invoiceType)
2. ✅ Modifier invoiceController.js
3. ✅ Créer NewCustomInvoiceModal.jsx
4. ✅ Ajouter bouton "Facture libre" dans sidebar
5. ✅ Tester localement
6. ✅ Déployer

### Phase 2 : Infrastructure Automations (2-3 jours)

1. ⬜ Créer modèles (Automation, AutomationRun, EmailTemplate)
2. ⬜ Créer routes et controllers
3. ⬜ Implémenter CmsPollerService
4. ⬜ Implémenter TriggerService
5. ⬜ Implémenter ExecutorService
6. ⬜ Implémenter SchedulerService

### Phase 3 : Interface Automations (3-4 jours)

1. ⬜ Installer React Flow
2. ⬜ Créer page Automations
3. ⬜ Créer AutomationBuilder (canvas)
4. ⬜ Créer nodes (Trigger, Action, Condition, Wait)
5. ⬜ Créer panels de configuration
6. ⬜ Implémenter sauvegarde/chargement

### Phase 4 : Templates Email (1-2 jours)

1. ⬜ Créer gestion templates
2. ⬜ Éditeur HTML avec variables
3. ⬜ Prévisualisation
4. ⬜ Templates par défaut

### Phase 5 : Tests & Déploiement (1-2 jours)

1. ⬜ Tests unitaires services
2. ⬜ Tests intégration polling CMS
3. ⬜ Tests E2E workflows
4. ⬜ Déploiement .59
5. ⬜ Monitoring

---

## 8. Prompt pour Secteur Web

> Voir fichier séparé : `PROMPT_SECTEUR_WEB.md`

Ce prompt contient les instructions pour ajouter des endpoints webhook dans cms-backend (optionnel, pour améliorer la réactivité du système).

---

## 9. Fichiers à Créer/Modifier

### Backend

| Fichier | Action | Description |
|---------|--------|-------------|
| `models/Invoice.js` | Modifier | Ajouter customLines, invoiceType |
| `models/Automation.js` | Créer | Schéma workflows |
| `models/AutomationRun.js` | Créer | Schéma exécutions |
| `models/EmailTemplate.js` | Créer | Schéma templates |
| `models/CmsEventCache.js` | Créer | Cache événements CMS |
| `controllers/invoiceController.js` | Modifier | Support factures custom |
| `controllers/automationController.js` | Créer | CRUD automations |
| `controllers/emailTemplateController.js` | Créer | CRUD templates |
| `routes/automations.js` | Créer | Routes automations |
| `routes/emailTemplates.js` | Créer | Routes templates |
| `services/automation/triggerService.js` | Créer | Gestion triggers |
| `services/automation/executorService.js` | Créer | Exécution workflows |
| `services/automation/schedulerService.js` | Créer | Planification |
| `services/automation/emailService.js` | Créer | Envoi emails |
| `services/automation/cmsPollerService.js` | Créer | Polling CMS |

### Frontend

| Fichier | Action | Description |
|---------|--------|-------------|
| `pages/Automations.jsx` | Créer | Page principale |
| `components/Sidebar/NewCustomInvoiceModal.jsx` | Créer | Modal facture custom |
| `components/Automations/AutomationList.jsx` | Créer | Liste automations |
| `components/Automations/AutomationBuilder.jsx` | Créer | Canvas React Flow |
| `components/Automations/nodes/*.jsx` | Créer | Nodes du workflow |
| `stores/automationStore.js` | Créer | État Zustand |
| `services/api.js` | Modifier | Ajouter automationsApi |

---

## 10. Dépendances à Installer

### Backend

```bash
npm install node-cron nodemailer handlebars
```

- `node-cron` : Planification des tâches
- `nodemailer` : Envoi d'emails
- `handlebars` : Templating emails

### Frontend

```bash
npm install @xyflow/react
```

- `@xyflow/react` : Canvas drag & drop pour le workflow builder

---

**Version : 1.0 - Février 2026**
**Auteur : Claude Code**
