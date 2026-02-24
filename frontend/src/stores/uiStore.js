import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      // Theme
      darkMode: true, // Default to dark mode like Swigs Task
      accentColor: 'emerald', // 'emerald' | 'teal' | 'lime'

      // Card personalization
      cardStyle: 'left-border', // 'left-border' | 'full-border' | 'top-gradient'
      cardSize: 'medium', // 'small' | 'medium' | 'large'

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
      hiddenStatuses: [],
      showArchived: false,

      // Analytics filters
      analyticsHiddenStatuses: [],

      // Planning filters
      planningHiddenStatuses: [],

      // Expanded cards
      expandedCards: {},

      // Theme Actions
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
      setDarkMode: (value) => set({ darkMode: value }),
      setAccentColor: (color) => set({ accentColor: color }),
      setCardStyle: (style) => set({ cardStyle: style }),
      setCardSize: (size) => set({ cardSize: size }),

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
      toggleHiddenStatus: (statusId) => set(state => {
        const hidden = state.hiddenStatuses;
        return {
          hiddenStatuses: hidden.includes(statusId)
            ? hidden.filter(id => id !== statusId)
            : [...hidden, statusId]
        };
      }),
      clearHiddenStatuses: () => set({ hiddenStatuses: [] }),
      toggleShowArchived: () => set(state => ({ showArchived: !state.showArchived })),

      // Analytics filter actions
      toggleAnalyticsHiddenStatus: (statusId) => set(state => {
        const hidden = state.analyticsHiddenStatuses;
        return {
          analyticsHiddenStatuses: hidden.includes(statusId)
            ? hidden.filter(id => id !== statusId)
            : [...hidden, statusId]
        };
      }),
      clearAnalyticsHiddenStatuses: () => set({ analyticsHiddenStatuses: [] }),

      // Planning filter actions
      togglePlanningHiddenStatus: (statusId) => set(state => {
        const hidden = state.planningHiddenStatuses;
        return {
          planningHiddenStatuses: hidden.includes(statusId)
            ? hidden.filter(id => id !== statusId)
            : [...hidden, statusId]
        };
      }),
      clearPlanningHiddenStatuses: () => set({ planningHiddenStatuses: [] }),

      resetFilters: () => set({
        searchQuery: '',
        hiddenStatuses: [],
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
      partialize: (state) => ({
        darkMode: state.darkMode,
        accentColor: state.accentColor,
        expandedCards: state.expandedCards,
        hiddenStatuses: state.hiddenStatuses,
        analyticsHiddenStatuses: state.analyticsHiddenStatuses,
        planningHiddenStatuses: state.planningHiddenStatuses,
        cardStyle: state.cardStyle,
        cardSize: state.cardSize
      })
    }
  )
);
