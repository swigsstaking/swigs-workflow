# Prompt Bugfix Critiques & Sécurité — SWIGS Workflow

Tu es un développeur backend senior chargé de corriger les **bugs critiques et failles de sécurité** identifiés lors d'un audit complet de swigs-workflow. Chaque fix doit être **non-breaking** et **backward compatible**.

---

## CONTEXTE

### L'application
**swigs-workflow** est un outil de gestion de projets et facturation pour freelances/PME suisses. Il est **déjà en production et utilisé quotidiennement**.

- **URL** : https://workflow.swigs.online
- **Serveur** : 192.168.110.59 (SSH: `ssh swigs@192.168.110.59`)
- **Port** : 3003
- **PM2** : `swigs-workflow` (2 instances cluster)
- **DB** : MongoDB locale (`swigs-workflow`)

### Stack technique
- **Backend** : Node.js (ESM), Express 4.21, Mongoose 8.9, JWT auth
- **Frontend** : React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5
- **Auth** : SSO via SWIGS Hub (PKCE OAuth 2.0), tokens JWT 7j
- **Multi-tenant** : Données isolées par `userId`

### Contraintes ABSOLUES
1. **ZERO breaking change** — l'app est utilisée quotidiennement en production
2. **Pas de migration destructive** — pas de drop/rename de champs existants
3. **Backward compatible** — les nouveaux champs doivent avoir des `default` values
4. **Tester localement** avant tout déploiement
5. **Pas de nouvelles dépendances** sauf si absolument nécessaire et validé
6. **MongoDB** : ne pas mettre `default: null` avec `unique: true, sparse: true`

### Déploiement
```bash
# Backend
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.env' backend/ swigs@192.168.110.59:/home/swigs/swigs-workflow/backend/
ssh swigs@192.168.110.59 'cd /home/swigs/swigs-workflow/backend && npm install && pm2 restart swigs-workflow'

# Frontend (si modifié)
cd frontend && npm run build
rsync -avz --delete frontend/dist/ swigs@192.168.110.59:/home/swigs/swigs-workflow/frontend/dist/
```

---

## BUG 1 : MULTI-TENANCY CASSÉE — STATUTS (CRITIQUE)

### Le problème
`backend/src/controllers/statusController.js` ligne ~8 : `getStatuses()` retourne **TOUS les statuts de TOUS les utilisateurs** au lieu de filtrer par `userId`.

```javascript
// ACTUEL — CASSÉ
const getStatuses = async (req, res, next) => {
  try {
    const statuses = await Status.find().sort('order');  // ← PAS DE FILTRE userId !
    res.json({ data: statuses });
  } catch (error) {
    next(error);
  }
};
```

### Le fix
Ajouter le filtre `userId` comme dans tous les autres controllers.

```javascript
// CORRIGÉ
const getStatuses = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user) filter.userId = req.user.id;
    const statuses = await Status.find(filter).sort('order');
    res.json({ data: statuses });
  } catch (error) {
    next(error);
  }
};
```

### Vérification
- Vérifie aussi `createStatus`, `deleteStatus`, `reorderStatuses`, `seedStatuses` — ils doivent TOUS filtrer par `userId`
- Vérifie que le middleware auth (`requireAuth` ou `optionalAuth`) est bien appliqué sur les routes `/api/statuses`

### Fichiers à modifier
- `backend/src/controllers/statusController.js`

---

## BUG 2 : RACE CONDITION NUMÉROTATION FACTURES/DEVIS (CRITIQUE)

### Le problème
`Invoice.generateNumber()` et `Quote.generateNumber()` utilisent un pattern `count() + 1` qui n'est **pas atomique**. Si deux factures sont créées simultanément (PM2 cluster = 2 instances !), elles peuvent avoir le même numéro.

```javascript
// ACTUEL — RACE CONDITION
static async generateNumber() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    number: new RegExp(`^FAC-${year}-`)
  });
  const num = String(count + 1).padStart(3, '0');
  return `FAC-${year}-${num}`;
}
```

### Le fix
Utiliser `findOneAndUpdate` avec `$inc` sur un compteur atomique, OU utiliser une boucle retry avec index unique.

**Option recommandée — Retry loop** (pas besoin de nouveau modèle) :

