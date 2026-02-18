import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsApi } from '../services/api';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      settings: null,
      personalization: {
        cardStyle: 'left-border',
        cardSize: 'medium'
      },
      loading: false,
      error: null,

      fetchSettings: async () => {
        set({ loading: true, error: null });
        try {
          const { data } = await settingsApi.get();
          // Only update settings, keep personalization from localStorage
          // (personalization is persisted locally until backend supports it)
          const currentPersonalization = get().personalization;
          set({
            settings: data.data,
            // Use API personalization if available, otherwise keep local
            personalization: data.data.personalization || currentPersonalization,
            loading: false
          });
        } catch (error) {
          set({ loading: false, error: error.message });
        }
      },

      updatePersonalization: (updates) => {
        const currentPersonalization = get().personalization;
        const newPersonalization = { ...currentPersonalization, ...updates };
        // Update localStorage only (persisted via zustand persist middleware)
        // Backend sync can be added later when deployed
        set({ personalization: newPersonalization });
      }
    }),
    {
      name: 'swigs-workflow-settings',
      partialize: (state) => ({ personalization: state.personalization })
    }
  )
);
