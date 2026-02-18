import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-7xl font-bold text-slate-200 dark:text-dark-border mb-4">404</p>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
        Page introuvable
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link to="/">
        <Button icon={Home}>Retour au workflow</Button>
      </Link>
    </div>
  );
}
