# Rapport d'Audit V1 — SWIGS Hub + ReserveTable

**Date** : 13 fevrier 2026
**Auditeur** : Claude AI (Agent Team — 5 agents + team lead)
**Durée** : ~25 minutes

---

## Résumé exécutif

| Domaine | Verdict | Notes |
|---------|---------|-------|
| Hub Frontend | **OK** | Toutes les pages fonctionnelles, responsive, dark mode |
| ReserveTable Frontend | **OK** | Dashboard, réservations, calendrier, plan de salle, settings |
| Hub Backend API | **OK** | Subscriptions, usage reporting, capping, edge cases |
| ReserveTable Backend | **PARTIEL** | Routes SSO manquantes, DEV_BYPASS_AUTH actif |
| Intégration Stripe | **OK avec réserves** | Prix OK, meter OK, webhooks OK. Bug legacy subscription détecté sur anciens checkouts |
| Sécurité code | **5 CRITIQUES** | Timing attack, race conditions, validation manquante |
| Flow E2E | **OK** | Inscription → Checkout → SSO → Restaurant → Réservation → Persistance |

### Décision

- **NOGO pour V1 en l'état** — 5 corrections critiques nécessaires (estimées 1-2 jours de travail)

---

## Résultats par agent

### 1. Frontend (team-lead — Chrome DevTools MCP)

| # | Test | Statut | Notes |
|---|------|--------|-------|
| F1 | Inscription Hub | **OK** | Register mode mot de passe + auto-login fonctionnel |
| F2 | Dashboard Hub | **OK** | Header, tabs Mes apps/Gratuites, cartes apps, Profil, Marketplace, Paiements |
| F3 | Marketplace + Produit RT | **OK** | 3 plans corrects (Starter 10/Pro 15/Premium 35), Pro "Recommandé", tarification usage-based affichée |
| F4 | Checkout Stripe | **OK** | 2 line items (base 15 CHF + metered 1 CHF/unit), trial 30j, CHF 0.00 today, redirect success |
| F5 | Retour Hub | **OK** | Badge "Essai", "Essai gratuit jusqu'au 15 mars 2026" |
| F6 | SSO → ReserveTable | **OK** | Page "Vous n'avez pas encore de restaurant" (TEST CRITIQUE PASSÉ) |
| F7 | Création restaurant | **OK** | "Restaurant Audit V1" créé, dashboard affiché |
| F8 | Pages RT | **OK** | Réservations (Jean Audit 19h 4p créée), Calendrier, Plan de salle, Clients, Paramètres/Abonnement |
| F9 | Logout + Re-login | **OK** | Persistance restaurant + réservation confirmée, dashboard direct (pas page création) |
| F10 | Responsive / Dark mode | **OK** | Hub mobile (375x812) OK, dark mode OK |

**Console errors** : Aucune erreur JS sur Hub ni ReserveTable.

**Bugs frontend trouvés** :
| # | Sévérité | Description |
|---|----------|-------------|
| F-BUG-1 | IMPORTANT | Pas de bouton "Ouvrir" sur les cartes apps du dashboard Hub — l'utilisateur ne peut pas lancer une app depuis ses abonnements |
| F-BUG-2 | IMPORTANT | Checkout possible même avec abonnement existant — risque de subscription dupliquée dans Stripe |
| F-BUG-3 | MINEUR | "1 réservations" au lieu de "1 réservation" (grammaire singulier/pluriel) |

---

### 2. Backend (backend-tester — SSH/curl)

| # | Test | Statut | Notes |
|---|------|--------|-------|
| B1 | Hub Auth endpoints | **PARTIEL** | Magic link OK (pas de leak info), profile route 404, login/register OK (JSON parsing issue spécifique à curl SSH) |
| B2 | Hub Subscriptions API | **OK** | check, report-usage, delta, cap tous fonctionnels |
| B3 | Hub Edge cases | **OK** | Mauvais secret → 403, user inexistant → hasSubscription:false, params manquants → 400 |
| B4 | RT SSO verify | **KO** | Route `/api/auth/sso/verify` retourne 404 |
| B5 | RT Billing cron | **OK** | Job tourne à :30 chaque heure. 404 warnings pour users sans subscription (bruyant) |
| B6 | RT Feature gating | **N/A** | Non testable — DEV_BYPASS_AUTH=true actif |
| B7 | DB Cohérence | **OK** | 0 plans PLACEHOLDER, 0 plans sans metered price, 0 subscriptions orphelines |

