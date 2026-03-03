import { useState } from 'react';
import { X, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { planningApi } from '../../services/api';
import Button from '../ui/Button';

export default function CalendarSyncModal({ isOpen, onClose }) {
  const [calendarUrl, setCalendarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [showRegenWarning, setShowRegenWarning] = useState(false);

  const generateToken = async (regenerate = false) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const { data } = await planningApi.generateCalendarToken();
      setCalendarUrl(data.data.url);
      if (regenerate) setShowRegenWarning(false);
    } catch (err) {
      setError('Erreur lors de la génération du lien');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = calendarUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-border">
          <h2 className="font-display font-bold text-[15px] text-slate-900 dark:text-white">
            Synchroniser le calendrier
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Explanation */}
          <p className="text-[13px] text-slate-500 dark:text-zinc-400">
            Générez un lien iCal pour synchroniser votre planning SWIGS avec Google Calendar, Apple Calendar ou Outlook. Les calendriers se mettent à jour automatiquement.
          </p>

          {/* Generate / URL section */}
          {!calendarUrl ? (
            <div className="flex justify-center">
              <Button onClick={() => generateToken()} disabled={loading}>
                {loading ? 'Génération...' : 'Générer le lien'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Lien iCal
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={calendarUrl}
                  className="flex-1 px-3 py-2 text-[12.5px] rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-mono truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`
                    p-2.5 rounded-lg border transition-colors shrink-0
                    ${copied
                      ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                      : 'bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }
                  `}
                  title={copied ? 'Copié !' : 'Copier le lien'}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Regenerate */}
              {!showRegenWarning ? (
                <button
                  onClick={() => setShowRegenWarning(true)}
                  className="flex items-center gap-1.5 text-[12px] text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Régénérer le lien
                </button>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[12px] text-amber-700 dark:text-amber-300">
                      Cela invalidera l'ancien lien. Les calendriers déjà connectés ne se synchroniseront plus.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => generateToken(true)} disabled={loading}>
                        {loading ? 'Régénération...' : 'Confirmer'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setShowRegenWarning(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-500">{error}</p>
          )}

          {/* Instructions */}
          {calendarUrl && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-dark-border">
              <h3 className="text-[13px] font-semibold text-slate-700 dark:text-zinc-300">
                Comment ajouter à votre calendrier
              </h3>

              {/* Google Calendar */}
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-400">
                  Google Calendar
                </p>
                <ol className="text-[12px] text-slate-500 dark:text-zinc-400 space-y-0.5 pl-4 list-decimal">
                  <li>Ouvrez Google Calendar (web)</li>
                  <li>Cliquez sur le <strong>+</strong> à côté de "Autres agendas"</li>
                  <li>Sélectionnez "À partir de l'URL"</li>
                  <li>Collez le lien ci-dessus et cliquez "Ajouter l'agenda"</li>
                </ol>
              </div>

              {/* Apple Calendar */}
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-400">
                  Apple Calendar
                </p>
                <ol className="text-[12px] text-slate-500 dark:text-zinc-400 space-y-0.5 pl-4 list-decimal">
                  <li>Ouvrez Calendrier sur Mac</li>
                  <li>Fichier → Nouvel abonnement à un calendrier...</li>
                  <li>Collez le lien et cliquez "S'abonner"</li>
                </ol>
              </div>

              {/* Outlook */}
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-400">
                  Outlook
                </p>
                <ol className="text-[12px] text-slate-500 dark:text-zinc-400 space-y-0.5 pl-4 list-decimal">
                  <li>Ouvrez Outlook Calendar (web)</li>
                  <li>Cliquez "Ajouter un calendrier" → "S'abonner à partir du web"</li>
                  <li>Collez le lien et cliquez "Importer"</li>
                </ol>
              </div>

              {/* Infomaniak */}
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-400">
                  Infomaniak (kSuite / Mail)
                </p>
                <ol className="text-[12px] text-slate-500 dark:text-zinc-400 space-y-0.5 pl-4 list-decimal">
                  <li>Ouvrez votre calendrier Infomaniak (kcalendar.infomaniak.com)</li>
                  <li>Cliquez sur l'icône <strong>+</strong> à côté de "Mes calendriers"</li>
                  <li>Sélectionnez "S'abonner à un calendrier (URL)"</li>
                  <li>Collez le lien et validez</li>
                </ol>
              </div>
              {/* Generic iCal message */}
              <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-lg">
                <p className="text-[12px] text-slate-500 dark:text-zinc-400">
                  <strong className="text-slate-600 dark:text-zinc-300">Autre application ?</strong> Ce lien utilise le format standard iCal (.ics), compatible avec la plupart des applications de calendrier : Thunderbird, Fastmail, Proton Calendar, Nextcloud, Synology Calendar, Zimbra, et bien d'autres. Cherchez l'option "S'abonner à un calendrier par URL" dans votre application.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
