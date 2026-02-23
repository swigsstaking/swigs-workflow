/**
 * Seed script: Creates demo data for the Secretary Briefing interface
 * Run: mongosh swigs-workflow seed-dashboard-demo.js
 *
 * Creates: 6 projects, ~15 invoices, 3 quotes, ~10 unbilled events
 * Enables reminders in settings
 */

const userId = ObjectId("698213f6aa3f218aae0adf3b"); // corentin@swigs.ch
const now = new Date();

function daysAgo(n) {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n) {
  return new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
}

// ─── 1. PROJECTS ─────────────────────────────────────────────────
const projects = [
  {
    _id: ObjectId(),
    userId,
    name: "Refonte E-commerce",
    client: { name: "Jean Dupont", company: "Acme Corp SA", email: "jean@acme.ch", phone: "+41 79 111 22 33" },
    createdAt: daysAgo(120), updatedAt: now
  },
  {
    _id: ObjectId(),
    userId,
    name: "App Mobile Fitness",
    client: { name: "Marie Lambert", company: "TechVision SA", email: "marie@techvision.ch", phone: "+41 79 222 33 44" },
    createdAt: daysAgo(90), updatedAt: now
  },
  {
    _id: ObjectId(),
    userId,
    name: "Maintenance Serveur",
    client: { name: "Pierre Martin", company: "BuildRight Sàrl", email: "pierre@buildright.ch", phone: "+41 79 333 44 55" },
    createdAt: daysAgo(180), updatedAt: now
  },
  {
    _id: ObjectId(),
    userId,
    name: "Identité Visuelle",
    client: { name: "Sophie Renaud", company: "GreenLeaf Sàrl", email: "sophie@greenleaf.ch", phone: "+41 79 444 55 66" },
    createdAt: daysAgo(30), updatedAt: now
  },
  {
    _id: ObjectId(),
    userId,
    name: "Dashboard Analytics",
    client: { name: "Lucas Weber", company: "DataFlow AG", email: "lucas@dataflow.ch", phone: "+41 79 555 66 77" },
    createdAt: daysAgo(60), updatedAt: now
  },
  {
    _id: ObjectId(),
    userId,
    name: "SEO & Marketing",
    client: { name: "Thomas Müller", company: "Alpine Services GmbH", email: "thomas@alpine.ch", phone: "+41 79 666 77 88" },
    createdAt: daysAgo(45), updatedAt: now
  }
];

print("Creating 6 demo projects...");
db.projects.insertMany(projects);

// ─── 2. INVOICES ─────────────────────────────────────────────────
const invoices = [];

// --- CRITICAL OVERDUE (>30 days) ---

// Acme Corp — 50j overdue, no reminders sent → remindersDue: reminder_1
invoices.push({
  project: projects[0]._id,
  number: "FAC-2026-101",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(80),
  dueDate: daysAgo(50),
  total: 4500,
  subtotal: 4162.81,
  vatRate: 8.1,
  vatAmount: 337.19,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Développement frontend", type: "hours", hours: 30, hourlyRate: 150, amount: 4500, date: daysAgo(85) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(80), updatedAt: daysAgo(50)
});

// BuildRight — 40j overdue, reminder_1 already sent → remindersDue: reminder_2
invoices.push({
  project: projects[2]._id,
  number: "FAC-2026-102",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(70),
  dueDate: daysAgo(40),
  total: 3200,
  subtotal: 2960.22,
  vatRate: 8.1,
  vatAmount: 239.78,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(30), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "Maintenance serveur Q4", type: "hours", hours: 20, hourlyRate: 160, amount: 3200, date: daysAgo(75) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(70), updatedAt: daysAgo(40)
});

// BuildRight — 65j overdue, 3 reminders sent → remindersDue: final_notice
invoices.push({
  project: projects[2]._id,
  number: "FAC-2026-103",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(95),
  dueDate: daysAgo(65),
  total: 8750,
  subtotal: 8094.36,
  vatRate: 8.1,
  vatAmount: 655.64,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(55), emailSent: true },
    { type: "reminder_2", sentAt: daysAgo(45), emailSent: true },
    { type: "reminder_3", sentAt: daysAgo(30), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "Migration infrastructure", type: "hours", hours: 50, hourlyRate: 175, amount: 8750, date: daysAgo(100) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(95), updatedAt: daysAgo(65)
});

