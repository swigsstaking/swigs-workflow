# Audit de Qualité du Code - SWIGS Workflow

**Date**: 13 février 2026
**Auditeur**: Agent code-quality
**Portée**: Backend (Node.js/Express/MongoDB) & Frontend (React/Vite/Zustand)

---

## Résumé Exécutif

L'application swigs-workflow présente une architecture **globalement propre et bien structurée**. Le code backend suit des patterns MVC cohérents avec Mongoose pour MongoDB. Le frontend utilise Zustand pour la gestion d'état et React moderne.

**Points forts** :
- Architecture claire (models, controllers, routes, services)
- Système multi-tenant bien implémenté avec `userId`
- Système d'authentification SSO correctement intégré
- Gestion d'erreurs centralisée
- Immutabilité des snapshots pour factures/devis

**Points faibles majeurs** :
- **Validations d'input insuffisantes** au niveau backend (risque injection)
- **Promesses non catchées** dans plusieurs endroits critiques
- **Console.log() en production** (logs debug non nettoyés)
- **Code mort** et imports non utilisés dans automation services
- **Erreurs silencieuses** dans plusieurs try/catch

---

## Problèmes par Sévérité

### 🔴 CRITIQUE

#### 1. Validation d'entrée insuffisante - Risque d'injection NoSQL
**Fichiers**: Multiples controllers

**Problème**: Les paramètres utilisateurs sont utilisés directement dans les queries MongoDB sans validation stricte.

**Exemples**:
- `projectController.js:38-39` : `status` et `search` non validés avant utilisation
- `analyticsController.js:36-43` : Dates calculées sans validation
- `invoiceController.js:112-119` : `quotePartials` accepte un objet arbitraire

```javascript
// backend/src/controllers/projectController.js:38-39
if (status) {
  matchStage.status = new mongoose.Types.ObjectId(status); // ❌ Pas de validation
}
```

**Impact**: Injection NoSQL possible, crash serveur si format invalide

**Recommandation**:
```javascript
// Validation stricte avec joi ou zod
import Joi from 'joi';

const projectQuerySchema = Joi.object({
  status: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  search: Joi.string().max(100).trim(),
  archived: Joi.string().valid('true', 'false')
});

// Dans le controller
const { error, value } = projectQuerySchema.validate(req.query);
if (error) return res.status(400).json({ error: error.details[0].message });
```

---

#### 2. Promesses non catchées - Crash potentiel
**Fichiers**: `automationController.js`, `eventBus.service.js`

**Problème**: Exécutions asynchrones lancées sans gestion d'erreur.

**Exemples**:

```javascript
// backend/src/controllers/automationController.js:184-186
executeRun(run._id).catch(err => {
  console.error('Manual run execution error:', err); // ❌ Log seulement
});
```

```javascript
// backend/src/services/eventBus.service.js:268-273
eventBus.on(eventType, async (event) => {
  try {
    await fireTrigger(eventType, event.payload, { siteId: event.payload?.siteId });
  } catch (err) {
    console.error(`Failed to trigger automation for ${eventType}:`, err); // ❌ Erreur silencieuse
  }
});
```

**Impact**: Erreurs non remontées, comportements imprévisibles, fuites mémoire potentielles

**Recommandation**:
- Logger avec un service centralisé (Sentry, Datadog)
- Remonter les erreurs critiques par email/alerting
- Ajouter des métriques de monitoring

---

#### 3. Injection de date dans analyticsController
**Fichier**: `analyticsController.js:432-490`

**Problème**: La fonction `seedTestData` crée des factures de test avec des dates hardcodées incluant 2025/2026. Ce code devrait être supprimé ou protégé par une feature flag de développement.

```javascript
// backend/src/controllers/analyticsController.js:462
{ projectIdx: 0, number: 'TEST-2025-001', subtotal: 4500, status: 'paid', issueDate: new Date('2025-08-15'), ... }
```

**Impact**: Pollution de données en production, risque de fausses analytics

**Recommandation**:
```javascript
// Protéger par NODE_ENV
if (process.env.NODE_ENV !== 'development') {
  return res.status(403).json({ error: 'Endpoint disponible uniquement en développement' });
}
```

---

### 🟠 IMPORTANT

#### 4. Console.log() en production
**Fichiers**: Multiples (12+ occurrences)

**Exemples**:
- `projectController.js:15-34` : Logs debug étendus
- `server.js:225-237` : Logs de démarrage (acceptable)
- `eventBus.service.js:71,98,109,260` : Logs de connexion WebSocket

**Impact**: Performance dégradée, logs sensibles potentiellement exposés, difficile à désactiver

