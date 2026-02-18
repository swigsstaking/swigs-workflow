# SWIGS Workflow - Audit Sécurité & Améliorations

## CONTEXTE

Tu travailles sur `swigs-workflow`, une app Node.js/Express + React de gestion de projets et facturation faisant partie de l'écosystème SWIGS. Lis d'abord MEMORY.md et le README du projet pour comprendre l'architecture.

## RÈGLE ABSOLUE : ZÉRO BREAKING CHANGE

**AUCUNE modification ne doit casser le système existant.** C'est la priorité numéro 1.

### Ce que ça veut dire concrètement :

1. **Ne JAMAIS modifier le flow d'authentification SSO existant**
   - Le flow actuel : Hub → redirige vers `workflow.swigs.online/?sso_token=xxx` → `SsoHandler.jsx` intercepte → `verifySsoToken()` → POST `/api/auth/sso-verify`
   - Le backend a aussi un flow PKCE (`GET /api/auth/login` → Hub OAuth → callback) qui coexiste
   - **NE PAS supprimer ni modifier `/api/auth/sso-verify`**
   - **NE PAS modifier `loginWithHub()` dans `authStore.js`** (il redirige vers `apps.swigs.online`)
   - **NE PAS modifier `SsoHandler.jsx`** (il intercepte `?sso_token=`)

2. **Ne JAMAIS rendre obligatoire une nouvelle variable d'environnement**
   - `crypto.js` utilise actuellement `JWT_SECRET` comme clé de dérivation avec un salt hardcodé `'salt'`
   - Si tu améliores le chiffrement, la nouvelle méthode DOIT être opt-in
   - Les valeurs déjà chiffrées en base DOIVENT rester déchiffrables
   - Approche recommandée : nouveau format identifiable (ex: préfixe `v2:`) + fallback sur l'ancien format

3. **Ne JAMAIS modifier la structure des modèles Mongoose de manière breaking**
   - `Session.js` a un champ `refreshToken` (string, unique, sparse) — le garder
   - Si tu ajoutes un champ `refreshTokenHash`, il doit être optionnel
   - Les sessions existantes en base doivent continuer à fonctionner

4. **Ne JAMAIS changer les réponses API de manière breaking**
   - Si tu masques des secrets dans `GET /api/settings`, les champs doivent garder le même nom
   - Ajouter des champs indicateurs (`_hasPass: true`) est OK
   - Le PUT `/api/settings` doit continuer à accepter le même format qu'avant

5. **Tester sur le serveur AVANT de considérer comme terminé**
   - Backend : tester directement sur `192.168.110.59` (PM2 cluster mode, port 3004)
   - Frontend : build + déployer + vérifier que le login SSO fonctionne toujours
   - Vérifier les logs PM2 : `pm2 logs swigs-workflow --lines 20 --nostream`

## VULNÉRABILITÉS IDENTIFIÉES (PAR PRIORITÉ)

### CRITIQUE

1. **Chiffrement faible dans `crypto.js`**
   - Utilise `JWT_SECRET` comme clé (partagé avec JWT, mauvaise pratique)
   - Salt hardcodé `'salt'` dans `scryptSync`
   - **Fix recommandé** : Ajouter support d'une clé dédiée `ENCRYPTION_KEY` (opt-in), nouveau format `v2:iv:authTag:encrypted`, fallback automatique sur l'ancien format si `ENCRYPTION_KEY` n'est pas défini

2. **Secrets en clair dans la réponse `GET /api/settings`**
   - `smtp.pass`, `abaninja.apiKey` sont déchiffrés et envoyés au frontend
   - Le `cmsIntegration.serviceToken` est aussi renvoyé
   - **Fix recommandé** : Masquer avec `'••••••••'` + ajouter `_hasPass: true/false`. Le PUT doit ignorer `'••••••••'` et garder la valeur existante

### HAUTE

3. **Pas de vérification JWT du `id_token` dans le callback OAuth**
   - `auth.js` ligne ~146 : `JSON.parse(Buffer.from(payloadB64, 'base64url').toString())` — aucune vérification de signature
   - **Fix recommandé** : `jwt.verify(id_token, APP_SECRET)` avec fallback sur decode si la clé ne matche pas

4. **Tokens dans l'URL du callback OAuth**
   - `auth.js` ligne ~184 : `returnUrl.searchParams.set('access_token', appAccessToken)` — les tokens sont dans l'URL (historique navigateur, logs serveur)
   - **Fix recommandé** : Utiliser un auth code intermédiaire (30s TTL, one-time use) à échanger via POST

5. **Refresh tokens stockés en clair en base**
   - `Session.js` stocke `refreshToken` en clair
   - **Fix recommandé** : Ajouter un champ `refreshTokenHash` (SHA-256), chercher par hash. Garder `refreshToken` pour migration

6. **Pas de rotation des refresh tokens**
   - `/api/auth/refresh` renvoie un nouveau accessToken mais garde le même refreshToken
   - **Fix recommandé** : Générer un nouveau refreshToken à chaque refresh, invalider l'ancien

7. **Pas de validation `returnUrl` (open redirect)**
   - `auth.js` : `const returnUrl = req.query.returnUrl || '/'` — pas de validation
   - **Fix recommandé** : Vérifier que l'URL est same-origin

8. **Avatar URL non validé**
   - L'avatar venant du Hub est stocké directement sans validation
   - **Fix recommandé** : Vérifier que c'est une URL `https://`

### MOYENNE

9. **Error handler leak les messages d'erreur en production**
   - `errorHandler.js` : renvoie `err.message` pour toutes les erreurs 500
   - **Fix** : Message générique en production pour les 500

10. **Pas de protection SSRF sur les webhooks d'automation**
    - `executorService.js` : `fetch(action.config.webhookUrl)` sans validation
    - **Fix** : Bloquer localhost, réseaux privés, IPs link-local

