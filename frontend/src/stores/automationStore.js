import { create } from 'zustand';
import { automationsApi, emailTemplatesApi } from '../services/api';

export const useAutomationStore = create((set, get) => ({
  // Automations
  automations: [],
  selectedAutomation: null,
  automationRuns: [],

  // Email Templates
  emailTemplates: [],

  // Loading states
  loading: false,
  saving: false,
  error: null,

  // Fetch all automations
  fetchAutomations: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await automationsApi.getAll();
      set({ automations: data.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // Fetch single automation
  fetchAutomation: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await automationsApi.getOne(id);
      set({ selectedAutomation: data.data, loading: false });
      return data.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  // Create automation
  createAutomation: async (automationData) => {
    set({ saving: true, error: null });
    try {
      const { data } = await automationsApi.create(automationData);
      set(state => ({
        automations: [data.data, ...state.automations],
        selectedAutomation: data.data,
        saving: false
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message, saving: false });
      throw error;
    }
  },

  // Update automation
  updateAutomation: async (id, automationData) => {
    set({ saving: true, error: null });
    try {
      const { data } = await automationsApi.update(id, automationData);
      set(state => ({
        automations: state.automations.map(a =>
          a._id === id ? data.data : a
        ),
        selectedAutomation: data.data,
        saving: false
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message, saving: false });
      throw error;
    }
  },

  // Delete automation
  deleteAutomation: async (id) => {
    try {
      await automationsApi.delete(id);
      set(state => ({
        automations: state.automations.filter(a => a._id !== id),
        selectedAutomation: state.selectedAutomation?._id === id ? null : state.selectedAutomation
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Toggle automation active state
  toggleAutomation: async (id) => {
    try {
      const { data } = await automationsApi.toggle(id);
      set(state => ({
        automations: state.automations.map(a =>
          a._id === id ? data.data : a
        ),
        selectedAutomation: state.selectedAutomation?._id === id
          ? data.data
          : state.selectedAutomation
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Run automation manually
  runAutomation: async (id, testData = {}) => {
    try {
      const { data } = await automationsApi.run(id, testData);
      // Refresh runs
      get().fetchAutomationRuns(id);
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Fetch automation runs
  fetchAutomationRuns: async (automationId) => {
    try {
      const { data } = await automationsApi.getRuns(automationId);
      set({ automationRuns: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  // Clear selected automation
  clearSelection: () => {
    set({ selectedAutomation: null, automationRuns: [] });
  },

  // ===== Email Templates =====

  // Fetch email templates
  fetchEmailTemplates: async () => {
    try {
      const { data } = await emailTemplatesApi.getAll();
      set({ emailTemplates: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  // Create email template
  createEmailTemplate: async (templateData) => {
    try {
      const { data } = await emailTemplatesApi.create(templateData);
      set(state => ({
        emailTemplates: [data.data, ...state.emailTemplates]
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Update email template
  updateEmailTemplate: async (id, templateData) => {
    try {
      const { data } = await emailTemplatesApi.update(id, templateData);
      set(state => ({
        emailTemplates: state.emailTemplates.map(t =>
          t._id === id ? data.data : t
        )
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Delete email template
  deleteEmailTemplate: async (id) => {
    try {
      await emailTemplatesApi.delete(id);
      set(state => ({
        emailTemplates: state.emailTemplates.filter(t => t._id !== id)
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Preview email template
  previewEmailTemplate: async (id, data = {}) => {
    try {
      const response = await emailTemplatesApi.preview(id, data);
      return response.data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  }
}));
