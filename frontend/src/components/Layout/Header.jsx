/**
 * SWIGS Pro Header — "Carte Alpine" redesign.
 * - Topographic texture overlay at 4% opacity
 * - Swiss-grid precision spacing
 * - Active nav: filled pill bg + 3px bottom accent bar
 * - SWIGS Swiss cross logo + Jakarta Sans wordmark
 * - Stone-bordered search input
 */

import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Settings, Plus, Search, Archive, Sun, Moon,
  Calendar, BarChart3, Zap, LogIn, LogOut, Menu, X,
  Home, Layers, Calculator,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useTimerStore } from '../../stores/timerStore';
import TimerWidget from './TimerWidget';
import Logo from './Logo';

const NAV_ITEMS = [
  { to: '/',            label: 'Briefing',    icon: Home,     exact: true },
  { to: '/workflow',    label: 'Projets',     icon: Layers },
  { to: '/planning',   label: 'Planning',    icon: Calendar },
  { to: '/analytics',  label: 'Analytics',   icon: BarChart3 },
  { to: '/automations',label: 'Automations', icon: Zap },
  { to: '/comptabilite',label: 'Comptabilité', icon: Calculator },
];

const ACCENT_OPTIONS = [
  { name: 'emerald', bg: 'bg-emerald-500' },
  { name: 'teal',    bg: 'bg-teal-500' },
  { name: 'lime',    bg: 'bg-lime-500' },
];

