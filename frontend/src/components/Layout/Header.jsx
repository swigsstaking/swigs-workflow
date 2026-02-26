import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Plus, Search, Archive, Sun, Moon, Calendar, BarChart3, Zap, LogIn, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useTimerStore } from '../../stores/timerStore';
import TimerWidget from './TimerWidget';
import Logo from './Logo';

export default function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    showArchived,
    toggleShowArchived,
    toggleNewProjectModal,
    darkMode,
    toggleDarkMode,
    accentColor,
    setAccentColor
  } = useUIStore();

  const { user, isAuthenticated, logout, loginWithHub } = useAuthStore();
  const { activeTimer, fetchActive } = useTimerStore();

  const currentPath = location.pathname;
  const isWorkflow = currentPath === '/workflow';

  useEffect(() => {
    if (isAuthenticated) {
      fetchActive();
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = [
    { to: '/workflow', label: 'Projets' },
    { to: '/planning', label: 'Planning', icon: Calendar },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/automations', label: 'Automations', icon: Zap },
  ];

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] border-t-[2px] border-t-primary-500">
      <div className="px-4 h-11 flex items-center gap-3">

        {/* Zone 1: Logo + Nav */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="md:hidden p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200 mr-1"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <Link to="/" className="flex items-center gap-2 mr-3 group">
            <Logo size={24} />
            <span className="text-sm font-semibold font-display tracking-tight text-slate-900 dark:text-white hidden sm:inline">
              Swigs Pro
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200
                    ${isActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }
                  `}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span className={Icon ? 'hidden lg:inline' : ''}>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary-500 rounded-full" />
                  )}
                </Link>
              );
            })}
            <Link
              to="/settings"
              aria-current={currentPath === '/settings' ? 'page' : undefined}
              className={`
                relative p-1.5 rounded-md transition-all duration-200
                ${currentPath === '/settings'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }
              `}
            >
              <Settings className="w-3.5 h-3.5" />
              {currentPath === '/settings' && (
                <span className="absolute bottom-0 left-1.5 right-1.5 h-[2px] bg-primary-500 rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        {/* Zone 2: Centered Search (workflow only) */}
        {isWorkflow ? (
          <div className="flex-1 flex justify-center min-w-0 px-2">
            <div className={`relative w-full hidden md:block transition-all duration-300 ${activeTimer ? 'max-w-xs' : 'max-w-md'}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-9 pr-3 py-1.5
                  text-[13px] bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg
                  text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500
                  focus:outline-none focus:bg-white dark:focus:bg-white/[0.08] focus:border-slate-300 dark:focus:border-white/[0.15] focus:ring-1 focus:ring-primary-500/30
                  transition-all duration-200
                "
              />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Zone 3: Widgets + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTimer && <TimerWidget />}

          {/* Workflow actions */}
          {isWorkflow && (
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200 dark:border-white/[0.06]">
              <button
                onClick={toggleShowArchived}
                className={`
                  p-1.5 rounded-md transition-all duration-200
                  ${showArchived
                    ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                  }
                `}
                title={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                aria-label={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleNewProjectModal}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-500/15 hover:bg-primary-100 dark:hover:bg-primary-500/25 text-primary-600 dark:text-primary-400 rounded-md text-[13px] font-medium transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </div>
          )}

          {/* Separator */}
          <div className="w-px h-4 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />

          {/* Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <div
                className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-xs font-semibold text-primary-600 dark:text-primary-400"
                title={user?.name}
              >
                {userInitials}
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-3.5 h-3.5" />
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

          {/* Accent color picker — min 44×44px touch target via padding */}
          <div className="flex items-center gap-0.5">
            {[
              { name: 'emerald', color: 'bg-emerald-500' },
              { name: 'teal', color: 'bg-teal-500' },
              { name: 'lime', color: 'bg-lime-500' },
            ].map(({ name, color }) => (
              <button
                key={name}
                onClick={() => setAccentColor(name)}
                className={`p-2.5 rounded-md flex items-center justify-center transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]`}
                title={name.charAt(0).toUpperCase() + name.slice(1)}
                aria-label={`Accent ${name}`}
                aria-pressed={accentColor === name}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${color} transition-all duration-200 ${
                  accentColor === name
                    ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ring-slate-300 dark:ring-white/30 scale-110'
                    : 'opacity-40'
                }`} />
              </button>
            ))}
          </div>

          {/* Dark mode — min 44×44px touch target */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors duration-200 flex items-center justify-center"
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
            aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            aria-pressed={darkMode}
          >
            {darkMode
              ? <Moon className="w-3.5 h-3.5 text-primary-400" />
              : <Sun className="w-3.5 h-3.5 text-amber-500" />
            }
          </button>
        </div>
      </div>

      {/* Mobile drawer — slide down from header */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-11 z-30 bg-black/40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              key="mobile-drawer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full left-0 right-0 z-30 bg-white dark:bg-dark-bg border-b border-slate-200 dark:border-white/[0.06] shadow-xl md:hidden"
            >
              <nav className="px-4 py-3 flex flex-col gap-1">
                {navItems.map(({ to, label, icon: Icon }) => {
                  const isActive = currentPath.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      aria-current={isActive ? 'page' : undefined}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      {Icon
                        ? <Icon className="w-4 h-4 shrink-0" />
                        : <div className="w-4 h-4 shrink-0" />
                      }
                      {label}
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                      )}
                    </Link>
                  );
                })}

                {/* Settings link */}
                <Link
                  to="/settings"
                  aria-current={currentPath === '/settings' ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-200
                    ${currentPath === '/settings'
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }
                  `}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  Settings
                  {currentPath === '/settings' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Link>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
