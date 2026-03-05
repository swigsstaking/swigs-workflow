import { Crown, ArrowRight } from 'lucide-react';

/**
 * UpgradePrompt — shown when a Compta Plus feature is gated.
 * Can be inline (within a page) or as a full-page overlay.
 */
export default function UpgradePrompt({ feature, inline = false }) {
  const hubUrl = import.meta.env.VITE_HUB_URL || 'https://apps.swigs.online';
  const upgradeUrl = `${hubUrl}/marketplace/swigs-workflow#compta-plus`;

  if (inline) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {feature || 'Cette fonctionnalité'} nécessite le module Compta Plus
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Option à 10 CHF/mois — Multi-banque, catégories de dépenses, export fiduciaire et plus.
          </p>
        </div>
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex-shrink-0"
        >
          Activer
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-6">
        <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Module Compta Plus
      </h2>
      <p className="text-slate-600 dark:text-slate-400 max-w-md mb-2">
        {feature || 'Cette fonctionnalité'} fait partie du module Compta Plus pour Swigs Pro.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md mb-8">
        Multi-banque, catégories de dépenses, classification auto des fournisseurs,
        pièces jointes, analytics P&L, TVA nette et export fiduciaire complet.
      </p>
      <div className="flex items-center gap-4">
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30"
        >
          <Crown className="w-4 h-4" />
          Activer Compta Plus — 10 CHF/mois
        </a>
      </div>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Sans engagement. Annulation à tout moment.
      </p>
    </div>
  );
}
