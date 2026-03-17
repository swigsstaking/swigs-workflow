import { Outlet } from 'react-router-dom';
import Header from './Header';
import TrialBanner from './TrialBanner';
import { ToastContainer } from '../ui/Toast';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[rgb(var(--body-light))] dark:bg-dark-bg transition-colors">
      <Header />
      <TrialBanner />
      <main>
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
