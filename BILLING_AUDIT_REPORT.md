# Audit Complet — Facturation & Devis SWIGS Workflow

**Date** : 23 février 2026
**Équipe** : frontend-auditor, backend-auditor, ux-designer
**Périmètre** : Système de facturation, devis, relances, PDF, portal, timer, import bancaire

---

## Executive Summary

Le système de facturation SWIGS Workflow repose sur une base technique solide : architecture multi-tenant, dark mode cohérent, 8 templates PDF, QR-Bill suisse, relances automatiques, et un flux devis→facture fonctionnel. L'application est utilisable en production et couvre les besoins essentiels d'un freelancer suisse.

Cependant, l'audit révèle **7 bugs critiques** (dont 2 crashs runtime confirmés), **des failles de sécurité** (routes non protégées, fuite multi-tenant legacy), et **des lacunes UX significatives** (pas d'onboarding, empty states sans CTA, gestion d'erreurs silencieuse). Le QR-Bill suisse présente des non-conformités avec la norme (champs zip/city vides, référence de paiement invalide) qui peuvent causer des rejets bancaires.

La fonctionnalité majeure absente est la **facturation récurrente** — indispensable pour les clients avec abonnements mensuels. L'accessibilité est insuffisante (score 5.5/10) avec des labels manquants sur la plupart des formulaires. Le double système de templates email crée de la confusion. Enfin, l'absence de transactions MongoDB sur la création de facture expose à des incohérences de données.

---

## Scores de maturité par catégorie

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| **Facturation** | 7/10 | Flux fonctionnel, snapshots immuables, mais race conditions sur numérotation et pas de transactions |
| **Devis** | 8/10 | Workflow complet, acomptes partiels, conversion fluide — manque confirmation UI sur changements statut |
| **Relances** | 9/10 | Timeline claire, 4 niveaux, templates personnalisables — délais non éditables |
| **PDF & Design** | 9/10 | 8 templates, live preview, QR-Bill — mais QR-Bill non conforme norme suisse |
| **UX/UI** | 7/10 | Dark mode cohérent, animations fluides — erreurs silencieuses, pas d'onboarding |
| **Performance** | 6.5/10 | Pas de skeleton loaders, N+1 queries, templates PDF rechargés à chaque requête |
| **Sécurité** | 6/10 | Chiffrement AES-256, CORS, Helmet — mais routes automation sans auth, fuite multi-tenant legacy |
| **Accessibilité** | 5.5/10 | Focus trap modal OK — labels manquants, pas de role/aria sur checkboxes custom |
| **Score global** | **7.2/10** | |

---

## Findings par priorité

### P0 — Critique (corriger immédiatement)

#### P0-1. PortalView.jsx — crash `doc is not defined`
- **Fichier** : `frontend/src/pages/PortalView.jsx:51`
- **Impact** : Le téléchargement PDF depuis le portal public crashe systématiquement
- **Cause** : `doc` est destructuré dans le JSX return (ligne 107) mais utilisé dans `handleDownloadPDF` (ligne 51) qui est hors scope
- **Fix** : Remplacer `doc.number` par `portalData?.document?.number`
- **Effort** : S

#### P0-2. Routes automation sans authentification
- **Fichier** : `backend/server.js:202-204`
- **Impact** : `/api/automations`, `/api/automation-runs`, `/api/email-templates` accessibles sans auth — n'importe qui peut lire/modifier les automations
- **Fix** : Ajouter `requireAuth` sur ces routes
- **Effort** : S

#### P0-3. Race condition numérotation factures/devis
- **Fichier** : `backend/src/models/Invoice.js` et `Quote.js` — méthode `generateNumber`
- **Impact** : En cluster PM2 multi-process, deux factures peuvent obtenir le même numéro. Le fallback `Date.now()` génère un numéro non lisible (ex: `FAC-2026-1708xxx`)
- **Fix** : Utiliser `findOneAndUpdate` avec `$inc` sur une collection `Counters` (approche atomique MongoDB)
- **Effort** : M

#### P0-4. Pas de transaction MongoDB sur createInvoice
- **Fichier** : `backend/src/controllers/invoiceController.js`
- **Impact** : La création de facture implique 3 opérations (create invoice, update events billed, update quotes). Si l'étape 2 ou 3 échoue, les données sont incohérentes
- **Fix** : `mongoose.startSession()` + transactions
- **Effort** : M

