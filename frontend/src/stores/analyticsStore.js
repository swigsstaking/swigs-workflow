import { create } from 'zustand';
import { analyticsApi } from '../services/api';

export const useAnalyticsStore = create((set, get) => ({
  // State
  revenue: null,
  monthly: [],
  quotes: null,
  projects: null,
  clients: [],
  hours: null,

  // UI State
  loading: false,
  error: null,
  showLastYear: false,

  // Actions
  setShowLastYear: (show) => set({ showLastYear: show }),

  fetchRevenue: async () => {
    try {
      const response = await analyticsApi.getRevenue();
      set({ revenue: response.data.data });
    } catch (error) {
      console.error('Error fetching revenue:', error);
    }
  },

  fetchMonthly: async () => {
    try {
      const { showLastYear } = get();
      const response = await analyticsApi.getMonthly({ includeLastYear: showLastYear });
      set({ monthly: response.data.data });
    } catch (error) {
      console.error('Error fetching monthly:', error);
    }
  },

  fetchQuotes: async () => {
    try {
      const response = await analyticsApi.getQuotes();
      set({ quotes: response.data.data });
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  },

  fetchProjects: async () => {
    try {
      const response = await analyticsApi.getProjects();
      set({ projects: response.data.data });
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  },

  fetchClients: async (limit = 5) => {
    try {
      const response = await analyticsApi.getTopClients(limit);
      set({ clients: response.data.data });
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  },

  fetchHours: async (months = 12) => {
    try {
      const response = await analyticsApi.getHours(months);
      set({ hours: response.data.data });
    } catch (error) {
      console.error('Error fetching hours:', error);
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const { showLastYear } = get();
      const [revenueRes, monthlyRes, quotesRes, projectsRes, clientsRes, hoursRes] = await Promise.all([
        analyticsApi.getRevenue(),
        analyticsApi.getMonthly({ includeLastYear: showLastYear }),
        analyticsApi.getQuotes(),
        analyticsApi.getProjects(),
        analyticsApi.getTopClients(5),
        analyticsApi.getHours(12)
      ]);

      set({
        revenue: revenueRes.data.data,
        monthly: monthlyRes.data.data,
        quotes: quotesRes.data.data,
        projects: projectsRes.data.data,
        clients: clientsRes.data.data,
        hours: hoursRes.data.data,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching all analytics:', error);
      set({ error: error.message, loading: false });
    }
  },

  refreshWithLastYear: async (show) => {
    set({ showLastYear: show, loading: true });
    try {
      const response = await analyticsApi.getMonthly({ includeLastYear: show });
      set({ monthly: response.data.data, loading: false });
    } catch (error) {
      console.error('Error refreshing monthly:', error);
      set({ loading: false });
    }
  }
}));