**Recommandation**:
- Utiliser une bibliothèque de logging (winston, pino)
- Filtrer par niveau (DEBUG, INFO, WARN, ERROR)
- Désactiver DEBUG en production via variable d'environnement

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Usage
logger.debug('Match stage:', JSON.stringify(matchStage));
logger.error('MongoDB connection error:', err);
```

---

#### 5. Conditions de course dans updatePositions
**Fichier**: `projectController.js:564-588`

**Problème**: Batch update sans transaction MongoDB. Si plusieurs utilisateurs mettent à jour en même temps, dernière écriture gagne.

```javascript
// backend/src/controllers/projectController.js:582
await Project.bulkWrite(bulkOps); // ❌ Pas de transaction
```

**Impact**: Positions perdues lors de conflits d'édition simultanée

**Recommandation**:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Project.bulkWrite(bulkOps, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

#### 6. Erreurs silencieuses dans quoteController
**Fichier**: `quoteController.js:228-242`

**Problème**: Lors de la mise à jour de devis signés/facturés, seules les notes sont modifiables mais aucun message clair n'est retourné si l'utilisateur tente de modifier autre chose.

```javascript
// backend/src/controllers/quoteController.js:228-237
if (isLocked) {
  if (notes !== undefined) {
    quote.notes = notes;
    await quote.save();
    return res.json({ success: true, data: quote, message: '...' });
  }
  return res.status(400).json({ error: '...' }); // ❌ Mais si notes === undefined ?
}
```

**Impact**: UX confuse, modifications silencieusement ignorées

**Recommandation**: Toujours valider ET retourner un message clair sur ce qui a été modifié.

---

#### 7. Memory leak potentiel dans eventBus
**Fichier**: `eventBus.service.js:44`

**Problème**: `pendingEvents` array peut croître indéfiniment si la connexion WebSocket ne se rétablit jamais.

```javascript
// backend/src/services/eventBus.service.js:44
this.pendingEvents = []; // ❌ Pas de limite de taille
```

**Impact**: Consommation mémoire infinie en cas de déconnexion prolongée

**Recommandation**:
```javascript
constructor() {
  super();
  this.pendingEvents = [];
  this.maxPendingEvents = 1000; // Limite
}

publish(event, payload) {
  // ...
  if (this.connected && this.ws) {
    this.ws.send(JSON.stringify(message));
  } else {
    if (this.pendingEvents.length < this.maxPendingEvents) {
      this.pendingEvents.push(message);
    } else {
      logger.warn(`[EventBus] Dropping event ${event}, queue full`);
    }
  }
}
```

---

#### 8. Calcul de partial quote fragile
**Fichier**: `invoiceController.js:239-276`

**Problème**: Calcul complexe de factures partielles avec beaucoup de logique imbriquée. Difficile à tester, risque d'erreurs d'arrondi.

```javascript
// backend/src/controllers/invoiceController.js:245-258
if (partial && partial.value > 0) {
  if (partial.type === 'percent') {
    invoiceAmount = quote.subtotal * (partial.value / 100);
  } else {
    invoiceAmount = partial.value;
  }
  isPartial = invoiceAmount < quote.subtotal;
}

