import { Clock, AlertTriangle, CreditCard, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

/**
 * TrialBanner — Shows subscription status alerts (trial ending, past due, etc.)
 * Displayed between Header and main content.
 */
export default function TrialBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);

  const subscription = user?.subscription;

  if (!subscription || dismissed) return null;

  const hubUrl = import.meta.env.VITE_HUB_URL || 'https://apps.swigs.online';
  const billingUrl = `${hubUrl}/settings/billing`;

  // Trial ending soon (≤ 5 days remaining)
  if (subscription.status === 'trialing' && subscription.daysRemaining != null && subscription.daysRemaining <= 5) {
    const days = subscription.daysRemaining;
    const urgent = days <= 1;

    return (
      <div className={`relative px-4 py-2.5 text-sm flex items-center justify-center gap-2 ${
        urgent
          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800'
      }`}>
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span>
          {days === 0
            ? "Votre essai gratuit se termine aujourd'hui."
            : `Votre essai gratuit se termine dans ${days} jour${days > 1 ? 's' : ''}.`
          }
        </span>
        <a
          href={billingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-medium underline underline-offset-2 ${
            urgent ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'
          }`}
        >
          Ajouter un moyen de paiement
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Past due
  if (subscription.status === 'past_due') {
    return (
      <div className="relative px-4 py-2.5 text-sm flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>Votre paiement a échoué.</span>
        <a
          href={billingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 text-red-800 dark:text-red-200"
        >
          Mettre à jour votre paiement
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Cancelling at period end
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const endDate = new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-CH', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
      <div className="relative px-4 py-2.5 text-sm flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
        <CreditCard className="w-4 h-4 flex-shrink-0" />
        <span>Votre abonnement sera annulé le {endDate}.</span>
        <a
          href={billingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 text-slate-700 dark:text-slate-300"
        >
          Réactiver
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
