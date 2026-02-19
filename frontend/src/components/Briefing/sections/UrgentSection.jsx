import { motion } from 'framer-motion';
import { AlertTriangle, Send } from 'lucide-react';
import BriefingItem from '../items/BriefingItem';
import { sectionContainer, sectionTitle } from '../utils/animations';

export default function UrgentSection({ items, onSendReminder, onSendAll }) {
  if (!items.length) return null;

  const hasReminders = items.some((i) => i.actionType === 'send');

  return (
    <motion.section variants={sectionContainer} initial="hidden" animate="visible">
      <motion.div variants={sectionTitle} className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-red-400">
            Urgent
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[11px] font-bold">
            {items.length}
          </span>
        </div>
        {hasReminders && onSendAll && (
          <button
            onClick={onSendAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-xs font-medium"
          >
            <Send className="w-3 h-3" />
            Tout envoyer
          </button>
        )}
      </motion.div>

      <div className="space-y-2">
        {items.map((item) => (
          <BriefingItem
            key={item.id}
            item={item}
            accent="red"
            onSendReminder={onSendReminder}
          />
        ))}
      </div>
    </motion.section>
  );
}
