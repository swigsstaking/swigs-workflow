import { ArrowRight, Clock, FileText, Receipt, CalendarDays, BarChart3, Zap, CheckCircle } from 'lucide-react';
import Logo from '../components/Layout/Logo';

const features = [
  {
    icon: FileText,
    title: 'Gestion de projets',
    description: 'Organisez vos projets sur un canvas visuel. Suivez l\'avancement, les budgets et les deadlines en un coup d\'oeil.',
  },
  {
    icon: Clock,
    title: 'Suivi des heures',
    description: 'Timer intégré et saisie manuelle. Chaque minute est comptée et associée au bon projet pour une facturation précise.',
  },
  {
    icon: Receipt,
    title: 'QR-factures suisses',
    description: 'Générez des factures conformes avec QR-code de paiement suisse, TVA 8.1% et numérotation automatique.',
  },
  {
    icon: CalendarDays,
    title: 'Devis & signatures',
    description: 'Créez des devis professionnels, envoyez-les par email et collectez les signatures électroniques de vos clients.',
  },
  {
    icon: Zap,
    title: 'Relances automatiques',
    description: 'Rappels de paiement à 4 niveaux envoyés automatiquement. Vos factures ne restent plus impayées.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & comptabilité',
    description: 'Tableau de bord avec chiffre d\'affaires, heures facturées et suivi comptable pour piloter votre activité.',
  },
];

export default function LandingPage() {
  const hubUrl = import.meta.env.VITE_HUB_URL || 'https://apps.swigs.online';
  const loginUrl = `${hubUrl}/login?redirect=${encodeURIComponent(window.location.origin)}`;
  const registerUrl = `${hubUrl}/register?redirect=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-800/60">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400/70 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display font-bold text-[15px] tracking-tight">Swigs Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={loginUrl}
              className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2"
            >
              Connexion
            </a>
            <a
              href={registerUrl}
              className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-[6px] transition-all active:scale-[0.98]"
            >
              Essai gratuit
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/15 dark:via-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Dès 15 CHF/mois &middot; Essai gratuit 10 jours
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight max-w-4xl mx-auto tracking-tight">
            Projets, heures et{' '}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              factures
            </span>
            {' '}tout-en-un
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            L'outil de gestion complet pour freelances et PME suisses.
            QR-factures, TVA 8.1%, devis avec signature et relances automatiques.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={registerUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[8px] shadow-xl shadow-emerald-500/20 transition-all hover:shadow-emerald-500/35 active:scale-[0.98] text-base"
            >
              Commencer gratuitement
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href={loginUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-medium rounded-[8px] border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors text-base"
            >
              Connexion
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-400 dark:text-zinc-600">
            Sans carte bancaire &middot; Sans engagement &middot; Données hébergées en Suisse
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Tout pour piloter votre activité</h2>
          <p className="mt-4 text-lg text-slate-500 dark:text-zinc-400 max-w-xl mx-auto">
            De la saisie des heures à l'encaissement, un seul outil suffit.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white dark:bg-zinc-900 rounded-[8px] border border-slate-200/80 dark:border-zinc-800/60 p-6 hover:border-emerald-300/60 dark:hover:border-emerald-500/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-[8px] bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base font-display font-bold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-200/80 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: '8.1%', label: 'TVA suisse intégrée' },
              { value: 'QR', label: 'Factures avec QR-code' },
              { value: '4', label: 'Niveaux de relances' },
              { value: '99.9%', label: 'Disponibilité' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4">
          Prêt à simplifier votre gestion ?
        </h2>
        <p className="text-lg text-slate-500 dark:text-zinc-400 max-w-xl mx-auto mb-10">
          Créez votre compte en 30 secondes et commencez à gérer vos projets, heures et factures.
        </p>
        <a
          href={registerUrl}
          className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[8px] shadow-xl shadow-emerald-500/20 transition-all hover:shadow-emerald-500/35 active:scale-[0.98] text-lg"
        >
          Essayer gratuitement 10 jours
          <ArrowRight className="w-5 h-5" />
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400 dark:text-zinc-500">
            Swigs Pro — Une app de l'écosystème{' '}
            <a
              href="https://swigs.ch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Swigs
            </a>
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-400 dark:text-zinc-500">
            <a
              href="https://apps.swigs.online"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              Autres apps
            </a>
            <a
              href="mailto:support@swigs.online"
              className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              Support
            </a>
            <a
              href="https://swigs.ch"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              swigs.ch
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
