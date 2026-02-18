import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

export default function TriggerNode({ data, selected }) {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-violet-500 to-purple-600 text-white
        ${selected ? 'border-white ring-2 ring-violet-400' : 'border-violet-400/50'}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-violet-200 uppercase tracking-wider">
            Déclencheur
          </p>
          <p className="text-sm font-semibold">{data.label}</p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-violet-400"
      />
    </div>
  );
}
