import { useState } from 'react';
import { Bot, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { apiTokenApi } from '../../../services/api';

export default function TelegramBotSection() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateToken = async () => {
    setLoading(true);
    try {
      const { data } = await apiTokenApi.generate();
      setToken(data.token);
    } catch (err) {
      console.error('Failed to generate token:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(`/login ${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bot Telegram</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Connecte ton compte SWIGS Pro au bot Telegram pour g&eacute;rer tes factures, projets et clients depuis ton t&eacute;l&eacute;phone.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-slate-50 dark:bg-dark-card rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-900 dark:text-white">Comment se connecter</h3>
        <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold">1</span>
            <span>Ouvre Telegram et cherche <strong>@swigspro_bot</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold">2</span>
            <span>G&eacute;n&egrave;re un token API ci-dessous</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold">3</span>
            <span>Colle la commande dans le chat Telegram avec le bot</span>
          </li>
        </ol>
      </div>

      {/* Token generation */}
      <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-900 dark:text-white">Token API</h3>
          <button
            onClick={generateToken}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {token ? 'Reg\u00E9n\u00E9rer' : 'G\u00E9n\u00E9rer un token'}
          </button>
        </div>

        {token && (
          <div className="space-y-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Ce token expire dans 90 jours. Ne le partage avec personne.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-slate-100 dark:bg-dark-bg px-3 py-2 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
                /login {token}
              </code>
              <button
                onClick={copyToken}
                className="flex-shrink-0 px-3 py-2 bg-slate-200 dark:bg-dark-border hover:bg-slate-300 dark:hover:bg-dark-hover rounded-lg transition-colors"
                title="Copier"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Colle cette commande dans le chat avec @swigspro_bot sur Telegram.
            </p>
          </div>
        )}
      </div>

      {/* What you can do */}
      <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl p-5 space-y-3">
        <h3 className="font-medium text-slate-900 dark:text-white">Ce que tu peux faire</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
          {[
            '"briefing" \u2014 Alertes & pr\u00E9visions',
            '"factures impay\u00E9es" \u2014 Liste compl\u00E8te',
            '"cash flow" \u2014 Pr\u00E9visions tr\u00E9sorerie',
            '"mauvais payeurs" \u2014 Clients lents',
            '"top clients" \u2014 Classement CA',
            '"d\u00E9marre timer Projet X"',
            '"heures non factur\u00E9es"',
            '"rentabilit\u00E9" \u2014 Marge nette',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Bot className="w-3.5 h-3.5 mt-0.5 text-primary-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
