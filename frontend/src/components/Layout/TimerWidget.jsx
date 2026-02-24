import { useState } from 'react';
import { Play, Pause, Square, Trash2, Check } from 'lucide-react';
import { useTimerStore } from '../../stores/timerStore';
import { useToastStore } from '../../stores/toastStore';

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':');
}

export default function TimerWidget() {
  const { activeTimer, elapsed, pause, resume, stop, discard } = useTimerStore();
  const { addToast } = useToastStore();
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [stopDescription, setStopDescription] = useState('');

  if (!activeTimer) return null;

  const isRunning = activeTimer.status === 'running';
  const projectName = activeTimer.projectId?.name || 'Projet';

  const handlePauseResume = async () => {
    try {
      if (isRunning) {
        await pause();
      } else {
        await resume();
      }
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la mise en pause' });
    }
  };

  const handleStopOpen = () => {
    setStopDescription(activeTimer.description || '');
    setShowStopConfirm(true);
    setShowDiscardConfirm(false);
  };

  const handleStopConfirm = async () => {
    try {
      const event = await stop({ description: stopDescription || activeTimer.description || 'Session de travail' });
      setShowStopConfirm(false);
      addToast({
        type: 'success',
        message: `Session enregistrée : ${event.hours}h pour ${projectName}`
      });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de l\'arrêt du timer' });
    }
  };

  const handleDiscardConfirm = async () => {
    try {
      await discard();
      setShowDiscardConfirm(false);
      addToast({ type: 'success', message: 'Timer supprimé' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la suppression du timer' });
    }
  };

  const cancelAll = () => {
    setShowStopConfirm(false);
    setShowDiscardConfirm(false);
  };

  return (
    <div className="relative flex items-center">
      {/* Stop confirmation popover */}
      {showStopConfirm && (
        <div className="absolute top-full right-0 mt-2.5 w-72 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-xl dark:shadow-2xl dark:shadow-black/40 p-3.5 z-50">
          <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">Arrêter le timer</p>
          <p className="text-xs text-slate-500 mb-3">
            {formatElapsed(elapsed)} travaillées sur <span className="text-slate-700 dark:text-slate-400">{projectName}</span>
          </p>
          <input
            type="text"
            value={stopDescription}
            onChange={(e) => setStopDescription(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40 focus:border-primary-500/40 mb-3 transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={handleStopConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Check className="w-3 h-3" />
              Enregistrer
            </button>
            <button
              onClick={cancelAll}
              className="px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-400 rounded-lg text-xs transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Discard confirmation popover */}
      {showDiscardConfirm && (
        <div className="absolute top-full right-0 mt-2.5 w-64 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-xl dark:shadow-2xl dark:shadow-black/40 p-3.5 z-50">
          <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">Supprimer le timer ?</p>
          <p className="text-xs text-slate-500 mb-3">Le temps enregistré sera perdu.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDiscardConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Supprimer
            </button>
            <button
              onClick={cancelAll}
              className="px-3 py-1.5 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-400 rounded-lg text-xs transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Main timer pill */}
      <div className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300
        ${isRunning
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
          : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20'
        }
      `}>
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {isRunning && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`} />
        </span>

        <span className="text-[13px] font-mono font-medium text-slate-900 dark:text-white tabular-nums">
          {formatElapsed(elapsed)}
        </span>
        <span className="text-xs text-slate-500 hidden sm:inline max-w-[80px] truncate">
          {projectName}
        </span>

        <div className="flex items-center gap-0.5 ml-0.5">
          <button
            onClick={handlePauseResume}
            className={`p-1 rounded-full transition-all duration-200 ${
              isRunning
                ? 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}
            title={isRunning ? 'Pause' : 'Reprendre'}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          <button
            onClick={handleStopOpen}
            className="p-1 rounded-full text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all duration-200"
            title="Arrêter et enregistrer"
          >
            <Square className="w-3 h-3" />
          </button>

          <button
            onClick={() => { setShowStopConfirm(false); setShowDiscardConfirm(true); }}
            className="p-1 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all duration-200"
            title="Supprimer le timer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
