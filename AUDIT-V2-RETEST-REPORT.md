# Rapport de Retest V2 — SWIGS Hub + ReserveTable

**Date** : 13 février 2026
**Auditeur** : Claude AI (Team lead + 2 agents)
**Durée** : ~30 minutes

---

## Résumé exécutif

| Domaine | Verdict | Notes |
|---------|---------|-------|
| Sécurité (CR-1 à CR-4) | **OK** | 4/4 fixes correctement implémentées |
| UX Fix F-BUG-1 | **OK** | Boutons "Ouvrir" ajoutés puis retirés (cartes cliquables) |
| UX Fix F-BUG-2 | **OK** | Apps gratuites affichent "Gratuit", apps payées "Essai"/"Actif" |
| Team Role Feature | **PARTIEL** | Backend Hub OK, mais tokens OAuth incomplets |
| Admin Panel Team UI | **OK** | Toggle Promouvoir/Retirer team fonctionnel |
| Régressions | **OK** | Admin, Team, Normal user tous fonctionnels |

### Décision

- **GO conditionnel** — 1 correction critique restante (OAuth tokens) + 1 bug cache à corriger

---

## 1. Sécurité (CR-1 à CR-4) — Agent: security-tester

### Résultats

| # | Fix | Statut | Vérification |
|---|-----|--------|-------------|
| CR-1 | Timing attack `verifyAppSecret` | **OK** | `crypto.timingSafeEqual()` avec vérification longueur Buffer |
| CR-2 | Race condition idempotency webhook | **OK** | `findOneAndUpdate` atomique + upsert + gestion E11000 + index unique TTL 30j |
| CR-3 | Validation quantity report-usage | **OK** | `Number.isFinite()` + `Number.isInteger()` + `>= 0`. Tests: -5→400, 3.7→400, "abc"→400, 1e999→400, 0→200 |
| CR-4 | Reset lastReportedUsage | **OK** | Reset conditionnel: `newPeriodStart.getTime() !== previousPeriodStart.getTime()`. Gère null (1ère facture) |

**Verdict sécurité : 4/4 PASS**

---

## 2. UX Fixes — Team lead (Chrome DevTools)

### F-BUG-1 : Bouton "Ouvrir" sur cartes apps

**Statut : CORRIGÉ puis AMÉLIORÉ**

- V2 initial : Boutons "Ouvrir" ajoutés sur toutes les cartes ✅
- V2 final : Boutons retirés car les cartes entières sont cliquables (demande utilisateur)
- Les cartes utilisent `cursor-pointer` et `onClick={handleCardClick}` pour lancer les apps

### F-BUG-2 : Labels apps gratuites/payées

**Statut : CORRIGÉ**

- Apps sans abonnement : badge "Gratuit" (gris)
- Apps en essai : "Essai gratuit jusqu'au [date]" + badge "Essai" (cyan)
- Apps actives : "Plan : [nom]" + badge "Actif" (vert)

---

## 3. Team Role Feature — Agent: team-reviewer + Team lead

### Code Review

| Fichier | Check | Statut |
|---------|-------|--------|
| User.js | `isTeam: Boolean, default: false` | **OK** |
| token.service.js | isTeam dans JWT (access, SSO, app tokens) | **OK** |
| subscriptions.js `/check` | Bypass pour team users + virtual subscriptions | **OK** |
| admin.js routes | Team ≠ Admin (distinction stricte) | **OK** |
| oauth.js tokens | isTeam/isAdmin dans access_token et id_token | **KO** |

### API Tests

| # | Test | Statut |
|---|------|--------|
| 1 | Team users en DB | **OK** — 2 team users confirmés |
| 2 | Subscription check bypass | **OK** — Team user retourne `hasSubscription: true` plan Premium |
| 3 | Team vs Admin distinction | **OK** — isTeam ≠ isAdmin |
| 4 | Migration isTeam | **OK** — 0 users sans champ isTeam |
| 5 | Sécurité PUT /me | **OK** — isTeam non modifiable via profil |

### Browser Tests

| # | Test | Statut | Notes |
|---|------|--------|-------|
| 7 | Admin: toggle Team role | **OK** | "Promouvoir team" → role Team, compteur 2→3, bouton → "Retirer team" |
| 8 | Team user: toutes apps | **OK** | 4 apps affichées (RT Premium, Task/Workflow/Webify Pro) sans subscription réelle |
| 9 | Team user: pas de lien Admin | **OK** | Header sans "Admin" |
| 10 | Team user: /admin → redirect / | **OK** | Redirection immédiate vers dashboard |

