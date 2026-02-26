import { Outlet } from 'react-router-dom';
import { LogIn, Sparkles } from 'lucide-react';
import Header from './Header';
import { ToastContainer } from '../ui/Toast';
import { useAuthStore } from '../../stores/authStore';

export default function Layout() {
  const { isAuthenticated, loginWithHub } = useAuthStore();

  return (
    <div className="min-h-screen bg-[rgb(var(--body-light))] dark:bg-dark-bg transition-colors">
      <Header />
      <main>
        <Outlet />
      </main>
      <ToastContainer />

      {/* Auth gate — blocks interaction when not logged in */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-border w-full max-w-sm mx-4 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Bienvenue sur Swigs Pro
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Connectez-vous ou créez un compte pour profiter de l'essai gratuit et accéder à tous vos projets.
            </p>

            <button
              onClick={loginWithHub}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Se connecter / Créer un compte
            </button>

            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Essai gratuit — aucune carte bancaire requise
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
