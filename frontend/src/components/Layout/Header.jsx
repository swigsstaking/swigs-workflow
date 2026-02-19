import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Settings, Plus, Search, Archive, Sun, Moon, Calendar, BarChart3, Zap, LogIn, LogOut, Home } from 'lucide-react';
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

  const navLink = (to, label, Icon, exact = false) => {
    const isActive = exact ? currentPath === to : currentPath.startsWith(to);
    return (
      <Link
        to={to}
        aria-current={isActive ? 'page' : undefined}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-medium rounded-md transition-colors
          ${isActive
            ? 'text-white bg-white/[0.12]'
            : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }
        `}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className={Icon ? 'hidden md:inline' : ''}>{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0d1117] border-b border-white/[0.06] transition-colors">
      <div className="px-4 py-1.5">
        <div className="flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-1">
            <Link to="/" className="flex items-center gap-2 mr-4">
              <div className="w-6 h-6 bg-primary-500 rounded-md flex items-center justify-center">
                <LayoutGrid className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white hidden sm:inline">
                Swigs
              </span>
            </Link>

            <nav className="flex items-center gap-0.5">
              {navLink('/', 'Accueil', Home, true)}
              {navLink('/workflow', 'Workflow')}
              {navLink('/planning', 'Planning', Calendar)}
              {navLink('/analytics', 'Analytics', BarChart3)}
              {navLink('/automations', 'Automations', Zap)}
              <Link
                to="/settings"
                aria-current={currentPath === '/settings' ? 'page' : undefined}
                className={`
                  p-1.5 rounded-md transition-colors
                  ${currentPath === '/settings'
                    ? 'text-white bg-white/[0.12]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }
                `}
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentPath === '/workflow' && (
              <>
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="
                      w-48 pl-8 pr-3 py-1
                      text-[13px] bg-white/[0.06] border border-white/[0.08] rounded-md
                      text-white
                      placeholder:text-slate-500
                      focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50
                      transition-colors
                    "
                  />
                </div>

                {/* Archive toggle */}
                <button
                  onClick={toggleShowArchived}
                  className={`
                    p-1.5 rounded-md transition-colors
                    ${showArchived
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                    }
                  `}
                  title={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                  aria-label={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                >
                  <Archive className="w-4 h-4" />
                </button>

                {/* New Project */}
                <Button
                  onClick={toggleNewProjectModal}
                  icon={Plus}
                  size="sm"
                  className="!py-1 !px-2.5 !text-[13px] !rounded-md"
                >
                  <span className="hidden sm:inline">Nouveau</span>
                </Button>
              </>
            )}

            {/* Auth */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-slate-400 hidden sm:inline">
                  {user?.name}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithHub}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-[13px] font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Connexion
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
              aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
