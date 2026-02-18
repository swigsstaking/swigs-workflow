import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay, addDays } from 'date-fns';
import { planningApi } from '../services/api';

export const usePlanningStore = create(
  persist(
    (set, get) => ({
      // State
      blocks: [],
      localBlocks: [], // localStorage fallback
      currentDate: new Date(),
      viewMode: 'week', // 'week' or 'day'
      loading: false,
      error: null,
      useLocalStorage: true, // Fallback when backend not available

      // Navigation
      setCurrentDate: (date) => set({ currentDate: date }),

      goToNextWeek: () => set(state => ({
        currentDate: addWeeks(state.currentDate, 1)
      })),

      goToPrevWeek: () => set(state => ({
        currentDate: subWeeks(state.currentDate, 1)
      })),

      goToToday: () => set({ currentDate: new Date() }),

      goToNextDay: () => set(state => ({
        currentDate: addDays(state.currentDate, 1)
      })),

      goToPrevDay: () => set(state => ({
        currentDate: addDays(state.currentDate, -1)
      })),

      setViewMode: (mode) => set({ viewMode: mode }),

      // Get date range based on view mode
      getDateRange: () => {
        const { currentDate, viewMode } = get();
        if (viewMode === 'week') {
          return {
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 })
          };
        }
        // Day view
        return {
          start: startOfDay(currentDate),
          end: addDays(startOfDay(currentDate), 1)
        };
      },

      // Fetch blocks from API
      fetchBlocks: async () => {
        const { getDateRange, useLocalStorage } = get();
        const { start, end } = getDateRange();

        set({ loading: true, error: null });

        try {
          const { data } = await planningApi.getBlocks({
            start: start.toISOString(),
            end: end.toISOString()
          });
          set({ blocks: data.data, loading: false, useLocalStorage: false });
        } catch (error) {
          // Fallback to localStorage
          console.log('Using localStorage for planning (backend not available)');
          const { localBlocks } = get();
          const filteredBlocks = localBlocks.filter(block => {
            const blockStart = new Date(block.start);
            const blockEnd = new Date(block.end);
            return blockStart <= end && blockEnd >= start;
          });
          set({ blocks: filteredBlocks, loading: false, useLocalStorage: true });
        }
      },

      // Create block
      createBlock: async (blockData) => {
        const { useLocalStorage, localBlocks } = get();

        try {
          if (useLocalStorage) {
            // Create block locally
            const newBlock = {
              _id: `local-${Date.now()}`,
              ...blockData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            set(state => ({
              blocks: [...state.blocks, newBlock],
              localBlocks: [...state.localBlocks, newBlock]
            }));
            return newBlock;
          }

          const { data } = await planningApi.create(blockData);
          set(state => ({
            blocks: [...state.blocks, data.data]
          }));
          return data.data;
        } catch (error) {
          // Fallback to localStorage
          const newBlock = {
            _id: `local-${Date.now()}`,
            ...blockData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          set(state => ({
            blocks: [...state.blocks, newBlock],
            localBlocks: [...state.localBlocks, newBlock],
            useLocalStorage: true
          }));
          return newBlock;
        }
      },

      // Update block
      updateBlock: async (id, updateData) => {
        const { useLocalStorage } = get();

        try {
          if (useLocalStorage) {
            set(state => ({
              blocks: state.blocks.map(b =>
                b._id === id ? { ...b, ...updateData, updatedAt: new Date().toISOString() } : b
              ),
              localBlocks: state.localBlocks.map(b =>
                b._id === id ? { ...b, ...updateData, updatedAt: new Date().toISOString() } : b
              )
            }));
            return get().blocks.find(b => b._id === id);
          }

          const { data } = await planningApi.update(id, updateData);
          set(state => ({
            blocks: state.blocks.map(b => b._id === id ? data.data : b)
          }));
          return data.data;
        } catch (error) {
          // Fallback to localStorage
          set(state => ({
            blocks: state.blocks.map(b =>
              b._id === id ? { ...b, ...updateData, updatedAt: new Date().toISOString() } : b
            ),
            localBlocks: state.localBlocks.map(b =>
              b._id === id ? { ...b, ...updateData, updatedAt: new Date().toISOString() } : b
            ),
            useLocalStorage: true
          }));
          return get().blocks.find(b => b._id === id);
        }
      },

      // Delete block
      deleteBlock: async (id) => {
        const { useLocalStorage } = get();

        try {
          if (useLocalStorage) {
            set(state => ({
              blocks: state.blocks.filter(b => b._id !== id),
              localBlocks: state.localBlocks.filter(b => b._id !== id)
            }));
            return;
          }

          await planningApi.delete(id);
          set(state => ({
            blocks: state.blocks.filter(b => b._id !== id)
          }));
        } catch (error) {
          // Fallback to localStorage
          set(state => ({
            blocks: state.blocks.filter(b => b._id !== id),
            localBlocks: state.localBlocks.filter(b => b._id !== id),
            useLocalStorage: true
          }));
        }
      },

      // Clear error
      clearError: () => set({ error: null })
    }),
    {
      name: 'swigs-planning',
      partialize: (state) => ({
        localBlocks: state.localBlocks,
        viewMode: state.viewMode
      })
    }
  )
);
