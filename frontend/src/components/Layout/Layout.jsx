import { Outlet } from 'react-router-dom';
import Header from './Header';
import { ToastContainer } from '../ui/Toast';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors">
      <Header />
      <main>
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