**Détails B2 (tests clés)** :
- `report-usage quantity=10` → reported:true, delta:10 ✓
- `report-usage quantity=10 (repeat)` → reported:false, "No new usage" ✓
- `report-usage quantity=100` → cappedUsage:84 (= (99-15)/1) ✓
- `check subscription trialing` → status:trialing, plan:Pro, basePrice:15, usagePrice:1, maxPrice:99 ✓

**Bugs backend trouvés** :
| # | Sévérité | Description |
|---|----------|-------------|
| B-BUG-1 | IMPORTANT | Hub `/api/auth/profile` route 404 |
| B-BUG-2 | IMPORTANT | RT routes SSO inexistantes (`/api/auth/sso/verify`) — le SSO côté RT fonctionne via un autre mécanisme |
| B-BUG-3 | MINEUR | RT billing job flood les logs avec 404 pour users sans subscription |
| B-BUG-4 | MINEUR | Incohérence possible planId vs plan name retourné (user reçoit "Premium" au lieu de "Pro") |

---

### 3. Stripe (stripe-tester — API Stripe)

| # | Test | Statut | Notes |
|---|------|--------|-------|
| S1 | Prix Stripe | **OK** | 6 prix actifs corrects (3 base + 3 metered) + 3 prix legacy |
| S2 | Billing Meter | **OK** | status:active, event_name:reservetatable_reservation, aggregation:sum |
| S3 | Checkout Sessions | **OK** | 2 sessions complètes, webhooks traités |
| S4 | Subscription Stripe | **WARNING** | Ancien checkout (test-e2e) utilise plan FREE legacy. Nouveau checkout (audit-v1) semble correct (Pro trial) |
| S5 | Meter Events | **OK** | 179 events agrégés sur le dernier mois |
| S6 | Invoice Preview | **WARNING** | API `/invoices/upcoming` dépréciée par Stripe |
| S7 | Webhooks | **OK** | Endpoint configuré, 5 events types, idempotency DB fonctionne |
| S8 | Changement plan | **SKIP** | Non testé (nécessite sub active) |
| S9 | Annulation | **SKIP** | Non testé |

**Bug Stripe trouvé** :
| # | Sévérité | Description |
|---|----------|-------------|
| S-BUG-1 | IMPORTANT | Anciens checkouts créent des subscriptions avec plan legacy FREE (0 CHF) au lieu de base+metered. Les nouveaux checkouts semblent corrects. Vérifier que tous les plans legacy sont désactivés/migrés. |
| S-BUG-2 | MINEUR | API `GET /invoices/upcoming` dépréciée — migrer vers `POST /invoices/create_preview` |

---

### 4. Code Review (code-reviewer — analyse statique)

#### CRITIQUE (5 — bloquants V1)

| # | Fichier | Description |
|---|---------|-------------|
| CR-1 | `hub/middleware/auth.js:74-80` | **TIMING ATTACK** : `verifyAppSecret` utilise `includes()` (non constant-time). Remplacer par `crypto.timingSafeEqual()` |
| CR-2 | `hub/routes/webhooks.js:36-38` | **RACE CONDITION IDEMPOTENCY** : Check non-atomique — 2 webhooks identiques simultanés passent. Utiliser `findOneAndUpdate` + upsert ou index unique |
| CR-3 | `hub/routes/subscriptions.js:238-243` | **VALIDATION MANQUANTE** : `quantity` sur `/report-usage` peut être négatif, NaN, Infinity. Ajouter `quantity >= 0` + `Number.isFinite()` |
| CR-4 | `hub/services/subscription.service.js:107` | **RESET USAGE MAL PLACÉ** : `lastReportedUsage = 0` reset à chaque paiement, pas basé sur `invoice.period.start`. Décalage possible si webhook en retard |
| CR-5 | `rt/middleware/subscriptionCheck.js:45-47` | **CASE-SENSITIVE PLAN NAME** : Comparaison `planName === 'pro'` avec `.toLowerCase()` juste avant — vérifier cohérence données seed/Stripe |