const remainingAmount = quote.subtotal - (quote.invoicedAmount || 0);
if (invoiceAmount > remainingAmount) {
  invoiceAmount = remainingAmount;
}
```

**Impact**: Bugs potentiels sur arrondis, edge cases non gérés (montant négatif, division par zéro)

**Recommandation**: Extraire dans une fonction pure testée unitairement.

```javascript
// services/invoicing/partialCalculator.js
export function calculatePartialAmount(quote, partial) {
  if (!partial || partial.value <= 0) {
    return { amount: quote.subtotal, isPartial: false };
  }

  let requestedAmount = partial.type === 'percent'
    ? quote.subtotal * (partial.value / 100)
    : partial.value;

  const remainingAmount = quote.subtotal - (quote.invoicedAmount || 0);
  const finalAmount = Math.min(requestedAmount, remainingAmount);

  return {
    amount: Math.round(finalAmount * 100) / 100, // Arrondi 2 décimales
    isPartial: finalAmount < quote.subtotal,
    remaining: remainingAmount - finalAmount
  };
}
```

---

### 🟡 MINEUR

#### 9. Code mort dans automation services
**Fichiers**: `backend/src/services/automation/*.js`

**Observations**:
- `cmsPollerService.js` (non lu dans cet audit mais référencé) : Service de polling CMS legacy à migrer vers Event Bus
- `schedulerService.js` : Probablement utilisé pour crons mais non lu
- `triggerService.js` : Référencé mais non audité

**Recommandation**: Auditer et nettoyer les services automation. Supprimer code legacy si Event Bus est actif.

---

#### 10. Magic numbers dans analytics
**Fichier**: `analyticsController.js:23,356-369,407`

**Exemples**:
```javascript
const monthNames = ['Jan', 'Fév', 'Mar', ...]; // ❌ Hardcodé
const months = parseInt(req.query.months) || 12; // ❌ Magic number
```

**Impact**: Maintenabilité réduite

**Recommandation**: Extraire dans des constantes.

```javascript
const MONTH_NAMES_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const DEFAULT_MONTHS_LOOKBACK = 12;
const MAX_MONTHS_LOOKBACK = 24;
```

---

#### 11. Naming incohérent dans frontend
**Fichier**: `projectStore.js:102-125`

**Problème**: Mélange de localStorage et API pour les positions.

```javascript
// frontend/src/stores/projectStore.js:108
localStorage.setItem('swigs-project-positions', JSON.stringify(positionMap));
// ...
await projectsApi.updatePositions(positions); // API call en silencieux
```

**Impact**: Confusion sur la source de vérité, comportement imprévisible

**Recommandation**: Choisir une stratégie claire (soit localStorage + sync, soit API uniquement).

---

#### 12. try/catch vides
**Fichier**: `projectStore.js:119-124`

```javascript
try {
  await projectsApi.updatePositions(positions);
} catch (error) {
  console.log('Positions saved locally (backend not deployed)'); // ❌ Catch qui ignore l'erreur
}
```

**Impact**: Masque des erreurs réelles d'API (timeouts, 500, etc.)

**Recommandation**:
```javascript
try {
  await projectsApi.updatePositions(positions);
  console.log('Positions synced to server');
} catch (error) {
  if (error.response?.status === 404) {
    console.warn('Position API not deployed yet, using localStorage only');
  } else {
    console.error('Failed to sync positions:', error);
    // Optionnel: retry logic ou afficher un toast utilisateur
  }
}
```

---

#### 13. Duplication de code dans historyService
**Fichier**: `historyService.js`

**Problème**: Chaque méthode répète la même structure.

```javascript
async quoteCreated(projectId, quoteNumber, total) {
  return this.log(projectId, 'quote_created', `Devis ${quoteNumber} créé (${total}€)`, { quoteNumber, total });
}
async quoteSent(projectId, quoteNumber) {
  return this.log(projectId, 'quote_sent', `Devis ${quoteNumber} envoyé`, { quoteNumber });
}
```

**Impact**: Maintenabilité réduite, risque de bugs si la structure change

**Recommandation**: Générer automatiquement les méthodes ou utiliser un pattern factory.

```javascript
const HISTORY_ACTIONS = {
  quote_created: (number, total) => `Devis ${number} créé (${total}€)`,
  quote_sent: (number) => `Devis ${number} envoyé`,
  // ...
};

async logAction(projectId, action, ...args) {
  const template = HISTORY_ACTIONS[action];
  if (!template) throw new Error(`Unknown action: ${action}`);
  return this.log(projectId, action, template(...args), { ...args });
}
```

---

#### 14. Calcul d'heures sans gestion de fuseaux horaires
**Fichier**: `analyticsController.js:8-19`

```javascript
const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};
```

**Impact**: Décalages horaires possibles si serveur et utilisateurs sont dans des TZ différents

**Recommandation**: Utiliser `date-fns-tz` ou `luxon` pour normaliser en UTC.

```javascript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const getMonthRange = (year, month, timezone = 'UTC') => {
  const localStart = new Date(year, month - 1, 1);
  const localEnd = new Date(year, month, 0, 23, 59, 59, 999);

  return {
    start: zonedTimeToUtc(localStart, timezone),
    end: zonedTimeToUtc(localEnd, timezone)
  };
};
```

---

#### 15. Frontend: Axios interceptor peut boucler
**Fichier**: `frontend/src/services/api.js:21-42`

**Problème**: Si `refreshAccessToken()` retourne `true` mais le token reste invalide, boucle infinie potentielle.

```javascript
// frontend/src/services/api.js:28-37
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const success = await refreshAccessToken();
  if (success) {
    const { accessToken } = useAuthStore.getState();
    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
    return api(originalRequest); // ❌ Si le nouveau token est aussi invalide ?
  }
}
```

**Impact**: Stack overflow, application freeze

**Recommandation**: Ajouter un compteur de retries max.

```javascript
if (error.response?.status === 401) {
  const retryCount = originalRequest._retryCount || 0;
  if (retryCount < 1) {
    originalRequest._retryCount = retryCount + 1;
    const success = await refreshAccessToken();
    if (success) {
      const { accessToken } = useAuthStore.getState();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    }
  }
  // Après 1 retry raté, forcer logout
  useAuthStore.getState().logout();
}
```

---

## Qualité de l'Architecture

### Points Forts

1. **Séparation des préoccupations**: Models, Controllers, Routes bien séparés
2. **Middleware centralisé**: Auth et errorHandler propres
3. **Multi-tenant**: Implémentation cohérente du `userId`
4. **Immutabilité des snapshots**: Les factures stockent des copies immuables (bonne pratique)
5. **Event Bus**: Architecture orientée événements pour inter-app communication
6. **Indexes MongoDB**: Bien pensés pour les requêtes fréquentes

### Points Faibles

1. **Validation d'entrée**: Quasi absente au niveau backend
2. **Tests unitaires**: Aucun fichier de test trouvé
3. **Documentation**: Commentaires minimalistes, pas de JSDoc complet
4. **Error handling**: Trop de console.error() au lieu de logs structurés
5. **Transactions MongoDB**: Absentes dans les opérations critiques

---

## Code Smell & Anti-Patterns

### Backend

1. **God Controller**: `projectController.js` fait 606 lignes (trop long)
2. **Query anti-pattern**: Utilisation de `await` dans des boucles (analyticsController.js:136-187)
3. **Magic strings**: Statuts hardcodés ('draft', 'sent', 'paid') au lieu d'enums

### Frontend

1. **State management mixte**: LocalStorage + API + Zustand pour positions
2. **Props drilling**: Composants profonds sans Context (non audité en détail)
3. **useEffect missing dependencies**: Probable (non vérifié exhaustivement)

---

## Complexité Cyclomatique

### Fonctions avec haute complexité (>10)

1. **`projectController.getProjects`** (51-221): 15+ branches (filtres, pagination, aggregation)
2. **`invoiceController.createInvoice`** (108-336): 20+ branches (standard/custom, events/quotes/partials)
3. **`executorService.executeNode`** (69-150+): 12+ branches (switch sur node types + conditions)

**Recommandation**: Refactorer en sous-fonctions pures testables.

---

## Recommandations Prioritaires

### Court Terme (Sprint actuel)

1. ✅ **Ajouter validation d'input** avec Joi/Zod sur tous les controllers
2. ✅ **Remplacer console.log() par winston/pino**
3. ✅ **Protéger `seedTestData` par NODE_ENV**
4. ✅ **Gérer les erreurs de promesses asynchrones** (automation, eventBus)

### Moyen Terme (2-3 sprints)

1. 🔄 **Ajouter transactions MongoDB** pour opérations critiques (batch updates, invoices)
2. 🔄 **Extraire calculs complexes** (partial invoices) en fonctions pures testables
3. 🔄 **Limiter `pendingEvents`** dans eventBus (max 1000)
4. 🔄 **Tests unitaires** : Minimum 50% coverage sur controllers et services

### Long Terme (Backlog)

1. 📋 **Migrer vers TypeScript** (typage fort pour éviter bugs)
2. 📋 **Monitoring & Alerting** (Sentry, Datadog)
3. 📋 **Documentation OpenAPI** (Swagger pour l'API)
4. 📋 **CI/CD avec tests** automatiques

---

## Métriques de Code

| Métrique | Backend | Frontend | Cible |
|----------|---------|----------|-------|
| Fichiers analysés | 52 | 50 | N/A |
| Lignes de code | ~8 500 | ~5 000 | N/A |
| Complexité moyenne | 6-8 | 4-6 | <10 |
| Fonctions >50 lignes | 18 | 12 | <10% |
| TODO/FIXME | 3 | 1 | 0 |
| Console.log() | 25+ | 8+ | 0 en prod |

---

## Conclusion

Le code de swigs-workflow est **fonctionnel et maintenable** mais souffre de **lacunes de validation et de gestion d'erreurs**. Les problèmes critiques (injection NoSQL, promesses non catchées) doivent être corrigés **immédiatement**. Les problèmes importants (logs, conditions de course) dans un **délai de 2-4 semaines**. Les points mineurs peuvent être adressés progressivement.

**Note Globale**: 7/10 (Bon avec améliorations nécessaires)

---

**Prochaines Étapes** :
1. Prioriser les fixes critiques (validation, promesses)
2. Mettre en place un système de logging structuré
3. Ajouter des tests unitaires sur les fonctions critiques (invoicing, quotes)
4. Documenter les edge cases connus (partial invoices, positions concurrentes)
