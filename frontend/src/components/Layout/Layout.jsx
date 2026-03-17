import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import TrialBanner from './TrialBanner';
import { ToastContainer } from '../ui/Toast';
import AISidebar from '../AI/AISidebar';
import { useAIStore } from '../../stores/aiStore';
import { useAuthStore } from '../../stores/authStore';

export default function Layout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const fetchSuggestions = useAIStore(s => s.fetchSuggestions);

  // Fetch AI suggestions once on mount (authenticated only)
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => fetchSuggestions(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, fetchSuggestions]);

  return (
    <div className="min-h-screen bg-[rgb(var(--body-light))] dark:bg-dark-bg transition-colors">
      <Header />
      <TrialBanner />
      <main>
        <Outlet />
      </main>
      <AISidebar />
      <ToastContainer />
    </div>
  );
}
