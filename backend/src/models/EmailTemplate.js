import mongoose from 'mongoose';

// Available variable documentation
const variableSchema = new mongoose.Schema({
  name: String,         // e.g., '{{customer.firstName}}'
  description: String,  // e.g., 'Prénom du client'
  example: String       // e.g., 'Jean'
}, { _id: false });

const emailTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  name: {
    type: String,
    required: [true, 'Le nom du template est requis'],
    trim: true
  },

  // Email subject (supports variables)
  subject: {
    type: String,
    required: [true, 'Le sujet est requis'],
    trim: true
  },

  // Email body (HTML with Handlebars variables)
  body: {
    type: String,
    required: [true, 'Le corps du mail est requis']
  },

  // Plain text version (optional, auto-generated if not provided)
  bodyText: String,

  // Category for organization
  category: {
    type: String,
    enum: ['order', 'customer', 'project', 'invoice', 'quote', 'reminder', 'general'],
    default: 'general'
  },

  // Available variables documentation
  availableVariables: [variableSchema],

  // Design options
  design: {
    headerColor: { type: String, default: '#3B82F6' },
    footerText: String,
    logoUrl: String
  },

  // State
  isActive: {
    type: Boolean,
    default: true
  },

  // Usage stats
  stats: {
    timesSent: { type: Number, default: 0 },
    lastUsedAt: Date
  }
}, {
  timestamps: true
});

// Indexes
emailTemplateSchema.index({ userId: 1, category: 1 });
emailTemplateSchema.index({ userId: 1, isActive: 1 });

// Pre-defined variable sets by category
emailTemplateSchema.statics.getVariablesByCategory = function(category) {
  const baseVariables = [
    { name: '{{company.name}}', description: 'Nom de votre entreprise', example: 'SWIGS' },
    { name: '{{company.email}}', description: 'Email de votre entreprise', example: 'contact@swigs.online' },
    { name: '{{company.phone}}', description: 'Téléphone de votre entreprise', example: '+41 79 123 45 67' },
    { name: '{{today}}', description: 'Date du jour', example: '05.02.2026' }
  ];

  const categoryVariables = {
    order: [
      { name: '{{order.number}}', description: 'Numéro de commande', example: 'ORD-2026-0001' },
      { name: '{{order.total}}', description: 'Total de la commande', example: '150.00 CHF' },
      { name: '{{order.status}}', description: 'Statut de la commande', example: 'Payée' },
      { name: '{{order.items}}', description: 'Liste des articles', example: '2x T-Shirt, 1x Casquette' },
      { name: '{{order.trackingNumber}}', description: 'Numéro de suivi', example: 'CH123456789' },
      { name: '{{order.trackingUrl}}', description: 'Lien de suivi', example: 'https://...' },
      { name: '{{customer.firstName}}', description: 'Prénom du client', example: 'Jean' },
      { name: '{{customer.lastName}}', description: 'Nom du client', example: 'Dupont' },
      { name: '{{customer.email}}', description: 'Email du client', example: 'jean@example.com' }
    ],
    customer: [
      { name: '{{customer.firstName}}', description: 'Prénom du client', example: 'Jean' },
      { name: '{{customer.lastName}}', description: 'Nom du client', example: 'Dupont' },
      { name: '{{customer.email}}', description: 'Email du client', example: 'jean@example.com' },
      { name: '{{customer.phone}}', description: 'Téléphone du client', example: '+41 79 987 65 43' }
    ],
    project: [
      { name: '{{project.name}}', description: 'Nom du projet', example: 'Site Web E-commerce' },
      { name: '{{project.status}}', description: 'Statut du projet', example: 'En cours' },
      { name: '{{client.name}}', description: 'Nom du client', example: 'Dupont SA' },
      { name: '{{client.email}}', description: 'Email du client', example: 'contact@dupont.ch' }
    ],
    invoice: [
      { name: '{{invoice.number}}', description: 'Numéro de facture', example: 'FAC-2026-001' },
      { name: '{{invoice.total}}', description: 'Total TTC', example: '1\'620.00 CHF' },
      { name: '{{invoice.subtotal}}', description: 'Total HT', example: '1\'500.00 CHF' },
      { name: '{{invoice.dueDate}}', description: 'Date d\'échéance', example: '05.03.2026' },
      { name: '{{invoice.status}}', description: 'Statut', example: 'Envoyée' },
      { name: '{{project.name}}', description: 'Nom du projet', example: 'Site Web' },
      { name: '{{client.name}}', description: 'Nom du client', example: 'Dupont SA' }
    ],
    quote: [
      { name: '{{quote.number}}', description: 'Numéro de devis', example: 'DEV-2026-001' },
      { name: '{{quote.total}}', description: 'Total TTC', example: '5\'400.00 CHF' },
      { name: '{{quote.validUntil}}', description: 'Valide jusqu\'au', example: '05.03.2026' },
      { name: '{{project.name}}', description: 'Nom du projet', example: 'Refonte site' },
      { name: '{{client.name}}', description: 'Nom du client', example: 'Dupont SA' }
    ],
    reminder: [
      { name: '{{days}}', description: 'Nombre de jours', example: '7' },
      { name: '{{document.number}}', description: 'Numéro du document', example: 'FAC-2026-001' },
      { name: '{{document.total}}', description: 'Montant', example: '1\'500.00 CHF' }
    ],
    general: []
  };

  return [...baseVariables, ...(categoryVariables[category] || [])];
};

