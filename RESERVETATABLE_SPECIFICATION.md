# ReserveTable - Specification & Roadmap

> Application de gestion des reservations pour restaurants - Connectee SWIGS Hub
> **URL** : https://reservetatable.ch

---

## 1. Analyse Concurrentielle

### 1.1 Panorama des Concurrents

| Solution | Marche | Points Forts | Points Faibles | Prix |
|----------|--------|--------------|----------------|------|
| **Piktable** | Suisse romande | Local, simple, plafond garanti, assistant IA | Nouveau, peu de clients | 10-35 CHF + commission (max 99-149 CHF) |
| **MyLOCALINA** | Suisse | #1 en CH, gratuit, local.ch integre | Features limitees version gratuite | Gratuit / Premium |
| **aleno** | Suisse | IA "The Brain", 32+ integrations, pas de commission | Prix sur mesure (opaque) | Sur devis |
| **TheFork** | Europe | Enorme reseau, marketing integre, app mobile | Commissions, dependance plateforme | Commission/cover |
| **OpenTable** | Global | Leader mondial, 200+ integrations, benchmarking | $39-449/mois + commissions, cher | $39-449/mois + fees |
| **Zenchef** | Europe | Zero commission, CRM integre, Reserve Google | Interface perfectible | Abonnement fixe |

### 1.2 Analyse Detaillee Piktable (Concurrent Direct)

**Plans tarifaires Piktable :**

| Plan | Abonnement | Commission | Plafond Total |
|------|------------|------------|---------------|
| **Starter** | 10 CHF/mois | 0.5 CHF/resa | 99 CHF/mois |
| **Pro** | 15 CHF/mois | 1 CHF/resa | 99 CHF/mois |
| **Premium** | 35 CHF/mois | 1 CHF/resa | 149 CHF/mois |

*-20% en facturation annuelle, 1 mois gratuit d'essai*

**Fonctionnalites Piktable par plan :**

| Feature | Starter | Pro | Premium |
|---------|:-------:|:---:|:-------:|
| Widget/lien reservation integrable | ✅ | ✅ | ✅ |
| Gestion tables et capacites | ✅ | ✅ | ✅ |
| Creneaux horaires personnalisables | ✅ | ✅ | ✅ |
| Fiches clients | ✅ | ✅ | ✅ |
| Historique et fidelite clients | ✅ | ✅ | ✅ |
| Stats de base (venues, annulations) | ✅ | ✅ | ✅ |
| Emails automatiques | ✅ | ✅ | ✅ |
| Assistant IA | 5 q/mois | 5 q/mois | 50 q/mois |
| Emails (confirmation, rappel, suivi) | - | ✅ | ✅ |
| Demande avis Google/TripAdvisor | - | ✅ | ✅ |
| Multi-utilisateurs (admin + staff) | - | ✅ | ✅ |
| Combinaison tables grands groupes | - | ✅ | ✅ |
| Historique emails envoyes | - | ✅ | ✅ |
| Plan de table 2D basique | - | ✅ | ✅ |
| Plan 2D interactif (drag & drop) | - | - | ✅ |
| Gestion zones (terrasse, bar...) | - | - | ✅ |
| Echange tables en un clic | - | - | ✅ |
| Support prioritaire | - | - | ✅ |

**Points forts Piktable a egalerr :**
- Vue calendrier claire (jour/heure/client)
- Plan de salle avec elements decoratifs (portes, comptoirs)
- Statut tables temps reel (libre/reserve/occupe)
- Widget client : reservation en quelques clics
- Client peut modifier/annuler en un clic
- Client peut copier/partager sa reservation
- Configuration en 5 minutes
- Plafond de prix garanti (securite pour le restaurateur)

---

## 2. Positionnement ReserveTable

### 2.1 Proposition de Valeur

```
ReserveTable : La solution suisse de reservation simple et abordable,
avec couts plafonnes et ecosysteme SWIGS integre.
```

### 2.2 Differenciateurs vs Piktable

| Aspect | Piktable | ReserveTable |
|--------|----------|--------------|
| Ecosysteme | Standalone | SSO SWIGS Hub, future integration CMS |
| Assistant IA | Limite (5-50 q/mois) | Illimite (si implemente) |
| Multi-etablissements | Non mentionne | Natif des le depart |
| Hebergement | Non precise | Suisse (serveur .59) |
| Open source | Non | Potentiellement |

