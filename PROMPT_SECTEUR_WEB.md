# Prompt Secteur Web - Webhooks CMS Backend

## Contexte

L'équipe Apps a développé un système d'automatisation de mails dans **swigs-workflow**. Ce système peut fonctionner en mode **polling** (interrogation périodique de l'API), mais serait plus réactif avec des **webhooks** envoyés par cms-backend.

## Objectif

Ajouter un système de webhooks dans **swigs-cms-backend** pour notifier les applications externes (swigs-workflow, futures apps) des événements importants.

## Événements à Notifier

| Événement | Trigger | Données |
|-----------|---------|---------|
| `order.created` | Nouvelle commande créée | Order complet |
| `order.paid` | Paiement confirmé (Stripe webhook) | Order + payment info |
| `order.status_changed` | Status mis à jour | Order + old/new status |
| `order.shipped` | Commande expédiée | Order + tracking info |
| `customer.created` | Nouveau client inscrit | Customer (sans password) |
| `customer.updated` | Profil client modifié | Customer + changed fields |

## Architecture Proposée

### 1. Modèle WebhookSubscription

```javascript
// models/WebhookSubscription.js
const mongoose = require('mongoose');

const WebhookSubscriptionSchema = new mongoose.Schema({
  // Qui s'abonne
  appName: { type: String, required: true },        // 'swigs-workflow', 'swigs-task'
  appSecret: { type: String, required: true },      // Secret pour signature

  // URL de destination
  url: { type: String, required: true },            // https://workflow.swigs.online/api/webhooks/cms

  // Événements souscrits
  events: [{
    type: String,
    enum: ['order.created', 'order.paid', 'order.status_changed',
           'order.shipped', 'customer.created', 'customer.updated']
  }],

  // Filtres optionnels
  filters: {
    siteIds: [mongoose.Schema.Types.ObjectId],      // Filtrer par sites
  },

  // État
  isActive: { type: Boolean, default: true },

  // Stats
  stats: {
    totalSent: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    lastSentAt: Date,
    lastError: String
  }
}, { timestamps: true });

module.exports = mongoose.model('WebhookSubscription', WebhookSubscriptionSchema);
```

### 2. Service WebhookDispatcher

```javascript
// services/webhookDispatcher.js
const crypto = require('crypto');
const axios = require('axios');
const WebhookSubscription = require('../models/WebhookSubscription');

class WebhookDispatcher {
  /**
   * Envoyer un événement à tous les abonnés
   */
  async dispatch(eventType, data, siteId = null) {
    try {
      // Trouver les abonnés actifs pour cet événement
      const query = {
        isActive: true,
        events: eventType
      };

      // Filtre optionnel par site
      if (siteId) {
        query.$or = [
          { 'filters.siteIds': { $size: 0 } },        // Pas de filtre = tous les sites
          { 'filters.siteIds': siteId }               // Ou site spécifique
        ];
      }

      const subscriptions = await WebhookSubscription.find(query);

      // Envoyer à chaque abonné
      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendWebhook(sub, eventType, data))
      );

      // Logger les résultats
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Webhook failed for ${subscriptions[index].appName}:`, result.reason);
        }
      });

      return results;
    } catch (error) {
      console.error('WebhookDispatcher error:', error);
      throw error;
    }
  }

  /**
   * Envoyer un webhook à un abonné spécifique
   */
  async sendWebhook(subscription, eventType, data) {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data
    };

    // Générer la signature HMAC
    const signature = this.generateSignature(payload, subscription.appSecret);

    try {
      const response = await axios.post(subscription.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Timestamp': payload.timestamp
        },
        timeout: 10000  // 10 secondes timeout
      });

      // Mettre à jour les stats
      await WebhookSubscription.findByIdAndUpdate(subscription._id, {
        $inc: { 'stats.totalSent': 1 },
        'stats.lastSentAt': new Date()
      });

      return { success: true, statusCode: response.status };
    } catch (error) {
      // Mettre à jour les stats d'erreur
      await WebhookSubscription.findByIdAndUpdate(subscription._id, {
        $inc: { 'stats.totalFailed': 1 },
        'stats.lastError': error.message
      });

      throw error;
    }
  }

  /**
   * Générer une signature HMAC-SHA256
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }
}

module.exports = new WebhookDispatcher();
```

### 3. Intégration dans les Controllers Existants

#### orderController.js

```javascript
const webhookDispatcher = require('../services/webhookDispatcher');

// Dans createOrder() - après création
await webhookDispatcher.dispatch('order.created', {
  orderId: order._id,
  orderNumber: order.orderNumber,
  customer: order.customer,
  items: order.items,
  total: order.total,
  status: order.status,
  siteId: order.site
}, order.site);

// Dans updateOrderStatus() - après mise à jour
await webhookDispatcher.dispatch('order.status_changed', {
  orderId: order._id,
  orderNumber: order.orderNumber,
  oldStatus,
  newStatus: order.status,
  trackingNumber: order.shipping?.trackingNumber,
  trackingUrl: order.shipping?.trackingUrl,
  siteId: order.site
}, order.site);

// Si shipped spécifiquement
if (newStatus === 'shipped') {
  await webhookDispatcher.dispatch('order.shipped', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    shipping: order.shipping,
    siteId: order.site
  }, order.site);
}
```

#### webhook.controller.js (Stripe)

```javascript
const webhookDispatcher = require('../services/webhookDispatcher');

// Dans le handler checkout.session.completed, après confirmOrderPayment()
await webhookDispatcher.dispatch('order.paid', {
  orderId: order._id,
  orderNumber: order.orderNumber,
  customer: order.customer,
  items: order.items,
  total: order.total,
  payment: {
    method: order.payment.method,
    transactionId: order.payment.transactionId,
    paidAt: order.payment.paidAt
  },
  siteId: order.site
}, order.site);
```

#### customerController.js

```javascript
const webhookDispatcher = require('../services/webhookDispatcher');

// Dans register() - après création
await webhookDispatcher.dispatch('customer.created', {
  customerId: customer._id,
  email: customer.email,
  firstName: customer.firstName,
  lastName: customer.lastName,
  siteId: customer.site
}, customer.site);

// Dans updateProfile() - après mise à jour
await webhookDispatcher.dispatch('customer.updated', {
  customerId: customer._id,
  email: customer.email,
  changedFields: Object.keys(req.body),
  siteId: customer.site
}, customer.site);
```

### 4. Routes Admin pour Gérer les Webhooks

```javascript
// routes/webhooks.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Toutes les routes nécessitent admin ou superadmin
router.use(protect, authorize('admin', 'superadmin'));

router.get('/', async (req, res) => {
  const subscriptions = await WebhookSubscription.find();
  res.json(subscriptions);
});

router.post('/', async (req, res) => {
  const { appName, appSecret, url, events, filters } = req.body;
  const subscription = await WebhookSubscription.create({
    appName, appSecret, url, events, filters
  });
  res.status(201).json(subscription);
});

router.put('/:id', async (req, res) => {
  const subscription = await WebhookSubscription.findByIdAndUpdate(
    req.params.id, req.body, { new: true }
  );
  res.json(subscription);
});

router.delete('/:id', async (req, res) => {
  await WebhookSubscription.findByIdAndDelete(req.params.id);
  res.json({ message: 'Subscription deleted' });
});

// Test un webhook
router.post('/:id/test', async (req, res) => {
  const subscription = await WebhookSubscription.findById(req.params.id);
  if (!subscription) return res.status(404).json({ message: 'Not found' });

  try {
    await webhookDispatcher.sendWebhook(subscription, 'test', {
      message: 'Test webhook from SWIGS CMS',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Test webhook sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### 5. Enregistrer dans server.js

```javascript
// server.js - ajouter la route
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);
```

---

## Configuration Côté swigs-workflow

### Récepteur de Webhooks

```javascript
// swigs-workflow/backend/src/routes/cmsWebhooks.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.CMS_WEBHOOK_SECRET;

// Middleware de vérification de signature
const verifySignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`;

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

router.post('/cms', verifySignature, async (req, res) => {
  const { event, data, timestamp } = req.body;

  console.log(`📨 Received CMS webhook: ${event}`);

  try {
    // Déclencher les automations correspondantes
    const triggerService = require('../services/automation/triggerService');
    await triggerService.fireTrigger(event, data);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## Sécurité

### Signature HMAC

Chaque webhook est signé avec HMAC-SHA256 :

```
X-Webhook-Signature: sha256=<hex-encoded-hmac>
```

Le récepteur DOIT vérifier cette signature avant de traiter le webhook.

### Secrets

- Chaque app a son propre `appSecret`
- Générer avec : `crypto.randomBytes(32).toString('hex')`
- Stocker dans `.env` des deux côtés

### Retry Policy

En cas d'échec (timeout, erreur 5xx) :
- Retry après 1 minute
- Retry après 5 minutes
- Retry après 15 minutes
- Abandon après 3 tentatives

### Rate Limiting

- Maximum 100 webhooks/minute par subscription
- Queue les webhooks si limite atteinte

---

## Variables d'Environnement

### cms-backend (.env)

```env
# Webhooks (optionnel, activer si utilisé)
WEBHOOKS_ENABLED=true
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT=10000
```

### swigs-workflow (.env)

```env
# Réception webhooks CMS
CMS_WEBHOOK_SECRET=<même secret que dans subscription>
```

---

## Enregistrement de swigs-workflow

Commande pour enregistrer swigs-workflow comme subscriber :

```bash
curl -X POST https://swigs.online/api/webhooks \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "swigs-workflow",
    "appSecret": "xxxxx-généré-avec-crypto-xxxxx",
    "url": "https://workflow.swigs.online/api/webhooks/cms",
    "events": ["order.created", "order.paid", "order.shipped", "customer.created"],
    "filters": {}
  }'
```

---

## Priorité

Cette fonctionnalité est **OPTIONNELLE**. Le système d'automatisation peut fonctionner en mode polling uniquement. Les webhooks améliorent simplement la réactivité (notification instantanée vs polling toutes les minutes).

**Recommandation** : Implémenter en Phase 2, une fois que le système de base fonctionne.

---

## Fichiers à Créer/Modifier

| Fichier | Action |
|---------|--------|
| `models/WebhookSubscription.js` | Créer |
| `services/webhookDispatcher.js` | Créer |
| `routes/webhooks.js` | Créer |
| `server.js` | Modifier (ajouter route) |
| `controllers/orderController.js` | Modifier (dispatch events) |
| `controllers/webhook.controller.js` | Modifier (dispatch order.paid) |
| `controllers/customerController.js` | Modifier (dispatch events) |

---

## Tests

```bash
# Tester l'envoi d'un webhook
curl -X POST https://swigs.online/api/webhooks/<subscription-id>/test \
  -H "Authorization: Bearer <admin-token>"

# Vérifier les stats
curl https://swigs.online/api/webhooks \
  -H "Authorization: Bearer <admin-token>"
```

---

**Note** : Ce prompt est destiné à l'équipe gérant swigs-cms-backend. L'implémentation est optionnelle et peut être faite ultérieurement.

---

**Version : 1.0 - Février 2026**
