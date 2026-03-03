import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronsDownUp, ChevronsUpDown, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import WorkflowGrid from '../components/Workflow/WorkflowGrid';
import StatusFilter from '../components/Workflow/StatusFilter';
import NewProjectModal from '../components/Workflow/NewProjectModal';
import ProjectSidebar from '../components/Sidebar/ProjectSidebar';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';

export default function Workflow() {
  const {
    projects,
    statuses,
    selectedProject,
    fetchProjects,
    fetchStatuses,
    fetchProject,
    clearSelectedProject,
    updatePositions
  } = useProjectStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchSettings } = useSettingsStore();
  const { sessionVersion } = useAuthStore();
  const lastSessionVersion = useRef(sessionVersion);

  const {
    searchQuery,
    hiddenStatuses,
    showArchived,
    openSidebar,
    closeSidebar,
    sidebarOpen,
    expandedCards,
    toggleAllCardsExpanded,
    viewMode,
    setViewMode,
    sortMode,
    setSortMode
  } = useUIStore();

  const [initialLoading, setInitialLoading] = useState(true);

  // Load data on mount and when showArchived changes
  useEffect(() => {
    const init = async () => {
      try {
        await fetchStatuses();
        await fetchSettings();
        await fetchProjects({ archived: showArchived });
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, [showArchived]);

  // Reload data when session changes (new login while on page)
  useEffect(() => {
    if (sessionVersion > lastSessionVersion.current) {
      lastSessionVersion.current = sessionVersion;
      // Session changed, reload data
      const reload = async () => {
        await fetchStatuses();
        await fetchSettings();
        await fetchProjects({ archived: showArchived });
      };
      reload();
    }
  }, [sessionVersion, showArchived]);

  // Handle deep-link from dashboard (e.g. ?project=xxx&tab=documents)
  useEffect(() => {
    const projectId = searchParams.get('project');
    const tab = searchParams.get('tab');
    if (projectId && !initialLoading) {
      fetchProject(projectId).then(() => {
        openSidebar(tab || 'documents');
      });
      // Clear query params to avoid re-opening on re-render
      setSearchParams({}, { replace: true });
    }
  }, [initialLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.client?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter (hide mode)
    if (hiddenStatuses.length > 0) {
      result = result.filter(p => !hiddenStatuses.includes(p.status?._id));
    }

    // Sort
    const sort = sortMode || 'manual';
    if (sort !== 'manual') {
      result = [...result].sort((a, b) => {
        if (sort === 'name-asc') return (a.name || '').localeCompare(b.name || '', 'fr');
        if (sort === 'name-desc') return (b.name || '').localeCompare(a.name || '', 'fr');
        if (sort === 'created-desc') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sort === 'created-asc') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sort === 'amount-desc') return (b.unbilledTotal || 0) - (a.unbilledTotal || 0);
        return 0;
      });
    }

    return result;
  }, [projects, searchQuery, hiddenStatuses, sortMode]);

  // Handle project click
  const handleProjectClick = async (project) => {
    await fetchProject(project._id);
    openSidebar('info');
  };

  // Handle invoice badge click → open sidebar on documents tab
  const handleInvoiceClick = async (project) => {
    await fetchProject(project._id);
    openSidebar('documents');
  };

  // Handle sidebar close
  const handleCloseSidebar = () => {
    closeSidebar();
    clearSelectedProject();
  };

  return (
    <div className="relative min-h-[calc(100vh-41px)]">
      {/* Main content */}
      <div
        className={`
          transition-all duration-300
          ${sidebarOpen ? 'mr-[480px]' : ''}
        `}
      >
        <div className="p-6">
          {initialLoading ? (
            <>
              {/* Skeleton: Status filter pills */}
              <div className="mb-6 flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-16 rounded-full" />
                ))}
              </div>

              {/* Skeleton: Project count */}
              <div className="mb-4">
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Skeleton: Project cards grid */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Status filters */}
              <div className="mb-6">
                <StatusFilter />
              </div>

              {/* Project count + view mode toggle + expand toggle */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''}
                  {showArchived && ' (archivés)'}
                </span>

                <div className="flex items-center gap-2">
                  {/* Sort dropdown */}
                  <div className="relative">
                    <select
                      value={sortMode || 'manual'}
                      onChange={(e) => setSortMode(e.target.value)}
                      className="appearance-none pl-7 pr-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-dark-hover text-slate-600 dark:text-slate-300 border-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-card transition-colors"
                    >
                      <option value="manual">Tri manuel</option>
                      <option value="name-asc">A → Z</option>
                      <option value="name-desc">Z → A</option>
                      <option value="created-desc">Plus récent</option>
                      <option value="created-asc">Plus ancien</option>
                      <option value="amount-desc">Montant ↓</option>
                    </select>
                    <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-dark-hover rounded-lg p-0.5">
                    {[
                      { mode: 'grid', icon: LayoutGrid, title: 'Grille' },
                      { mode: 'list', icon: List, title: 'Liste' }
                    ].map(({ mode, icon: Icon, title }) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`p-1.5 rounded-md transition-all ${
                          (viewMode || 'grid') === mode
                            ? 'bg-white dark:bg-dark-card text-primary-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                        title={title}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>

                  {/* Expand/collapse toggle (hidden in list mode) */}
                  {filteredProjects.length > 0 && (viewMode || 'grid') !== 'list' && (
                    <button
                      onClick={() => toggleAllCardsExpanded(filteredProjects.map(p => p._id))}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
                      title={filteredProjects.every(p => expandedCards[p._id]) ? 'Réduire toutes les cartes' : 'Étendre toutes les cartes'}
                    >
                      {filteredProjects.every(p => expandedCards[p._id]) ? (
                        <>
                          <ChevronsDownUp className="w-3.5 h-3.5" />
                          Réduire
                        </>
                      ) : (
                        <>
                          <ChevronsUpDown className="w-3.5 h-3.5" />
                          Étendre
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Grid */}
              <WorkflowGrid
                projects={filteredProjects}
                onProjectClick={handleProjectClick}
                onInvoiceClick={handleInvoiceClick}
                onPositionsChange={updatePositions}
                showArchived={showArchived}
              />
            </>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <ProjectSidebar
        project={selectedProject}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      {/* New Project Modal */}
      <NewProjectModal />
    </div>
  );
}
