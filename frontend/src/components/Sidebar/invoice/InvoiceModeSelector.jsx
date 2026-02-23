import { Receipt, FileText, RefreshCw } from 'lucide-react';

const MODES = [
  { mode: 'standard', icon: Receipt, label: 'Standard', subtitle: 'Depuis événements et devis' },
  { mode: 'custom', icon: FileText, label: 'Libre', subtitle: 'Lignes personnalisées' },
  { mode: 'recurring', icon: RefreshCw, label: 'Récurrence', subtitle: 'Facturation périodique' },
];

export default function InvoiceModeSelector({ mode, setMode }) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex gap-2">
        {MODES.map(({ mode: m, icon: Icon, label, subtitle }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            title={subtitle}
            className={`
              flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${mode === m
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </div>
            <p className={`text-xs mt-1 ${mode === m ? 'text-primary-100' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