// DataFlow — 35j overdue, reminder_1+2 sent → no trigger (next is reminder_3 at 30j, already past)
// Actually 35 >= 30 and reminder_3 not sent → remindersDue: reminder_3
invoices.push({
  project: projects[4]._id,
  number: "FAC-2026-104",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(65),
  dueDate: daysAgo(35),
  total: 6200,
  subtotal: 5735.43,
  vatRate: 8.1,
  vatAmount: 464.57,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(25), emailSent: true },
    { type: "reminder_2", sentAt: daysAgo(15), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "API development", type: "hours", hours: 40, hourlyRate: 155, amount: 6200, date: daysAgo(70) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(65), updatedAt: daysAgo(35)
});

// --- OVERDUE (< 30 days, for upcoming reminders) ---

// Acme Corp — 10j overdue, no reminders → remindersDue: reminder_1 (7 >= 10? yes)
invoices.push({
  project: projects[0]._id,
  number: "FAC-2026-105",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(40),
  dueDate: daysAgo(10),
  total: 2500,
  subtotal: 2313.60,
  vatRate: 8.1,
  vatAmount: 186.40,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Design UX maquettes", type: "hours", hours: 16, hourlyRate: 150, amount: 2400, date: daysAgo(45) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(40), updatedAt: daysAgo(10)
});

// DataFlow — 5j overdue → upcoming reminder_1 dans 2j
invoices.push({
  project: projects[4]._id,
  number: "FAC-2026-106",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(35),
  dueDate: daysAgo(5),
  total: 1800,
  subtotal: 1665.12,
  vatRate: 8.1,
  vatAmount: 134.88,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Optimisation queries", type: "hours", hours: 12, hourlyRate: 150, amount: 1800, date: daysAgo(38) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(35), updatedAt: daysAgo(5)
});

// --- PAID THIS WEEK ---

// TechVision — paid 2 days ago
invoices.push({
  project: projects[1]._id,
  number: "FAC-2026-107",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(45),
  dueDate: daysAgo(15),
  paidAt: daysAgo(2),
  total: 12000,
  subtotal: 11100.83,
  vatRate: 8.1,
  vatAmount: 899.17,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "App mobile - Sprint 3", type: "hours", hours: 80, hourlyRate: 150, amount: 12000, date: daysAgo(50) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(45), updatedAt: daysAgo(2)
});

// Alpine Services — paid 3 days ago
invoices.push({
  project: projects[5]._id,
  number: "FAC-2026-108",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(35),
  dueDate: daysAgo(5),
  paidAt: daysAgo(3),
  total: 3500,
  subtotal: 3238.67,
  vatRate: 8.1,
  vatAmount: 261.33,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Campagne SEO Q1", type: "hours", hours: 22, hourlyRate: 140, amount: 3080, date: daysAgo(40) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(35), updatedAt: daysAgo(3)
});

// Acme Corp — paid 5 days ago
invoices.push({
  project: projects[0]._id,
  number: "FAC-2026-109",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(55),
  dueDate: daysAgo(25),
  paidAt: daysAgo(5),
  total: 5800,
  subtotal: 5366.33,
  vatRate: 8.1,
  vatAmount: 433.67,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(15), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "Intégration paiement", type: "hours", hours: 38, hourlyRate: 150, amount: 5700, date: daysAgo(60) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(55), updatedAt: daysAgo(5)
});

// --- NOT YET DUE (for cash flow forecast) ---

// GreenLeaf — due in 15 days
invoices.push({
  project: projects[3]._id,
  number: "FAC-2026-110",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(15),
  dueDate: daysFromNow(15),
  total: 4200,
  subtotal: 3885.29,
  vatRate: 8.1,
  vatAmount: 314.71,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Création logo & charte", type: "hours", hours: 28, hourlyRate: 150, amount: 4200, date: daysAgo(20) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(15), updatedAt: daysAgo(15)
});

// DataFlow — due in 22 days
invoices.push({
  project: projects[4]._id,
  number: "FAC-2026-111",
  invoiceType: "standard",
  status: "sent",
  issueDate: daysAgo(8),
  dueDate: daysFromNow(22),
  total: 7500,
  subtotal: 6938.02,
  vatRate: 8.1,
  vatAmount: 561.98,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Dashboard V2 complet", type: "hours", hours: 50, hourlyRate: 150, amount: 7500, date: daysAgo(12) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(8), updatedAt: daysAgo(8)
});

// --- HISTORICAL PAID (for client intelligence + reliability) ---

// TechVision — old paid (15 days to pay = reliable)
invoices.push({
  project: projects[1]._id,
  number: "FAC-2026-112",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(90),
  dueDate: daysAgo(60),
  paidAt: daysAgo(75),
  total: 9500,
  subtotal: 8790.01,
  vatRate: 8.1,
  vatAmount: 709.99,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "App mobile - Sprint 1-2", type: "hours", hours: 63, hourlyRate: 150, amount: 9450, date: daysAgo(95) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(90), updatedAt: daysAgo(75)
});