export default function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef(null);

  const {
    searchQuery, setSearchQuery,
    showArchived, toggleShowArchived,
    toggleNewProjectModal,
    darkMode, toggleDarkMode,
    accentColor, setAccentColor,
  } = useUIStore();

  const { user, isAuthenticated, logout, loginWithHub } = useAuthStore();
  const { activeTimer, fetchActive } = useTimerStore();

  const currentPath = location.pathname;
  const isWorkflow = currentPath === '/workflow';

  useEffect(() => {
    if (isAuthenticated) fetchActive();
  }, [isAuthenticated]); // eslint-disable-line

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchRef.current) {
      setTimeout(() => mobileSearchRef.current?.focus(), 150);
    }
  }, [mobileSearchOpen]);

  const isNavActive = (item) =>
    item.exact ? currentPath === item.to : currentPath.startsWith(item.to);

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // Shared focus ring classes
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-[rgb(var(--swigs-stone)/0.25)] dark:border-white/[0.06]">

      <div className="relative px-3 sm:px-5 h-12 flex items-center gap-2">

        {/* Zone 1: Hamburger (mobile) + Logo + Desktop Nav */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`md:hidden p-1.5 rounded-[6px] text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] transition-all duration-200 mr-0.5 ${focusRing}`}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.span key="x" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-4 h-4" />
                </motion.span>
              ) : (
                <motion.span key="menu" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Logo + Wordmark */}
          <Link
            to="/"
            className={`flex items-center gap-2 mr-4 group ${focusRing} rounded-[6px]`}
          >
            <Logo size={22} />
            <span className="text-[13.5px] font-display font-semibold tracking-tight text-slate-900 dark:text-white hidden sm:inline">
              SWIGS Pro
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] font-medium
                    rounded-[6px] transition-all duration-200
                    ${focusRing}
                    ${isActive
                      ? 'bg-primary-50/90 dark:bg-primary-500/[0.08] text-primary-700 dark:text-primary-300'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.04]'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {/* Active indicator — 3px bottom bar */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-primary-500 rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Settings */}
            <Link
              to="/settings"
              aria-current={currentPath === '/settings' ? 'page' : undefined}
              aria-label="Paramètres"
              className={`
                relative p-1.5 rounded-[6px] transition-all duration-200
                ${focusRing}
                ${currentPath === '/settings'
                  ? 'bg-primary-50/90 dark:bg-primary-500/[0.08] text-primary-700 dark:text-primary-300'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.04]'
                }
              `}
            >
              <Settings className="w-3.5 h-3.5" />
              {currentPath === '/settings' && (
                <span className="absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-primary-500 rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        {/* Zone 2: Search (workflow) */}
        {isWorkflow ? (
          <div className="flex-1 flex justify-center min-w-0 px-2">
            {/* Desktop search — SWIGS stone border */}
            <div className={`relative w-full hidden md:block transition-all duration-300 ${activeTimer ? 'max-w-xs' : 'max-w-md'}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] dark:text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-9 pr-3 py-1.5 text-[13px]
                  bg-[rgb(var(--swigs-cream)/0.4)] dark:bg-white/[0.04]
                  border border-[rgb(var(--swigs-stone)/0.45)] dark:border-white/[0.08]
                  rounded-[6px] text-slate-900 dark:text-white
                  placeholder:text-slate-400 dark:placeholder:text-zinc-500
                  transition-all duration-200
                  focus:outline-none focus:bg-white dark:focus:bg-white/[0.07]
                  focus:border-primary-400 dark:focus:border-primary-500/40
                  focus:ring-2 focus:ring-primary-500/15
                "
              />
            </div>

            {/* Mobile search expand */}
            <div className="md:hidden flex items-center">
              <AnimatePresence mode="wait">
                {mobileSearchOpen ? (
                  <motion.div
                    key="search-input"
                    initial={{ width: 32, opacity: 0 }}
                    animate={{ width: 180, opacity: 1 }}
                    exit={{ width: 32, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgb(var(--swigs-stone))] pointer-events-none" />
                    <input
                      ref={mobileSearchRef}
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => { if (!searchQuery) setMobileSearchOpen(false); }}
                      className="
                        w-full pl-7 pr-7 py-1.5 text-[13px]
                        bg-[rgb(var(--swigs-cream)/0.4)] dark:bg-white/[0.06]
                        border border-[rgb(var(--swigs-stone)/0.45)] dark:border-white/[0.1]
                        rounded-[6px] text-slate-900 dark:text-white placeholder:text-slate-400
                        focus:outline-none focus:ring-2 focus:ring-primary-500/20
                      "
                    />
                    <button
                      onClick={() => { setSearchQuery(''); setMobileSearchOpen(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="search-icon"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setMobileSearchOpen(true)}
                    className={`p-1.5 rounded-[6px] text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05] transition-all ${focusRing}`}
                    aria-label="Rechercher un projet"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Zone 3: Actions + Auth */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTimer && <TimerWidget />}

          {/* Workflow actions */}
          {isWorkflow && (
            <div className="flex items-center gap-1 ml-0.5 pl-2 border-l border-[rgb(var(--swigs-stone)/0.25)] dark:border-white/[0.06]">
              <button
                onClick={toggleShowArchived}
                className={`
                  p-1.5 rounded-[6px] transition-all duration-200 ${focusRing}
                  ${showArchived
                    ? 'bg-amber-100/80 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05]'
                  }
                `}
                title={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                aria-label={showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
                aria-pressed={showArchived}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleNewProjectModal}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1
                  bg-primary-50 dark:bg-primary-500/15
                  hover:bg-primary-100 dark:hover:bg-primary-500/25
                  text-primary-600 dark:text-primary-400
                  rounded-[6px] text-[12.5px] font-medium
                  transition-all duration-200 ${focusRing}
                `}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-4 bg-[rgb(var(--swigs-stone)/0.3)] dark:bg-white/[0.06] mx-0.5" />

          {/* Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1">
              <div
                className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-[10px] font-semibold text-primary-700 dark:text-primary-400 cursor-default select-none"
                title={user?.name}
                aria-label={`Connecté en tant que ${user?.name}`}
              >
                {userInitials}
              </div>
              <button
                onClick={logout}
                className={`p-1.5 rounded-[6px] text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 ${focusRing}`}
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithHub}
              className={`flex items-center gap-1.5 px-2.5 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded-[6px] text-[12.5px] font-medium transition-all duration-200 active:scale-[0.98] ${focusRing}`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Connexion
            </button>
          )}

          {/* Accent color picker */}
          <div className="flex items-center">
            {ACCENT_OPTIONS.map(({ name, bg }) => (
              <button
                key={name}
                onClick={() => setAccentColor(name)}
                className={`p-2 rounded-[6px] flex items-center justify-center transition-all duration-200 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05] ${focusRing}`}
                title={`Accent ${name.charAt(0).toUpperCase() + name.slice(1)}`}
                aria-label={`Couleur d'accent : ${name}`}
                aria-pressed={accentColor === name}
              >
                <span
                  className={`w-3 h-3 rounded-full ${bg} transition-all duration-200 ${
                    accentColor === name
                      ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ring-current scale-110'
                      : 'opacity-35 scale-90'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-[6px] hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05] transition-all duration-200 flex items-center justify-center ${focusRing}`}
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
            aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            aria-pressed={darkMode}
          >
            <AnimatePresence mode="wait" initial={false}>
              {darkMode ? (
                <motion.span key="moon" initial={{ scale: 0.5, rotate: -90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.5, rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="w-3.5 h-3.5 text-primary-400" />
                </motion.span>
              ) : (
                <motion.span key="sun" initial={{ scale: 0.5, rotate: 90, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.5, rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-12 z-30 bg-black/40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              key="mobile-drawer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full left-0 right-0 z-30 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-xl border-b border-[rgb(var(--swigs-stone)/0.2)] dark:border-white/[0.06] shadow-xl md:hidden"
            >
              {isWorkflow && (
                <div className="px-4 pt-3 pb-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Rechercher un projet..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="
                        w-full pl-9 pr-3 py-2 text-sm
                        bg-[rgb(var(--swigs-cream)/0.5)] dark:bg-white/[0.05]
                        border border-[rgb(var(--swigs-stone)/0.4)] dark:border-white/[0.08]
                        rounded-[6px] text-slate-900 dark:text-white placeholder:text-slate-400
                        focus:outline-none focus:ring-2 focus:ring-primary-500/20
                      "
                    />
                  </div>
                </div>
              )}

              <nav className="px-4 py-3 flex flex-col gap-0.5" aria-label="Navigation mobile">
                {NAV_ITEMS.map((item) => {
                  const isActive = isNavActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={isActive ? 'page' : undefined}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 text-[13.5px] font-medium rounded-[6px]
                        transition-all duration-200 ${focusRing}
                        ${isActive
                          ? 'bg-primary-50/90 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                          : 'text-slate-600 dark:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                    </Link>
                  );
                })}

                <Link
                  to="/settings"
                  aria-current={currentPath === '/settings' ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-[13.5px] font-medium rounded-[6px]
                    transition-all duration-200 ${focusRing}
                    ${currentPath === '/settings'
                      ? 'bg-primary-50/90 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05]'
                    }
                  `}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  Paramètres
                  {currentPath === '/settings' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                </Link>

                <div className="pt-2 mt-2 border-t border-[rgb(var(--swigs-stone)/0.2)] dark:border-white/[0.06] flex items-center justify-between">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-primary-400">
                        {userInitials}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-zinc-300 truncate max-w-[140px]">{user?.name}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => { loginWithHub(); setMobileMenuOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-[6px] text-sm font-medium transition-all"
                    >
                      <LogIn className="w-4 h-4" />
                      Se connecter
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    {ACCENT_OPTIONS.map(({ name, bg }) => (
                      <button
                        key={name}
                        onClick={() => setAccentColor(name)}
                        className="p-2 rounded-[6px] transition-all"
                        aria-label={`Accent ${name}`}
                        aria-pressed={accentColor === name}
                      >
                        <span className={`w-4 h-4 rounded-full ${bg} block transition-all ${accentColor === name ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ring-slate-400 scale-110' : 'opacity-40'}`} />
                      </button>
                    ))}
                    <button
                      onClick={toggleDarkMode}
                      className="p-2 rounded-[6px] hover:bg-[rgb(var(--swigs-stone)/0.1)] dark:hover:bg-white/[0.05] transition-colors"
                      aria-label={darkMode ? 'Mode clair' : 'Mode sombre'}
                    >
                      {darkMode
                        ? <Moon className="w-4 h-4 text-primary-400" />
                        : <Sun className="w-4 h-4 text-amber-500" />
                      }
                    </button>
                    {isAuthenticated && (
                      <button
                        onClick={() => { logout(); setMobileMenuOpen(false); }}
                        className="p-2 rounded-[6px] text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        aria-label="Déconnexion"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
