import History from '../models/History.js';

export const historyService = {
  async log(projectId, action, description, metadata = {}, user = 'system') {
    return await History.create({
      project: projectId,
      action,
      description,
      metadata,
      user
    });
  },

  // Project actions
  async projectCreated(projectId, projectName) {
    return this.log(projectId, 'project_created', `Projet "${projectName}" créé`);
  },

  async projectUpdated(projectId, changes) {
    return this.log(projectId, 'project_updated', 'Projet mis à jour', { changes });
  },

  async projectArchived(projectId) {
    return this.log(projectId, 'project_archived', 'Projet archivé');
  },

  async projectRestored(projectId) {
    return this.log(projectId, 'project_restored', 'Projet restauré');
  },

  async statusChanged(projectId, oldStatus, newStatus) {
    return this.log(projectId, 'status_change', `Statut changé de "${oldStatus}" à "${newStatus}"`, {
      oldStatus,
      newStatus
    });
  },

  // Event actions
  async eventAdded(projectId, eventType, description) {
    return this.log(projectId, 'event_added', `Événement ajouté: ${description}`, { eventType });
  },

  async eventUpdated(projectId, eventId) {
    return this.log(projectId, 'event_updated', 'Événement modifié', { eventId });
  },

  async eventDeleted(projectId, description) {
    return this.log(projectId, 'event_deleted', `Événement supprimé: ${description}`);
  },

  // Quote actions
  async quoteCreated(projectId, quoteNumber, total) {
    return this.log(projectId, 'quote_created', `Devis ${quoteNumber} créé (${total}€)`, { quoteNumber, total });
  },

  async quoteSent(projectId, quoteNumber) {
    return this.log(projectId, 'quote_sent', `Devis ${quoteNumber} envoyé`, { quoteNumber });
  },

  async quoteSigned(projectId, quoteNumber) {
    return this.log(projectId, 'quote_signed', `Devis ${quoteNumber} signé`, { quoteNumber });
  },

  async quoteRefused(projectId, quoteNumber) {
    return this.log(projectId, 'quote_refused', `Devis ${quoteNumber} refusé`, { quoteNumber });
  },

  async quoteUpdated(projectId, quoteNumber, previousStatus, newStatus) {
    return this.log(projectId, 'quote_updated', `Devis ${quoteNumber} modifié (${previousStatus} → ${newStatus})`, { quoteNumber, previousStatus, newStatus });
  },

  async quoteDeleted(projectId, quoteNumber) {
    return this.log(projectId, 'quote_deleted', `Devis ${quoteNumber} supprimé`, { quoteNumber });
  },

  // Invoice actions
  async invoiceCreated(projectId, invoiceNumber, total) {
    return this.log(projectId, 'invoice_created', `Facture ${invoiceNumber} créée (${total}€)`, { invoiceNumber, total });
  },

  async invoiceSent(projectId, invoiceNumber) {
    return this.log(projectId, 'invoice_sent', `Facture ${invoiceNumber} envoyée`, { invoiceNumber });
  },

  async invoicePaid(projectId, invoiceNumber) {
    return this.log(projectId, 'invoice_paid', `Facture ${invoiceNumber} payée`, { invoiceNumber });
  },

  async invoiceCancelled(projectId, invoiceNumber) {
    return this.log(projectId, 'invoice_cancelled', `Facture ${invoiceNumber} annulée`, { invoiceNumber });
  },

  async invoiceDeleted(projectId, invoiceNumber) {
    return this.log(projectId, 'invoice_deleted', `Facture ${invoiceNumber} supprimée`, { invoiceNumber });
  },

  async bankImported(projectId, importId, filename, count) {
    return this.log(projectId, 'bank_import', `Import bancaire ${filename} (${count} transactions)`, { importId, filename, count });
  },

  async bankReconciled(projectId, invoiceNumber, method, confidence) {
    return this.log(projectId, 'bank_reconciled', `Facture ${invoiceNumber} rapprochée (${method}, ${confidence}%)`, { invoiceNumber, method, confidence });
  }
};