#### P0-5. QR-Bill non conforme — champs zip/city vides
- **Fichier** : `backend/src/services/qrbill.service.js`
- **Impact** : Les QR-Bills générés ont `zip: ''` et `city: ''` pour créditeur ET débiteur — invalide selon la norme Swiss QR-Bill, peut être rejeté par les banques
- **Fix** : Décomposer `company.address` en champs séparés (street, zip, city) dans Settings, et utiliser `client.address` décomposé
- **Effort** : M

#### P0-6. QR-Bill — référence de paiement invalide
- **Fichier** : `backend/src/services/qrbill.service.js`
- **Impact** : `FAC-2026-001` → `2026001` (7 chiffres) — une QR-Référence valide doit être 26 chiffres avec checksum, ou vide
- **Fix** : Générer une QR-Référence conforme ou utiliser SCOR reference
- **Effort** : M

#### P0-7. NewInvoiceModal — erreur silencieuse à la création
- **Fichier** : `frontend/src/components/Sidebar/NewInvoiceModal.jsx:244`
- **Impact** : Si la création échoue (réseau, validation), l'utilisateur ne voit aucun message d'erreur — juste le bouton qui se dé-loader
- **Fix** : Ajouter `addToast({ type: 'error', message: ... })` dans le catch
- **Effort** : S

---

### P1 — Important (sprint prochain)

#### P1-1. Multi-tenant legacy — projets sans userId accessibles par tous
- **Fichier** : `backend/src/controllers/invoiceController.js:99` et `projectController.js`
- **Impact** : Si `project.userId` est null (données legacy), tout utilisateur authentifié peut accéder au projet et ses factures
- **Fix** : Inverser la logique — bloquer si userId absent, ou migrer les données legacy
- **Effort** : M

#### P1-2. Annulation facture ne décrémente pas invoicedAmount des quotes
- **Fichier** : `backend/src/controllers/invoiceController.js` — `changeInvoiceStatus`
- **Impact** : Une quote partiellement facturée puis annulée garde un `invoicedAmount` incorrect — empêche de refacturer correctement
- **Fix** : Lors de l'annulation, recalculer `invoicedAmount` et mettre à jour `invoices[]` sur les quotes liées
- **Effort** : M

#### P1-3. updateSettings retourne les secrets chiffrés
- **Fichier** : `backend/src/controllers/settingsController.js:123`
- **Impact** : `smtp.pass`, `abaninja.apiKey`, `bankImap.pass` chiffrés mais exposés dans la réponse
- **Fix** : Appliquer le même filtre que `getSettings` (supprimer les champs sensibles)
- **Effort** : S

#### P1-4. Puppeteer — page non fermée en cas d'erreur
- **Fichier** : `backend/src/services/pdfTemplates/renderer.js`
- **Impact** : Si `page.pdf()` lève une exception, la page Puppeteer reste ouverte — accumulation de pages fantômes, memory leak
- **Fix** : `await page.close()` dans un bloc `finally`
- **Effort** : S

#### P1-5. Relance manuelle bloquée si auto-reminders désactivés
- **Fichier** : `backend/src/controllers/reminderController.js`
- **Impact** : L'utilisateur ne peut pas envoyer de relance manuelle si les relances automatiques sont désactivées — contreintuitif
- **Fix** : Séparer le check `schedule.enabled` du flux de relance manuelle
- **Effort** : S

#### P1-6. deleteInvoice permet de supprimer une facture payée
- **Fichier** : `backend/src/controllers/invoiceController.js`
- **Impact** : Une facture `paid` peut être supprimée sans contrôle — problème comptable
- **Fix** : Bloquer la suppression si status !== 'draft' (ou exiger annulation préalable)
- **Effort** : S

#### P1-7. BankSection — loadImports() appelé dans le corps du composant
- **Fichier** : `frontend/src/components/Settings/BankSection.jsx:220`
- **Impact** : `loadImports()` déclenché à chaque render (pas dans un useEffect) — appels API en boucle
- **Fix** : Déplacer dans `useEffect([], [])`
- **Effort** : S

