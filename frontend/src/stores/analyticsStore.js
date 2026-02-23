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

  fetchRevenue: async (excludeStatuses = []) => {
    try {
      const params = excludeStatuses.length ? { excludeStatuses: excludeStatuses.join(',') } : {};
      const response = await analyticsApi.getRevenue(params);
      set({ revenue: response.data.data });
    } catch (error) {
      console.error('Error fetching revenue:', error);
    }
  },

  fetchMonthly: async (excludeStatuses = []) => {
    try {
      const { showLastYear } = get();
      const params = { includeLastYear: showLastYear };
      if (excludeStatuses.length) params.excludeStatuses = excludeStatuses.join(',');
      const response = await analyticsApi.getMonthly(params);
      set({ monthly: response.data.data });
    } catch (error) {
      console.error('Error fetching monthly:', error);
    }
  },

  fetchQuotes: async (excludeStatuses = []) => {
    try {
      const params = excludeStatuses.length ? { excludeStatuses: excludeStatuses.join(',') } : {};
      const response = await analyticsApi.getQuotes(params);
      set({ quotes: response.data.data });
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  },

  fetchProjects: async (excludeStatuses = []) => {
    try {
      const params = excludeStatuses.length ? { excludeStatuses: excludeStatuses.join(',') } : {};
      const response = await analyticsApi.getProjects(params);
      set({ projects: response.data.data });
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  },

  fetchClients: async (limit = 5, excludeStatuses = []) => {
    try {
      const extraParams = excludeStatuses.length ? { excludeStatuses: excludeStatuses.join(',') } : {};
      const response = await analyticsApi.getTopClients(limit, extraParams);
      set({ clients: response.data.data });
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  },

  fetchHours: async (months = 12, excludeStatuses = []) => {
    try {
      const extraParams = excludeStatuses.length ? { excludeStatuses: excludeStatuses.join(',') } : {};
      const response = await analyticsApi.getHours(months, extraParams);
      set({ hours: response.data.data });
    } catch (error) {
      console.error('Error fetching hours:', error);
    }
  },

  fetchAll: async (excludeStatuses = []) => {
    set({ loading: true, error: null });
    try {
      const { showLastYear } = get();
      const esParam = excludeStatuses.length ? excludeStatuses.join(',') : undefined;
      const baseParams = esParam ? { excludeStatuses: esParam } : {};
      const monthlyParams = { ...baseParams, includeLastYear: showLastYear };

      const [revenueRes, monthlyRes, quotesRes, projectsRes, clientsRes, hoursRes] = await Promise.all([
        analyticsApi.getRevenue(baseParams),
        analyticsApi.getMonthly(monthlyParams),
        analyticsApi.getQuotes(baseParams),
        analyticsApi.getProjects(baseParams),
        analyticsApi.getTopClients(5, baseParams),
        analyticsApi.getHours(12, baseParams)
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

  refreshWithLastYear: async (show, excludeStatuses = []) => {
    set({ showLastYear: show, loading: true });
    try {
      const params = { includeLastYear: show };
      if (excludeStatuses.length) params.excludeStatuses = excludeStatuses.join(',');
      const response = await analyticsApi.getMonthly(params);
      set({ monthly: response.data.data, loading: false });
    } catch (error) {
      console.error('Error refreshing monthly:', error);
      set({ loading: false });
    }
  }
}));
