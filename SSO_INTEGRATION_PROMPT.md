# SWIGS Hub v2 - Integration Guide

## Vue d'Ensemble

Ce document decrit l'architecture complete pour integrer une application dans l'ecosysteme SWIGS :
- **SSO avec PKCE** : Authentification OAuth 2.0 securisee
- **Event Bus WebSocket** : Communication temps reel inter-apps
- **App Registry** : Gestion des permissions et secrets

---

## Status des Applications (Mis à jour: 2026-02-09)

| App | SSO PKCE | Event Bus | Hub Registry | Notes |
|-----|----------|-----------|--------------|-------|
| **swigs-workflow** | ✅ Complet | ✅ Connecte | ✅ | Reference implementation |
| **swigs-task** | ✅ Complet | ✅ Connecte | ✅ | PKCE + Magic Link + Event Bus |
| **reservetatable** | ✅ Complet | ✅ Connecte | ✅ | PKCE + Event Bus |
| **webify** | N/A | ❌ | ✅ | App publique sans auth |

### Subscriptions Event Bus par App

- **swigs-workflow** : `order.created`, `order.paid`, `order.shipped`, `order.delivered`, `customer.created`, `customer.updated`
- **swigs-task** : `invoice.created`, `invoice.paid`, `project.created`
- **reservetatable** : `customer.created`, `customer.updated`

---

## Architecture Globale

```
                      ┌─────────────────────────────────────────────────────────────┐
                      │                      SWIGS HUB v2                           │
                      │                  https://apps.swigs.online                  │
                      │                       (port 3006)                           │
                      ├─────────────────────────────────────────────────────────────┤
                      │                                                             │
                      │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
                      │   │ OAuth PKCE   │  │  Event Bus   │  │ App Registry │     │
                      │   │ /api/oauth/* │  │ /ws/events   │  │ apps.js      │     │
                      │   └──────────────┘  └──────────────┘  └──────────────┘     │
                      │                                                             │
                      └───────────────────────────┬─────────────────────────────────┘
                                                  │
                  ┌───────────────────────────────┼───────────────────────────────┐
                  │                               │                               │
                  ▼                               ▼                               ▼
         ┌────────────────┐             ┌────────────────┐             ┌────────────────┐
         │ SWIGS Workflow │             │  SWIGS Task    │             │   Other Apps   │
         │     :3003      │             │    :3002       │             │                │
         │                │             │                │             │                │
         │ ✅ SSO + Event │             │ ⚠️ SSO only    │             │ To integrate   │
         └────────────────┘             └────────────────┘             └────────────────┘
```

---

## PARTIE 1 : SSO avec PKCE (OAuth 2.0)

### 1.1 Flow d'Authentification

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│  User   │                    │   App   │                    │   Hub   │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                              │                              │
     │  1. GET /api/auth/login      │                              │
     │─────────────────────────────>│                              │
     │                              │                              │
     │                              │  2. Generate PKCE:           │
     │                              │     code_verifier (random)   │
     │                              │     code_challenge (SHA256)  │
     │                              │     state (CSRF token)       │
     │                              │                              │
     │  3. Redirect 302             │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │  4. GET /api/oauth/authorize │                              │
     │     ?client_id=app           │                              │
     │     &redirect_uri=...        │                              │
     │     &code_challenge=xxx      │                              │
     │     &code_challenge_method=S256                             │
     │     &state=yyy               │                              │
     │─────────────────────────────────────────────────────────────>
     │                              │                              │
     │                              │  5. Hub authenticates user   │
     │                              │     (Magic Link email)       │
     │                              │                              │
     │  6. Redirect to App callback │                              │
     │     ?code=AUTH_CODE&state=yyy│                              │
     │<─────────────────────────────────────────────────────────────
     │                              │                              │
     │  7. GET /api/auth/callback   │                              │
     │─────────────────────────────>│                              │
     │                              │                              │
     │                              │  8. POST /api/oauth/token    │
     │                              │     grant_type=authorization_code
     │                              │     code=AUTH_CODE           │
     │                              │     code_verifier=xxx        │
     │                              │─────────────────────────────>│
     │                              │                              │
     │                              │  9. Verify PKCE:             │
     │                              │     SHA256(verifier)==challenge
     │                              │                              │
     │                              │  10. Return tokens           │
     │                              │<─────────────────────────────│
     │                              │                              │
     │  11. Create local session    │                              │
     │<─────────────────────────────│                              │
