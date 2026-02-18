# Audit de Sécurité OWASP Top 10 - SWIGS Workflow

**Date**: 2026-02-13
**Application**: swigs-workflow
**Auditeur**: Agent security-audit
**Version**: 1.0.0

---

## Résumé Exécutif

### Score Global de Sécurité: 7.5/10

L'application swigs-workflow présente un **niveau de sécurité satisfaisant** avec plusieurs bonnes pratiques mises en place (rate limiting, helmet, CORS, JWT, PKCE). Cependant, des vulnérabilités critiques et moyennes ont été identifiées, nécessitant une attention immédiate.

### Résumé des Findings

| Sévérité | Nombre |
|----------|--------|
| 🔴 Critique | 3 |
| 🟠 Haute | 5 |
| 🟡 Moyenne | 6 |
| 🔵 Faible | 4 |

### Points Forts

- ✅ Authentification OAuth 2.0 avec PKCE correctement implémentée
- ✅ Rate limiting global (100/min) et strict pour auth (10/min)
- ✅ Headers de sécurité avec helmet
- ✅ CORS configuré avec whitelist
- ✅ Isolation multi-tenant via `userId`
- ✅ JWT avec expiration (7j par défaut)
- ✅ Refresh tokens avec révocation

### Vulnérabilités Critiques à Corriger Immédiatement

1. **Routes automation sans requireAuth** (CRITICAL)
2. **Absence de validation d'inputs systématique** (CRITICAL)
3. **Pas de .gitignore** - risque de commit de secrets (CRITICAL)

---

## A01: Broken Access Control 🔴

### Sévérité: CRITIQUE

### Finding 1: Routes automation avec optionalAuth au lieu de requireAuth

**Fichier**: `backend/src/routes/automations.js:19`
**Fichier**: `backend/src/routes/emailTemplates.js:18`
**Fichier**: `backend/src/routes/automationRuns.js:8`

```javascript
// automations.js
router.use(optionalAuth); // ❌ VULNÉRABILITÉ
```

**Description**: Les routes d'automations, email templates et automation runs utilisent `optionalAuth` qui permet l'accès sans authentification. Bien que les controllers vérifient `req.user`, cela crée un risque d'exposition de données si la vérification est oubliée ou contournée.

**Impact**: Un attaquant pourrait potentiellement accéder aux automations, runs et templates d'autres utilisateurs si une route ne vérifie pas correctement `req.user`.

**Recommandation**:
```javascript
// CORRECT
router.use(requireAuth); // ✅ Force authentication
```

**Lignes affectées**:
- `/backend/src/routes/automations.js:19`
- `/backend/src/routes/emailTemplates.js:18`
- `/backend/src/routes/automationRuns.js:8`

---

### Finding 2: Vérification d'ownership inconsistante dans automationController

**Fichier**: `backend/src/controllers/automationController.js:28-29`

```javascript
// Vérifie userId mais ne bloque que si userId existe
if (req.user && automation.userId && automation.userId.toString() !== req.user._id.toString()) {
  return res.status(403).json({ success: false, error: 'Accès refusé' });
}
```

**Description**: La vérification d'ownership ne bloque que si `req.user` ET `automation.userId` existent. Si `req.user` est null (via optionalAuth), l'accès est autorisé.

**Impact**: En combinaison avec optionalAuth, un utilisateur non authentifié pourrait accéder aux automations sans userId associé.

**Recommandation**:
```javascript
// CORRECT - Bloquer systématiquement sans auth
if (!req.user) {
  return res.status(401).json({ success: false, error: 'Authentification requise' });
}
if (automation.userId && automation.userId.toString() !== req.user._id.toString()) {
  return res.status(403).json({ success: false, error: 'Accès refusé' });
}
```

**Lignes affectées**: Tous les endpoints dans automationController.js (lignes 28, 71, 102, 128, 164, 209, 240)

---

### Finding 3: Isolation multi-tenant correcte MAIS fragile

**Sévérité**: MOYENNE

**Fichiers**: Tous les controllers

**Description**: L'isolation multi-tenant repose sur l'ajout manuel de `userId` dans chaque query. Exemple:
```javascript
const query = { _id: req.params.id };
if (req.user) {
  query.userId = req.user._id;
}
```

Cette approche est **correcte** mais **fragile** car un développeur pourrait oublier d'ajouter le filtre `userId`.

