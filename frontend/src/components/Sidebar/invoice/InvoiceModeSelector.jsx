import { Receipt, FileText } from 'lucide-react';

export default function InvoiceModeSelector({ mode, setMode }) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex gap-2">
        <button
          onClick={() => setMode('standard')}
          title="Facturer depuis vos devis signés et événements"
          className={`
            flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all
            ${mode === 'standard'
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <Receipt className="w-4 h-4" />
            <span>Standard</span>
          </div>
          <p className={`text-xs mt-1 ${mode === 'standard' ? 'text-primary-100' : 'text-slate-400'}`}>
            Depuis événements et devis
          </p>
        </button>
        <button
          onClick={() => setMode('custom')}
          title="Créer une facture avec des lignes personnalisées"
          className={`
            flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all
            ${mode === 'custom'
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }
          `}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Libre</span>
          </div>
          <p className={`text-xs mt-1 ${mode === 'custom' ? 'text-primary-100' : 'text-slate-400'}`}>
            Lignes personnalisées
          </p>
        </button>
      </div>
    </div>
  );
}
