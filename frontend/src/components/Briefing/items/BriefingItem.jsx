import { motion } from 'framer-motion';
import {
  Bell, AlertTriangle, CalendarClock, FileText, Receipt,
  CreditCard, ShieldCheck, ArrowUpRight, Send,
} from 'lucide-react';
import { itemVariant } from '../utils/animations';
import { fmt } from '../utils/briefingLogic';

const iconMap = {
  bell: Bell,
  alert: AlertTriangle,
  calendar: CalendarClock,
  file: FileText,
  receipt: Receipt,
  credit: CreditCard,
  shield: ShieldCheck,
  arrow: ArrowUpRight,
};

const accentColors = {
  red: {
    badge: 'bg-red-500/20 text-red-300',
    action: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
    icon: 'text-red-400',
    dot: 'bg-red-400',
  },
  amber: {
    badge: 'bg-amber-500/20 text-amber-300',
    action: 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
    icon: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  green: {
    badge: 'bg-emerald-500/20 text-emerald-300',
    action: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
    icon: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
};

export default function BriefingItem({ item, accent = 'red', onSendReminder, onClick }) {
  const Icon = iconMap[item.icon] || Bell;
  const colors = accentColors[accent] || accentColors.red;

  const handleClick = () => {
    if (onClick) onClick(item);
  };

  const handleSend = (e) => {
    e.stopPropagation();
    if (onSendReminder) onSendReminder(item.invoiceId);
  };

  return (
    <motion.div
      variants={itemVariant}
      onClick={handleClick}
      className={`flex items-center gap-3 py-2.5 px-3.5 bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-xl hover:bg-white/[0.07] transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`flex-shrink-0 ${colors.icon}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{item.title}</span>
          {item.subtitle && (
            <span className="text-xs text-white/50 truncate hidden sm:inline">{item.subtitle}</span>
          )}
          {item.badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${colors.badge}`}>
              {item.badge}
            </span>
          )}
        </div>
        {item.detail && (
          <p className="text-xs text-white/50 mt-0.5 truncate">{item.detail}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
        {item.amount != null && (
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            {fmt(item.amount)}
          </span>
        )}
        {item.actionType === 'send' && onSendReminder && (
          <button
            onClick={handleSend}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${colors.action}`}
          >
            <Send className="w-3 h-3" />
            Envoyer
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Sub-item for children lists (payments, actions)
export function BriefingSubItem({ child, accent = 'green' }) {
  const colors = accentColors[accent] || accentColors.green;

  return (
    <div className="flex items-center gap-2.5 py-1.5 pl-7">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        child.sent === false ? 'bg-white/20' : colors.dot
      }`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-white/60 truncate block">{child.label}</span>
        {child.sub && <span className="text-[11px] text-white/30">{child.sub}</span>}
      </div>
      {child.amount != null && (
        <span className={`text-xs font-medium whitespace-nowrap ${colors.icon}`}>
          +{fmt(child.amount)}
        </span>
      )}
    </div>
  );
}
