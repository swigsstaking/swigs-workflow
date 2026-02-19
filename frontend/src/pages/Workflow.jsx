import { useEffect, useMemo, useRef, useState } from 'react';
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

  const { fetchSettings } = useSettingsStore();
  const { sessionVersion } = useAuthStore();
  const lastSessionVersion = useRef(sessionVersion);

  const {
    searchQuery,
    statusFilter,
    showArchived,
    openSidebar,
    closeSidebar,
    sidebarOpen
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

  // Filter projects
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

    // Status filter
    if (statusFilter) {
      result = result.filter(p => p.status?._id === statusFilter);
    }

    return result;
  }, [projects, searchQuery, statusFilter]);

  // Handle project click
  const handleProjectClick = async (project) => {
    await fetchProject(project._id);
    openSidebar('info');
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

              {/* Project count */}
              <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''}
                {showArchived && ' (archivés)'}
              </div>

              {/* Grid */}
              <WorkflowGrid
                projects={filteredProjects}
                onProjectClick={handleProjectClick}
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