### 2.3 Cible

- **Primaire** : Restaurants independants en Suisse romande
- **Secondaire** : Petits groupes (2-5 etablissements)
- **Tertiaire** : Hotels avec restaurant (integration future CMS)

---

## 3. Features - Matrice Complete

### 3.1 MVP (Must Have) - Parite Piktable Starter+

| # | Feature | Description | Priorite |
|---|---------|-------------|----------|
| 1 | **Widget reservation** | Embed iframe ou script sur site client | P0 |
| 2 | **Calendrier reservations** | Vue jour/semaine avec timeline horaire | P0 |
| 3 | **Gestion tables** | CRUD tables avec capacite min/max | P0 |
| 4 | **Creneaux horaires** | Services midi/soir, durees personnalisables | P0 |
| 5 | **CRM basique** | Fiches clients avec historique | P0 |
| 6 | **Emails automatiques** | Confirmation, modification, annulation | P0 |
| 7 | **Stats basiques** | Venues, annulations, taux confirmation | P0 |
| 8 | **Plan 2D basique** | Visualisation tables avec statuts | P0 |
| 9 | **SSO SWIGS Hub** | Authentification centralisee | P0 |

### 3.2 Version 1.1 - Parite Piktable Pro

| # | Feature | Description | Priorite |
|---|---------|-------------|----------|
| 10 | **Rappels automatiques** | Email/SMS avant reservation (24h, 2h) | P1 |
| 11 | **Demande avis** | Email post-visite → Google/TripAdvisor | P1 |
| 12 | **Multi-utilisateurs** | Admin + staff avec permissions | P1 |
| 13 | **Combinaison tables** | Grouper tables pour grands groupes | P1 |
| 14 | **Historique emails** | Log complet des communications | P1 |
| 15 | **Modification client** | Lien dans email pour modifier/annuler | P1 |
| 16 | **Partage reservation** | Bouton copier/partager pour invites | P1 |

### 3.3 Version 2.0 - Parite Piktable Premium+

| # | Feature | Description | Priorite |
|---|---------|-------------|----------|
| 17 | **Plan 2D interactif** | Drag & drop tables, React Flow | P2 |
| 18 | **Multi-zones** | Terrasse, interieur, bar, prive... | P2 |
| 19 | **Elements decoratifs** | Portes, comptoirs, murs dans le plan | P2 |
| 20 | **Echange tables** | Reassigner table en un clic | P2 |
| 21 | **SMS notifications** | Twilio ou autre gateway | P2 |
| 22 | **Horaires speciaux** | Fermetures exceptionnelles, fetes | P2 |

### 3.4 Version 3.0 - Avantage Concurrentiel

| # | Feature | Description | Priorite |
|---|---------|-------------|----------|
| 23 | **Multi-etablissements** | Gestion plusieurs restos, vue groupe | P3 |
| 24 | **Reserve with Google** | Integration Google Business | P3 |
| 25 | **Assistant IA illimite** | Chatbot aide restaurateur | P3 |
| 26 | **Pre-auth CB (Stripe)** | No-show protection | P3 |
| 27 | **API publique** | Webhooks, integrations tierces | P3 |
| 28 | **App mobile PWA** | Interface responsive, notifications push | P3 |

---

## 4. Architecture Technique

### 4.1 Stack Technologique