```javascript
static async generateNumber() {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  // Trouver le dernier numéro utilisé
  const lastInvoice = await this.findOne(
    { number: new RegExp(`^${prefix}`) },
    { number: 1 },
    { sort: { number: -1 } }
  );

  let nextNum = 1;
  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.number.replace(prefix, ''), 10);
    nextNum = lastNum + 1;
  }

  // Retry loop en cas de conflit (index unique sur number)
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `${prefix}${String(nextNum + attempt).padStart(3, '0')}`;
    const exists = await this.findOne({ number });
    if (!exists) return number;
  }

  // Fallback avec timestamp
  return `${prefix}${Date.now()}`;
}
```

### Fichiers à modifier
- `backend/src/models/Invoice.js` — `generateNumber()` static method
- `backend/src/models/Quote.js` — `generateNumber()` static method (même fix, préfixe `DEV-`)

### Vérification
- L'index `unique: true` sur `number` doit déjà exister dans les deux modèles
- Tester en créant 2 factures rapidement l'une après l'autre

---

## BUG 3 : TRANSITION DE STATUT DEVIS INCOHÉRENTE (CRITIQUE)

### Le problème
`backend/src/controllers/quoteController.js` dans `changeQuoteStatus()` : il est possible de changer le statut d'un devis de `invoiced` ou `partial` vers `signed` ou `draft`, ce qui **casse l'intégrité** des données de facturation.

### Le fix
Ajouter une validation des transitions autorisées :

```javascript
// Transitions autorisées
const ALLOWED_TRANSITIONS = {
  'draft':    ['sent', 'signed', 'refused'],
  'sent':     ['signed', 'refused', 'expired', 'draft'],
  'signed':   [],          // Seul le système peut changer (partial, invoiced via invoice creation)
  'refused':  ['draft'],   // Peut être remis en brouillon
  'expired':  ['draft'],   // Peut être remis en brouillon
  'partial':  [],          // Géré automatiquement par le système de facturation
  'invoiced': []           // État final, géré par le système
};
```

Intégrer cette validation dans `changeQuoteStatus()` :
```javascript
const allowedNext = ALLOWED_TRANSITIONS[quote.status] || [];
if (!allowedNext.includes(status)) {
  return res.status(400).json({
    error: `Impossible de passer de "${quote.status}" à "${status}"`
  });
}
```

### Fichiers à modifier
- `backend/src/controllers/quoteController.js` — `changeQuoteStatus()`

### Vérification
- Vérifier que l'UI frontend ne permet pas non plus ces transitions (si un select est utilisé, filtrer les options)
- Vérifier que la création d'une facture partielle met bien le devis en `partial` automatiquement
- Vérifier que la suppression de toutes les factures liées remet le devis en `signed`

---

## BUG 4 : API CALL PAR KEYSTROKE (IMPORTANT)

### Le problème
`frontend/src/pages/Settings.jsx` — Les tabs "Entreprise" et "Facturation" appellent `handleUpdateSettings()` directement dans le `onChange` de chaque input. Chaque frappe de clavier = 1 appel API `PUT /api/settings`.

```jsx
// ACTUEL — DÉSASTREUX
<Input
  label="Nom de l'entreprise"
  value={settings?.company?.name || ''}
  onChange={(e) => handleUpdateSettings('company', { ...settings.company, name: e.target.value })}
/>
```

### Le fix
**NOTE** : Si le prompt `REDESIGN-SETTINGS-PROMPT.md` est également donné à une instance Claude, ce bug sera corrigé dans le cadre du redesign. **Ne corriger ici QUE si le redesign n'est pas en cours.**

Si tu corriges ce bug indépendamment :
1. Ajouter un local state pour `companyForm` et `invoicingForm`
2. Utiliser `useEffect` pour initialiser depuis `settings`
3. Ajouter un bouton "Sauvegarder" qui appelle l'API une seule fois
4. Afficher le bouton seulement quand il y a des changements

### Fichiers à modifier
- `frontend/src/pages/Settings.jsx` — Tabs "Entreprise" (company) et "Facturation" (invoicing)

---

## BUG 5 : VALIDATION DES INPUTS (SÉCURITÉ)

### Le problème
Aucun endpoint ne valide les données entrantes. Les `req.body` sont utilisés directement dans les queries Mongoose. Exemples :

