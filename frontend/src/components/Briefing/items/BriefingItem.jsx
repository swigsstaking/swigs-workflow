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
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    action: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
    icon: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    action: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25',
    icon: 'text-amber-500 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  green: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    action: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25',
    icon: 'text-emerald-500 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
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
      className={`flex items-center gap-3 py-2.5 px-3.5 bg-white border border-slate-200 dark:bg-white/[0.04] dark:backdrop-blur-sm dark:border-white/[0.06] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.07] transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`flex-shrink-0 ${colors.icon}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</span>
          {item.subtitle && (
            <span className="text-xs text-slate-500 dark:text-white/50 truncate hidden sm:inline">{item.subtitle}</span>
          )}
          {item.badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${colors.badge}`}>
              {item.badge}
            </span>
          )}
        </div>
        {item.detail && (
          <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">{item.detail}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
        {item.amount != null && (
          <span className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
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
        child.sent === false ? 'bg-slate-300 dark:bg-white/20' : colors.dot
      }`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-600 dark:text-white/60 truncate block">{child.label}</span>
        {child.sub && <span className="text-[11px] text-slate-400 dark:text-white/30">{child.sub}</span>}
      </div>
      {child.amount != null && (
        <span className={`text-xs font-medium whitespace-nowrap ${colors.icon}`}>
          +{fmt(child.amount)}
        </span>
      )}
    </div>
  );
}
