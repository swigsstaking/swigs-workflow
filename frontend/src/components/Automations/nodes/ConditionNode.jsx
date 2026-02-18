import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export default function ConditionNode({ data, selected }) {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-amber-500 to-orange-500 text-white
        ${selected ? 'border-white ring-2 ring-amber-400' : 'border-amber-400/50'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-amber-400"
      />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <GitBranch className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-amber-200 uppercase tracking-wider">
            Condition
          </p>
          <p className="text-sm font-semibold">{data.label}</p>
        </div>
      </div>

      {data.config?.field && (
        <div className="mt-2 px-2 py-1 rounded bg-white/10 text-xs text-amber-100 truncate">
          {data.config.field} {data.config.operator} {data.config.value}
        </div>
      )}

      {/* Two outputs: true (left) and false (right) */}
      <div className="flex justify-between mt-3 text-[10px]">
        <span className="text-emerald-200">✓ Oui</span>
        <span className="text-red-200">✗ Non</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-white"
      />
    </div>
  );
}
