import { Handle, Position } from '@xyflow/react';
import { Mail, Webhook, Bell } from 'lucide-react';

const ACTION_ICONS = {
  send_email: Mail,
  webhook: Webhook,
  notification: Bell
};

export default function ActionNode({ data, selected }) {
  const Icon = ACTION_ICONS[data.subType] || Mail;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-blue-500 to-blue-600 text-white
        ${selected ? 'border-white ring-2 ring-blue-400' : 'border-blue-400/50'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-blue-200 uppercase tracking-wider">
            Action
          </p>
          <p className="text-sm font-semibold">{data.label}</p>
        </div>
      </div>

      {data.config?.templateId && (
        <div className="mt-2 px-2 py-1 rounded bg-white/10 text-xs text-blue-100 truncate">
          Template configuré
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
      />
    </div>
  );
}
