import { create } from 'zustand';
import { dashboardApi } from '../services/api';

export const useDashboardStore = create((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetchDashboard: async (force = false) => {
    // Cache for 30 seconds unless forced
    const { lastFetched, loading } = get();
    if (!force && lastFetched && Date.now() - lastFetched < 30000) return;
    if (loading) return;

    set({ loading: true, error: null });
    try {
      const response = await dashboardApi.get();
      set({
        data: response.data.data,
        loading: false,
        lastFetched: Date.now()
      });
    } catch (error) {
      console.error('Dashboard fetch failed:', error);
      set({ loading: false, error: error.message });
    }
  }
}));