```
┌─────────────────────────────────────────────────────────────────┐
│                       ReserveTable                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │    Frontend      │     │    Backend       │                 │
│  ├──────────────────┤     ├──────────────────┤                 │
│  │ React 18 + Vite  │────▶│ Node.js/Express  │                 │
│  │ Tailwind CSS     │     │ MongoDB          │                 │
│  │ Zustand          │     │ Redis (cache)    │                 │
│  │ React Query      │     │ node-cron        │                 │
│  │ @xyflow/react    │     │ nodemailer       │                 │
│  │ date-fns         │     │ Twilio (SMS)     │                 │
│  └──────────────────┘     └────────┬─────────┘                 │
│                                    │                           │
│  ┌─────────────────────────────────┴───────────────────────┐   │
│  │                    Integrations                          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • SWIGS Hub (SSO)           • Twilio (SMS)               │   │
│  │ • Reserve with Google       • Stripe (pre-auth CB)       │   │
│  │ • Widget embed              • Google Places API          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Integration SWIGS Hub

```
┌────────────────────────────────────────────────────────────────┐
│                         SWIGS HUB                              │
│                   https://apps.swigs.online                    │
│                                                                │
│  1. User se connecte sur Hub (magic link)                      │
│  2. Click "ReserveTable" → Hub genere sso_token (60s)          │
│  3. Redirect vers reservetatable.ch?sso_token=xxx              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     ReserveTable                               │
│                https://reservetatable.ch                       │
│                                                                │
│  4. Frontend detecte ?sso_token dans URL                       │
│  5. POST /api/auth/sso-verify avec le token                    │
│  6. Backend verifie aupres du Hub                              │
│  7. Si valide → cree user local + session, retourne JWT        │
│  8. Frontend stocke token, user connecte                       │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Modeles de Donnees