```

### 1.2 Endpoints Hub OAuth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/authorize` | GET | Initie le flow OAuth, affiche login Hub |
| `/api/oauth/token` | POST | Echange code contre tokens |
| `/api/oauth/revoke` | POST | Revoque un token |
| `/api/oauth/userinfo` | GET | Retourne infos utilisateur |

### 1.3 Implementation Backend (Reference: swigs-workflow)

#### Variables d'environnement requises

```env
# SWIGS Hub
HUB_URL=https://apps.swigs.online
APP_ID=swigs-workflow
APP_SECRET=<secret_from_hub_env>

# JWT local
JWT_SECRET=<your_jwt_secret>
```

#### Route Login (`/api/auth/login`)

```javascript
import crypto from 'crypto';

// Store PKCE challenges (use Redis in production)
const pkceStore = new Map();

router.get('/login', (req, res) => {
  // 1. Generate PKCE values
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // 2. Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // 3. Store verifier temporarily
  pkceStore.set(state, {
    codeVerifier,
    returnUrl: req.query.returnUrl || '/',
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 min
  });

  // 4. Build authorization URL
  const authUrl = new URL(`${HUB_URL}/api/oauth/authorize`);
  authUrl.searchParams.set('client_id', APP_ID);
  authUrl.searchParams.set('redirect_uri', `${YOUR_APP_URL}/api/auth/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'openid profile email');

  res.redirect(authUrl.toString());
});
```

#### Route Callback (`/api/auth/callback`)

```javascript
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${error}`);
  }

  // 1. Validate state and get verifier
  const pkceData = pkceStore.get(state);
  if (!pkceData || pkceData.expiresAt < Date.now()) {
    pkceStore.delete(state);
    return res.redirect('/?auth_error=invalid_state');
  }
  pkceStore.delete(state);

  // 2. Exchange code for tokens
  const tokenResponse = await fetch(`${HUB_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: APP_ID,
      code,
      code_verifier: pkceData.codeVerifier,
      redirect_uri: `${YOUR_APP_URL}/api/auth/callback`
    })
  });

  if (!tokenResponse.ok) {
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const { access_token, id_token } = await tokenResponse.json();

  // 3. Get user info from Hub
  const userInfoResponse = await fetch(`${HUB_URL}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const hubUser = await userInfoResponse.json();

  // 4. Find or create local user
  let user = await User.findOne({ hubUserId: hubUser.sub });
  if (!user) {
    user = await User.create({
      hubUserId: hubUser.sub,
      email: hubUser.email,
      name: hubUser.name
    });
  }

  // 5. Create local session and redirect
  const appToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

  res.redirect(`${pkceData.returnUrl}?token=${appToken}`);
});
```

---

## PARTIE 2 : Event Bus WebSocket

### 2.1 Architecture

L'Event Bus permet aux apps de communiquer en temps reel via WebSocket.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CMS Backend    │     │    SWIGS Hub    │     │    Workflow     │
│                 │     │   Event Bus     │     │                 │
│  publish:       │────>│                 │────>│  subscribe:     │
│  - order.paid   │     │  Route events   │     │  - order.*      │
│  - customer.*   │     │  Buffer offline │     │  - customer.*   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 2.2 Connexion WebSocket

**URL** : `wss://apps.swigs.online/ws/events`

**Authentification** : JWT signé avec APP_SECRET dans query param

```javascript
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// Generate service token
const serviceToken = jwt.sign(
  { app: APP_ID, type: 'service' },
  APP_SECRET,
  { expiresIn: '1h' }
);

// Connect
const ws = new WebSocket(
  `wss://apps.swigs.online/ws/events?token=${serviceToken}&app_id=${APP_ID}`
);
```

### 2.3 Messages Event Bus

#### Subscribe
```json
{
  "action": "subscribe",
  "events": ["order.created", "order.paid", "customer.*"]
}
```

#### Publish
```json
{
  "action": "publish",
  "event": "invoice.created",
  "payload": {
    "invoiceId": "123",
    "invoiceNumber": "FAC-2026-001",
    "total": 1081.00
  },
  "timestamp": "2026-02-09T10:30:00.000Z",
  "signature": "<hmac_sha256>"
}
```

#### Receive Event
```json
{
  "type": "event",
  "event": "order.paid",
  "source": "swigs-cms",
  "payload": { ... },
  "timestamp": "2026-02-09T10:30:00.000Z",
  "messageId": "uuid"
}
```

### 2.4 Implementation Complete (swigs-workflow)

Voir `/backend/src/services/eventBus.service.js` pour l'implementation de reference :

- Connexion WebSocket avec JWT auth
- Reconnexion automatique avec backoff exponentiel
- Signature HMAC-SHA256 des messages
- Gestion des subscriptions
- Integration avec le systeme d'automations

---

## PARTIE 3 : Enregistrement d'une App

### 3.1 Configuration Hub

Chaque app doit etre enregistree dans `/swigs-hub/backend/src/config/apps.js` :

```javascript
export const registeredApps = {
  'my-new-app': {
    name: 'my-new-app',
    displayName: 'My New App',
    description: 'Description de l\'app',
    icon: 'app.svg',
    color: '#6366F1',
    url: 'https://myapp.swigs.online',
    apiUrl: 'https://myapp.swigs.online/api',
    allowedOrigins: [
      'https://myapp.swigs.online',
      'http://localhost:5173'
    ],
    secret: process.env.APP_SECRET_MYAPP,
    requiresAuth: true
  }
};
```

### 3.2 Variables Hub `.env`

Ajouter le secret dans `/swigs-hub/backend/.env` :

```env
APP_SECRET_MYAPP=<generate_with_openssl_rand_hex_32>
```

### 3.3 Variables App `.env`

Dans l'app cliente :

```env
HUB_URL=https://apps.swigs.online
HUB_WS_URL=wss://apps.swigs.online
APP_ID=my-new-app
APP_SECRET=<same_secret_as_hub>
```

---

## PARTIE 4 : Checklist Integration

### Pour ajouter SSO a une app

- [ ] Enregistrer l'app dans Hub `apps.js`
- [ ] Ajouter `APP_SECRET_*` dans Hub `.env`
- [ ] Configurer `.env` de l'app avec HUB_URL, APP_ID, APP_SECRET
- [ ] Implementer `/api/auth/login` (PKCE generation + redirect)
- [ ] Implementer `/api/auth/callback` (token exchange)
- [ ] Creer/adapter modele User avec `hubUserId`
- [ ] Tester le flow complet

### Pour ajouter Event Bus

- [ ] S'assurer que SSO fonctionne (meme secret)
- [ ] Installer `ws` et `jsonwebtoken`
- [ ] Creer `eventBus.service.js` (copier depuis workflow)
- [ ] Initialiser au demarrage du serveur
- [ ] S'abonner aux events necessaires
- [ ] Implementer handlers pour les events recus
- [ ] Tester avec un publish depuis une autre app

---

## PARTIE 5 : Events Standards

### CMS Events (source: swigs-cms)
- `order.created` - Nouvelle commande
- `order.paid` - Commande payee
- `order.shipped` - Commande expediee
- `order.delivered` - Commande livree
- `customer.created` - Nouveau client
- `customer.updated` - Client modifie

### Workflow Events (source: swigs-workflow)
- `invoice.created` - Facture creee
- `invoice.sent` - Facture envoyee
- `invoice.paid` - Facture payee
- `quote.signed` - Devis signe

### Task Events (source: swigs-task) - A implementer
- `task.created` - Tache creee
- `task.completed` - Tache terminee
- `reminder.due` - Rappel a envoyer

---

## PARTIE 6 : Securite

| Element | Recommandation |
|---------|----------------|
| APP_SECRET | Generer avec `openssl rand -hex 32` |
| PKCE | Toujours S256, jamais plain |
| WebSocket | Toujours wss:// en production |
| JWT | Expiration courte (1h pour service tokens) |
| Signatures | HMAC-SHA256 avec timing-safe compare |

---

## PARTIE 7 : Troubleshooting

### "Invalid token" sur Event Bus
- Verifier que APP_SECRET est identique dans Hub et App
- Verifier que l'app est enregistree dans `apps.js`
- Verifier que le JWT est correctement genere

### "Unexpected server response: 200"
- Nginx ne proxy pas WebSocket
- Ajouter la config WebSocket dans nginx :
```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:3006;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

### CORS errors
- Ajouter l'origine dans `allowedOrigins` de apps.js
- Ajouter l'origine dans la config CORS de l'app

---

## Fichiers de Reference

- Hub OAuth routes : `/swigs-hub/backend/src/routes/oauth.js`
- Hub Event Bus : `/swigs-hub/backend/src/services/eventBus.service.js`
- Hub Apps config : `/swigs-hub/backend/src/config/apps.js`
- Workflow Auth : `/swigs-workflow/backend/src/routes/auth.js`
- Workflow Event Bus : `/swigs-workflow/backend/src/services/eventBus.service.js`

---

## Support

- **Serveur Hub** : 192.168.110.59:3006
- **Logs Hub** : `pm2 logs swigs-hub`
- **Logs Workflow** : `pm2 logs swigs-workflow`
