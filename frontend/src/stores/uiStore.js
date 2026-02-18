import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      // Theme
      darkMode: true, // Default to dark mode like Swigs Task

      // Sidebar
      sidebarOpen: false,
      sidebarTab: 'info',

      // Modals
      showNewProjectModal: false,
      showNewEventModal: false,
      showNewInvoiceModal: false,
      showNewQuoteModal: false,
      showStatusModal: false,

      // Filters
      searchQuery: '',
      statusFilter: null,
      showArchived: false,

      // Expanded cards
      expandedCards: {},

      // Theme Actions
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
      setDarkMode: (value) => set({ darkMode: value }),

      // Sidebar Actions
      openSidebar: (tab = 'info') => set({ sidebarOpen: true, sidebarTab: tab }),
      closeSidebar: () => set({ sidebarOpen: false }),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      // Modal Actions
      toggleNewProjectModal: () => set(state => ({ showNewProjectModal: !state.showNewProjectModal })),
      toggleNewEventModal: () => set(state => ({ showNewEventModal: !state.showNewEventModal })),
      toggleNewInvoiceModal: () => set(state => ({ showNewInvoiceModal: !state.showNewInvoiceModal })),
      toggleNewQuoteModal: () => set(state => ({ showNewQuoteModal: !state.showNewQuoteModal })),
      toggleStatusModal: () => set(state => ({ showStatusModal: !state.showStatusModal })),

      // Filter Actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setStatusFilter: (statusId) => set({ statusFilter: statusId }),
      toggleShowArchived: () => set(state => ({ showArchived: !state.showArchived })),

      resetFilters: () => set({
        searchQuery: '',
        statusFilter: null,
        showArchived: false
      }),

      // Expanded Cards Actions
      toggleCardExpanded: (projectId) => set(state => ({
        expandedCards: {
          ...state.expandedCards,
          [projectId]: !state.expandedCards[projectId]
        }
      })),
      setCardExpanded: (projectId, expanded) => set(state => ({
        expandedCards: {
          ...state.expandedCards,
          [projectId]: expanded
        }
      })),
      collapseAllCards: () => set({ expandedCards: {} })
    }),
    {
      name: 'swigs-workflow-ui',
      partialize: (state) => ({ darkMode: state.darkMode, expandedCards: state.expandedCards })
    }
  )
);