// Create default templates for a user
emailTemplateSchema.statics.createDefaults = async function(userId) {
  const defaults = [
    {
      userId,
      name: 'Confirmation de commande',
      subject: 'Votre commande {{order.number}} est confirmée',
      body: `<h2>Merci pour votre commande !</h2>
<p>Bonjour {{customer.firstName}},</p>
<p>Nous avons bien reçu votre commande <strong>{{order.number}}</strong> d'un montant de <strong>{{order.total}}</strong>.</p>
<p>Nous vous tiendrons informé(e) de l'expédition.</p>
<p>Cordialement,<br>{{company.name}}</p>`,
      category: 'order'
    },
    {
      userId,
      name: 'Commande expédiée',
      subject: 'Votre commande {{order.number}} a été expédiée',
      body: `<h2>Votre commande est en route !</h2>
<p>Bonjour {{customer.firstName}},</p>
<p>Votre commande <strong>{{order.number}}</strong> a été expédiée.</p>
{{#if order.trackingNumber}}
<p>Numéro de suivi : <strong>{{order.trackingNumber}}</strong></p>
<p><a href="{{order.trackingUrl}}">Suivre ma commande</a></p>
{{/if}}
<p>Cordialement,<br>{{company.name}}</p>`,
      category: 'order'
    },
    {
      userId,
      name: 'Bienvenue nouveau client',
      subject: 'Bienvenue chez {{company.name}} !',
      body: `<h2>Bienvenue {{customer.firstName}} !</h2>
<p>Nous sommes ravis de vous compter parmi nos clients.</p>
<p>N'hésitez pas à nous contacter si vous avez des questions.</p>
<p>À bientôt,<br>{{company.name}}</p>`,
      category: 'customer'
    },
    {
      userId,
      name: 'Rappel de paiement',
      subject: 'Rappel : Facture {{invoice.number}} en attente',
      body: `<p>Bonjour,</p>
<p>Nous vous rappelons que la facture <strong>{{invoice.number}}</strong> d'un montant de <strong>{{invoice.total}}</strong> est en attente de règlement.</p>
<p>Date d'échéance : {{invoice.dueDate}}</p>
<p>Merci de procéder au paiement dans les meilleurs délais.</p>
<p>Cordialement,<br>{{company.name}}</p>`,
      category: 'invoice'
    }
  ];

  return this.insertMany(defaults);
};

export default mongoose.model('EmailTemplate', emailTemplateSchema);