```javascript
// User (proprietaire/staff)
{
  _id: ObjectId,
  hubUserId: String,          // Lien SWIGS Hub
  email: String,
  name: String,
  role: 'owner' | 'admin' | 'staff',
  restaurantIds: [ObjectId],  // Acces multi-restos
  preferences: {
    language: 'fr' | 'de' | 'en',
    timezone: String,
    notifications: { email: Boolean, push: Boolean }
  },
  isActive: Boolean,
  lastLogin: Date,
  createdAt, updatedAt
}

// Restaurant
{
  _id: ObjectId,
  ownerId: ObjectId,          // User proprietaire
  name: String,
  slug: String,               // URL unique widget
  description: String,

  // Contact
  address: { street, city, postalCode, canton, country },
  phone: String,
  email: String,
  website: String,

  // Config
  timezone: String,           // "Europe/Zurich"
  currency: String,           // "CHF"
  language: String,           // Langue par defaut emails

  // Reservation settings
  settings: {
    defaultDuration: Number,      // Minutes (ex: 90)
    maxPartySize: Number,         // Ex: 12
    minAdvanceBooking: Number,    // Heures minimum avant (ex: 2)
    maxAdvanceBooking: Number,    // Jours maximum avant (ex: 30)
    slotInterval: Number,         // Intervalle creneaux (ex: 15, 30)
    autoConfirm: Boolean,         // Confirmation automatique
    requirePhone: Boolean,        // Telephone obligatoire
    allowNotes: Boolean,          // Notes client autorisees
  },

  // Notifications
  notifications: {
    confirmationEmail: Boolean,
    reminderEmail: Boolean,
    reminderHours: [Number],      // Ex: [24, 2]
    reminderSms: Boolean,
    reviewRequestEmail: Boolean,  // Demande avis post-visite
    reviewRequestDelay: Number,   // Heures apres visite
  },

  // Integrations
  integrations: {
    googlePlaceId: String,
    tripAdvisorUrl: String,
    stripeAccountId: String,
  },

  // Branding widget
  branding: {
    primaryColor: String,
    logo: String,
    coverImage: String,
  },

  // Plan & billing
  plan: 'starter' | 'pro' | 'premium',
  billingCycle: 'monthly' | 'yearly',

  isActive: Boolean,
  createdAt, updatedAt
}

// Zone (plan de salle)
{
  _id: ObjectId,
  restaurantId: ObjectId,
  name: String,               // "Terrasse", "Salle principale", "Bar"
  order: Number,              // Ordre d'affichage
  isActive: Boolean,
  capacity: Number,           // Capacite totale zone
  availableForReservation: Boolean,
}

// Table
{
  _id: ObjectId,
  restaurantId: ObjectId,
  zoneId: ObjectId,
  name: String,               // "Table 1", "T-A"
  capacity: { min: Number, max: Number },

  // Position plan 2D
  position: { x: Number, y: Number },
  rotation: Number,           // Degres
  shape: 'rectangle' | 'circle' | 'square',
  size: { width: Number, height: Number },

  // Combinaison
  combinableWith: [ObjectId], // Tables combinables

  isActive: Boolean,
  order: Number,
  createdAt, updatedAt
}

// FloorElement (elements decoratifs)
{
  _id: ObjectId,
  restaurantId: ObjectId,
  zoneId: ObjectId,
  type: 'wall' | 'door' | 'window' | 'counter' | 'stairs' | 'plant' | 'custom',
  label: String,
  position: { x: Number, y: Number },
  size: { width: Number, height: Number },
  rotation: Number,
}

// OpeningHours
{
  _id: ObjectId,
  restaurantId: ObjectId,
  dayOfWeek: Number,          // 0-6 (Dimanche-Samedi)
  shifts: [{
    name: String,             // "Midi", "Soir"
    openTime: String,         // "11:30"
    closeTime: String,        // "14:00"
    lastBooking: String,      // "13:30"
    capacity: Number,         // Capacite specifique ce service (optionnel)
  }],
  isClosed: Boolean,
}

// SpecialDate (exceptions)
{
  _id: ObjectId,
  restaurantId: ObjectId,
  date: Date,
  type: 'closed' | 'modified' | 'special',
  shifts: [...],              // Si modified
  reason: String,             // "Fermeture annuelle", "Noel"
  isRecurring: Boolean,       // Chaque annee
}

// Guest (CRM)
{
  _id: ObjectId,
  restaurantId: ObjectId,

  // Contact
  firstName: String,
  lastName: String,
  email: String,
  phone: String,

  // Preferences
  language: String,
  allergies: [String],
  dietaryRestrictions: [String],
  preferences: String,        // Notes libres

  // Stats calculees
  stats: {
    totalReservations: Number,
    totalVisits: Number,        // Completed
    totalNoShows: Number,
    totalCancellations: Number,
    averagePartySize: Number,
    firstVisit: Date,
    lastVisit: Date,
  },

  // Fidelite
  tags: [String],             // "VIP", "Regulier", "Presse", "Difficile"
  vipScore: Number,           // Score fidelite calcule

  // Marketing
  marketingConsent: Boolean,

  // Notes staff
  internalNotes: String,

  createdAt, updatedAt
}

// Reservation
{
  _id: ObjectId,
  restaurantId: ObjectId,
  guestId: ObjectId,

  // Table(s) assignee(s)
  tableIds: [ObjectId],       // Peut etre plusieurs si combinaison

  // Timing
  date: Date,                 // YYYY-MM-DD
  time: String,               // "19:30"
  duration: Number,           // Minutes
  endTime: String,            // Calcule

  // Details
  partySize: Number,
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'noshow',
  source: 'widget' | 'google' | 'phone' | 'walkin' | 'manual',

  // Notes
  guestNotes: String,         // Notes du client
  internalNotes: String,      // Notes staff
  specialRequests: [String],  // Tags: "Anniversaire", "Chaise bebe"

  // Confirmation
  isConfirmed: Boolean,
  confirmedAt: Date,
  confirmationToken: String,  // Pour lien modification

  // No-show protection (v2)
  requiresDeposit: Boolean,
  depositAmount: Number,
  stripePaymentIntentId: String,
  depositStatus: 'pending' | 'captured' | 'released' | 'refunded',

  // Tracking
  createdBy: ObjectId,        // User qui a cree (si manuel)
  createdAt, updatedAt,
  cancelledAt: Date,
  cancelledBy: 'guest' | 'staff',
  cancelReason: String,
  seatedAt: Date,
  completedAt: Date,
}

// Notification (queue & log)
{
  _id: ObjectId,
  restaurantId: ObjectId,
  reservationId: ObjectId,
  guestId: ObjectId,

  type: 'confirmation' | 'reminder' | 'modification' | 'cancellation' | 'review_request',
  channel: 'email' | 'sms',

  // Contenu
  subject: String,
  content: String,            // HTML ou texte

  // Status
  status: 'pending' | 'sent' | 'failed' | 'bounced',
  scheduledFor: Date,
  sentAt: Date,
  error: String,

  // Tracking
  opens: Number,              // Email opens
  clicks: Number,             // Link clicks

  createdAt
}

// EmailLog (historique complet)
{
  _id: ObjectId,
  restaurantId: ObjectId,
  reservationId: ObjectId,
  guestId: ObjectId,
  notificationId: ObjectId,

  type: String,
  recipient: String,
  subject: String,
  status: String,
  sentAt: Date,

  // Pour debug
  messageId: String,          // ID provider
  provider: String,           // "nodemailer", "sendgrid"
}
```

