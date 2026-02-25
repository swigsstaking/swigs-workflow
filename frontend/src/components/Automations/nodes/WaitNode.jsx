import { Handle, Position } from '@xyflow/react';
import { Clock, AlertTriangle } from 'lucide-react';

const isConfigValid = (data) => {
  const c = data.config || {};
  return c.duration > 0 && !!c.unit;
};

export default function WaitNode({ data, selected }) {
  const valid = isConfigValid(data);

  const formatDuration = () => {
    if (!data.config?.duration || !data.config?.unit) return null;
    const units = {
      minutes: 'min',
      hours: 'h',
      days: 'j'
    };
    return `${data.config.duration} ${units[data.config.unit] || data.config.unit}`;
  };

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-indigo-500 to-indigo-600 text-white
        ${selected ? 'border-white ring-2 ring-indigo-400' : 'border-indigo-400/50'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-indigo-400"
      />

      {!valid && (
        <div
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-sm z-10"
          title="Configuration incomplète"
        >
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-indigo-200 uppercase tracking-wider">
            Attendre
          </p>
          <p className="text-sm font-semibold">{data.label}</p>
        </div>
      </div>

      {formatDuration() && (
        <div className="mt-2 px-2 py-1 rounded bg-white/10 text-xs text-indigo-100">
          ⏱ {formatDuration()}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-indigo-400"
      />
    </div>
  );
}
