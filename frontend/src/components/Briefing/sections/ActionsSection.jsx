import { motion } from 'framer-motion';
import { Sparkles, Settings, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import { sectionContainer, sectionTitle, itemVariant } from '../utils/animations';
import { useAIStore } from '../../../stores/aiStore';

const ICON_MAP = {
  warning: AlertTriangle,
  tip: Lightbulb,
  info: Sparkles,
  action: Settings,
};

const ACCENT_MAP = {
  warning: {
    icon: 'text-amber-500 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  tip: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  info: {
    icon: 'text-blue-500 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  },
  action: {
    icon: 'text-violet-500 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
};

// Actions that navigate to settings
const NAVIGATION_MAP = {
  configure_smtp: '/settings?section=smtp',
  add_qr_iban: '/settings?section=company',
  configure_qr_iban: '/settings?section=company',
  missing_canton: '/settings?section=company',
};

// Actions that duplicate urgent/watch items
const DUPLICATE_ACTIONS = ['view_overdue'];

const PROMPT_MAP = {
  view_overdue: 'Quelles sont mes factures en retard et que me conseilles-tu de faire ?',
  check_vat: 'Est-ce que je suis assujetti à la TVA ? Aide-moi à vérifier.',
  check_vat_threshold: 'Mon chiffre d\'affaires approche du seuil TVA de 100\'000 CHF. Explique-moi les implications.',
  enable_reminders: 'Active les rappels automatiques de factures.',
  categorize_expenses: 'Quelles dépenses ne sont pas encore catégorisées ?',
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

export default function ActionsSection({ suggestions = [], hasUrgentItems = false }) {
  const { openSidebar, sendMessage, clearMessages } = useAIStore();

  // Filter out duplicates (overdue already shown in URGENT section)
  const filtered = suggestions.filter(s => {
    if (hasUrgentItems && DUPLICATE_ACTIONS.includes(s.action)) return false;
    return true;
  });

  if (!filtered.length) return null;

  const handleClick = (suggestion) => {
    const navPath = NAVIGATION_MAP[suggestion.action];
    if (navPath) {
      window.location.href = navPath;
      return;
    }

    openSidebar();
    clearMessages();
    const prompt = PROMPT_MAP[suggestion.action] || suggestion.message;
    setTimeout(() => sendMessage(prompt), 100);
  };

  return (
    <motion.section variants={sectionContainer} initial="hidden" animate="visible">
      <motion.div variants={sectionTitle} className="flex items-center gap-2 mb-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
          Actions recommandées
        </h2>
        <span className="px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 text-[10px] font-bold">
          {filtered.length}
        </span>
      </motion.div>

      <div className="space-y-1.5">
        {filtered.map((s, i) => {
          const Icon = ICON_MAP[s.type] || Sparkles;
          const colors = ACCENT_MAP[s.type] || ACCENT_MAP.info;
          const label = ACTION_LABELS[s.action] || 'Voir';

          return (
            <motion.div
              key={s.action || i}
              variants={itemVariant}
              onClick={() => handleClick(s)}
              className="flex items-center gap-3 py-2.5 px-3.5 bg-white border border-slate-200 dark:bg-white/[0.04] dark:backdrop-blur-sm dark:border-white/[0.06] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              <div className={`flex-shrink-0 ${colors.icon}`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {s.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
                  {s.message}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/60 text-[11px] font-medium hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors">
                {label}
                <ArrowRight className="w-3 h-3" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