### 4.4 Structure Projet

```
reservetatable/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── email.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Restaurant.js
│   │   │   ├── Zone.js
│   │   │   ├── Table.js
│   │   │   ├── FloorElement.js
│   │   │   ├── OpeningHours.js
│   │   │   ├── SpecialDate.js
│   │   │   ├── Guest.js
│   │   │   ├── Reservation.js
│   │   │   ├── Notification.js
│   │   │   └── EmailLog.js
│   │   ├── routes/
│   │   │   ├── auth.js           # SSO Hub
│   │   │   ├── restaurants.js
│   │   │   ├── zones.js
│   │   │   ├── tables.js
│   │   │   ├── floorElements.js
│   │   │   ├── openingHours.js
│   │   │   ├── reservations.js
│   │   │   ├── guests.js
│   │   │   ├── notifications.js
│   │   │   ├── stats.js
│   │   │   └── widget.js         # API publique widget
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── restaurantAccess.js
│   │   │   └── rateLimiter.js
│   │   ├── services/
│   │   │   ├── availability.js   # Calcul disponibilites
│   │   │   ├── email.js          # Nodemailer
│   │   │   ├── sms.js            # Twilio
│   │   │   ├── notifications.js  # Orchestration
│   │   │   └── stats.js          # Calculs stats
│   │   ├── jobs/
│   │   │   ├── reminders.js      # Cron rappels
│   │   │   └── reviewRequests.js # Cron demande avis
│   │   └── templates/
│   │       ├── confirmation.hbs
│   │       ├── reminder.hbs
│   │       ├── modification.hbs
│   │       ├── cancellation.hbs
│   │       └── reviewRequest.hbs
│   ├── server.js
│   ├── package.json
│   ├── ecosystem.config.cjs
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── SsoHandler.jsx
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── RestaurantSwitcher.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── TodayOverview.jsx
│   │   │   │   ├── StatsCards.jsx
│   │   │   │   ├── UpcomingReservations.jsx
│   │   │   │   └── OccupancyChart.jsx
│   │   │   ├── reservations/
│   │   │   │   ├── ReservationList.jsx
│   │   │   │   ├── ReservationForm.jsx
│   │   │   │   ├── ReservationCard.jsx
│   │   │   │   ├── ReservationDetail.jsx
│   │   │   │   ├── Timeline.jsx
│   │   │   │   └── CalendarView.jsx
│   │   │   ├── floor-plan/
│   │   │   │   ├── FloorPlan.jsx
│   │   │   │   ├── ZoneTabs.jsx
│   │   │   │   ├── TableNode.jsx
│   │   │   │   ├── FloorElementNode.jsx
│   │   │   │   ├── TableEditor.jsx
│   │   │   │   └── FloorPlanEditor.jsx
│   │   │   ├── guests/
│   │   │   │   ├── GuestList.jsx
│   │   │   │   ├── GuestProfile.jsx
│   │   │   │   ├── GuestHistory.jsx
│   │   │   │   └── GuestTags.jsx
│   │   │   ├── settings/
│   │   │   │   ├── RestaurantSettings.jsx
│   │   │   │   ├── OpeningHoursEditor.jsx
│   │   │   │   ├── SpecialDatesEditor.jsx
│   │   │   │   ├── NotificationSettings.jsx
│   │   │   │   ├── WidgetSettings.jsx
│   │   │   │   └── TeamSettings.jsx
│   │   │   └── stats/
│   │   │       ├── StatsOverview.jsx
│   │   │       └── EmailHistory.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Reservations.jsx
│   │   │   ├── FloorPlan.jsx
│   │   │   ├── Guests.jsx
│   │   │   ├── Stats.jsx
│   │   │   └── Settings.jsx
│   │   ├── stores/
│   │   │   ├── authStore.js
│   │   │   ├── restaurantStore.js
│   │   │   ├── reservationStore.js
│   │   │   └── floorPlanStore.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── hooks/
│   │   │   ├── useReservations.js
│   │   │   ├── useAvailability.js
│   │   │   └── useGuests.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── widget/                       # Widget embeddable
│   ├── src/
│   │   ├── Widget.jsx
│   │   ├── steps/
│   │   │   ├── DatePicker.jsx
│   │   │   ├── TimePicker.jsx
│   │   │   ├── GuestCount.jsx
│   │   │   ├── GuestInfo.jsx
│   │   │   └── Confirmation.jsx
│   │   └── embed.js
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 5. Interface Utilisateur

### 5.1 Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  ReserveTable    [Mon Restaurant ▼]         [FR ▼]  [User ▼]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────┐                                                     │
│  │ 🏠     │  Tableau de bord                 Aujourd'hui: Lun 6│
│  │ 📅     │  ───────────────────────────────────────────────── │
│  │ 🪑     │                                                     │
│  │ 👥     │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ 📊     │  │  18    │ │  86    │ │  2     │ │  94%   │       │
│  │ ⚙️     │  │ Resas  │ │Couverts│ │No-show │ │ Taux   │       │
│  │        │  │ auj.   │ │ sem.   │ │ mois   │ │confirm │       │
│  └────────┘  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Service midi    11:30 ████████████░░░░░░░░ 14:00        │   │
│  │ Service soir    18:00 ██████████████████░░░░ 22:00      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Prochaines reservations                    [+ Nouvelle resa]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 12:00 │ Dupont Jean    │ 4p │ Table 3  │ ● Confirme    │   │
│  │ 12:30 │ Martin Claire  │ 2p │ Table 1  │ ○ En attente  │   │
│  │ 19:00 │ Müller Hans    │ 6p │ T5+T6    │ ● Confirme    │   │
│  │ 19:30 │ Bernard Pierre │ 2p │ -        │ ○ A assigner  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Plan de Salle (Premium)

```
┌─────────────────────────────────────────────────────────────────┐
│  Plan de salle                              [Editer] [Zones ▼] │
├─────────────────────────────────────────────────────────────────┤
│  [Salle] [Terrasse] [Bar]                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     ┌─────┐                           ┌─────┐           │   │
│  │     │ T1  │   ┌─────┐                │ T5  │           │   │
│  │     │ 🟢  │   │ T2  │   ┌─────────┐  │ 🟠  │           │   │
│  │     │ 2-4 │   │ 🔵  │   │   T3    │  │ 4-6 │           │   │
│  │     └─────┘   │ 2   │   │   🔵    │  └─────┘           │   │
│  │               └─────┘   │   6-8   │                    │   │
│  │  ┌────────┐             └─────────┘   ┌─────┐          │   │
│  │  │ Entree │                          │ T6  │          │   │
│  │  └────────┘   ┌─────┐   ┌─────┐      │ 🟡  │          │   │
│  │               │ T4  │   │Comptoir    │ 2-4 │          │   │
│  │               │ 🟢  │   └─────┘      └─────┘          │   │
│  │               │ 2   │                                  │   │
│  │               └─────┘                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Legende: 🟢 Libre  🔵 Reserve  🟠 Occupe  🟡 Bientot libre    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Widget Client (Embed)

