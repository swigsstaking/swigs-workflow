import axios from 'axios';

const ABANINJA_BASE_URL = 'https://api.abaninja.ch/v2';

export class AbaNinjaService {
  constructor(apiKey) {
    this.client = axios.create({
      baseURL: ABANINJA_BASE_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // --- Adresses ---
  async getAddresses() {
    const response = await this.client.get('/addresses');
    return response.data;
  }

  async createAddress(data) {
    const response = await this.client.post('/addresses', data);
    return response.data;
  }

  async updateAddress(id, data) {
    const response = await this.client.put(`/addresses/${id}`, data);
    return response.data;
  }

  async findAddressByEmail(email) {
    const addresses = await this.getAddresses();
    return addresses.find(a => a.email === email);
  }

  // --- Factures ---
  async createInvoice(data) {
    const response = await this.client.post('/invoices', data);
    return response.data;
  }

  async getInvoice(id) {
    const response = await this.client.get(`/invoices/${id}`);
    return response.data;
  }

  // --- Devis ---
  async createEstimate(data) {
    const response = await this.client.post('/estimates', data);
    return response.data;
  }

  async getEstimate(id) {
    const response = await this.client.get(`/estimates/${id}`);
    return response.data;
  }

  // --- Test connexion ---
  async testConnection() {
    await this.client.get('/addresses?limit=1');
    return { success: true, message: 'Connexion réussie' };
  }

  // --- Mappers ---

  /**
   * Map Client to AbaNinja Address format
   */
  mapClientToAddress(client) {
    // Parse address string "Rue du Lac 18, 1950 Sion, Suisse" → structured
    const parts = (client.address || '').split(',').map(s => s.trim());
    const street = parts[0] || '';
    const cityPart = parts[1] || '';
    const zipMatch = cityPart.match(/^(\d{4})\s+(.+)$/);

    return {
      type: client.company ? 'company' : 'person',
      name: client.company || client.name,
      firstName: '',
      lastName: client.name,
      street,
      zip: zipMatch ? zipMatch[1] : '',
      city: zipMatch ? zipMatch[2] : cityPart,
      country: 'CH',
      email: client.email || '',
      phone: client.phone || ''
    };
  }

  /**
   * Map Invoice to AbaNinja format
   */
  mapInvoiceToAbaNinja(invoice, project, addressId) {
    const items = [];

    // Events snapshots
    if (invoice.events?.length) {
      invoice.events.forEach(e => {
        items.push({
          description: e.description,
          quantity: e.hours || 1,
          unitPrice: e.hourlyRate || e.amount || 0,
          vatRate: invoice.vatRate || 8.1
        });
      });
    }

    // Quote snapshots
    if (invoice.quotes?.length) {
      invoice.quotes.forEach(q => {
        (q.lines || []).forEach(line => {
          items.push({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: invoice.vatRate || 8.1
          });
        });
      });
    }

    // Custom lines
    if (invoice.customLines?.length) {
      invoice.customLines.forEach(line => {
        items.push({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: invoice.vatRate || 8.1
        });
      });
    }

    return {
      addressId,
      title: `Facture ${invoice.number}`,
      date: invoice.issueDate?.toISOString().split('T')[0],
      dueDate: invoice.dueDate?.toISOString().split('T')[0],
      currency: 'CHF',
      items,
      reference: invoice.number,
      notes: invoice.notes || ''
    };
  }

  /**
   * Map Quote to AbaNinja Estimate format
   */
  mapQuoteToAbaNinja(quote, project, addressId) {
    const items = (quote.lines || []).map(line => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: quote.vatRate || 8.1
    }));

    return {
      addressId,
      title: `Devis ${quote.number}`,
      date: quote.issueDate?.toISOString().split('T')[0],
      currency: 'CHF',
      items,
      reference: quote.number,
      notes: quote.notes || ''
    };
  }
}
