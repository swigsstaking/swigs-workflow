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
  { id: 'info', label: 'Infos', icon: Info },
  { id: 'events', label: 'Événements', icon: Calendar },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'documents', label: 'Documents', icon: FileText }
];

export default function ProjectSidebar({ project, isOpen, onClose }) {
  const { sidebarTab, setSidebarTab } = useUIStore();
  const {
    fetchProjectEvents,
    fetchProjectInvoices,
    fetchProjectQuotes,
    fetchProjectHistory
  } = useProjectStore();

  // Load data when project changes or tab changes
  useEffect(() => {
    if (!project?._id) return;

    if (sidebarTab === 'events') {
      fetchProjectEvents(project._id);
      fetchProjectQuotes(project._id); // Also load quotes for EventsTab
    } else if (sidebarTab === 'history') {
      fetchProjectHistory(project._id);
    } else if (sidebarTab === 'documents') {
      fetchProjectInvoices(project._id);
      fetchProjectQuotes(project._id);
    }
  }, [project?._id, sidebarTab]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const renderTabContent = () => {
    if (!project) return null;

    switch (sidebarTab) {
      case 'info':
        return <InfoTab project={project} />;
      case 'events':
        return <EventsTab project={project} />;
      case 'history':
        return <HistoryTab project={project} />;
      case 'documents':
        return <DocumentsTab project={project} />;
      default:
        return <InfoTab project={project} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && project && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="
            fixed top-[41px] right-0 bottom-0
            w-full md:w-[480px] max-w-full bg-white dark:bg-dark-card
            border-l border-slate-200 dark:border-dark-border
            shadow-xl
            flex flex-col
            z-30
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                {project.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {project.client?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-dark-border">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2
                  px-4 py-3 text-sm font-medium
                  transition-colors
                  ${sidebarTab === tab.id
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50 dark:bg-primary-900/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {renderTabContent()}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
