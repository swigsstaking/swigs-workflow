/**
 * SWIGS ProjectSidebar — "Carte Alpine" redesign.
 * - Header with topographic texture overlay + Jakarta Sans project name
 * - Segment-control tab bar (pill-style active indicator)
 * - Swiss precision spacing throughout
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Calendar, History, FileText } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';
import InfoTab from './InfoTab';
import EventsTab from './EventsTab';
import HistoryTab from './HistoryTab';
import DocumentsTab from './DocumentsTab';

const tabs = [
  { id: 'info',      label: 'Infos',        icon: Info },
  { id: 'events',    label: 'Événements',   icon: Calendar },
  { id: 'history',   label: 'Historique',   icon: History },
  { id: 'documents', label: 'Documents',    icon: FileText },
];

export default function ProjectSidebar({ project, isOpen, onClose }) {
  const { sidebarTab, setSidebarTab } = useUIStore();
  const {
    fetchProjectEvents,
    fetchProjectInvoices,
    fetchProjectQuotes,
    fetchProjectHistory,
  } = useProjectStore();

  useEffect(() => {
    if (!project?._id) return;
    if (sidebarTab === 'events') {
      fetchProjectEvents(project._id);
      fetchProjectQuotes(project._id);
    } else if (sidebarTab === 'history') {
      fetchProjectHistory(project._id);
    } else if (sidebarTab === 'documents') {
      fetchProjectInvoices(project._id);
      fetchProjectQuotes(project._id);
    }
  }, [project?._id, sidebarTab]); // eslint-disable-line

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const renderTabContent = () => {
    if (!project) return null;
    switch (sidebarTab) {
      case 'info':      return <InfoTab project={project} />;
      case 'events':    return <EventsTab project={project} />;
      case 'history':   return <HistoryTab project={project} />;
      case 'documents': return <DocumentsTab project={project} />;
      default:          return <InfoTab project={project} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && project && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="
              fixed top-[48px] right-0 bottom-0
              w-full md:w-[480px] max-w-full
              bg-white dark:bg-dark-card
              border-l border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border
              shadow-2xl flex flex-col z-30
            "
          >
            {/* ── Header — topo texture + Jakarta Sans ── */}
            <div className="relative overflow-hidden flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--swigs-stone)/0.25)] dark:border-dark-border shrink-0">

              <div className="relative flex-1 min-w-0">
                <h2 className="font-display font-bold text-[17px] tracking-tight text-slate-900 dark:text-white truncate leading-tight">
                  {project.name}
                </h2>
                {project.client?.name && (
                  <p className="text-xs text-[rgb(var(--swigs-stone))] dark:text-zinc-500 truncate mt-0.5 font-medium">
                    {project.client.name}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                aria-label="Fermer"
                className="
                  relative ml-3 p-1.5 rounded-[6px]
                  text-slate-400 dark:text-zinc-500
                  hover:text-slate-600 dark:hover:text-zinc-300
                  hover:bg-[rgb(var(--swigs-stone)/0.15)] dark:hover:bg-white/[0.05]
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                "
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* ── Segment Tab Bar ── */}
            <div
              role="tablist"
              aria-label="Sections du projet"
              className="flex gap-1 p-1.5 bg-slate-50 dark:bg-zinc-950/60 border-b border-[rgb(var(--swigs-stone)/0.2)] dark:border-dark-border shrink-0"
            >
              {tabs.map((tab) => {
                const isActive = sidebarTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
                    onClick={() => setSidebarTab(tab.id)}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5
                      px-3 py-1.5 text-[12px] font-medium
                      rounded-[6px] transition-all duration-200
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                      ${isActive
                        ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400 border border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border'
                        : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-white/60 dark:hover:bg-white/[0.03] border border-transparent'
                      }
                    `}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Tab Content ── */}
            <div
              role="tabpanel"
              id={`tabpanel-${sidebarTab}`}
              aria-labelledby={sidebarTab}
              className="flex-1 overflow-y-auto"
            >
              {renderTabContent()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
