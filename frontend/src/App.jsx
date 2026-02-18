import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUIStore } from './stores/uiStore';
import Layout from './components/Layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Workflow from './pages/Workflow';
import SsoHandler from './components/auth/SsoHandler';

// Lazy-loaded pages
const Planning = lazy(() => import('./pages/Planning'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Automations = lazy(() => import('./pages/Automations'));
const Settings = lazy(() => import('./pages/Settings'));
const PortalView = lazy(() => import('./pages/PortalView'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  const { darkMode } = useUIStore();

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const suspenseFallback = (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-dark-bg">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  return (
    <BrowserRouter>
      <SsoHandler />
      <Routes>
        {/* Public route - Portal */}
        <Route path="/portal/:token" element={
          <Suspense fallback={suspenseFallback}>
            <ErrorBoundary>
              <PortalView />
            </ErrorBoundary>
          </Suspense>
        } />

        {/* Protected routes */}
        <Route path="/" element={
          <ErrorBoundary>
            <Layout />
          </ErrorBoundary>
        }>
          <Route index element={<Workflow />} />
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
          <Route path="automations" element={
            <Suspense fallback={suspenseFallback}>
              <Automations />
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

export default App;