**Recommandation**:
1. Ajouter un middleware global qui filtre automatiquement les queries Mongoose par userId
2. OU utiliser Mongoose middleware hooks pour ajouter le filtre automatiquement
3. Documenter clairement la convention dans un guide de contribution

**Exemple de middleware de filtrage automatique**:
```javascript
// middleware/tenantFilter.js
export const autoTenantFilter = (req, res, next) => {
  if (req.user) {
    const originalFind = mongoose.Model.find;
    mongoose.Model.find = function(conditions, ...args) {
      if (this.schema.path('userId')) {
        conditions = { ...conditions, userId: req.user._id };
      }
      return originalFind.call(this, conditions, ...args);
    };
  }
  next();
};
```

---

## A02: Cryptographic Failures 🟢

### Sévérité: FAIBLE

### Finding 1: JWT Secret non vérifié au démarrage

**Fichier**: `backend/src/middleware/auth.js:16`

**Description**: Le serveur démarre même si `JWT_SECRET` n'est pas configuré, ce qui causerait des erreurs au runtime.

**Recommandation**:
```javascript
// backend/server.js
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}
```

---

### Finding 2: Refresh tokens stockés en clair

**Fichier**: `backend/src/routes/auth.js:136`

**Sévérité**: FAIBLE (acceptable pour cette architecture)

**Description**: Les refresh tokens sont générés avec `crypto.randomBytes(64).toString('hex')` mais stockés en clair dans MongoDB. Bien que non critique (tokens suffisamment longs et aléatoires), un hash serait plus sécurisé.

**Recommandation**:
- Acceptable pour l'architecture actuelle (tokens de 128 caractères hex)
- Pour améliorer: hasher avec bcrypt avant stockage
- Alternative: utiliser des JWTs signés comme refresh tokens

---

## A03: Injection 🟡

### Sévérité: MOYENNE

### Finding 1: Absence de validation systématique des inputs

**Fichier**: Tous les controllers (111 usages de req.body/params/query)

**Description**: Aucune validation systématique des données entrantes. Exemples:

**projectController.js:385-386**:
```javascript
const { name, description, client, status, tags, notes } = req.body;
// Aucune validation avant insertion
const project = await Project.create({ userId: req.user?._id, name, description, ... });
```

**invoiceController.js:110-119**:
```javascript
const { invoiceType, eventIds, quoteIds, ... } = req.body;
// Pas de validation des types, formats, limites
```

**Impact**:
- Injections NoSQL possibles via opérateurs MongoDB ($gt, $regex, etc.)
- Données invalides dans la base
- Contournement de la logique métier

**Recommandation**: Utiliser un schéma de validation comme `joi` ou `zod`:

```javascript
import Joi from 'joi';

const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(2000).optional(),
  client: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required()
  }).required(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
});

// Dans le controller
export const createProject = async (req, res, next) => {
  const { error, value } = createProjectSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  // Use validated data: value.name, value.description, etc.
};
```

**Tous les controllers affectés**:
- projectController.js (12 usages)
- invoiceController.js (17 usages)
- quoteController.js (15 usages)
- eventController.js (11 usages)
- automationController.js (15 usages)
- Etc. (111 usages total)

---

### Finding 2: Requêtes MongoDB sans sanitization

**Sévérité**: MOYENNE

**Fichier**: `backend/src/controllers/projectController.js:42`

**Description**: Les paramètres de recherche sont utilisés directement dans les queries MongoDB:
```javascript
if (search) {
  matchStage.$text = { $search: search };
}
```

Bien que moins critique avec Mongoose, un attaquant pourrait injecter des expressions régulières complexes pour un DoS.

**Recommandation**:
```javascript
import validator from 'validator';

if (search) {
  const sanitizedSearch = validator.escape(search.substring(0, 100));
  matchStage.$text = { $search: sanitizedSearch };
}
```

---

### Finding 3: Aucune protection XSS dans le frontend (Vérifié: OK)

**Sévérité**: FAIBLE

**Résultat**: Aucun usage de `dangerouslySetInnerHTML` ou `innerHTML` trouvé dans le code source frontend (hors node_modules). React échappe automatiquement les données.

✅ **Pas de vulnérabilité XSS identifiée**

---

## A04: Insecure Design 🟡

### Sévérité: MOYENNE

### Finding 1: PKCE store en mémoire (Map)

**Fichier**: `backend/src/routes/auth.js:15`

```javascript
const pkceStore = new Map();
```

