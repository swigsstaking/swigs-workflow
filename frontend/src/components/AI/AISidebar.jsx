import { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Square, Trash2, Sparkles } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import AIChatMessage from './AIChatMessage';

const SPRING = { type: 'spring', damping: 26, stiffness: 220 };

export default function AISidebar() {
  const {
    isOpen, closeSidebar,
    messages, isStreaming, error,
    sendMessage, stopGeneration, clearMessages
  } = useAIStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="fixed inset-0 top-12 bg-black/30 z-20 md:hidden"
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SPRING}
            className="fixed top-12 right-0 bottom-0 w-full md:w-96 bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-white/[0.06] z-30 flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white">Assistant Comptable</h2>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">Alimenté par Qwen</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="p-1.5 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                    title="Nouvelle conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={closeSidebar}
                  className="p-1.5 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-primary-500 dark:text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Assistant Comptable
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                    Posez vos questions sur la TVA suisse, les calculs comptables, ou la gestion de vos factures.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      'Quel est le taux de TVA normal ?',
                      'Calculer la TVA sur 1000 CHF',
                      'Mes factures en retard ?'
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                        className="px-3 py-1.5 text-[11px] rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <AIChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  toolResults={msg.toolResults}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none px-3 py-2 text-[13px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 dark:focus:border-primary-500/40 disabled:opacity-50 transition-all"
                />
                {isStreaming ? (
                  <button
                    onClick={stopGeneration}
                    className="shrink-0 p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                    title="Arrêter la génération"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="shrink-0 p-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Envoyer (Ctrl+Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-zinc-600 text-center">
                Ctrl+Enter pour envoyer. L'assistant peut faire des erreurs.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