#### P1-8. NewQuoteModal — race condition statusTimeout
- **Fichier** : `frontend/src/components/Sidebar/NewQuoteModal.jsx:152-157`
- **Impact** : Si l'utilisateur ferme le modal manuellement pendant le timeout de 2s, `onClose()` est rappelé sur un composant potentiellement démonté
- **Fix** : `clearTimeout(statusTimeoutRef.current)` dans le cleanup de l'effet ou lors de `onClose`
- **Effort** : S

#### P1-9. StandardInvoiceForm — signedAt peut être null
- **Fichier** : `frontend/src/components/Sidebar/StandardInvoiceForm.jsx:224`
- **Impact** : `format(new Date(undefined), ...)` lève une exception si `quote.signedAt` est null
- **Fix** : Guard `quote.signedAt &&` avant le format
- **Effort** : S

#### P1-10. Empty states sans CTA sur InvoiceList, QuoteList, EventsTab
- **Fichiers** : `InvoiceList.jsx`, `QuoteList.jsx`, `EventsTab.jsx`
- **Impact** : L'utilisateur voit "Aucune facture" sans guidance — devrait avoir un bouton "Créer ma première facture"
- **Fix** : Ajouter des empty states avec CTA contextuel
- **Effort** : S

#### P1-11. Accessibilité — labels manquants sur formulaires
- **Fichiers** : `NewCustomInvoiceModal.jsx`, `BankSection.jsx`, `StandardInvoiceForm.jsx`
- **Impact** : Inputs sans `label htmlFor` ni `aria-label` — inaccessibles aux lecteurs d'écran
- **Fix** : Ajouter `aria-label` ou `<label htmlFor>` sur tous les inputs
- **Effort** : M

#### P1-12. TVA hardcodée à 8.1% dans NewCustomInvoiceModal (legacy)
- **Fichier** : `frontend/src/components/Sidebar/NewCustomInvoiceModal.jsx:46`
- **Impact** : Ignore le taux TVA configuré dans Settings
- **Fix** : Supprimer ce composant (doublon de CustomInvoiceForm dans NewInvoiceModal) ou utiliser settings.vatRate
- **Effort** : S

#### P1-13. historyService — symbole € au lieu de CHF
- **Fichier** : `backend/src/services/historyService.js`
- **Impact** : L'audit trail affiche les montants en euros alors que l'application est orientée CHF
- **Fix** : Utiliser la devise configurée dans Settings ou CHF par défaut
- **Effort** : S

#### P1-14. historyService non-blocking
- **Fichier** : `backend/src/services/historyService.js`
- **Impact** : Si `History.create` échoue (timeout DB), l'exception propage et fait échouer l'opération principale (création facture, etc.)
- **Fix** : Wrapper chaque appel dans un try/catch fire-and-forget
- **Effort** : S

---

### P2 — Amélioration (sprint moyen)

| # | Description | Fichier | Effort |
|---|-------------|---------|--------|
| P2-1 | **Facturation récurrente** (feature complète) | Nouveau modèle + controller + UI | XL |
| P2-2 | Rate limiting spécifique routes PDF (Puppeteer) | `backend/src/routes/` | S |
| P2-3 | Cache templates/CSS PDF au démarrage | `renderer.js` | S |
| P2-4 | Onboarding wizard / banner configuration | `Secretary.jsx` | M |
| P2-5 | Unifier/deprecate double système templates email | `EmailsSection.jsx` | M |
| P2-6 | Validation IBAN avant sauvegarde Settings | `settingsController.js` | S |
| P2-7 | Adresse company décomposée (street, zip, city) pour QR-Bill | `Settings.js` + UI | M |
| P2-8 | Preview auto au chargement InvoiceDesignTab | `InvoiceDesignTab.jsx` | S |
| P2-9 | Skeleton loaders sur DocumentsTab, EventsTab, ServicesTab | Frontend multiple | M |
| P2-10 | Refactoring 3 fetchs post-création facture dans projectStore | `projectStore.js` | M |
| P2-11 | Index `dueDate` sur Invoice pour requête relances | `Invoice.js` | S |
| P2-12 | settingsStore global (éviter fetch dupliqué) | Frontend | M |
| P2-13 | Confirmation avant changement statut devis depuis EventsTab | `EventsTab.jsx` | S |
| P2-14 | Variables cliquables insertion dans RemindersSection | `RemindersSection.jsx` | S |
| P2-15 | Portal : couleurs depuis settings company (pas hardcodé bleu) | `PortalView.jsx` | S |
| P2-16 | Emails factures/devis en HTML (pas juste plain text) | `email.service.js` | M |
| P2-17 | Prefixes FAC-/DEV- depuis Settings (actuellement ignorés) | `Invoice.js`, `Quote.js` | S |
| P2-18 | Page de confirmation post-signature portal | `PortalView.jsx` | S |

