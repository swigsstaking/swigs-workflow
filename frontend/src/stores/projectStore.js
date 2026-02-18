import { create } from 'zustand';
import { projectsApi, statusesApi, eventsApi, invoicesApi, quotesApi, historyApi } from '../services/api';

export const useProjectStore = create((set, get) => ({
  // State
  projects: [],
  statuses: [],
  selectedProject: null,
  projectEvents: [],
  projectInvoices: [],
  projectQuotes: [],
  projectHistory: [],
  loading: false,
  error: null,

  // Projects actions
  fetchProjects: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { data } = await projectsApi.getAll(params);
      set({ projects: data.data, loading: false });
      // Apply saved positions from localStorage
      get().applySavedPositions();
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await projectsApi.getOne(id);
      set({ selectedProject: data.data, loading: false });
      return data.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createProject: async (projectData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await projectsApi.create(projectData);
      set(state => ({
        projects: [data.data, ...state.projects],
        loading: false
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProject: async (id, projectData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await projectsApi.update(id, projectData);
      set(state => ({
        projects: state.projects.map(p => p._id === id ? data.data : p),
        selectedProject: state.selectedProject?._id === id ? data.data : state.selectedProject,
        loading: false
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  changeProjectStatus: async (id, statusId) => {
    try {
      const { data } = await projectsApi.changeStatus(id, statusId);
      set(state => ({
        projects: state.projects.map(p => p._id === id ? { ...p, status: data.data.status } : p),
        selectedProject: state.selectedProject?._id === id
          ? { ...state.selectedProject, status: data.data.status }
          : state.selectedProject
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  archiveProject: async (id) => {
    try {
      await projectsApi.archive(id);
      set(state => ({
        projects: state.projects.filter(p => p._id !== id),
        selectedProject: state.selectedProject?._id === id ? null : state.selectedProject
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  restoreProject: async (id) => {
    try {
      const { data } = await projectsApi.restore(id);
      set(state => ({
        projects: state.projects.map(p => p._id === id ? data.data : p)
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Position actions
  updatePositions: async (positions) => {
    // Save positions to localStorage (until backend is deployed)
    const positionMap = {};
    positions.forEach(pos => {
      positionMap[pos.id] = pos.order;
    });
    localStorage.setItem('swigs-project-positions', JSON.stringify(positionMap));

    // Optimistic update - reorder projects locally
    set(state => {
      const reorderedProjects = positions
        .map(pos => state.projects.find(p => p._id === pos.id))
        .filter(Boolean);
      return { projects: reorderedProjects };
    });

    // Try API call (will fail silently if endpoint not deployed)
    try {
      await projectsApi.updatePositions(positions);
    } catch (error) {
      // Silently ignore - positions are saved in localStorage
      console.log('Positions saved locally (backend not deployed)');
    }
  },

  // Apply saved positions from localStorage
  applySavedPositions: () => {
    const saved = localStorage.getItem('swigs-project-positions');
    if (!saved) return;

    try {
      const positionMap = JSON.parse(saved);
      set(state => {
        const sortedProjects = [...state.projects].sort((a, b) => {
          const orderA = positionMap[a._id] ?? 999;
          const orderB = positionMap[b._id] ?? 999;
          return orderA - orderB;
        });
        return { projects: sortedProjects };
      });
    } catch (e) {
      console.error('Failed to apply saved positions', e);
    }
  },

  resetPositions: async () => {
    localStorage.removeItem('swigs-project-positions');
    try {
      await projectsApi.resetPositions();
    } catch (error) {
      // Silently ignore
    }
    get().fetchProjects();
  },

  // Statuses actions
  fetchStatuses: async () => {
    try {
      const { data } = await statusesApi.getAll();
      set({ statuses: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createStatus: async (statusData) => {
    try {
      const { data } = await statusesApi.create(statusData);
      set(state => ({ statuses: [...state.statuses, data.data] }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateStatus: async (id, statusData) => {
    try {
      const { data } = await statusesApi.update(id, statusData);
      set(state => ({
        statuses: state.statuses.map(s => s._id === id ? data.data : s)
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteStatus: async (id) => {
    try {
      await statusesApi.delete(id);
      set(state => ({
        statuses: state.statuses.filter(s => s._id !== id)
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  seedStatuses: async () => {
    try {
      const { data } = await statusesApi.seed();
      set({ statuses: data.data });
    } catch (error) {
      // Statuses might already exist
      await get().fetchStatuses();
    }
  },

  // Events actions
  fetchProjectEvents: async (projectId, params = {}) => {
    try {
      const { data } = await eventsApi.getForProject(projectId, params);
      set({ projectEvents: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createEvent: async (projectId, eventData) => {
    try {
      const { data } = await eventsApi.create(projectId, eventData);
      set(state => ({
        projectEvents: [data.data, ...state.projectEvents]
      }));
      // Refresh project to update unbilled totals
      get().fetchProject(projectId);
      get().fetchProjects();
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateEvent: async (id, eventData) => {
    try {
      const { data } = await eventsApi.update(id, eventData);
      set(state => ({
        projectEvents: state.projectEvents.map(e => e._id === id ? data.data : e)
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteEvent: async (id) => {
    try {
      await eventsApi.delete(id);
      set(state => ({
        projectEvents: state.projectEvents.filter(e => e._id !== id)
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Invoices actions
  fetchProjectInvoices: async (projectId) => {
    try {
      const { data } = await invoicesApi.getForProject(projectId);
      set({ projectInvoices: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createInvoice: async (projectId, invoiceData) => {
    try {
      const { data } = await invoicesApi.create(projectId, invoiceData);
      set(state => ({
        projectInvoices: [data.data, ...state.projectInvoices]
      }));
      // Refresh events to update billed status
      get().fetchProjectEvents(projectId);
      get().fetchProject(projectId);
      get().fetchProjects();
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateInvoiceStatus: async (id, status) => {
    try {
      const { data } = await invoicesApi.changeStatus(id, status);
      set(state => ({
        projectInvoices: state.projectInvoices.map(i => i._id === id ? data.data : i)
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteInvoice: async (id, projectId) => {
    try {
      await invoicesApi.delete(id);
      set(state => ({
        projectInvoices: state.projectInvoices.filter(i => i._id !== id)
      }));
      // Refresh events to update billed status
      if (projectId) {
        get().fetchProjectEvents(projectId);
        get().fetchProjectQuotes(projectId);
        get().fetchProject(projectId);
        get().fetchProjects();
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Quotes actions
  fetchProjectQuotes: async (projectId) => {
    try {
      const { data } = await quotesApi.getForProject(projectId);
      set({ projectQuotes: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createQuote: async (projectId, quoteData) => {
    try {
      const { data } = await quotesApi.create(projectId, quoteData);
      set(state => ({
        projectQuotes: [data.data, ...state.projectQuotes]
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateQuote: async (id, quoteData) => {
    try {
      const { data } = await quotesApi.update(id, quoteData);
      set(state => ({
        projectQuotes: state.projectQuotes.map(q => q._id === id ? data.data : q)
      }));
      return { quote: data.data, statusChanged: data.statusChanged, previousStatus: data.previousStatus };
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateQuoteStatus: async (id, status) => {
    try {
      const { data } = await quotesApi.changeStatus(id, status);
      set(state => ({
        projectQuotes: state.projectQuotes.map(q => q._id === id ? data.data : q)
      }));
      return data.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteQuote: async (id, projectId) => {
    try {
      await quotesApi.delete(id);
      // Mise à jour locale immédiate
      set(state => ({
        projectQuotes: state.projectQuotes.filter(q => q._id !== id)
      }));
      // Refresh toutes les données du projet
      if (projectId) {
        await get().fetchProjectQuotes(projectId);
        get().fetchProject(projectId);
        get().fetchProjects();
      }
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // History actions
  fetchProjectHistory: async (projectId) => {
    try {
      const { data } = await historyApi.getForProject(projectId);
      set({ projectHistory: data.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  // UI actions
  selectProject: (project) => set({ selectedProject: project }),
  clearSelectedProject: () => set({
    selectedProject: null,
    projectEvents: [],
    projectInvoices: [],
    projectQuotes: [],
    projectHistory: []
  }),
  clearError: () => set({ error: null })
}));
