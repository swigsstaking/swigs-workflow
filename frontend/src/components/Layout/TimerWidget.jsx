import { useState } from 'react';
import { Play, Pause, Square, Trash2, Timer, Check, X } from 'lucide-react';
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
        <div className="absolute top-full right-0 mt-2 w-72 bg-[#161b22] border border-white/[0.12] rounded-lg shadow-xl p-3 z-50">
          <p className="text-xs font-medium text-slate-300 mb-2">Arreter le timer</p>
          <p className="text-xs text-slate-500 mb-2">
            {formatElapsed(elapsed)} travaillees sur {projectName}
          </p>
          <input
            type="text"
            value={stopDescription}
            onChange={(e) => setStopDescription(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full px-2 py-1.5 text-xs bg-white/[0.06] border border-white/[0.08] rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 mb-2"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleStopConfirm}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors"
            >
              <Check className="w-3 h-3" />
              Enregistrer
            </button>
            <button
              onClick={cancelAll}
              className="px-2 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 rounded-md text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Discard confirmation popover */}
      {showDiscardConfirm && (
        <div className="absolute top-full right-0 mt-2 w-60 bg-[#161b22] border border-white/[0.12] rounded-lg shadow-xl p-3 z-50">
          <p className="text-xs font-medium text-slate-300 mb-1">Supprimer le timer ?</p>
          <p className="text-xs text-slate-500 mb-2">Le temps enregistre sera perdu.</p>
          <div className="flex gap-1.5">
            <button
              onClick={handleDiscardConfirm}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Supprimer
            </button>
            <button
              onClick={cancelAll}
              className="px-2 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 rounded-md text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main timer display */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.06] border border-white/[0.08] rounded-lg">
        <Timer className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className="text-[13px] font-mono font-medium text-white tabular-nums">
          {formatElapsed(elapsed)}
        </span>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          • {projectName.length > 12 ? projectName.slice(0, 12) + '…' : projectName}
        </span>

        {/* Pause/Resume */}
        <button
          onClick={handlePauseResume}
          className="p-1 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
          title={isRunning ? 'Pause' : 'Reprendre'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        {/* Stop */}
        <button
          onClick={handleStopOpen}
          className="p-1 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-emerald-400 transition-colors"
          title="Arreter et enregistrer"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Discard */}
        <button
          onClick={() => { setShowStopConfirm(false); setShowDiscardConfirm(true); }}
          className="p-1 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-red-400 transition-colors"
          title="Supprimer le timer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