```javascript
// projectController.js — Mass assignment
const project = new Project({ ...req.body, userId: req.user.id });

// clientController.js — Aucune validation email
const client = new Client({ ...req.body, userId: req.user.id });

// invoiceController.js — Aucune validation montants
const invoice = new Invoice({ ...req.body, project: projectId });
```

### Le fix
Ajouter une **validation minimale** sur les endpoints critiques. Utiliser un helper simple sans nouvelle dépendance :

```javascript
// backend/src/middleware/validate.js (NOUVEAU FICHIER)

/**
 * Middleware de validation simple
 * Usage: validate({ body: { name: 'required|string', email: 'email', amount: 'number|min:0' } })
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      for (const [field, rules] of Object.entries(schema.body)) {
        const value = req.body[field];
        const ruleList = rules.split('|');

        for (const rule of ruleList) {
          if (rule === 'required' && (value === undefined || value === null || value === '')) {
            errors.push(`${field} est requis`);
          }
          if (rule === 'string' && value !== undefined && typeof value !== 'string') {
            errors.push(`${field} doit être une chaîne`);
          }
          if (rule === 'number' && value !== undefined && typeof value !== 'number') {
            errors.push(`${field} doit être un nombre`);
          }
          if (rule === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} doit être un email valide`);
          }
          if (rule.startsWith('min:') && typeof value === 'number') {
            const min = parseFloat(rule.split(':')[1]);
            if (value < min) errors.push(`${field} doit être >= ${min}`);
          }
          if (rule.startsWith('max:') && typeof value === 'number') {
            const max = parseFloat(rule.split(':')[1]);
            if (value > max) errors.push(`${field} doit être <= ${max}`);
          }
          if (rule.startsWith('in:') && value !== undefined) {
            const allowed = rule.split(':')[1].split(',');
            if (!allowed.includes(String(value))) {
              errors.push(`${field} doit être parmi: ${allowed.join(', ')}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation échouée', details: errors });
    }

    next();
  };
}

/**
 * Sanitize: ne garder que les champs autorisés
 */
export function sanitizeBody(...allowedFields) {
  return (req, res, next) => {
    const sanitized = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
      }
    }
    req.body = sanitized;
    next();
  };
}
```

### Où appliquer en priorité

**Endpoints critiques (facturation)** :
```javascript
// routes/invoices.js
import { validate, sanitizeBody } from '../middleware/validate.js';

router.patch('/:id/status',
  validate({ body: { status: 'required|string|in:draft,sent,paid,cancelled' } }),
  changeInvoiceStatus
);
```

**Endpoints données** :
```javascript
// routes/clients.js
router.post('/',
  sanitizeBody('name', 'email', 'phone', 'company', 'address', 'siret', 'notes'),
  validate({ body: { name: 'required|string' } }),
  createClient
);
```

### Fichiers à créer
- `backend/src/middleware/validate.js`

### Fichiers à modifier (ajouter validation)
Appliquer `validate()` et/ou `sanitizeBody()` sur ces routes en priorité :
- `backend/src/routes/invoices.js` — create, update, changeStatus
- `backend/src/routes/quotes.js` — create, update, changeStatus
- `backend/src/routes/projects.js` — create, update
- `backend/src/routes/clients.js` — create, update
- `backend/src/routes/events.js` — create, update
- `backend/src/routes/settings.js` — update

---

## BUG 6 : TEMPLATES HANDLEBARS NON SANDBOXÉS (SÉCURITÉ)

### Le problème
`backend/src/controllers/emailTemplateController.js` — Les templates Handlebars sont compilés et exécutés sans sanitisation. Un utilisateur malveillant pourrait injecter du code via un template.

De même dans `backend/src/services/automation/emailService.js` — Les helpers Handlebars sont enregistrés globalement (pollution).

### Le fix

**Dans emailTemplateController.js** — Ajouter une sanitisation avant compilation :

```javascript
// Avant de compiler le template, vérifier qu'il ne contient pas de helpers dangereux
function sanitizeTemplate(template) {
  // Interdire les expressions Handlebars dangereuses
  const forbidden = [
    /\{\{#?with\b/gi,          // {{#with}} peut accéder au prototype
    /\{\{#?each\s+\.\./gi,     // parent context traversal
    /\{\{.*constructor/gi,      // prototype pollution
    /\{\{.*__proto__/gi,        // prototype access
    /\{\{.*process\./gi,        // Node.js process access
    /\{\{.*require\(/gi,        // Module loading
    /\{\{.*eval\(/gi,           // Code execution
  ];

  for (const pattern of forbidden) {
    if (pattern.test(template)) {
      throw new Error('Le template contient des expressions non autorisées');
    }
  }

  return template;
}
```

Appeler `sanitizeTemplate()` dans :
- `previewEmailTemplate()` avant `Handlebars.compile()`
- `sendTestEmail()` avant `Handlebars.compile()`
- `createEmailTemplate()` et `updateEmailTemplate()` avant de sauvegarder

**Dans automation emailService.js** — Créer un environnement Handlebars isolé :

```javascript
// Au lieu de Handlebars.registerHelper() global
const hbs = Handlebars.create();  // Instance isolée
hbs.registerHelper('formatDate', ...);
hbs.registerHelper('formatCurrency', ...);
// Utiliser hbs.compile() au lieu de Handlebars.compile()
```

### Fichiers à modifier
- `backend/src/controllers/emailTemplateController.js`
- `backend/src/services/automation/emailService.js`

---

## BUG 7 : SECRETS EN CLAIR (SÉCURITÉ)

### Le problème
Les mots de passe SMTP (`settings.smtp.pass`) et clés API AbaNinja (`settings.abaninja.apiKey`) sont stockés en clair dans MongoDB.

### Le fix
Ajouter un chiffrement/déchiffrement simple avec `crypto` natif de Node.js :

```javascript
// backend/src/utils/crypto.js (NOUVEAU FICHIER)
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET, 'salt', 32);

export function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Si le déchiffrement échoue, c'est probablement du texte en clair (migration)
    return encryptedText;
  }
}
```

**Appliquer dans Settings** :
- `settingsController.js` → `updateSettings()` : chiffrer `smtp.pass` et `abaninja.apiKey` avant save
- `settingsController.js` → `getSettings()` : déchiffrer avant d'envoyer au frontend
- `email.service.js` → `createTransporter()` : déchiffrer `smtp.pass`
- `abaninja.service.js` → constructor : déchiffrer `apiKey`

**Backward compatible** : La fonction `decrypt()` retourne le texte tel quel si ce n'est pas du chiffré (pas de `:` dans le texte). Les anciennes valeurs en clair continuent de fonctionner et seront chiffrées au prochain save.

### Fichiers à créer
- `backend/src/utils/crypto.js`

### Fichiers à modifier
- `backend/src/controllers/settingsController.js`
- `backend/src/services/email.service.js`
- `backend/src/services/abaninja.service.js`

---

## ORDRE D'IMPLÉMENTATION RECOMMANDÉ

1. **BUG 1** (statuts multi-tenancy) — 5 min, risque nul
2. **BUG 3** (transitions devis) — 15 min, risque nul
3. **BUG 2** (numérotation atomique) — 30 min, risque faible
4. **BUG 5** (validation middleware) — 1h, risque nul (ajout sans modification)
5. **BUG 6** (Handlebars sanitisation) — 30 min, risque nul
6. **BUG 7** (chiffrement secrets) — 45 min, risque faible (backward compat)
7. **BUG 4** (API keystroke) — 30 min, risque nul (SKIP si redesign Settings en cours)

**Total estimé : ~3h**

---

## VÉRIFICATIONS POST-FIX

Après avoir appliqué tous les fixes :

1. **Tester la création de facture** — Vérifier que le numéro s'incrémente correctement
2. **Tester les statuts** — Vérifier qu'un utilisateur ne voit QUE ses statuts
3. **Tester les transitions devis** — Vérifier qu'un devis `invoiced` ne peut pas redevenir `signed`
4. **Tester la validation** — Envoyer un POST `/api/clients` sans `name` → doit retourner 400
5. **Tester les emails** — Vérifier que SMTP fonctionne encore après chiffrement
6. **Tester AbaNinja** — Vérifier que la connexion fonctionne encore après chiffrement

---

## NOTES IMPORTANTES

- **Mode agents** : Utilise `mode: "bypassPermissions"` et `model: "sonnet"` pour les agents (subagent_type: "general-purpose")
- **L'utilisateur parle français** — communiquer en français
- **PM2 cluster = 2 instances** — le fix de numérotation est d'autant plus important
- **Pas de tests automatisés** — être très prudent, tester manuellement
- **Ne PAS toucher** aux fonctionnalités existantes, seulement corriger les bugs identifiés