```
┌────────────────────────────────────────┐
│        Mon Restaurant                  │
│   Reserver une table                   │
├────────────────────────────────────────┤
│                                        │
│  Combien de personnes ?                │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │1 │ │2 │ │3 │ │4 │ │5 │ │6+│       │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘       │
│                                        │
│  Quelle date ?                         │
│  ┌────────────────────────────────┐   │
│  │  < Fevrier 2025 >              │   │
│  │  Lu Ma Me Je Ve Sa Di          │   │
│  │        1  2  3  4  5  6        │   │
│  │   7  8  9 [10] 11 12 13        │   │
│  │  14 15 16 17 18 19 20          │   │
│  └────────────────────────────────┘   │
│                                        │
│  Quelle heure ?                        │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │12:00 │ │12:30 │ │13:00 │          │
│  └──────┘ └──────┘ └──────┘          │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │19:00 │ │19:30 │ │20:00 │          │
│  └──────┘ └──────┘ └──────┘          │
│                                        │
│  ┌────────────────────────────────┐   │
│  │      Continuer →               │   │
│  └────────────────────────────────┘   │
│                                        │
│  Powered by ReserveTable              │
└────────────────────────────────────────┘
```

---

## 6. Roadmap de Developpement

### Phase 1 : MVP (5 semaines)

