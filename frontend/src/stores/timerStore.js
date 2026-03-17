import { create } from 'zustand';
import { timerApi } from '../services/api';
import { trackEvent } from '../lib/posthog';

export const useTimerStore = create((set, get) => ({
  activeTimer: null,
  elapsed: 0,
  loading: false,
  _interval: null,
  _cleanupRegistered: false,

  fetchActive: async () => {
    try {
      const { data } = await timerApi.getActive();
      set({ activeTimer: data.data });
      if (data.data && data.data.status === 'running') {
        get()._startTick();
      }
    } catch {
      set({ activeTimer: null });
    }
  },

  start: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await timerApi.start(payload);
      set({ activeTimer: data.data, loading: false });
      trackEvent('timer_started', { project_id: payload?.projectId, project_name: data.data?.projectId?.name });
      get()._startTick();
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  pause: async () => {
    try {
      const { data } = await timerApi.pause();
      set({ activeTimer: data.data });
      get()._stopTick();
    } catch (err) {
      throw err;
    }
  },

  resume: async () => {
    try {
      const { data } = await timerApi.resume();
      set({ activeTimer: data.data });
      get()._startTick();
    } catch (err) {
      throw err;
    }
  },

  stop: async (payload) => {
    try {
      const activeTimer = get().activeTimer;
      const { data } = await timerApi.stop(payload);
      get()._stopTick();
      const elapsed = get().elapsed;
      trackEvent('timer_stopped', {
        project_name: activeTimer?.projectId?.name,
        duration_minutes: Math.round(elapsed / 1000 / 60),
        duration_seconds: Math.round(elapsed / 1000),
      });
      set({ activeTimer: null, elapsed: 0 });
      return data.data; // returns created event
    } catch (err) {
      throw err;
    }
  },

  discard: async () => {
    try {
      await timerApi.discard();
      get()._stopTick();
      set({ activeTimer: null, elapsed: 0 });
    } catch (err) {
      throw err;
    }
  },

  _startTick: () => {
    get()._stopTick();
    const interval = setInterval(() => {
      const timer = get().activeTimer;
      if (!timer || timer.status !== 'running') return;
      const now = Date.now();
      const elapsed = now - new Date(timer.startedAt).getTime() - (timer.totalPausedMs || 0);
      set({ elapsed: Math.max(0, elapsed) });
    }, 1000);
    set({ _interval: interval });

    // Register cleanup on page unload (once)
    if (!get()._cleanupRegistered) {
      const cleanup = () => get()._stopTick();
      window.addEventListener('beforeunload', cleanup);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && get().activeTimer?.status === 'running') {
          // Recalculate elapsed when tab becomes visible again
          const timer = get().activeTimer;
          if (timer) {
            const elapsed = Date.now() - new Date(timer.startedAt).getTime() - (timer.totalPausedMs || 0);
            set({ elapsed: Math.max(0, elapsed) });
          }
        }
      });
      set({ _cleanupRegistered: true });
    }
  },

  _stopTick: () => {
    const interval = get()._interval;
    if (interval) clearInterval(interval);
    set({ _interval: null });
  },
}));
