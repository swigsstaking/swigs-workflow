import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';

export default function WaitNode({ data, selected }) {
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
        px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-indigo-500 to-indigo-600 text-white
        ${selected ? 'border-white ring-2 ring-indigo-400' : 'border-indigo-400/50'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-indigo-400"
      />

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
