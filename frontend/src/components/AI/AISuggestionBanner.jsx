import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Lightbulb, Sparkles } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

const TYPE_CONFIG = {
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
    titleColor: 'text-amber-800 dark:text-amber-300',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800/30',
    iconColor: 'text-blue-500 dark:text-blue-400',
    titleColor: 'text-blue-800 dark:text-blue-300',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  tip: {
    icon: Lightbulb,
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    border: 'border-emerald-200 dark:border-emerald-800/30',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    titleColor: 'text-emerald-800 dark:text-emerald-300',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

const PROMPT_MAP = {
  view_overdue: 'Quelles sont mes factures en retard et que me conseilles-tu de faire ?',
  check_vat: 'Est-ce que je suis assujetti à la TVA ? Aide-moi à vérifier.',
  create_project: 'Comment bien structurer mon premier projet dans SWIGS Pro ?',
};

export default function AISuggestionBanner({ suggestions, filter }) {
  const { openSidebar, sendMessage } = useAIStore();

  const filtered = filter ? suggestions.filter(filter) : suggestions;
  if (!filtered.length) return null;

  const handleAsk = (suggestion) => {
    openSidebar();
    const prompt = PROMPT_MAP[suggestion.action] || suggestion.message;
    sendMessage(prompt);
  };

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {filtered.map((s, i) => {
          const config = TYPE_CONFIG[s.type] || TYPE_CONFIG.info;
          const Icon = config.icon;

          return (
            <motion.div
              key={s.action || i}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.08, duration: 0.2 }}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium ${config.titleColor}`}>{s.title}</p>
                <p className={`text-[12px] mt-0.5 ${config.textColor}`}>{s.message}</p>
              </div>
              <button
                onClick={() => handleAsk(s)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-zinc-200 transition-all"
              >
                <Sparkles className="w-3 h-3" />
                Demander
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
