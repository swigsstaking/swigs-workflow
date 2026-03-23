import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Lightbulb, Settings, Sparkles } from 'lucide-react';
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
  action: {
    icon: Settings,
    bg: 'bg-violet-50 dark:bg-violet-900/10',
    border: 'border-violet-200 dark:border-violet-800/30',
    iconColor: 'text-violet-500 dark:text-violet-400',
    titleColor: 'text-violet-800 dark:text-violet-300',
    textColor: 'text-violet-700 dark:text-violet-400',
  },
};

const PROMPT_MAP = {
  view_overdue: 'Quelles sont mes factures en retard et que me conseilles-tu de faire ?',
  check_vat: 'Est-ce que je suis assujetti à la TVA ? Aide-moi à vérifier.',
  check_vat_threshold: 'Mon chiffre d\'affaires approche du seuil TVA de 100\'000 CHF. Explique-moi les implications et les démarches à faire.',
  create_project: 'Comment bien structurer mon premier projet dans SWIGS Pro ?',
  enable_reminders: 'Active les rappels automatiques de factures.',
  categorize_expenses: 'Quelles dépenses ne sont pas encore catégorisées ?',
  vat_threshold: 'Mon chiffre d\'affaires approche du seuil TVA. Explique-moi les implications.',
  unbilled_work: 'Quelles sont mes heures et dépenses non facturées ?',
  prepare_vat_report: 'Prépare mon décompte TVA du trimestre en cours.',
  configure_smtp: 'Comment configurer l\'envoi d\'emails dans SWIGS Pro ?',
  add_qr_iban: 'Comment ajouter mon QR-IBAN pour les factures QR ?',
  configure_qr_iban: 'Comment ajouter mon QR-IBAN pour les factures QR ?',
  export_journal: 'Exporte mon journal comptable de l\'année en cours.',
  missing_canton: 'Quel est mon canton et comment le configurer dans les paramètres ?',
  view_unbilled: 'Quelles sont mes heures et dépenses non facturées ?',
  estimate_taxes: 'Estime mes impôts pour l\'année en cours.',
};

const ACTION_LABELS = {
  view_overdue: 'Relancer',
  enable_reminders: 'Configurer',
  configure_smtp: 'Configurer',
  add_qr_iban: 'Configurer',
  configure_qr_iban: 'Configurer',
  prepare_vat_report: 'Préparer',
  export_journal: 'Exporter',
  categorize_expenses: 'Catégoriser',
  check_vat_threshold: 'Analyser',
  missing_canton: 'Configurer',
  view_unbilled: 'Voir',
  estimate_taxes: 'Estimer',
  unbilled_work: 'Voir',
};

// Actions that should navigate to settings instead of opening AI sidebar
const NAVIGATION_MAP = {
  configure_smtp: '/settings?section=smtp',
  add_qr_iban: '/settings?section=company',
  configure_qr_iban: '/settings?section=company',
  missing_canton: '/settings?section=company',
};

export default function AISuggestionBanner({ suggestions, filter }) {
  const { openSidebar, sendMessage, clearMessages } = useAIStore();

  const filtered = filter ? suggestions.filter(filter) : suggestions;
  if (!filtered.length) return null;

  const handleAsk = (suggestion) => {
    // Navigation actions go to settings, not AI
    const navPath = NAVIGATION_MAP[suggestion.action];
    if (navPath) {
      window.location.href = navPath;
      return;
    }

    // AI actions: open sidebar, clear previous conversation, send message
    openSidebar();
    clearMessages();
    const prompt = PROMPT_MAP[suggestion.action] || suggestion.message;
    // Small delay to ensure sidebar is mounted before sending
    setTimeout(() => sendMessage(prompt), 100);
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
                {ACTION_LABELS[s.action] || 'Demander'}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