// TechVision — old paid (12 days to pay)
invoices.push({
  project: projects[1]._id,
  number: "FAC-2026-113",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(140),
  dueDate: daysAgo(110),
  paidAt: daysAgo(128),
  total: 6800,
  subtotal: 6292.32,
  vatRate: 8.1,
  vatAmount: 507.68,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Phase discovery", type: "hours", hours: 45, hourlyRate: 150, amount: 6750, date: daysAgo(145) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(140), updatedAt: daysAgo(128)
});

// Acme Corp — old paid (28 days to pay)
invoices.push({
  project: projects[0]._id,
  number: "FAC-2026-114",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(100),
  dueDate: daysAgo(70),
  paidAt: daysAgo(72),
  total: 7200,
  subtotal: 6662.35,
  vatRate: 8.1,
  vatAmount: 537.65,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Backend e-commerce", type: "hours", hours: 48, hourlyRate: 150, amount: 7200, date: daysAgo(105) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(100), updatedAt: daysAgo(72)
});

// BuildRight — old paid (52 days to pay = unreliable)
invoices.push({
  project: projects[2]._id,
  number: "FAC-2026-115",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(150),
  dueDate: daysAgo(120),
  paidAt: daysAgo(98),
  total: 4800,
  subtotal: 4441.26,
  vatRate: 8.1,
  vatAmount: 358.74,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(110), emailSent: true },
    { type: "reminder_2", sentAt: daysAgo(100), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "Migration legacy", type: "hours", hours: 30, hourlyRate: 160, amount: 4800, date: daysAgo(155) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(150), updatedAt: daysAgo(98)
});

