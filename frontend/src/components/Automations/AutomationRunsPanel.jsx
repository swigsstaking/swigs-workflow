import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import { automationsApi, automationRunsApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import Button from '../ui/Button';

const STATUS_CONFIG = {
  completed: {
    label: 'Complété',
    color: 'green',
    icon: CheckCircle,
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400'
  },
  failed: {
    label: 'Échoué',
    color: 'red',
    icon: XCircle,
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400'
  },
  running: {
    label: 'En cours',
    color: 'blue',
    icon: Loader,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400'
  },
  waiting: {
    label: 'En attente',
    color: 'yellow',
    icon: Clock,
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    textClass: 'text-yellow-700 dark:text-yellow-400'
  },
  pending: {
    label: 'Planifié',
    color: 'gray',
    icon: AlertCircle,
    bgClass: 'bg-slate-100 dark:bg-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300'
  }
};

function RunLogEntry({ log }) {
  const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const Icon = statusConfig.icon;

  return (
    <div className="flex items-start gap-3 py-2 border-l-2 border-slate-200 dark:border-slate-700 pl-4 ml-2">
      <Icon className={`w-4 h-4 mt-0.5 ${statusConfig.textClass} ${log.status === 'running' ? 'animate-spin' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {log.label || log.nodeType}
          </span>
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${statusConfig.bgClass} ${statusConfig.textClass}`}>
            {statusConfig.label}
          </span>
          {log.durationMs !== undefined && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatDuration(log.durationMs)}
            </span>
          )}
        </div>
        {log.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {log.error}
          </p>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'il y a quelques secondes';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;

  return then.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function RunItem({ run, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(run._id);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-dark-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}

        <StatusIcon className={`w-5 h-5 ${statusConfig.textClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {formatRelativeTime(run.createdAt)}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgClass} ${statusConfig.textClass}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trigger: {run.triggerType || 'manual'}
            {run.durationMs !== undefined && ` • Durée: ${formatDuration(run.durationMs)}`}
          </p>
        </div>

        {run.status === 'failed' && (
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            loading={retrying}
          >
            Réessayer
          </Button>
        )}
      </button>

      {expanded && run.executionLog && run.executionLog.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-dark-border">
          <div className="mt-3 space-y-1">
            {run.executionLog.map((log, idx) => (
              <RunLogEntry key={idx} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AutomationRunsPanel({ automationId }) {
  const { addToast } = useToastStore();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, [automationId]);

  const loadRuns = async () => {
    if (!automationId) return;

    try {
      const { data } = await automationsApi.getRuns(automationId);
      setRuns(data.data || []);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du chargement de l\'historique' });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (runId) => {
    try {
      await automationRunsApi.retry(runId);
      addToast({ type: 'success', message: 'Automation relancée' });
      await loadRuns();
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la relance' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400">
          Aucune exécution pour cette automation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Historique d'exécution ({runs.length})
        </h3>
        <Button
          size="sm"
          variant="secondary"
          icon={RefreshCw}
          onClick={loadRuns}
        >
          Rafraîchir
        </Button>
      </div>

      {runs.map(run => (
        <RunItem key={run._id} run={run} onRetry={handleRetry} />
      ))}
    </div>
  );
}
