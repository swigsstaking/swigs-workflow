import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Settings, Plus, Search, Archive, Sun, Moon, Calendar, BarChart3, Zap, LogIn, LogOut } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import Button from '../ui/Button';

export default function Header() {
  const location = useLocation();
  const {
    searchQuery,
    setSearchQuery,
    showArchived,
    toggleShowArchived,
    toggleNewProjectModal,
    darkMode,
    toggleDarkMode
  } = useUIStore();

  const { user, isAuthenticated, logout, loginWithHub } = useAuthStore();

  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border transition-colors">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-900 dark:text-white">
                Swigs Workflow
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                to="/workflow"
                className={`
                  px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${currentPath === '/workflow'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover'
                  }
                `}
              >
                Workflow
              </Link>
              <Link
                to="/planning"
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${currentPath === '/planning'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover'
                  }
                `}
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden md:inline">Planning</span>
              </Link>
              <Link
                to="/analytics"
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${currentPath === '/analytics'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover'
                  }
                `}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden md:inline">Analytics</span>
              </Link>
              <Link
                to="/automations"
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${currentPath === '/automations'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover'
                  }
                `}
              >
                <Zap className="w-4 h-4" />
                <span className="hidden md:inline">Automations</span>
              </Link>
              <Link
                to="/settings"
                className={`
                  px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${currentPath === '/settings'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover'
                  }
                `}
              >
                <Settings className="w-4 h-4" />
              </Link>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {currentPath === '/workflow' && (
              <>
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un projet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="
                      w-64 pl-10 pr-4 py-2
                      text-sm bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-lg
                      text-slate-900 dark:text-white
                      placeholder:text-slate-400 dark:placeholder:text-slate-500
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      transition-colors
                    "
                  />
                </div>

                {/* Archive toggle */}
                <button
                  onClick={toggleShowArchived}
                  className={`
                    p-2 rounded-lg transition-colors
                    ${showArchived
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover hover:text-slate-600 dark:hover:text-slate-300'
                    }
                  `}
                  title={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                  aria-label={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                >
                  <Archive className="w-5 h-5" />
                </button>

                {/* New Project */}
                <Button
                  onClick={toggleNewProjectModal}
                  icon={Plus}
                >
                  <span className="hidden sm:inline">Nouveau projet</span>
                </Button>
              </>
            )}

            {/* Auth */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {user?.name}
                </span>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
                  title="Deconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithHub}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Connexion
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
              aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