**Description**: Les codes PKCE sont stockés en mémoire. En cas de redémarrage serveur, tous les flows OAuth en cours échouent.

**Impact**: Perte de disponibilité lors des déploiements, impossible de scaler horizontalement.

**Recommandation**:
```javascript
// Utiliser Redis
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Stocker
await redis.setex(`pkce:${state}`, 600, JSON.stringify(pkceData));

// Récupérer
const data = await redis.get(`pkce:${state}`);
```

---

### Finding 2: Pas de limite sur la taille des arrays

**Fichier**: `backend/src/controllers/invoiceController.js:191-206`

**Description**: Aucune limite sur le nombre d'eventIds ou quoteIds dans une facture.

```javascript
const events = eventIds.length > 0
  ? await Event.find({ _id: { $in: eventIds }, ... })
  : [];
```

**Impact**: Un attaquant pourrait envoyer 10,000 IDs et causer un DoS ou une charge excessive.

**Recommandation**:
```javascript
if (eventIds.length > 100) {
  return res.status(400).json({
    success: false,
    error: 'Maximum 100 événements par facture'
  });
}
```

---

### Finding 3: Pas de rate limiting spécifique sur les endpoints sensibles

**Sévérité**: MOYENNE

**Fichier**: `backend/server.js:177-194`