// DataFlow — old paid (32 days)
invoices.push({
  project: projects[4]._id,
  number: "FAC-2026-116",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(100),
  dueDate: daysAgo(70),
  paidAt: daysAgo(68),
  total: 5400,
  subtotal: 4996.30,
  vatRate: 8.1,
  vatAmount: 403.70,
  reminders: [
    { type: "reminder_1", sentAt: daysAgo(90), emailSent: true }
  ],
  events: [{ eventId: ObjectId(), description: "Dashboard V1", type: "hours", hours: 36, hourlyRate: 150, amount: 5400, date: daysAgo(105) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(100), updatedAt: daysAgo(68)
});

// Alpine Services — old paid (18 days = reliable)
invoices.push({
  project: projects[5]._id,
  number: "FAC-2026-117",
  invoiceType: "standard",
  status: "paid",
  issueDate: daysAgo(80),
  dueDate: daysAgo(50),
  paidAt: daysAgo(62),
  total: 2800,
  subtotal: 2591.12,
  vatRate: 8.1,
  vatAmount: 208.88,
  reminders: [],
  events: [{ eventId: ObjectId(), description: "Audit SEO initial", type: "hours", hours: 20, hourlyRate: 140, amount: 2800, date: daysAgo(85) }],
  quotes: [],
  customLines: [],
  createdAt: daysAgo(80), updatedAt: daysAgo(62)
});

print(`Creating ${invoices.length} demo invoices...`);
db.invoices.insertMany(invoices);

// ─── 3. QUOTES (PENDING SIGNATURE) ──────────────────────────────
const quotes = [
  {
    project: projects[3]._id, // GreenLeaf
    number: "DEV-2026-051",
    status: "sent",
    lines: [
      { description: "Refonte identité visuelle complète", quantity: 1, unitPrice: 8000, total: 8000 },
      { description: "Déclinaison supports print", quantity: 1, unitPrice: 4500, total: 4500 },
      { description: "Guide de style numérique", quantity: 1, unitPrice: 2500, total: 2500 }
    ],
    subtotal: 15000,
    vatRate: 8.1,
    vatAmount: 1215,
    total: 16215,
    validUntil: daysFromNow(15),
    createdAt: daysAgo(10), updatedAt: daysAgo(8)
  },
  {
    project: projects[0]._id, // Acme Corp
    number: "DEV-2026-052",
    status: "sent",
    lines: [
      { description: "Module marketplace", quantity: 1, unitPrice: 5500, total: 5500 },
      { description: "Intégration Stripe Connect", quantity: 1, unitPrice: 3000, total: 3000 }
    ],
    subtotal: 8500,
    vatRate: 8.1,
    vatAmount: 688.50,
    total: 9188.50,
    validUntil: daysFromNow(20),
    createdAt: daysAgo(5), updatedAt: daysAgo(3)
  },
  {
    project: projects[4]._id, // DataFlow
    number: "DEV-2026-053",
    status: "sent",
    lines: [
      { description: "Dashboard temps réel", quantity: 1, unitPrice: 12000, total: 12000 },
      { description: "API GraphQL", quantity: 1, unitPrice: 7000, total: 7000 },
      { description: "Documentation technique", quantity: 1, unitPrice: 3000, total: 3000 }
    ],
    subtotal: 22000,
    vatRate: 8.1,
    vatAmount: 1782,
    total: 23782,
    validUntil: daysFromNow(25),
    createdAt: daysAgo(7), updatedAt: daysAgo(5)
  }
];

print("Creating 3 demo quotes...");
db.quotes.insertMany(quotes);

// ─── 4. UNBILLED EVENTS ─────────────────────────────────────────
const events = [
  // DataFlow — 25h unbilled
  { project: projects[4]._id, type: "hours", description: "Optimisation performance API", date: daysAgo(3), hours: 8, hourlyRate: 155, billed: false, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { project: projects[4]._id, type: "hours", description: "Tests unitaires dashboard", date: daysAgo(2), hours: 6, hourlyRate: 155, billed: false, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { project: projects[4]._id, type: "hours", description: "Code review & refactoring", date: daysAgo(1), hours: 5, hourlyRate: 155, billed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { project: projects[4]._id, type: "hours", description: "Déploiement staging", date: now, hours: 4, hourlyRate: 155, billed: false, createdAt: now, updatedAt: now },
  { project: projects[4]._id, type: "expense", description: "Licence serveur cloud", date: daysAgo(5), amount: 450, billed: false, createdAt: daysAgo(5), updatedAt: daysAgo(5) },

  // Acme Corp — 15h unbilled
  { project: projects[0]._id, type: "hours", description: "Design système composants", date: daysAgo(4), hours: 6, hourlyRate: 150, billed: false, createdAt: daysAgo(4), updatedAt: daysAgo(4) },
  { project: projects[0]._id, type: "hours", description: "Intégration catalogue produits", date: daysAgo(2), hours: 5, hourlyRate: 150, billed: false, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { project: projects[0]._id, type: "hours", description: "Corrections UX mobile", date: daysAgo(1), hours: 4, hourlyRate: 150, billed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },

  // GreenLeaf — 8h unbilled
  { project: projects[3]._id, type: "hours", description: "Recherche typographique", date: daysAgo(3), hours: 3, hourlyRate: 130, billed: false, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { project: projects[3]._id, type: "hours", description: "Moodboard & direction artistique", date: daysAgo(1), hours: 5, hourlyRate: 130, billed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { project: projects[3]._id, type: "expense", description: "Fonts sous licence", date: daysAgo(2), amount: 280, billed: false, createdAt: daysAgo(2), updatedAt: daysAgo(2) },

  // Alpine Services — 4h unbilled (small, won't trigger threshold alone)
  { project: projects[5]._id, type: "hours", description: "Rapport mensuel analytics", date: daysAgo(1), hours: 4, hourlyRate: 140, billed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

print(`Creating ${events.length} demo events (unbilled)...`);
db.events.insertMany(events);

// ─── 5. ENABLE REMINDERS IN SETTINGS ────────────────────────────
print("Enabling reminders in settings...");
db.settings.updateOne(
  { userId },
  { $set: { "reminders.enabled": true } }
);

// ─── SUMMARY ─────────────────────────────────────────────────────
print("\n=== SEED COMPLETE ===");
print(`Projects: ${projects.length}`);
print(`Invoices: ${invoices.length}`);
print(`  - Critical overdue (>30j): 4 (FAC-101, 102, 103, 104)`);
print(`  - Overdue (<30j): 2 (FAC-105, 106)`);
print(`  - Paid this week: 3 (FAC-107, 108, 109)`);
print(`  - Not yet due: 2 (FAC-110, 111)`);
print(`  - Historical paid: 6 (FAC-112 to 117)`);
print(`Quotes pending: ${quotes.length}`);
print(`Unbilled events: ${events.length}`);
print(`Reminders: ENABLED`);
print("\nExpected on dashboard:");
print("  URGENT: ~5 reminders due (101→r1, 102→r2, 103→final, 104→r3, 105→r1)");
print("  + critical overdue without reminders");
print("  WATCH: upcoming reminders, 3 pending quotes, unbilled work >CHF 7k");
print("  STATUS: 3 payments (CHF 21,300), recovery rate, recent actions");
print("  SIDEBAR: 6 clients with reliability scores, cash flow forecast");