---

## 4. Régressions — Team lead (Chrome DevTools)

| # | Test | Statut | Notes |
|---|------|--------|-------|
| 12 | Admin: accès panel + apps | **OK** | Lien "Admin" visible, panel fonctionnel, 4 apps |
| 13 | Normal user: subscription | **OK** | RT "Essai" affiché, pas de lien Admin (après hard reload) |
| 14 | Normal user: /admin → redirect | **OK** | Redirection vers / |

---

## Nouveaux bugs trouvés

| # | Sévérité | Source | Description | Action |
|---|----------|--------|-------------|--------|
| V2-1 | **CRITIQUE** | Code Review | **OAuth tokens incomplets** : `access_token` et `id_token` dans `/api/oauth/token` n'incluent PAS `isTeam`/`isAdmin`. Les apps connectées via SSO ne peuvent pas bypasser les subscriptions pour les team users. | Ajouter `isAdmin: !!user.isAdmin, isTeam: !!user.isTeam` dans les 2 tokens (oauth.js:248-276) |
| V2-2 | **IMPORTANT** | Browser | **React Query cache leak** : Au logout/login, le cache React Query n'est pas vidé. Les subscriptions de l'utilisateur précédent persistent et s'affichent pour le nouveau user jusqu'au hard reload. | Appeler `queryClient.clear()` dans la fonction `logout()` du authStore |
| V2-3 | **MINEUR** | Code Review | `requireAdmin` middleware ne check pas `isTeam` — décision design intentionnelle ? Si Team = Admin light, ajouter `|| req.user.isTeam` | Clarifier la spec |

---

## Corrections appliquées pendant le retest

| # | Description | Fichier |
|---|-------------|---------|
| 1 | Suppression boutons "Ouvrir" des cartes apps (cartes cliquables) | `DashboardV2.jsx` |

---

## État des fixes V1

| Bug V1 | Statut V2 | Notes |
|--------|-----------|-------|
| CR-1 Timing attack | **FIXÉ** | crypto.timingSafeEqual |
| CR-2 Race condition idempotency | **FIXÉ** | findOneAndUpdate atomic |
| CR-3 Validation quantity | **FIXÉ** | isFinite + isInteger + >= 0 |
| CR-4 Reset usage | **FIXÉ** | Conditionnel sur period change |
| CR-5 Case-sensitive plan name | **NON TESTÉ** | Pas dans le scope V2 |
| F-BUG-1 Pas de bouton Ouvrir | **FIXÉ** | Cartes cliquables (bouton supprimé) |
| F-BUG-2 Checkout dupliqué | **FIXÉ** | Labels corrects gratuit/payé |

---

## Screenshots

Tous les screenshots V2 dans `/audit-screenshots/` :
- V2-dashboard-ouvrir-buttons.png (boutons Ouvrir — supprimés ensuite)
- V2-dashboard-no-ouvrir-buttons.png (version finale sans boutons)
- V2-admin-dashboard.png (admin logged in)
- V2-admin-users-team.png (admin panel — users avec roles)
- V2-team-user-dashboard.png (team user — toutes apps)
- V2-normal-user-all-apps.png (bug cache — données admin visibles)

---

## Recommandations

### Bloquant V1 (avant lancement)
1. **Fixer OAuth tokens** : Ajouter isTeam/isAdmin dans access_token et id_token (~15 min)
2. **Fixer cache React Query** : Clear au logout pour éviter fuite de données entre sessions (~15 min)

### Post-V1
- Décider si Team = Admin light (accès requireAdmin)
- CR-5 : Vérifier cohérence case plan names (non testé V2)
- Ajouter tests automatisés pour les 4 fixes sécurité

---

## Décision

### GO conditionnel — 2 corrections restantes (~30 min)

1. OAuth tokens (V2-1) — **CRITIQUE** : Sans cela, la feature Team ne fonctionne pas pour les apps SSO
2. Cache React Query (V2-2) — **IMPORTANT** : Fuite de données entre sessions utilisateur

Après ces 2 corrections, un quick retest sur le flow Team SSO end-to-end suffira pour valider le GO V1.