**Semaine 1 : Setup & Auth**
- [ ] Init repo `reservetatable`
- [ ] Setup backend (Express, MongoDB)
- [ ] Setup frontend (React, Vite, Tailwind)
- [ ] Integration SSO SWIGS Hub
- [ ] Modeles User, Restaurant, Session
- [ ] UI : Layout, Sidebar, Header

**Semaine 2 : Reservations Core**
- [ ] Modeles Table, Zone, OpeningHours, Guest, Reservation
- [ ] API CRUD Reservations
- [ ] Service calcul disponibilites
- [ ] UI : Liste reservations avec filtres
- [ ] UI : Formulaire creation reservation
- [ ] UI : Timeline journaliere

**Semaine 3 : Widget & Clients**
- [ ] Widget public de reservation (projet separe)
- [ ] API publique widget (sans auth)
- [ ] UI widget : selection date/heure/personnes
- [ ] UI widget : formulaire coordonnees
- [ ] Page confirmation client
- [ ] Lien modification/annulation

**Semaine 4 : Notifications**
- [ ] Service email (nodemailer + templates Handlebars)
- [ ] Emails confirmation automatique
- [ ] Emails modification/annulation
- [ ] Cron job rappels (24h, 2h avant)
- [ ] Historique emails envoyes
- [ ] UI : Parametres notifications

**Semaine 5 : Plan de salle & Stats**
- [ ] Plan 2D basique (visualisation tables)
- [ ] Statuts temps reel (libre/reserve/occupe)
- [ ] UI : Gestion tables et zones
- [ ] Dashboard stats (venues, annulations, taux)
- [ ] CRM : fiches clients avec historique
- [ ] Tests & bug fixes

### Phase 2 : Parite Piktable Pro (3 semaines)

**Semaine 6**
- [ ] Multi-utilisateurs (admin + staff)
- [ ] Permissions par role
- [ ] Combinaison tables grands groupes
- [ ] Demande avis post-visite (email auto)

**Semaine 7**
- [ ] Plan 2D interactif (React Flow, drag & drop)
- [ ] Elements decoratifs (portes, murs, comptoir)
- [ ] Echange tables en un clic
- [ ] Gestion horaires speciaux/fermetures

**Semaine 8**
- [ ] SMS notifications (Twilio)
- [ ] Client : partage reservation
- [ ] Export CSV (reservations, clients)
- [ ] Widget : personnalisation couleurs/logo

### Phase 3 : Premium + Avantages (4 semaines)

**Semaine 9-10**
- [ ] Multi-etablissements natif
- [ ] Vue groupe (stats agregees)
- [ ] Switch restaurant dans header

**Semaine 11-12**
- [ ] Reserve with Google (integration)
- [ ] Pre-autorisation CB (Stripe)
- [ ] Politique no-show configurable
- [ ] PWA mobile responsive

---

## 7. Deploiement

### 7.1 Serveur .59

| Element | Valeur |
|---------|--------|
| **Backend** | `~/reservetatable/backend/` |
| **Frontend** | `/var/www/reservetatable/` |
| **Port** | `3005` |
| **PM2 Name** | `reservetatable` |
| **URL** | `https://reservetatable.ch` |
| **MongoDB** | `mongodb://localhost:27017/reservetatable` |

### 7.2 Variables Environnement

