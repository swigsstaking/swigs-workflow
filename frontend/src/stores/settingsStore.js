import { create } from 'zustand';
import { settingsApi } from '../services/api';
import { trackSettingsChanged } from '../lib/posthog';

export const useSettingsStore = create(
  (set, get) => ({
    settings: null,
    loading: false,
    error: null,

    fetchSettings: async () => {
      if (get().loading) return;
      set({ loading: true, error: null });
      try {
        const { data } = await settingsApi.get();
        set({
          settings: data.data,
          loading: false
        });
      } catch (error) {
        set({ loading: false, error: error.message });
      }
    },

    updateSettings: async (updates) => {
      try {
        const { data } = await settingsApi.update(updates);
        set({ settings: data.data });
        const sections = Object.keys(updates);
        trackSettingsChanged(sections.join(','), { sections });
        return data.data;
      } catch (err) {
        throw err;
      }
    }
  })
);
