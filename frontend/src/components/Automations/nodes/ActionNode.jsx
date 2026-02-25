import { Handle, Position } from '@xyflow/react';
import { Mail, Webhook, Bell, ClipboardList, AlertTriangle, Database } from 'lucide-react';

const ACTION_ICONS = {
  send_email: Mail,
  webhook: Webhook,
  create_task: ClipboardList,
  update_record: Database,
  notification: Bell
};

const isConfigValid = (data) => {
  const c = data.config || {};
  switch (data.subType) {
    case 'send_email': return !!c.templateId;
    case 'webhook': return !!c.webhookUrl;
    case 'create_task': return !!c.taskTitle;
    case 'update_record': return !!c.recordType && !!c.recordField;
    default: return true;
  }
};

export default function ActionNode({ data, selected }) {
  const Icon = ACTION_ICONS[data.subType] || Mail;
  const valid = isConfigValid(data);

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl shadow-lg border-2 min-w-[180px]
        bg-gradient-to-br from-blue-500 to-blue-600 text-white
        ${selected ? 'border-white ring-2 ring-blue-400' : 'border-blue-400/50'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white !border-2 !border-blue-400"
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
