/** Fields to sync when updating a client across projects */
export const CLIENT_SYNC_FIELDS = ['name', 'email', 'phone', 'address', 'street', 'zip', 'city', 'country', 'che', 'company', 'siret'];

/** Allowed invoice statuses */
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'partial', 'cancelled', 'overdue'];

/** Allowed quote statuses */
export const QUOTE_STATUSES = ['draft', 'sent', 'signed', 'invoiced', 'cancelled', 'expired'];

/** Payment frequencies */
export const FREQUENCIES = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
};
