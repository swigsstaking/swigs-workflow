import { motion } from 'framer-motion';
import { AlertTriangle, Send } from 'lucide-react';
import BriefingItem from '../items/BriefingItem';
import { sectionContainer, sectionTitle } from '../utils/animations';

export default function UrgentSection({ items, onSendReminder, onSendAll, onItemClick }) {
  if (!items.length) return null;

  const hasReminders = items.some((i) => i.actionType === 'send');

  return (
    <motion.section variants={sectionContainer} initial="hidden" animate="visible">
      <motion.div variants={sectionTitle} className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-red-400">
            Urgent
          </h2>
          <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
            {items.length}
          </span>
        </div>
        {hasReminders && onSendAll && (
          <button
            onClick={onSendAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-[11px] font-medium"
          >
            <Send className="w-3 h-3" />
            Tout envoyer
          </button>
        )}
      </motion.div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <BriefingItem
            key={item.id}
            item={item}
            accent="red"
            onSendReminder={onSendReminder}
            onClick={onItemClick}
          />
        ))}
      </div>
    </motion.section>
  );
}
