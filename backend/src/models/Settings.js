import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  street: {
    type: String,
    default: ''
  },
  zip: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: 'CH'
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
  },
  // --- Paramètres comptables suisses ---
  legalForm: {
    type: String,
    enum: ['raison_individuelle', 'sarl', 'sa', 'snc', 'senc', 'cooperative', 'association', 'fondation'],
    default: 'raison_individuelle'
  },
  canton: {
    type: String,
    enum: ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH'],
    default: null
  },
  isVatSubject: {
    type: Boolean,
    default: true
  },
  vatDeclarationFrequency: {
    type: String,
    enum: ['quarterly', 'monthly', 'annual'],
    default: 'quarterly'
  },
  fiscalYearStart: {
    type: Number,
    min: 1,
    max: 12,
    default: 1
  },
  employeeCount: {
    type: Number,
    default: 0,
    min: 0
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
    default: 'Bonjour {clientName},\n\nVeuillez trouver ci-joint notre offre relative à votre demande.\n\nJe reste à votre disposition pour toute question ou ajustement.\n\nAvec mes meilleures salutations,\n\n{companyName}'
  },
  invoiceSubject: {
    type: String,
    default: 'Facture {number} - {projectName}'
  },
  invoiceBody: {
    type: String,
    default: 'Bonjour,\n\nVeuillez trouver ci-joint la facture relative à notre prestation. Je vous remercie pour la confiance accordée.\n\nJe reste à votre disposition pour tout renseignement complémentaire.\n\nAvec mes remerciements et mes salutations distinguées,\n\n{companyName}'
  }
}, { _id: false });

const emailNotificationsSchema = new mongoose.Schema({
  paymentConfirmation: {
    type: Boolean,
    default: true
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
        body: 'Bonjour {clientName},\n\nNous vous rappelons que la facture {number} d\'un montant de {total} est échue depuis le {dueDate}.\n\nMerci de procéder au règlement dans un délai de 15 jours.\n\nVeuillez trouver ci-joint le rappel détaillé.\n\nCordialement,\n{companyName}'
      },
      {
        days: 14,
        type: 'reminder_2',
        subject: '2ème rappel : Facture {number}',
        body: 'Bonjour {clientName},\n\nMalgré notre précédent rappel, la facture {number} d\'un montant de {total} reste impayée ({daysOverdue} jours de retard).\n\nNous vous prions de régulariser cette situation dans les plus brefs délais.\n\nCordialement,\n{companyName}'
      },
      {
        days: 30,
        type: 'reminder_3',
        subject: '3ème rappel : Facture {number}',
        body: 'Bonjour {clientName},\n\nLa facture {number} d\'un montant de {total} est en retard de {daysOverdue} jours.\n\nSans règlement sous 15 jours, nous serons contraints d\'engager des démarches de recouvrement.\n\nCordialement,\n{companyName}'
      },
      {
        days: 45,
        type: 'final_notice',
        subject: 'Mise en demeure : Facture {number}',
        body: 'Bonjour {clientName},\n\nDernière mise en demeure concernant la facture {number} d\'un montant de {total}, en retard de {daysOverdue} jours.\n\nSans paiement sous 10 jours, des poursuites seront engagées conformément à la loi.\n\n{companyName}'
      }
    ]
  }
}, { _id: false });

const bankImapSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  host: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 993
  },
  tls: {
    type: Boolean,
    default: true
  },
  user: {
    type: String,
    default: ''
  },
  pass: {
    type: String,
    default: ''
  },
  folder: {
    type: String,
    default: 'INBOX'
  },
  lastCheckedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const invoiceDesignSchema = new mongoose.Schema({
  template: {
    type: String,
    enum: ['modern', 'classic', 'minimal', 'swiss', 'elegant', 'bold', 'professional', 'envelope'],
    default: 'modern'
  },
  primaryColor: {
    type: String,
    default: '#3B82F6'
  },
  accentColor: {
    type: String,
    default: '#1E40AF'
  },
  fontFamily: {
    type: String,
    enum: ['Inter', 'Helvetica', 'Georgia'],
    default: 'Inter'
  },
  // Logo
  showLogo: {
    type: Boolean,
    default: true
  },
  logoPosition: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'left'
  },
  logoSize: {
    type: Number,
    default: 18,
    min: 6,
    max: 60
  },
  logoOffsetX: {
    type: Number,
    default: 0,
    min: -30,
    max: 30
  },
  logoOffsetY: {
    type: Number,
    default: 0,
    min: -15,
    max: 15
  },
  // Company info visibility
  showCompanyName: {
    type: Boolean,
    default: true
  },
  showCompanyAddress: {
    type: Boolean,
    default: true
  },
  showCompanyContact: {
    type: Boolean,
    default: true
  },
  showVatNumber: {
    type: Boolean,
    default: true
  },
  showSiret: {
    type: Boolean,
    default: false
  },
  showIban: {
    type: Boolean,
    default: true
  },
  showQrBill: {
    type: Boolean,
    default: true
  },
  // Document content visibility
  showProjectName: {
    type: Boolean,
    default: true
  },
  showPaymentTerms: {
    type: Boolean,
    default: true
  },
  showDateBlock: {
    type: Boolean,
    default: true
  },
  // Table style
  tableHeaderStyle: {
    type: String,
    enum: ['colored', 'dark', 'light', 'none'],
    default: 'colored'
  },
  // Custom texts
  footerText: {
    type: String,
    default: ''
  },
  headerText: {
    type: String,
    default: ''
  },
  notesTemplate: {
    type: String,
    default: ''
  },
  // Label overrides
  labelInvoice: {
    type: String,
    default: 'Facture'
  },
  labelQuote: {
    type: String,
    default: 'Devis'
  },
  labelServices: {
    type: String,
    default: 'Prestations'
  },
  // Letterhead (papier à lettres) — PDF background
  useLetterhead: {
    type: Boolean,
    default: false
  },
  letterheadPdf: {
    type: String,
    default: null
  }
}, { _id: false });

const lexaIntegrationSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true // true = publie vers Lexa
  },
  publishInvoices: {
    type: Boolean,
    default: true
  },
  publishExpenses: {
    type: Boolean,
    default: true
  },
  lastPublishedAt: {
    type: Date,
    default: null
  },
  failureCount: {
    type: Number,
    default: 0
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
  emailNotifications: {
    type: emailNotificationsSchema,
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
  invoiceDesign: {
    type: invoiceDesignSchema,
    default: () => ({})
  },
  abaninja: {
    type: abaninjaSchema,
    default: () => ({})
  },
  bankImap: {
    type: bankImapSchema,
    default: () => ({})
  },
  lexaIntegration: {
    type: lexaIntegrationSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

// Get settings for user (or global if no user) — excludes heavy fields
settingsSchema.statics.getSettings = async function(userId = null) {
  const query = userId ? { userId } : { userId: { $exists: false } };
  let settings = await this.findOne(query).select('-invoiceDesign.letterheadPdf');
  if (!settings) {
    settings = await this.create({ userId });
  }
  return settings;
};

// Get settings with letterhead PDF (for PDF generation only)
settingsSchema.statics.getSettingsWithLetterhead = async function(userId = null) {
  const query = userId ? { userId } : { userId: { $exists: false } };
  let settings = await this.findOne(query);
  if (!settings) {
    settings = await this.create({ userId });
  }
  return settings;
};

export default mongoose.model('Settings', settingsSchema);
