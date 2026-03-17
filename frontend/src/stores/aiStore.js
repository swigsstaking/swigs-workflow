import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { aiApi } from '../services/api';

let activeReader = null; // current SSE ReadableStream reader

export const useAIStore = create(
  persist(
    (set, get) => ({
      isOpen: false,
      messages: [],        // [{ id, role, content, timestamp, toolResults? }]
      isStreaming: false,
      suggestions: [],
      error: null,

      toggleSidebar: () => set(s => ({ isOpen: !s.isOpen })),
      openSidebar: () => set({ isOpen: true }),
      closeSidebar: () => set({ isOpen: false }),

      clearMessages: () => set({ messages: [], error: null }),

      // ---------------------------------------------------------------
      // Send message — POST /api/ai/chat with SSE streaming
      // ---------------------------------------------------------------
      sendMessage: async (text) => {
        if (!text.trim() || get().isStreaming) return;

        const userMsg = {
          id: crypto.randomUUID(),
          role: 'user',
          content: text.trim(),
          timestamp: Date.now()
        };

        const assistantMsg = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolResults: []
        };

        set(s => ({
          messages: [...s.messages, userMsg, assistantMsg],
          isStreaming: true,
          error: null
        }));

        try {
          const response = await aiApi.chat(text.trim());

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Erreur ${response.status}`);
          }

          const reader = response.body.getReader();
          activeReader = reader;
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6);
              if (!jsonStr.trim()) continue;

              try {
                const data = JSON.parse(jsonStr);

                if (data.type === 'token') {
                  set(s => {
                    const msgs = [...s.messages];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === 'assistant') {
                      msgs[msgs.length - 1] = { ...last, content: last.content + data.content };
                    }
                    return { messages: msgs };
                  });
                } else if (data.type === 'tool_result') {
                  set(s => {
                    const msgs = [...s.messages];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === 'assistant') {
                      msgs[msgs.length - 1] = {
                        ...last,
                        toolResults: [...(last.toolResults || []), { tool: data.tool, result: data.result }]
                      };
                    }
                    return { messages: msgs };
                  });
                } else if (data.type === 'done') {
                  break;
                } else if (data.type === 'error') {
                  set({ error: data.content });
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            set(s => ({
              messages: s.messages.filter(m => !(m.id === assistantMsg.id && !m.content)),
              error: err.message || 'Erreur de connexion'
            }));
          }
        } finally {
          activeReader = null;
          set({ isStreaming: false });
        }
      },

      // ---------------------------------------------------------------
      // Stop generation — POST /api/ai/chat/stop + abort reader
      // ---------------------------------------------------------------
      stopGeneration: async () => {
        if (activeReader) {
          try { activeReader.cancel(); } catch {}
          activeReader = null;
        }
        set({ isStreaming: false });
        try {
          await api.post('/ai/chat/stop');
        } catch {
          // ignore — best effort
        }
      },

      // ---------------------------------------------------------------
      // Fetch suggestions — GET /api/ai/suggestions
      // ---------------------------------------------------------------
      fetchSuggestions: async () => {
        try {
          const { data } = await api.get('/ai/suggestions');
          if (data.success) {
            set({ suggestions: data.data });
          }
        } catch {
          // silent — suggestions are non-critical
        }
      }
    }),
    {
      name: 'swigs-ai-store',
      partialize: (s) => ({ isOpen: s.isOpen })
    }
  )
);
