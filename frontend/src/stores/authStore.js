import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      sessionVersion: 0, // Increments on each new session to trigger data reload

      // Verifier un token SSO (venant du Hub)
      verifySsoToken: async (ssoToken) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/sso-verify', { ssoToken });
          const { accessToken, refreshToken, user } = response.data;

          set((state) => ({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            sessionVersion: state.sessionVersion + 1 // Trigger reload
          }));

          return { success: true, user };
        } catch (error) {
          console.error('SSO verification failed:', error);
          set({ isLoading: false });
          return {
            success: false,
            error: error.response?.data?.error || 'Verification SSO echouee'
          };
        }
      },

      // Rafraichir le token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken, user } = response.data;

          set({ accessToken, user });
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      // Recuperer le profil utilisateur
      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
          return response.data.user;
        } catch (error) {
          console.error('Fetch user failed:', error);
          return null;
        }
      },

      // Deconnexion
      logout: async () => {
        const { refreshToken } = get();

        try {
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken });
          }
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false
        });
      },

      // Se connecter via le Hub
      loginWithHub: () => {
        const hubUrl = import.meta.env.VITE_HUB_URL || 'https://apps.swigs.online';
        window.location.href = hubUrl;
      }
    }),
    {
      name: 'workflow-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