#### IMPORTANT (8 — à corriger rapidement post-V1)

| # | Fichier | Description |
|---|---------|-------------|
| CR-6 | `hub/services/stripe.service.js:67` | Metadata injection possible (userId/planId sans sanitize) |
| CR-7 | `hub/routes/subscriptions.js:262-264` | Cap calculation sans plafond absolu — si usagePrice très petit, cap énorme |
| CR-8 | `hub/routes/subscriptions.js:267-268` | Delta négatif masqué silencieusement (pas de warning log) |
| CR-9 | `hub/services/subscription.service.js:159-163` | Race condition sur referral commission (`totalEarned += amount` non-atomique) |
| CR-10 | `hub/services/subscription.service.js:240-247` | Plan change detection fragile (même metered price ID possible sur 2 plans) |
| CR-11 | `rt/services/billingService.js:40-42` | **N+1 QUERY** : 300+ queries pour 100 restaurants — utiliser aggregation pipeline |
| CR-12 | `rt/middleware/subscriptionCheck.js:73-76` | Cache race condition — 2 requêtes simultanées fetch Hub si cache expiré |
| CR-13 | `rt/stores/authStore.js:50-55` | Refresh token dans localStorage (vulnérable XSS) — recommandé httpOnly cookie |

#### MINEUR (10)
- Sparse index Plan.js, TTL index WebhookEvent.js, isMongoId regex, logging verbeux webhooks, virtual subscriptions perf, error handling batch RT, hubUserId fallback, loading state SubscriptionSection, logout error handling

#### POSITIF (8 bonnes pratiques)
- Webhook retourne toujours 200 à Stripe (évite retries)
- Idempotency check dans handleCheckoutCompleted
- Rate limiting granulaire par endpoint
- Fail-open design sur subscriptionCheck (Hub down → tout autorisé)
- Index composites bien pensés sur Subscription
- Utilisation de `expand` Stripe pour réduire les requêtes
- Erreurs par restaurant n'arrêtent pas le batch billing
- SSO handler gère tous les états (verifying, success, error)

---

### 5. E2E Flow (e2e-flow-tester — vérification DB/API)

| # | Test | Statut | Notes |
|---|------|--------|-------|
| E1 | Inscription DB | **OK** | User Audit V1, ID: 698ede7b287c909cc94a8eba |
| E2 | Product/Plans DB | **OK** | 3 plans, tous avec stripePriceId + stripeMeteredPriceId |
| E3 | Souscription DB | **OK** | status:trialing, Plan:Pro, stripeSubId présent, lastReportedUsage:0 |
| E4 | SSO → RT | **OK** | Vérifié via frontend (NoRestaurant → Restaurant créé) |
| E5 | Réservations | **OK** | Jean Audit, 19h, 4 personnes — vérifié via frontend |
| E6 | Billing report | **SKIP** | Non déclenché manuellement (cron tourne à :30) |
| E7 | Stripe verification | **OK** | Subscription active, payment method configuré |
| E8 | Cap test | **OK** | 100→84 (capped), 150→"no new usage" |
| E9 | Feature gating | **OK** | Middleware fail-open, features Pro correctement gated |
| E10 | Persistance | **OK** | Hub + RT données cohérentes après re-login |

**Observation** : EventBus WebSocket instable — reconnexions fréquentes (code 1006). Possible problème keepalive Nginx.

---

## Tous les bugs trouvés

