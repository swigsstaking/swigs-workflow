import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Invoice Schema (simplified for seeding)
const invoiceSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  number: String,
  events: [{
    description: String,
    type: String,
    hours: Number,
    hourlyRate: Number,
    amount: Number,
    date: Date
  }],
  quotes: [],
  subtotal: Number,
  vatRate: Number,
  vatAmount: Number,
  total: Number,
  status: String,
  issueDate: Date,
  dueDate: Date,
  paidAt: Date,
  notes: String
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

// Project IDs from the database
const projects = [
  { id: '697ce3b228e72c65348de666', client: 'GTS Global Trade Services Sarl' },
  { id: '697ce3b228e72c65348de668', client: 'SkiMax Sports' },
  { id: '697ce3b228e72c65348de669', client: 'ADLR Sàrl' },
  { id: '697ce3b228e72c65348de66a', client: 'Moontain Studio' },
  { id: '697ce3b228e72c65348de66b', client: 'Kozelsky Sàrl' },
  { id: '697ce3b228e72c65348de66c', client: 'A.N.S.R. SA' },
  { id: '697ce3b228e72c65348de66d', client: 'Richert & Associés SNC' }
];

// Test invoices data
const testInvoices = [
  // August 2025 - 2 paid invoices
  {
    projectIdx: 0, // GTS
    number: 'TEST-2025-001',
    subtotal: 4500,
    status: 'paid',
    issueDate: new Date('2025-08-15'),
    paidAt: new Date('2025-08-28'),
    description: 'Développement site ARMIS PRO'
  },
  {
    projectIdx: 1, // SkiMax
    number: 'TEST-2025-002',
    subtotal: 3200,
    status: 'paid',
    issueDate: new Date('2025-08-22'),
    paidAt: new Date('2025-09-05'),
    description: 'Création site web SkiMax'
  },

  // September 2025 - 3 invoices
  {
    projectIdx: 2, // ADLR
    number: 'TEST-2025-003',
    subtotal: 5800,
    status: 'paid',
    issueDate: new Date('2025-09-10'),
    paidAt: new Date('2025-09-25'),
    description: 'Site web ADLR - Phase 1'
  },
  {
    projectIdx: 3, // Moontain
    number: 'TEST-2025-004',
    subtotal: 2100,
    status: 'paid',
    issueDate: new Date('2025-09-18'),
    paidAt: new Date('2025-10-02'),
    description: 'Maintenance mensuelle'
  },
  {
    projectIdx: 0, // GTS
    number: 'TEST-2025-005',
    subtotal: 1500,
    status: 'paid',
    issueDate: new Date('2025-09-28'),
    paidAt: new Date('2025-10-10'),
    description: 'Support technique'
  },

  // October 2025 - 4 invoices
  {
    projectIdx: 4, // Kozelsky
    number: 'TEST-2025-006',
    subtotal: 6200,
    status: 'paid',
    issueDate: new Date('2025-10-05'),
    paidAt: new Date('2025-10-20'),
    description: 'Développement site Kozelsky'
  },
  {
    projectIdx: 5, // A.N.S.R.
    number: 'TEST-2025-007',
    subtotal: 4800,
    status: 'paid',
    issueDate: new Date('2025-10-12'),
    paidAt: new Date('2025-10-28'),
    description: 'Site web A.N.S.R. - Développement'
  },
  {
    projectIdx: 2, // ADLR
    number: 'TEST-2025-008',
    subtotal: 3500,
    status: 'paid',
    issueDate: new Date('2025-10-20'),
    paidAt: new Date('2025-11-05'),
    description: 'Site web ADLR - Phase 2'
  },
  {
    projectIdx: 3, // Moontain
    number: 'TEST-2025-009',
    subtotal: 2100,
    status: 'paid',
    issueDate: new Date('2025-10-28'),
    paidAt: new Date('2025-11-10'),
    description: 'Maintenance mensuelle'
  },

  // November 2025 - 3 invoices
  {
    projectIdx: 6, // Richert
    number: 'TEST-2025-010',
    subtotal: 7500,
    status: 'paid',
    issueDate: new Date('2025-11-08'),
    paidAt: new Date('2025-11-22'),
    description: 'Site web Richert & Associés'
  },
  {
    projectIdx: 0, // GTS
    number: 'TEST-2025-011',
    subtotal: 2800,
    status: 'paid',
    issueDate: new Date('2025-11-15'),
    paidAt: new Date('2025-11-30'),
    description: 'Évolutions ARMIS PRO'
  },
  {
    projectIdx: 1, // SkiMax
    number: 'TEST-2025-012',
    subtotal: 1800,
    status: 'paid',
    issueDate: new Date('2025-11-25'),
    paidAt: new Date('2025-12-10'),
    description: 'Optimisations SEO'
  },

  // December 2025 - 4 invoices
  {
    projectIdx: 2, // ADLR
    number: 'TEST-2025-013',
    subtotal: 4200,
    status: 'paid',
    issueDate: new Date('2025-12-05'),
    paidAt: new Date('2025-12-20'),
    description: 'Site web ADLR - Phase finale'
  },
  {
    projectIdx: 4, // Kozelsky
    number: 'TEST-2025-014',
    subtotal: 3100,
    status: 'paid',
    issueDate: new Date('2025-12-10'),
    paidAt: new Date('2025-12-28'),
    description: 'Fonctionnalités e-commerce'
  },
  {
    projectIdx: 3, // Moontain
    number: 'TEST-2025-015',
    subtotal: 2100,
    status: 'paid',
    issueDate: new Date('2025-12-18'),
    paidAt: new Date('2026-01-05'),
    description: 'Maintenance mensuelle'
  },
  {
    projectIdx: 5, // A.N.S.R.
    number: 'TEST-2025-016',
    subtotal: 2500,
    status: 'paid',
    issueDate: new Date('2025-12-22'),
    paidAt: new Date('2026-01-08'),
    description: 'Support et corrections'
  },

  // January 2026 - 3 invoices (current month - some pending)
  {
    projectIdx: 0, // GTS
    number: 'TEST-2026-001',
    subtotal: 5500,
    status: 'paid',
    issueDate: new Date('2026-01-10'),
    paidAt: new Date('2026-01-25'),
    description: 'Nouveau module ARMIS'
  },
  {
    projectIdx: 6, // Richert
    number: 'TEST-2026-002',
    subtotal: 3800,
    status: 'sent',
    issueDate: new Date('2026-01-18'),
    paidAt: null,
    description: 'Maintenance et évolutions'
  },
  {
    projectIdx: 1, // SkiMax
    number: 'TEST-2026-003',
    subtotal: 2200,
    status: 'sent',
    issueDate: new Date('2026-01-25'),
    paidAt: null,
    description: 'Nouvelle saison hiver'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing test invoices
    const deleted = await Invoice.deleteMany({ number: /^TEST-/ });
    console.log(`Deleted ${deleted.deletedCount} existing test invoices`);

    // Create new test invoices
    const vatRate = 8.1; // Swiss VAT

    for (const inv of testInvoices) {
      const vatAmount = Math.round(inv.subtotal * vatRate) / 100;
      const total = inv.subtotal + vatAmount;
      const dueDate = new Date(inv.issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice = new Invoice({
        project: new mongoose.Types.ObjectId(projects[inv.projectIdx].id),
        number: inv.number,
        events: [{
          description: inv.description,
          type: 'hours',
          hours: Math.round(inv.subtotal / 120), // Assuming 120 CHF/hour
          hourlyRate: 120,
          amount: inv.subtotal,
          date: inv.issueDate
        }],
        quotes: [],
        subtotal: inv.subtotal,
        vatRate: vatRate,
        vatAmount: vatAmount,
        total: total,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: dueDate,
        paidAt: inv.paidAt,
        notes: `Facture de test - ${projects[inv.projectIdx].client}`
      });

      await invoice.save();
      console.log(`Created: ${inv.number} - ${inv.subtotal} CHF (${inv.status})`);
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log(`Total test invoices created: ${testInvoices.length}`);

    // Summary by month
    console.log('\nSummary by month:');
    console.log('- Aug 2025: 2 invoices, 7,700 CHF');
    console.log('- Sep 2025: 3 invoices, 9,400 CHF');
    console.log('- Oct 2025: 4 invoices, 16,600 CHF');
    console.log('- Nov 2025: 3 invoices, 12,100 CHF');
    console.log('- Dec 2025: 4 invoices, 11,900 CHF');
    console.log('- Jan 2026: 3 invoices, 11,500 CHF');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seed();