---

### P3 — Nice-to-have (polish)

| # | Description | Effort |
|---|-------------|--------|
| P3-1 | TimerWidget : accents FR manquants ("Arreter" → "Arrêter") | S |
| P3-2 | TimerWidget : couleurs popovers hardcodées → Tailwind dark: | S |
| P3-3 | InvoiceDesignTab : mini-thumbnails des templates | M |
| P3-4 | RemindersSection : délais de relance éditables dans l'UI | M |
| P3-5 | Checkboxes accessibles (role="checkbox", aria-checked) StandardInvoiceForm | S |
| P3-6 | Logo stockage fichier au lieu de base64 en DB | M |
| P3-7 | Taux horaire par défaut depuis settings (EventsTab hardcode 50) | S |
| P3-8 | Nettoyage états morts uiStore (showNewInvoiceModal, showNewQuoteModal) | S |
| P3-9 | `_interval` timerStore → module-level variable (anti-pattern Zustand) | S |
| P3-10 | formatCurrency cohérent entre email.service et reminder.service | S |
| P3-11 | Portal : support multilingue (FR/EN/DE) | L |
| P3-12 | Suppression composant mort NewCustomInvoiceModal.jsx | S |
| P3-13 | Nav Header : "Workflow" invisible sur mobile (pas d'icône) | S |

---

## Fonctionnalité manquante majeure : Facturation récurrente

### Contexte
La facturation récurrente est indispensable pour les freelancers avec des clients en abonnement (maintenance mensuelle, hébergement, retainer). C'est la feature la plus demandée dans les SaaS de facturation.

### Modèle proposé : `RecurringInvoice`

```javascript
const recurringInvoiceSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  project: { type: ObjectId, ref: 'Project', required: true },

  // Template
  customLines: [{
    description: String,
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    unit: String
  }],

  // Fréquence
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },

  // Plage
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null }, // null = illimité

  // Configuration
  vatRate: { type: Number, default: 8.1 },
  paymentTermsDays: { type: Number, default: 30 },
  notes: String,
  autoSend: { type: Boolean, default: false },

  // Tracking
  status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
  lastGeneratedAt: Date,
  nextGenerationDate: { type: Date, required: true },
  generatedInvoices: [{ type: ObjectId, ref: 'Invoice' }],
  totalGenerated: { type: Number, default: 0 }
}, { timestamps: true });

recurringInvoiceSchema.index({ status: 1, nextGenerationDate: 1 });
recurringInvoiceSchema.index({ userId: 1, status: 1 });
```

### Cron job (quotidien)

```javascript
// Chaque jour à 6h00
cron.schedule('0 6 * * *', async () => {
  const due = await RecurringInvoice.find({
    status: 'active',
    nextGenerationDate: { $lte: new Date() }
  }).populate('project');

  for (const recurring of due) {
    const invoice = await Invoice.create({
      project: recurring.project._id,
      customLines: recurring.customLines,
      vatRate: recurring.vatRate,
      // ...
    });

    recurring.generatedInvoices.push(invoice._id);
    recurring.totalGenerated++;
    recurring.lastGeneratedAt = new Date();
    recurring.nextGenerationDate = calculateNext(recurring.frequency, recurring.dayOfMonth);
    await recurring.save();

    if (recurring.autoSend) {
      await emailService.sendInvoiceEmail(invoice);
    }
  }
});
```

### Maquette UI — Modal récurrence

```
┌─────────────────────────────────────────────────────────┐
│  Nouvelle facturation récurrente                    ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Projet      [Sélectionner un projet          ▼]       │
│  Client      Dupont SA (depuis le projet)               │
│                                                         │
│  ─── Lignes ──────────────────────────────────────────  │
│  Description          Qté    Prix unit.    Total        │
│  ┌─────────────────┬──────┬───────────┬──────────┐     │
│  │ Maintenance web │  1   │  500.00   │  500.00  │  🗑 │
│  │ Hébergement     │  1   │  50.00    │   50.00  │  🗑 │
│  └─────────────────┴──────┴───────────┴──────────┘     │
│  [+ Ajouter une ligne]                                  │
│                                                         │
│  ─── Fréquence ───────────────────────────────────────  │
│  Répétition  [Mensuelle ▼]    Jour du mois  [1  ▼]    │
│  Début       [01.03.2026]                               │
│  Fin         [○ Sans fin  ○ Jusqu'au ___________]      │
│                                                         │
│  ─── Options ─────────────────────────────────────────  │
│  TVA              [8.1] %                               │
│  Délai paiement   [30] jours                            │
│  ☑ Envoyer automatiquement par email                   │
│                                                         │
│  ─── Résumé ──────────────────────────────────────────  │
│  Sous-total         CHF 550.00                          │
│  TVA (8.1%)         CHF  44.55                          │
│  Total / mois       CHF 594.55                          │
│  Prochaine facture  1 mars 2026                         │
│                                                         │
│              [Annuler]    [Créer la récurrence]         │
└─────────────────────────────────────────────────────────┘
```

### Dashboard récurrences

```
┌─────────────────────────────────────────────────────────┐
│  Facturation récurrente        [+ Nouvelle récurrence]  │
├──────────┬──────────────┬───────────┬──────┬───────────┤
│ Client   │ Montant/mois │ Fréquence │ État │ Prochain  │
├──────────┼──────────────┼───────────┼──────┼───────────┤
│ Dupont   │ CHF 594.55   │ Mensuelle │ 🟢  │ 01.03.26  │
│ Martin   │ CHF 1200.00  │ Trimestr. │ 🟢  │ 01.04.26  │
│ Weber    │ CHF 300.00   │ Mensuelle │ ⏸️  │ —         │
└──────────┴──────────────┴───────────┴──────┴───────────┘
```

---

## Tableau de synthèse sécurité

| Point | Statut | Priorité |
|-------|--------|----------|
| requireAuth sur routes critiques | ⚠️ Manquant sur /api/automations | P0 |
| Multi-tenant filtrage userId | ⚠️ Incomplet (legacy userId null) | P1 |
| Chiffrement secrets SMTP/API | ✅ AES-256-GCM | — |
| Secrets non exposés en réponse | ⚠️ updateSettings retourne secrets | P1 |
| Rate limiting global | ✅ 100 req/min | — |
| Rate limiting routes PDF | ❌ Manquant | P2 |
| Transactions MongoDB | ❌ Manquant sur createInvoice | P0 |
| Validation inputs serveur | ⚠️ Partiel | P2 |
| CORS | ✅ Origines whitelistées | — |
| Helmet headers | ✅ Configuré | — |
| Injection NoSQL | ✅ Mongoose paramétrise | — |

---

## Roadmap suggérée

### Sprint 1 — Quick Wins & Sécurité (1-2 semaines)

**Objectif** : Corriger les bugs critiques et failles de sécurité

| # | Tâche | Effort | Ref |
|---|-------|--------|-----|
| 1 | Fix PortalView.jsx `doc` undefined | S | P0-1 |
| 2 | Ajouter requireAuth sur routes automation | S | P0-2 |
| 3 | Fix erreur silencieuse NewInvoiceModal | S | P0-7 |
| 4 | Fix BankSection loadImports dans useEffect | S | P1-7 |
| 5 | Guard signedAt null dans StandardInvoiceForm | S | P1-9 |
| 6 | Fix race condition timeout NewQuoteModal | S | P1-8 |
| 7 | Fix updateSettings expose secrets | S | P1-3 |
| 8 | Puppeteer page.close() dans finally | S | P1-4 |
| 9 | historyService fire-and-forget + CHF | S | P1-13, P1-14 |
| 10 | Relance manuelle sans dépendance auto-reminders | S | P1-5 |
| 11 | Bloquer suppression facture payée | S | P1-6 |
| 12 | Supprimer NewCustomInvoiceModal (doublon mort) | S | P1-12 |

### Sprint 2 — Robustesse & Features (2-3 semaines)

**Objectif** : Transactions, numérotation atomique, QR-Bill conforme, récurrence

| # | Tâche | Effort | Ref |
|---|-------|--------|-----|
| 1 | Transactions MongoDB sur createInvoice | M | P0-4 |
| 2 | Compteur atomique numérotation (collection Counters) | M | P0-3 |
| 3 | QR-Bill : adresse décomposée + zip/city | M | P0-5, P2-7 |
| 4 | QR-Bill : référence paiement conforme | M | P0-6 |
| 5 | Fix annulation facture → decrement invoicedAmount quotes | M | P1-2 |
| 6 | Multi-tenant legacy : migration ou blocage userId null | M | P1-1 |
| 7 | Empty states avec CTA (InvoiceList, QuoteList, EventsTab) | S | P1-10 |
| 8 | Accessibilité labels sur tous les formulaires | M | P1-11 |
| 9 | Facturation récurrente — modèle + cron + API | L | P2-1 |
| 10 | Facturation récurrente — UI (modal + dashboard) | L | P2-1 |

### Sprint 3 — Polish & Expérience (2-3 semaines)

**Objectif** : UX, performance, onboarding

| # | Tâche | Effort | Ref |
|---|-------|--------|-----|
| 1 | Onboarding banner/wizard | M | P2-4 |
| 2 | Unifier système templates email | M | P2-5 |
| 3 | Skeleton loaders (DocumentsTab, EventsTab, Services) | M | P2-9 |
| 4 | settingsStore global (éviter fetch dupliqués) | M | P2-12 |
| 5 | Refactoring fetchs post-création facture | M | P2-10 |
| 6 | Cache templates/CSS PDF au démarrage | S | P2-3 |
| 7 | Rate limiting routes PDF | S | P2-2 |
| 8 | Preview auto InvoiceDesignTab au chargement | S | P2-8 |
| 9 | Portal : couleurs depuis settings, page merci post-signature | S | P2-15, P2-18 |
| 10 | Emails factures/devis en HTML | M | P2-16 |
| 11 | Validation IBAN Settings | S | P2-6 |
| 12 | Confirmation changement statut devis | S | P2-13 |
| 13 | Variables cliquables RemindersSection | S | P2-14 |
| 14 | TimerWidget : accents + dark mode Tailwind | S | P3-1, P3-2 |

---

## Annexe — Fichiers audités

### Backend (27 fichiers)
- `backend/src/models/` : Invoice.js, Quote.js, Event.js, Project.js, Settings.js, Timer.js, Status.js, Service.js
- `backend/src/controllers/` : invoiceController.js, quoteController.js, eventController.js, projectController.js, settingsController.js, timerController.js, reminderController.js, dashboardController.js
- `backend/src/routes/` : invoices.js, quotes.js, projects.js, settings.js, timer.js
- `backend/src/services/` : pdf.service.js, qrbill.service.js, email.service.js, reminder.service.js, historyService.js
- `backend/src/services/pdfTemplates/` : renderer.js, templates/*.hbs, styles/invoice.css
- `backend/server.js`, `backend/src/middleware/auth.js`, `backend/src/middleware/validate.js`

### Frontend (25+ fichiers)
- `frontend/src/components/Sidebar/` : ProjectSidebar.jsx, EventsTab.jsx, DocumentsTab.jsx, InvoiceList.jsx, QuoteList.jsx, NewInvoiceModal.jsx, NewQuoteModal.jsx, NewCustomInvoiceModal.jsx, StandardInvoiceForm.jsx, CustomInvoiceForm.jsx, InvoiceSummary.jsx
- `frontend/src/components/Settings/` : InvoiceDesignTab.jsx, RemindersSection.jsx, EmailsSection.jsx, ServicesTab.jsx, BankSection.jsx
- `frontend/src/components/Layout/` : Header.jsx, TimerWidget.jsx
- `frontend/src/pages/` : PortalView.jsx, Secretary.jsx, Settings.jsx
- `frontend/src/stores/` : projectStore.js, timerStore.js, uiStore.js
- `frontend/src/services/` : api.js