| # | Sévérité | Source | Description | Action |
|---|----------|--------|-------------|--------|
| 1 | **CRITIQUE** | Code Review | Timing attack sur verifyAppSecret (auth.js) | `crypto.timingSafeEqual()` |
| 2 | **CRITIQUE** | Code Review | Race condition idempotency webhook (webhooks.js) | Index unique + upsert |
| 3 | **CRITIQUE** | Code Review | Validation manquante quantity report-usage | `>= 0` + `isFinite()` |
| 4 | **CRITIQUE** | Code Review | Reset lastReportedUsage mal placé | Baser sur invoice.period.start |
| 5 | **CRITIQUE** | Code Review | Case-sensitive plan name comparison | Vérifier seed data |
| 6 | **IMPORTANT** | Frontend | Pas de bouton "Ouvrir" sur cartes apps dashboard | Ajouter lien/bouton |
| 7 | **IMPORTANT** | Frontend | Checkout possible avec abonnement existant | Vérifier sub existante avant checkout |
| 8 | **IMPORTANT** | Backend | Hub /api/auth/profile → 404 | Implémenter ou documenter |
| 9 | **IMPORTANT** | Backend | RT routes SSO manquantes en prod | Implémenter ou clarifier |
| 10 | **IMPORTANT** | Stripe | Anciens checkouts sur plan legacy FREE | Migrer/désactiver anciens prix |
| 11 | **IMPORTANT** | Code Review | Metadata injection, N+1 query, refresh token localStorage, etc. (8 items) | Voir section Code Review |
| 12 | **MINEUR** | Frontend | Grammaire "1 réservations" | Singulier/pluriel |
| 13 | **MINEUR** | Backend | Billing job flood logs 404 | Skip silencieux |
| 14 | **MINEUR** | Stripe | API invoices/upcoming dépréciée | Migrer vers create_preview |
| 15 | **MINEUR** | E2E | EventBus reconnexions fréquentes (1006) | Vérifier keepalive Nginx |

---

## Recommandations V1

### Bloquants (avant lancement)
1. **Fixer timing attack** sur verifyAppSecret → `crypto.timingSafeEqual()` (~30 min)
2. **Fixer race condition idempotency** → index unique stripeEventId + upsert (~1h)
3. **Valider quantity** sur report-usage → `>= 0, isFinite, isInteger` (~15 min)
4. **Revoir reset lastReportedUsage** → basé sur invoice.period.start (~1h)
5. **Vérifier cohérence plan names** en DB et Stripe (casse) (~30 min)
6. **Ajouter bouton "Ouvrir"** sur cartes apps dashboard Hub (~1h)
7. **Empêcher checkout dupliqué** si subscription existante (~1h)

### Post-V1 (semaine 1-2)
- Migrer refresh token vers httpOnly cookie
- Optimiser N+1 queries billing service
- Migrer API invoices/upcoming vers create_preview
- Ajouter plafond absolu sur cap calculation
- Nettoyer/désactiver prix legacy Stripe
- Réduire verbosité logs billing job

### Post-V1 (mois 1)
- Implémenter monitoring/alerting billing
- Remplacer DEV_BYPASS_AUTH par vrai SSO frontend
- Ajouter tests automatisés Stripe (checkout → subscription → metered)
- Stabiliser EventBus WebSocket (keepalive)

---

## État du serveur

| Service | Status | Uptime | Restarts |
|---------|--------|--------|----------|
| swigs-hub | online | 26m | 39 |
| reservetatable | online | 92m | 21 |
| swigs-workflow | online | 3D | 5 (x2) |
| swigs-task | online | 3D | 15 |

**Note** : 39 restarts sur swigs-hub en 26min est préoccupant — investiguer la stabilité.

---

## Screenshots

Tous les screenshots sont dans `/audit-screenshots/` :
- F1-register-step2.png, F1-dashboard-after-register.png
- F3-marketplace.png, F3-product-top.png, F3-plans.png
- F4-stripe-checkout.png, F4-stripe-filled.png, F4-checkout-success.png
- F5-dashboard-subscription.png, F5-dashboard-no-open-button.png
- F6-no-restaurant.png
- F7-restaurant-dashboard.png
- F8-reservation-created.png, F8-calendar.png, F8-floor-plan.png, F8-clients.png, F8-settings-subscription.png
- F9-relogin-hub.png, F9-rt-persistence.png
- F10-hub-mobile.png, F10-hub-mobile-dark.png

---

## Décision

### NOGO pour V1 — 7 corrections bloquantes nécessaires

**Temps estimé** : 1-2 jours de développement pour les 7 items bloquants.

Après correction, un re-test ciblé sur les 5 items critiques de sécurité suffira pour valider le GO V1.
