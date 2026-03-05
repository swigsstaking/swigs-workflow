import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Loader2, Briefcase, ArrowRight, Clock, FileText, PenLine, CalendarDays, CheckCircle } from 'lucide-react';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Workflow from './pages/Workflow';
import SsoHandler from './components/auth/SsoHandler';
import CookieConsent from './components/CookieConsent';
import { initPostHog, identifyUser, resetUser, trackPageView } from './lib/posthog';

// Lazy-loaded pages
const Secretary = lazy(() => import('./pages/Secretary'));
const Planning = lazy(() => import('./pages/Planning'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));
const PortalView = lazy(() => import('./pages/PortalView'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Init PostHog on load if consent was previously given
initPostHog();

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

// Protect all authenticated routes — shows LandingPage when not logged in
function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <ErrorBoundary>
      <Layout />
    </ErrorBoundary>
  );
}

function App() {
  const { darkMode, accentColor } = useUIStore();
  const { user, isAuthenticated, fetchUser } = useAuthStore();

  // Validate token on mount — logout if stale/expired
  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, fetchUser]);

  // Identify/reset user in PostHog when auth changes
  useEffect(() => {
    if (isAuthenticated && user) {
      identifyUser(user);
    } else {
      resetUser();
    }
  }, [isAuthenticated, user]);

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Apply theme and accent color
  useEffect(() => {
    document.documentElement.dataset.theme = 'v2';
    document.documentElement.dataset.accent = accentColor;
  }, [accentColor]);

  const suspenseFallback = (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-dark-bg">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  return (
    <BrowserRouter>
      <PageViewTracker />
      <SsoHandler />
      <CookieConsent />
      <Routes>
        {/* Public route - Portal (accessible sans authentification) */}
        <Route path="/portal/:token" element={
          <Suspense fallback={suspenseFallback}>
            <ErrorBoundary>
              <PortalView />
            </ErrorBoundary>
          </Suspense>
        } />

        {/* Protected routes — LandingPage if not authenticated */}
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={
            <Suspense fallback={suspenseFallback}>
              <Secretary />
            </Suspense>
          } />
          <Route path="workflow" element={<Workflow />} />
          <Route path="planning" element={
            <Suspense fallback={suspenseFallback}>
              <Planning />
            </Suspense>
          } />
          <Route path="analytics" element={
            <Suspense fallback={suspenseFallback}>
              <Analytics />
            </Suspense>
          } />
          <Route path="comptabilite" element={
            <Suspense fallback={suspenseFallback}>
              <Comptabilite />
            </Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={suspenseFallback}>
              <Settings />
            </Suspense>
          } />
          <Route path="*" element={
            <Suspense fallback={suspenseFallback}>
              <NotFound />
            </Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// Landing page features
const landingFeatures = [
  {
    icon: Briefcase,
    title: 'Gestion de projets',
    description: 'Organisez vos projets sur un canvas visuel. Assignez des statuts, suivez l\'avancement et gardez une vue d\'ensemble.',
  },
  {
    icon: Clock,
    title: 'Suivi des heures',
    description: 'Saisissez vos heures et dépenses par projet. Tout est prêt pour la facturation en un clic.',
  },
  {
    icon: FileText,
    title: 'Factures QR suisses',
    description: 'Générez des factures PDF conformes avec QR-code Swiss QR-bill. Numérotation automatique, TVA 8.1%.',
  },
  {
    icon: PenLine,
    title: 'Devis & signatures',
    description: 'Créez des devis professionnels, envoyez-les à vos clients et suivez les signatures.',
  },
  {
    icon: CalendarDays,
    title: 'Planning',
    description: 'Planifiez vos projets et visualisez votre charge de travail sur un calendrier interactif.',
  },
];

// Landing page for unauthenticated users
function LandingPage() {
  const { loginWithHub, registerWithHub } = useAuthStore();

  const loginUrl = '/api/auth/login';
  const registerUrl = 'https://apps.swigs.online/register?redirect=https://workflow.swigs.online';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <Briefcase className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg">SWIGS Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={loginUrl}
              className="text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2"
            >
              Connexion
            </a>
            <a
              href={registerUrl}
              className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors"
            >
              Essai gratuit 10 jours
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 via-transparent to-transparent dark:from-emerald-950/20 dark:via-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            10 jours d'essai gratuit
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight max-w-4xl mx-auto">
            Projets, heures et{' '}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              factures QR suisses
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Gérez vos projets, saisissez vos heures, créez des devis et générez des factures QR conformes — le tout depuis une interface simple et moderne.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={registerUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-2xl shadow-xl shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 text-base"
            >
              Essai gratuit 10 jours
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href={loginUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-2xl border border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 transition-colors text-base"
            >
              Déjà un compte ? Se connecter
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-400 dark:text-zinc-500">
            Sans carte bancaire. Sans engagement.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold">Tout pour les indépendants & PME</h2>
          <p className="mt-4 text-lg text-slate-500 dark:text-zinc-400 max-w-xl mx-auto">
            Un outil complet pensé pour les professionnels suisses.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {landingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-white dark:bg-zinc-900/50 border-y border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à simplifier votre gestion ?
          </h2>
          <p className="text-lg text-slate-500 dark:text-zinc-400 max-w-xl mx-auto mb-10">
            Rejoignez les professionnels qui utilisent SWIGS Pro pour gérer projets, heures et factures au quotidien.
          </p>
          <a
            href={registerUrl}
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-2xl shadow-xl shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 text-lg"
          >
            Essai gratuit 10 jours
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            SWIGS Pro — Une app de l'écosystème{' '}
            <a
              href="https://swigs.ch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              SWIGS
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-slate-400 dark:text-zinc-500">
            <a href="https://apps.swigs.online" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">Autres apps</a>
            <a href="https://swigs.ch/mentions-legales" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">Mentions légales</a>
            <a href="https://swigs.ch/confidentialite" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">Confidentialité</a>
            <a href="https://swigs.ch/cgu" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">CGU</a>
            <a href="mailto:support@swigs.online" className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