```env
# Server
NODE_ENV=production
PORT=3004

# Database
MONGODB_URI=mongodb://localhost:27017/reservetatable

# SWIGS Hub SSO
HUB_URL=https://apps.swigs.online
APP_ID=reservetatable
APP_SECRET=reservetatable_secret_change_in_production

# JWT
JWT_SECRET=GENERER_SECURISE_64_BYTES
JWT_EXPIRE=7d

# Email (SWIGS)
SMTP_HOST=mail.infomaniak.com
SMTP_PORT=587
SMTP_USER=noreply@reservetatable.ch
SMTP_PASS=xxx
EMAIL_FROM="ReserveTable <noreply@reservetatable.ch>"

# SMS (optionnel)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Stripe (v2)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Google (v3)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 7.3 DNS & Domaine

- Acheter `reservetatable.ch` (ou .online)
- Configurer A record → 192.168.110.59
- Certbot SSL

---

## 8. Modele Commercial

### 8.1 Tarification (Inspire Piktable)

| Plan | Abonnement | Commission | Plafond | Cible |
|------|------------|------------|---------|-------|
| **Starter** | 10 CHF/mois | 0.50 CHF/resa | 99 CHF | Petits etablissements |
| **Pro** | 20 CHF/mois | 1 CHF/resa | 99 CHF | Restaurants standards |
| **Premium** | 40 CHF/mois | 1 CHF/resa | 149 CHF | Multi-zones, gros volume |

**Avantages :**
- -20% en facturation annuelle
- 1 mois gratuit d'essai (sans CB)
- Plafond garanti = securite pour le client

### 8.2 Features par Plan

| Feature | Starter | Pro | Premium |
|---------|:-------:|:---:|:-------:|
| Widget reservation | ✅ | ✅ | ✅ |
| Calendrier reservations | ✅ | ✅ | ✅ |
| Gestion tables | ✅ | ✅ | ✅ |
| Fiches clients + historique | ✅ | ✅ | ✅ |
| Emails automatiques | ✅ | ✅ | ✅ |
| Stats basiques | ✅ | ✅ | ✅ |
| Plan 2D basique | ✅ | ✅ | ✅ |
| Rappels email | - | ✅ | ✅ |
| Demande avis Google | - | ✅ | ✅ |
| Multi-utilisateurs | - | ✅ | ✅ |
| Combinaison tables | - | ✅ | ✅ |
| Historique emails | - | ✅ | ✅ |
| Plan 2D interactif | - | - | ✅ |
| Multi-zones | - | - | ✅ |
| Rappels SMS | - | - | ✅ |
| Support prioritaire | - | - | ✅ |

---

## 9. Checklist Parite Piktable

### Features Piktable → ReserveTable

| Feature Piktable | Status | Version |
|------------------|--------|---------|
| Widget/lien reservation | 🔲 | MVP |
| Gestion tables et capacites | 🔲 | MVP |
| Creneaux horaires personnalisables | 🔲 | MVP |
| Fiches clients | 🔲 | MVP |
| Historique et fidelite clients | 🔲 | MVP |
| Stats de base | 🔲 | MVP |
| Emails automatiques | 🔲 | MVP |
| Emails confirmation/rappel/suivi | 🔲 | MVP |
| Demande avis Google/TripAdvisor | 🔲 | v1.1 |
| Multi-utilisateurs | 🔲 | v1.1 |
| Combinaison tables | 🔲 | v1.1 |
| Historique emails | 🔲 | v1.1 |
| Plan 2D basique | 🔲 | MVP |
| Plan 2D interactif drag & drop | 🔲 | v2.0 |
| Multi-zones | 🔲 | v2.0 |
| Elements decoratifs | 🔲 | v2.0 |
| Echange tables | 🔲 | v2.0 |
| Client : modifier/annuler en 1 clic | 🔲 | MVP |
| Client : copier/partager resa | 🔲 | v1.1 |
| Vue calendrier (jour/heure/client) | 🔲 | MVP |
| Statut tables temps reel | 🔲 | MVP |
| Configuration en 5 min | 🔲 | MVP |
| Assistant IA | 🔲 | v3.0 |

---

## 10. Prochaines Etapes

1. **Validation** : Confirmer ce document ✅/❌
2. **Domaine** : Acheter reservetatable.ch
3. **Init** : Creer repo GitHub `swigsstaking/reservetatable`
4. **Sprint 1** : Setup + Auth SSO

---

## Sources

- [Piktable](https://piktable.ch/) - Concurrent direct, analyse complete
- [MyLOCALINA](https://www.mylocalina.ch/) - #1 Suisse
- [aleno](https://www.aleno.me/en/) - Swiss, IA
- [TheFork Manager](https://www.theforkmanager.com/en/) - Features 2025
- [OpenTable](https://www.opentable.com/restaurant-solutions/) - Leader mondial
- [Zenchef](https://www.zenchef.com/) - Zero commission

---

**Version** : 2.0
**Date** : Fevrier 2025
**Nom** : ReserveTable
