import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'SWIGS'
  },
  address: {
    type: String,
    default: ''
  },
  siret: {
    type: String,
    default: ''
  },
  vatNumber: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: null
  },
  iban: {
    type: String,
    default: ''
  },
  qrIban: {
    type: String,
    default: ''
  }
}, { _id: false });

const invoicingSchema = new mongoose.Schema({
  invoicePrefix: {
    type: String,
    default: 'FAC-'
  },
  quotePrefix: {
    type: String,
    default: 'DEV-'
  },
  defaultVatRate: {
    type: Number,
    default: 8.1,
    min: 0,
    max: 100
  },
  defaultPaymentTerms: {
    type: Number,
    default: 30
  },
  defaultHourlyRate: {
    type: Number,
    default: 50
  }
}, { _id: false });

const personalizationSchema = new mongoose.Schema({
  cardStyle: {
    type: String,
    enum: ['left-border', 'full-border'],
    default: 'left-border'
  },
  cardSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  }
}, { _id: false });

const emailTemplatesSchema = new mongoose.Schema({
  quoteSubject: {
    type: String,
    default: 'Devis {number} - {projectName}'
  },
  quoteBody: {
    type: String,
    default: 'Bonjour {clientName},\n\nVeuillez trouver ci-joint le devis {number} d\'un montant de {total} CHF.\n\nN\'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{companyName}'
  },
  invoiceSubject: {
    type: String,
    default: 'Facture {number} - {projectName}'
  },
  invoiceBody: {
    type: String,
    default: 'Bonjour {clientName},\n\nVeuillez trouver ci-joint la facture {number} d\'un montant de {total} CHF.\n\nMerci de procéder au règlement dans un délai de {paymentTerms} jours.\n\nCordialement,\n{companyName}'
  }
}, { _id: false });

const cmsIntegrationSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  apiUrl: {
    type: String,
    default: ''
  },
  serviceToken: {
    type: String,
    default: ''
  },
  pollInterval: {
    type: Number,
    default: 60000,
    min: 30000
  },
  lastPolledAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const smtpSchema = new mongoose.Schema({
  host: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 587
  },
  secure: {
    type: Boolean,
    default: false
  },
  user: {
    type: String,
    default: ''
  },
  pass: {
    type: String,
    default: ''
  }
}, { _id: false });

const reminderScheduleSchema = new mongoose.Schema({
  days: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['reminder_1', 'reminder_2', 'reminder_3', 'final_notice'],
    required: true
  },
  subject: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    default: ''
  }
}, { _id: false });

const remindersSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  schedule: {
    type: [reminderScheduleSchema],
    default: [
      {
        days: 7,
        type: 'reminder_1',
        subject: 'Rappel : Facture {number} échue',
        body: 'Bonjour {clientName},\n\nNous vous rappelons que la facture {number} d\'un montant de {total} CHF est échue depuis le {dueDate}.\n\nMerci de procéder au règlement.\n\nCordialement,\n{companyName}'
      },
      {
        days: 14,
        type: 'reminder_2',
        subject: '2ème rappel : Facture {number}',
        body: 'Bonjour {clientName},\n\nMalgré notre précédent rappel, la facture {number} de {total} CHF reste impayée ({daysOverdue} jours de retard).\n\nMerci de régulariser cette situation rapidement.\n\nCordialement,\n{companyName}'
      },
      {
        days: 30,
        type: 'reminder_3',
        subject: '3ème rappel : Facture {number}',
        body: 'Bonjour {clientName},\n\nLa facture {number} de {total} CHF est en retard de {daysOverdue} jours. Sans règlement sous 15 jours, nous serons contraints d\'engager des démarches.\n\nCordialement,\n{companyName}'
      },
      {
        days: 45,
        type: 'final_notice',
        subject: 'Mise en demeure : Facture {number}',
        body: 'Bonjour {clientName},\n\nDernière mise en demeure concernant la facture {number} de {total} CHF, en retard de {daysOverdue} jours. Sans paiement sous 10 jours, des poursuites seront engagées.\n\n{companyName}'
      }
    ]
  }
}, { _id: false });

const abaninjaSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    default: ''
  },
  autoSync: {
    type: Boolean,
    default: false
  },
  syncInvoices: {
    type: Boolean,
    default: true
  },
  syncQuotes: {
    type: Boolean,
    default: true
  },
  syncClients: {
    type: Boolean,
    default: true
  },
  lastSyncAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    unique: true,
    sparse: true
  },
  company: {
    type: companySchema,
    default: () => ({})
  },
  invoicing: {
    type: invoicingSchema,
    default: () => ({})
  },
  personalization: {
    type: personalizationSchema,
    default: () => ({})
  },
  emailTemplates: {
    type: emailTemplatesSchema,
    default: () => ({})
  },
  cmsIntegration: {
    type: cmsIntegrationSchema,
    default: () => ({})
  },
  smtp: {
    type: smtpSchema,
    default: () => ({})
  },
  reminders: {
    type: remindersSchema,
    default: () => ({})
  },
  abaninja: {
    type: abaninjaSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

// Get settings for user (or global if no user)
settingsSchema.statics.getSettings = async function(userId = null) {
  const query = userId ? { userId } : { userId: { $exists: false } };
  let settings = await this.findOne(query);
  if (!settings) {
    settings = await this.create({ userId });
  }
  return settings;
};

export default mongoose.model('Settings', settingsSchema);