11. **Body size limit trop élevé (10MB)**
    - `server.js` : `express.json({ limit: '10mb' })`
    - **Fix** : Réduire à 2MB

12. **`process.exit` conditionnel sur unhandledRejection**
    - En production, le process ne crash pas → état potentiellement corrompu
    - **Fix** : Toujours exit (PM2 redémarre)

13. **Pas de `.env.example`**
    - Difficile pour les nouveaux développeurs de savoir quelles vars sont nécessaires

### BASSE

14. **`cmsIntegration.serviceToken` stocké en clair en base**
    - Le token CMS n'est pas chiffré comme les autres secrets
    - **Fix** : Utiliser `encrypt()` au save, `decrypt()` au read

15. **Pas de rate limit spécifique sur `/api/auth/exchange`** (si implémenté)

16. **Dépendances avec vulnérabilités connues**
    - `npm audit` montre des issues sur nodemailer, axios
    - **Fix** : `npm audit fix` ou mettre à jour

## APPROCHE RECOMMANDÉE

### Étape 1 : Corrections non-breaking (pas de changement de flow)
- Masquer secrets dans GET /api/settings (ajout `_hasPass`, `_hasApiKey`)
- Error handler : message générique en prod pour 500
- SSRF protection sur webhooks
- Body size limit → 2MB
- Avatar URL validation (https only)
- Chiffrer `cmsIntegration.serviceToken`

### Étape 2 : Améliorations crypto (backward-compatible)
- Ajouter `ENCRYPTION_KEY` en opt-in (fallback sur `JWT_SECRET`)
- Format `v2:` avec fallback sur ancien format

### Étape 3 : Améliorations auth (backward-compatible, TESTER MINUTIEUSEMENT)
- JWT verify de l'id_token (avec fallback decode)
- returnUrl validation
- Refresh token hashing (champ optionnel, dual-lookup)
- Refresh token rotation

### Étape 4 : Auth code intermédiaire (plus risqué)
- Remplacer tokens-in-URL par auth code one-time use
- **ATTENTION** : Modifier le callback OAuth ET le SsoHandler frontend
- Tester le flow complet end-to-end AVANT de déployer

## COMMANDES DE TEST

```bash
# Se connecter au serveur
ssh swigs@192.168.110.59

# Générer un token de test
cd /home/swigs/swigs-workflow/backend
TOKEN=$(node -e "require('dotenv').config(); const jwt = require('jsonwebtoken'); console.log(jwt.sign({ userId: '698213f6aa3f218aae0adf3b' }, process.env.JWT_SECRET, { expiresIn: '1h' }))")

# Tester API settings (depuis le serveur uniquement - port 3004 n'est pas exposé)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3004/api/settings | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify(d.data?.smtp, null, 2))"

# Vérifier les logs
pm2 logs swigs-workflow --lines 20 --nostream

# Redémarrer après modification
pm2 restart swigs-workflow

# Health check
curl -s http://localhost:3004/api/health
```

## DÉPLOIEMENT

```bash
# Depuis la machine locale :
# Backend (fichier par fichier, ne PAS rsync tout le dossier)
rsync -avz backend/src/fichier.js swigs@192.168.110.59:/home/swigs/swigs-workflow/backend/src/fichier.js

# Frontend (build puis deploy)
cd frontend && npm run build
rsync -avz --delete frontend/dist/ swigs@192.168.110.59:/home/swigs/swigs-workflow/frontend/dist/

# Restart backend
ssh swigs@192.168.110.59 'pm2 restart swigs-workflow'
```

## FICHIERS CLÉS

| Fichier | Description |
|---------|-------------|
| `backend/src/utils/crypto.js` | Chiffrement AES-256-GCM (encrypt/decrypt) |
| `backend/src/routes/auth.js` | Routes auth (SSO verify, PKCE, refresh, logout) |
| `backend/src/models/Session.js` | Modèle session (refreshToken) |
| `backend/src/controllers/settingsController.js` | GET/PUT settings (secrets) |
| `backend/src/middleware/errorHandler.js` | Error handler global |
| `backend/src/middleware/auth.js` | Middleware requireAuth/optionalAuth |
| `backend/src/services/automation/executorService.js` | Webhooks automation |
| `backend/src/services/automation/cmsPollerService.js` | CMS polling service |
| `backend/server.js` | Express app setup, routes, middleware |
| `frontend/src/stores/authStore.js` | Store auth Zustand (loginWithHub, verifySsoToken) |
| `frontend/src/components/auth/SsoHandler.jsx` | Intercepte ?sso_token= dans URL |
| `frontend/src/components/Settings/sections/SmtpSection.jsx` | UI config SMTP |
| `frontend/src/components/Settings/sections/AbaNinjaSection.jsx` | UI config AbaNinja |

## ⚠️ ERREURS À NE PAS REPRODUIRE

1. **Ne JAMAIS faire `process.exit(1)` dans crypto.js si une env var manque** — ça crash toute l'app
2. **Ne JAMAIS supprimer l'endpoint `/api/auth/sso-verify`** — c'est le flow SSO principal
3. **Ne JAMAIS changer `loginWithHub` pour rediriger vers `/api/auth/login`** — ça casse le SSO
4. **Ne JAMAIS rendre `refreshTokenHash` required dans Session.js** — les sessions existantes n'en ont pas
5. **Ne JAMAIS déployer sans vérifier la syntaxe** : `node --check fichier.js`
6. **Ne JAMAIS oublier de rebuild + redéployer le frontend** si des fichiers frontend sont modifiés
7. **Toujours tester les API depuis le serveur** (localhost:3004), pas depuis la machine locale (le port n'est pas accessible directement)
