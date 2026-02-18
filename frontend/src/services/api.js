import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Intercepteur pour gerer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si 401 et moins de 1 retry
    if (error.response?.status === 401) {
      const retryCount = originalRequest._retryCount || 0;

      if (retryCount < 1) {
        originalRequest._retryCount = retryCount + 1;

        const { refreshAccessToken } = useAuthStore.getState();
        const success = await refreshAccessToken();

        if (success) {
          const { accessToken } = useAuthStore.getState();
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      }

      // Apres 1 retry rate ou refresh echec, forcer logout
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

// Projects
export const projectsApi = {
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  changeStatus: (id, status) => api.patch(`/projects/${id}/status`, { status }),
  archive: (id) => api.delete(`/projects/${id}`),
  restore: (id) => api.patch(`/projects/${id}/restore`),
  updatePositions: (positions) => api.patch('/projects/positions', { positions }),
  resetPositions: () => api.delete('/projects/positions')
};

// Statuses
export const statusesApi = {
  getAll: () => api.get('/statuses'),
  create: (data) => api.post('/statuses', data),
  update: (id, data) => api.put(`/statuses/${id}`, data),
  reorder: (statusIds) => api.put('/statuses/reorder', { statusIds }),
  delete: (id) => api.delete(`/statuses/${id}`),
  seed: () => api.post('/statuses/seed')
};

// Events
export const eventsApi = {
  getForProject: (projectId, params) => api.get(`/projects/${projectId}/events`, { params }),
  getUnbilled: (projectId) => api.get(`/projects/${projectId}/events/unbilled`),
  create: (projectId, data) => api.post(`/projects/${projectId}/events`, data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`)
};

// Invoices
export const invoicesApi = {
  getAll: (params) => api.get('/invoices', { params }),
  getForProject: (projectId, params) => api.get(`/projects/${projectId}/invoices`, { params }),
  getOne: (id) => api.get(`/invoices/${id}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/invoices`, data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  changeStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
  delete: (id) => api.delete(`/invoices/${id}`)
};

// Quotes
export const quotesApi = {
  getAll: (params) => api.get('/quotes', { params }),
  getForProject: (projectId, params) => api.get(`/projects/${projectId}/quotes`, { params }),
  getInvoiceable: (projectId) => api.get(`/projects/${projectId}/quotes/invoiceable`),
  getOne: (id) => api.get(`/quotes/${id}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/quotes`, data),
  update: (id, data) => api.put(`/quotes/${id}`, data),
  changeStatus: (id, status) => api.patch(`/quotes/${id}/status`, { status }),
  delete: (id) => api.delete(`/quotes/${id}`)
};

// History
export const historyApi = {
  getForProject: (projectId) => api.get(`/projects/${projectId}/history`)
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  getStats: () => api.get('/settings/stats')
};

// Clients
export const clientsApi = {
  getAll: (params) => api.get('/clients', { params }),
  getOne: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`)
};

// Planning
export const planningApi = {
  getBlocks: (params) => api.get('/planning', { params }),
  create: (data) => api.post('/planning', data),
  update: (id, data) => api.put(`/planning/${id}`, data),
  delete: (id) => api.delete(`/planning/${id}`)
};

// Analytics
export const analyticsApi = {
  getRevenue: () => api.get('/analytics/revenue'),
  getMonthly: (params) => api.get('/analytics/monthly', { params }),
  getQuotes: () => api.get('/analytics/quotes'),
  getProjects: () => api.get('/analytics/projects'),
  getTopClients: (limit = 5) => api.get('/analytics/clients', { params: { limit } }),
  getHours: (months = 12) => api.get('/analytics/hours', { params: { months } })
};

// Services
export const servicesApi = {
  getAll: (params) => api.get('/services', { params }),
  getOne: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
  reorder: (serviceIds) => api.put('/services/reorder', { serviceIds }),
  toggle: (id) => api.patch(`/services/${id}/toggle`)
};

// Automations
export const automationsApi = {
  getAll: () => api.get('/automations'),
  getOne: (id) => api.get(`/automations/${id}`),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  delete: (id) => api.delete(`/automations/${id}`),
  toggle: (id) => api.patch(`/automations/${id}/toggle`),
  run: (id, testData) => api.post(`/automations/${id}/run`, { testData }),
  getRuns: (id, params) => api.get(`/automations/${id}/runs`, { params })
};

// Automation Runs
export const automationRunsApi = {
  getOne: (id) => api.get(`/automation-runs/${id}`),
  retry: (id) => api.post(`/automation-runs/${id}/retry`)
};

// Email Templates
export const emailTemplatesApi = {
  getAll: (params) => api.get('/email-templates', { params }),
  getOne: (id) => api.get(`/email-templates/${id}`),
  create: (data) => api.post('/email-templates', data),
  update: (id, data) => api.put(`/email-templates/${id}`, data),
  delete: (id) => api.delete(`/email-templates/${id}`),
  preview: (id, data) => api.post(`/email-templates/${id}/preview`, { data }),
  sendTest: (id, to, data) => api.post(`/email-templates/${id}/send-test`, { to, data }),
  getVariables: (category) => api.get(`/email-templates/variables/${category}`),
  createDefaults: () => api.post('/email-templates/create-defaults')
};

// Exports
export const exportsApi = {
  journal: () => {
    const year = new Date().getFullYear();
    return api.get(`/exports/journal?from=${year}-01-01&to=${year}-12-31`, { responseType: 'blob' });
  },
  clients: () => api.get('/exports/clients', { responseType: 'blob' }),
  revenueReport: () => {
    const year = new Date().getFullYear();
    return api.get(`/exports/revenue-report?from=${year}-01-01&to=${year}-12-31`, { responseType: 'blob' });
  }
};

// Portal
export const portalApi = {
  // Public (no auth)
  getDocument: (token) => axios.get(`/api/portal/${token}`),
  downloadPDF: (token) => axios.get(`/api/portal/${token}/pdf`, { responseType: 'blob' }),
  signQuote: (token, data) => axios.post(`/api/portal/${token}/sign`, data),
  // Private (auth)
  generate: (data) => api.post('/portal/generate', data),
  revokeLink: (id) => api.delete(`/portal/links/${id}`),
  getLinks: (type, documentId) => api.get(`/portal/links/${type}/${documentId}`)
};

// Reminders
export const remindersApi = {
  send: (invoiceId) => api.post(`/reminders/${invoiceId}/send`)
};

// AbaNinja
export const abaninjaApi = {
  testConnection: () => api.post('/abaninja/test-connection'),
  syncInvoice: (id) => api.post(`/abaninja/sync/invoice/${id}`),
  syncQuote: (id) => api.post(`/abaninja/sync/quote/${id}`),
  syncClient: (id) => api.post(`/abaninja/sync/client/${id}`),
  syncAll: () => api.post('/abaninja/sync/all'),
  getStatus: () => api.get('/abaninja/status')
};

export default api;