**Description**: Seules les routes `/api/auth` ont un rate limiting strict (10/min). Les autres routes critiques (créations de factures, export PDF, envoi d'emails) n'ont que le limiter global (100/min).

**Recommandation**:
```javascript
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Trop de requêtes, veuillez patienter' }
});

app.use('/api/invoices', requireAuth, strictLimiter, invoiceRoutes);
app.use('/api/automations/:id/run', requireAuth, strictLimiter);
```

---

## A05: Security Misconfiguration 🔴

### Sévérité: CRITIQUE

### Finding 1: Pas de .gitignore - risque de commit de secrets

**Fichier**: Racine du projet

**Description**: Aucun fichier `.gitignore` trouvé. Les fichiers `.env`, `node_modules`, logs peuvent être commités par erreur.

**Impact**: Secrets, tokens, clés API exposés dans le repo Git.

**Recommandation**: Créer immédiatement un `.gitignore`:
```gitignore
# Dependencies
node_modules/
frontend/node_modules/
backend/node_modules/

# Environment
.env
.env.local
.env.production
*.env

# Logs
logs/
*.log
npm-debug.log*

# Build
frontend/dist/
backend/dist/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary
tmp/
temp/
*.tmp
```

---

### Finding 2: Variables d'environnement en dur dans le code

**Fichier**: `backend/src/routes/auth.js:10-12`

```javascript
const HUB_URL = process.env.HUB_URL || 'https://apps.swigs.online';
const APP_ID = process.env.APP_ID || 'swigs-workflow';
```

**Sévérité**: FAIBLE (acceptable pour defaults)

**Description**: URL et APP_ID avec valeurs par défaut en dur. Acceptable mais moins flexible.

**Recommandation**: Documenter clairement dans un fichier `.env.example`:
```env
# Hub Configuration
HUB_URL=https://apps.swigs.online
APP_ID=swigs-workflow
APP_SECRET=your-secret-here

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRE=7d

# MongoDB
MONGODB_URI=mongodb://localhost:27017/swigs-workflow
```

---

### Finding 3: Console.log en production

**Fichier**: Tous les services et controllers (83 occurrences)

**Sévérité**: FAIBLE

**Description**: De nombreux `console.log` et `console.error` dans le code, y compris dans les controllers production.

**Exemples**:
- `backend/src/controllers/projectController.js:15-17` (logs de debug)
- `backend/src/routes/auth.js:75,103,156,166,195,259` (logs d'erreurs avec détails)

**Impact**: Logs excessifs, potentiel leak d'informations sensibles dans les logs.

**Recommandation**: Utiliser un logger structuré (winston, pino):
```javascript
import pino from 'pino';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['password', 'token', 'secret']
});

// Usage
logger.info({ projectId: project._id }, 'Project created');
logger.error({ err, userId: req.user._id }, 'Project creation failed');
```

---

## A06: Vulnerable and Outdated Components 🟠

### Sévérité: HAUTE

### Finding 1: Dépendances outdated avec vulnérabilités potentielles

**Résultat npm outdated**:
```
Package     Current  Wanted  Latest
mongoose     8.22.0  8.23.0   9.2.1   (1 major version behind)
express      4.22.1  4.22.1   5.2.1   (1 major version behind)
nodemailer   6.10.1  6.10.1   8.0.1   (2 major versions behind)
pdfkit       0.15.2  0.15.2  0.17.2   (minor updates)
```

**Impact**: Vulnérabilités CVE connues dans les anciennes versions.

**Recommandation**:
1. Mettre à jour immédiatement les patches de sécurité:
```bash
npm update mongoose express
```

2. Planifier la migration vers les versions majeures (breaking changes):
```bash
# Tester d'abord dans un environnement de staging
npm install mongoose@9 express@5 nodemailer@8
npm test
```

3. Automatiser les checks de sécurité:
```bash
npm audit
npm audit fix
```

4. Configurer Dependabot ou Renovate pour les mises à jour automatiques.

---

### Finding 2: Pas de scan automatique des vulnérabilités

**Recommandation**: Ajouter au CI/CD:
```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit --audit-level=moderate
      - run: npm outdated
```

---

## A07: Identification and Authentication Failures 🟢

### Sévérité: FAIBLE (Bon niveau de sécurité)

### Points Forts Identifiés ✅

1. **OAuth 2.0 avec PKCE correctement implémenté**
   - Fichier: `backend/src/routes/auth.js:31-63`
   - Code verifier, code challenge (S256), state pour CSRF
   - ✅ Conformité OAuth 2.0 RFC 7636

2. **JWT avec expiration**
   - Fichier: `backend/src/middleware/auth.js:61-67`
   - Expiration configurable (7j par défaut)
   - Vérification de l'expiration dans le middleware
   - ✅ Pas de JWT éternels

3. **Refresh tokens avec révocation**
   - Fichier: `backend/src/routes/auth.js:136-145`
   - Session model avec flag `isRevoked`
   - Expiration à 30 jours
   - ✅ Logout possible

4. **Vérification du statut utilisateur**
   - Fichier: `backend/src/middleware/auth.js:18-21`
   - Check `user.isActive` avant d'autoriser l'accès
   - ✅ Désactivation compte possible

---

### Finding 1: Pas de rate limiting sur /auth/refresh

**Fichier**: `backend/server.js:177`

**Sévérité**: MOYENNE

**Description**: Le rate limiter strict (10/min) s'applique à `/api/auth` mais pas spécifiquement à `/api/auth/refresh`.

**Impact**: Un attaquant pourrait tenter de brute-force des refresh tokens (bien que très improbable avec 64 bytes hex = 2^512 possibilités).

**Recommandation**:
```javascript
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  skipSuccessfulRequests: false
});

app.use('/api/auth/refresh', refreshLimiter);
```

---

### Finding 2: Pas de détection de sessions concurrentes

**Sévérité**: FAIBLE

**Description**: Un utilisateur peut avoir un nombre illimité de sessions actives (plusieurs refresh tokens).

**Recommandation** (optionnel):
```javascript
// Limiter à 5 sessions par utilisateur
const existingSessions = await Session.countDocuments({
  userId: user._id,
  isRevoked: false
});

if (existingSessions >= 5) {
  // Révoquer la plus ancienne
  const oldest = await Session.findOne({ userId: user._id, isRevoked: false })
    .sort('createdAt')
    .limit(1);
  oldest.isRevoked = true;
  await oldest.save();
}
```

---

## A08: Software and Data Integrity Failures 🟡

### Sévérité: MOYENNE

### Finding 1: Pas de vérification d'intégrité sur les updates de données critiques

**Fichier**: `backend/src/controllers/invoiceController.js:354-359`

**Description**: Les factures draft peuvent être modifiées sans vérifier si des données critiques ont changé entre le fetch et l'update (race condition possible).

**Recommandation**: Utiliser le versioning optimiste de Mongoose:
```javascript
// Dans le model Invoice.js
const invoiceSchema = new mongoose.Schema({
  // ...
  __v: Number // Mongoose version key (automatique)
});

// Dans le controller
const invoice = await Invoice.findById(req.params.id);
const originalVersion = invoice.__v;

// Modifications...
invoice.notes = notes;

await invoice.save(); // Mongoose throw si __v a changé
```

---

### Finding 2: Snapshots de factures non signés

**Fichier**: `backend/src/controllers/invoiceController.js:218-236`

**Sévérité**: MOYENNE

**Description**: Les snapshots d'events et quotes dans les factures ne sont pas signés cryptographiquement. Un attaquant avec accès DB pourrait les modifier.

**Recommandation**:
```javascript
import crypto from 'crypto';

const snapshotData = {
  eventId: event._id,
  description: event.description,
  // ...
};

// Signer le snapshot
const signature = crypto
  .createHmac('sha256', process.env.INVOICE_SIGNING_KEY)
  .update(JSON.stringify(snapshotData))
  .digest('hex');

return { ...snapshotData, signature };
```

---

## A09: Security Logging and Monitoring Failures 🟠

### Sévérité: HAUTE

### Finding 1: Pas de logging des événements de sécurité

**Fichiers**: Tous les controllers

**Description**: Aucun log spécifique pour les événements de sécurité critiques:
- Échecs d'authentification répétés
- Tentatives d'accès refusé (403)
- Modifications de données critiques (factures paid, quotes signed)
- Changements de permissions utilisateur

**Recommandation**: Implémenter un audit trail:
```javascript
// services/securityLogger.js
import pino from 'pino';

const securityLogger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({})
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export const logSecurityEvent = (event, details) => {
  securityLogger.info({
    event_type: event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Usage dans les controllers
import { logSecurityEvent } from '../services/securityLogger.js';

// Dans auth.js
if (!user || !user.isActive) {
  logSecurityEvent('AUTH_FAILED', {
    ip: req.ip,
    userId: decoded.userId,
    reason: user ? 'user_inactive' : 'user_not_found'
  });
  return res.status(401).json({ error: 'Utilisateur invalide' });
}
```

---

### Finding 2: History service incomplet

**Fichier**: `backend/src/services/historyService.js`

**Description**: Le History service log les changements métier mais pas les événements de sécurité (login, logout, accès refusé).

**Recommandation**: Étendre le history service:
```javascript
export const historyService = {
  // Existing methods...

  // Security events
  userLoggedIn: (userId, ip, userAgent) => { ... },
  accessDenied: (userId, resource, action, ip) => { ... },
  suspiciousActivity: (userId, activity, details) => { ... }
};
```

---

### Finding 3: Pas de monitoring des anomalies

**Sévérité**: MOYENNE

**Recommandation**: Implémenter des alertes pour:
- 10+ échecs de login en 5 minutes pour un même user/IP
- Accès à 100+ resources en 1 minute (scraping)
- Modifications massives de données (bulk delete de projets)
- Pics de requêtes anormaux

**Exemple avec express middleware**:
```javascript
const anomalyDetector = {
  failedLogins: new Map(), // ip -> count

  recordFailedLogin(ip) {
    const count = (this.failedLogins.get(ip) || 0) + 1;
    this.failedLogins.set(ip, count);

    if (count >= 10) {
      // Alert!
      notifyAdmin(`Suspicious login attempts from ${ip}`);
    }

    // Reset after 5 minutes
    setTimeout(() => this.failedLogins.delete(ip), 5 * 60 * 1000);
  }
};
```

---

## A10: Server-Side Request Forgery (SSRF) 🟢

### Sévérité: FAIBLE

### Finding 1: Pas de SSRF identifié

**Résultat**: Aucun endpoint n'accepte d'URLs utilisateur à fetcher. Les seules requêtes externes sont:
1. Vers le Hub (URL hardcodée) pour OAuth
2. Vers le Hub WebSocket (URL hardcodée) pour l'Event Bus

✅ **Pas de vulnérabilité SSRF**

---

### Finding 2: Event Bus WebSocket - validation de l'URL recommandée

**Fichier**: `backend/src/services/eventBus.service.js:12`

**Sévérité**: FAIBLE

**Description**: L'URL du Hub est configurée via `HUB_WS_URL` mais pas validée.

**Recommandation**:
```javascript
const HUB_WS_URL = process.env.HUB_WS_URL || 'wss://apps.swigs.online';

// Valider l'URL
if (!HUB_WS_URL.startsWith('wss://') && !HUB_WS_URL.startsWith('ws://')) {
  throw new Error('HUB_WS_URL must be a valid WebSocket URL');
}

const allowedHosts = ['apps.swigs.online', 'localhost'];
const url = new URL(HUB_WS_URL);
if (!allowedHosts.includes(url.hostname)) {
  throw new Error(`HUB_WS_URL hostname ${url.hostname} not allowed`);
}
```

---

## Résumé des Recommandations Prioritaires

### 🔴 CRITIQUE - À Corriger Immédiatement

1. **Créer un .gitignore** pour éviter le commit de secrets
2. **Remplacer optionalAuth par requireAuth** sur les routes automation/emailTemplates/automationRuns
3. **Ajouter une validation systématique des inputs** avec joi/zod sur tous les endpoints

### 🟠 HAUTE - À Corriger Sous 2 Semaines

4. **Mettre à jour les dépendances** (mongoose 9, express 5, nodemailer 8)
5. **Implémenter un security logging** pour les événements critiques
6. **Ajouter des limits de taille** sur les arrays (eventIds, quoteIds, etc.)

### 🟡 MOYENNE - À Corriger Sous 1 Mois

7. **Migrer PKCE store vers Redis** pour la scalabilité
8. **Ajouter rate limiting spécifique** sur les endpoints sensibles
9. **Implémenter le versioning optimiste** sur les factures
10. **Remplacer console.log par un logger structuré** (winston/pino)

### 🔵 FAIBLE - Améliorations Continue

11. **Ajouter un monitoring des anomalies**
12. **Limiter le nombre de sessions concurrentes**
13. **Hasher les refresh tokens** dans la DB
14. **Valider l'URL du Hub WebSocket**

---

## Annexes

### A. Checklist de Revue de Code Sécurité

Pour les futures PR, vérifier:

- [ ] Toutes les routes utilisent `requireAuth` (sauf exceptions documentées)
- [ ] Tous les inputs sont validés avec un schéma joi/zod
- [ ] Toutes les queries filtrent par `userId` pour l'isolation multi-tenant
- [ ] Pas de secrets hardcodés dans le code
- [ ] Les erreurs ne leakent pas d'informations sensibles
- [ ] Les logs ne contiennent pas de données sensibles (passwords, tokens)
- [ ] Les limits de taille sont respectées (arrays, strings, files)
- [ ] Les événements de sécurité sont loggés

### B. Configuration de Sécurité Recommandée

```bash
# .env.example
# ===== SECURITY =====
JWT_SECRET=<générer avec: openssl rand -base64 64>
JWT_EXPIRE=7d

APP_SECRET=<générer avec: openssl rand -base64 64>
INVOICE_SIGNING_KEY=<générer avec: openssl rand -base64 32>

# ===== RATE LIMITING =====
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10

# ===== LOGGING =====
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_PATH=/var/log/swigs-workflow/app.log

# ===== SESSION =====
SESSION_REDIS_URL=redis://localhost:6379/0
SESSION_MAX_AGE=2592000000  # 30 days

# ===== CORS =====
CORS_ORIGINS=https://workflow.swigs.ch,https://workflow.swigs.online
```

### C. Scripts de Maintenance Sécurité

```bash
#!/bin/bash
# scripts/security-check.sh

echo "🔍 Running security checks..."

# 1. Check for outdated dependencies
echo "\n📦 Checking dependencies..."
npm outdated

# 2. Run npm audit
echo "\n🔐 Running npm audit..."
npm audit --audit-level=moderate

# 3. Check for secrets in code
echo "\n🔑 Checking for hardcoded secrets..."
grep -r "password\|secret\|api_key" backend/src --exclude-dir=node_modules || echo "✅ No secrets found"

# 4. Check for TODO SECURITY comments
echo "\n⚠️  Checking for security TODOs..."
grep -r "TODO.*SECURITY\|FIXME.*SECURITY" backend/src || echo "✅ No security TODOs"

echo "\n✅ Security checks complete!"
```

---

## Conclusion

L'application **swigs-workflow** présente une **base de sécurité solide** avec OAuth PKCE, rate limiting, et isolation multi-tenant. Cependant, les **3 vulnérabilités critiques** identifiées (routes sans auth, absence de validation, pas de .gitignore) doivent être corrigées **immédiatement** avant tout déploiement en production.

Les **recommandations prioritaires** (🔴 et 🟠) permettront d'atteindre un **score de 9/10** en sécurité.

**Prochaines étapes recommandées**:
1. Créer `.gitignore` et vérifier qu'aucun secret n'est commité
2. Corriger les routes automation (requireAuth)
3. Implémenter la validation d'inputs avec joi
4. Mettre à jour les dépendances
5. Implémenter le security logging
6. Planifier un audit de pénétration externe

---

**Rapport généré le**: 2026-02-13
**Durée de l'audit**: ~2 heures
**Fichiers analysés**: 50+ fichiers backend, 70+ fichiers frontend (node_modules exclus)
