import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function SsoHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifySsoToken, logout } = useAuthStore();
  const { fetchProjects, fetchStatuses } = useProjectStore();
  const { fetchSettings } = useSettingsStore();
  const [status, setStatus] = useState('checking'); // checking, verifying, loading, success, error
  const [error, setError] = useState(null);

  useEffect(() => {
    const ssoToken = searchParams.get('sso_token');

    if (!ssoToken) {
      setStatus('none');
      return;
    }

    // Supprimer le token de l'URL pour eviter les replays
    setSearchParams({}, { replace: true });

    // Verifier le token
    handleSsoVerify(ssoToken);
  }, []);

  const handleSsoVerify = async (token) => {
    setStatus('verifying');

    // IMPORTANT: Deconnecter l'utilisateur existant avant de verifier le nouveau token SSO
    // Cela evite le bug ou un utilisateur reste connecte avec l'ancien compte
    await logout();

    const result = await verifySsoToken(token);

    if (result.success) {
      // Token verifie, maintenant charger les donnees
      setStatus('loading');

      try {
        // Charger les donnees en parallele
        await Promise.all([
          fetchStatuses(),
          fetchSettings(),
          fetchProjects()
        ]);

        setStatus('success');

        // Rediriger sans recharger la page et cacher le modal
        setTimeout(() => {
          setStatus('none'); // Cacher le modal
          navigate('/', { replace: true });
        }, 800);
      } catch (loadError) {
        console.error('Error loading data after SSO:', loadError);
        // Meme si le chargement echoue, l'utilisateur est connecte
        // Les donnees se chargeront au prochain render
        setStatus('success');
        setTimeout(() => {
          setStatus('none'); // Cacher le modal
          navigate('/', { replace: true });
        }, 800);
      }
    } else {
      setStatus('error');
      setError(result.error);
    }
  };

  // Ne rien afficher si pas de token SSO
  if (status === 'none' || status === 'checking') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-card rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
        {status === 'verifying' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Connexion en cours...
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Verification de votre session SWIGS Hub
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Chargement des donnees...
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Preparation de votre espace de travail
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Connecte !
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Bienvenue dans votre espace Workflow
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Erreur de connexion
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              {error || 'Impossible de verifier votre session'}
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-4 py-2 bg-slate-200 dark:bg-dark-hover rounded-lg text-sm font-medium hover:bg-slate-300 dark:hover:bg-dark-border transition-colors"
            >
              Continuer sans connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
