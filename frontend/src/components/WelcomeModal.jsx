import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  FolderKanban,
  Receipt,
  BarChart3,
  Building2,
  Paintbrush,
  FolderPlus
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { trackEvent } from '../lib/posthog';

const STORAGE_KEY = 'swigs-pro-welcome-done';
const TOTAL_STEPS = 3;

const FEATURES = [
  {
    icon: FolderKanban,
    title: 'Projets & Clients',
    description: 'Organisez vos missions, suivez les heures et dépenses par projet',
    color: 'emerald'
  },
  {
    icon: Receipt,
    title: 'Factures & Devis',
    description: 'Générez des factures QR suisses conformes avec TVA 8.1%',
    color: 'blue'
  },
  {
    icon: BarChart3,
    title: 'Comptabilité',
    description: 'Import bancaire, catégorisation auto et rapports P&L',
    color: 'amber'
  }
];

const PILLS = ['Projets', 'Factures', 'Devis', 'Comptabilité'];

const colorMap = {
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-800',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/10',
    hoverText: 'group-hover:text-emerald-700 dark:group-hover:text-emerald-400'
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-300 dark:hover:border-blue-800',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/10',
    hoverText: 'group-hover:text-blue-700 dark:group-hover:text-blue-400'
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'hover:border-violet-300 dark:hover:border-violet-800',
    hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-900/10',
    hoverText: 'group-hover:text-violet-700 dark:group-hover:text-violet-400'
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'hover:border-amber-300 dark:hover:border-amber-800',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/10',
    hoverText: 'group-hover:text-amber-700 dark:group-hover:text-amber-400'
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-800',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/10',
    hoverText: 'group-hover:text-indigo-700 dark:group-hover:text-indigo-400'
  },
  primary: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-600 dark:text-primary-400',
    border: 'hover:border-primary-300 dark:hover:border-primary-800',
    hoverBg: 'hover:bg-primary-50 dark:hover:bg-primary-900/10',
    hoverText: 'group-hover:text-primary-700 dark:group-hover:text-primary-400'
  }
};

function StepDots({ total, current }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-primary-500'
              : i < current
                ? 'w-3 bg-primary-300 dark:bg-primary-700'
                : 'w-3 bg-slate-300 dark:bg-dark-border'
          }`}
        />
      ))}
    </div>
  );
}

const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -40 : 40, opacity: 0 })
};

export default function WelcomeModal({ onClose }) {
  const { user } = useAuthStore();
  const toggleNewProjectModal = useUIStore(s => s.toggleNewProjectModal);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const markCompleted = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const goNext = () => {
    trackEvent('welcome_modal_step', { app: 'swigs-pro', step: step + 1 });
    setDirection(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goPrev = () => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 0));
  };

  const handleDismiss = () => {
    trackEvent('welcome_modal_dismissed', { app: 'swigs-pro', at_step: step });
    markCompleted();
    onClose();
  };

  const handleFinish = () => {
    trackEvent('welcome_modal_completed', { app: 'swigs-pro' });
    markCompleted();
    onClose();
  };

  const handleAction = (action, path) => {
    trackEvent('welcome_modal_action', { app: 'swigs-pro', action });
    markCompleted();
    onClose();
    if (action === 'create_project') {
      toggleNewProjectModal();
    } else {
      navigate(path);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'vous';
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <StepDots total={TOTAL_STEPS} current={step} />
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 0 — Welcome */}
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-8 pb-6"
              >
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="relative mb-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary-500/30">
                      {initials}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Bienvenue sur Swigs Pro !
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
                    Gérez vos projets, créez des factures conformes au droit suisse et suivez vos heures — tout en un.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  {PILLS.map(label => (
                    <span
                      key={label}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-dark-hover text-slate-600 dark:text-slate-400"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleDismiss} className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    Passer
                  </button>
                  <button onClick={goNext} className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all">
                    Découvrir
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 1 — Features */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    Ce que vous pouvez faire
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tout pour gérer votre activité de freelance ou PME.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {FEATURES.map(feat => {
                    const Icon = feat.icon;
                    const c = colorMap[feat.color];
                    return (
                      <div
                        key={feat.title}
                        className="flex flex-col p-3.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card"
                      >
                        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2.5`}>
                          <Icon className={`w-[1.1rem] h-[1.1rem] ${c.text}`} />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{feat.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{feat.description}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={goPrev} className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={handleDismiss} className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    Passer
                  </button>
                  <button onClick={goNext} className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all">
                    Configurer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Get Started */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-6"
              >
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    Configurez votre espace
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Trois actions pour bien démarrer.
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  {/* Mon entreprise */}
                  <button
                    onClick={() => handleAction('company', '/settings?section=company')}
                    className={`group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-dark-border ${colorMap.emerald.border} bg-white dark:bg-dark-card ${colorMap.emerald.hoverBg} transition-all text-left`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${colorMap.emerald.bg} flex items-center justify-center shrink-0`}>
                      <Building2 className={`w-5 h-5 ${colorMap.emerald.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-slate-900 dark:text-white ${colorMap.emerald.hoverText} transition-colors`}>
                        Mon entreprise
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nom, adresse, IBAN</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" />
                  </button>

                  {/* Design des factures */}
                  <button
                    onClick={() => handleAction('invoice_design', '/settings?section=invoice-design')}
                    className={`group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-dark-border ${colorMap.indigo.border} bg-white dark:bg-dark-card ${colorMap.indigo.hoverBg} transition-all text-left`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${colorMap.indigo.bg} flex items-center justify-center shrink-0`}>
                      <Paintbrush className={`w-5 h-5 ${colorMap.indigo.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-slate-900 dark:text-white ${colorMap.indigo.hoverText} transition-colors`}>
                        Design des factures
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Logo, couleurs, template PDF</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>

                  {/* Créer un projet */}
                  <button
                    onClick={() => handleAction('create_project')}
                    className={`group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-dark-border ${colorMap.primary.border} bg-white dark:bg-dark-card ${colorMap.primary.hoverBg} transition-all text-left`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${colorMap.primary.bg} flex items-center justify-center shrink-0`}>
                      <FolderPlus className={`w-5 h-5 ${colorMap.primary.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-slate-900 dark:text-white ${colorMap.primary.hoverText} transition-colors`}>
                        Créer un projet
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Lancez votre premier projet</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors shrink-0" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={goPrev} className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleFinish}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Terminer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
