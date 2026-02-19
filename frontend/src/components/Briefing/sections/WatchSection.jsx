import { motion } from 'framer-motion';
import BriefingItem from '../items/BriefingItem';
import { sectionContainer, sectionTitle } from '../utils/animations';

export default function WatchSection({ items }) {
  if (!items.length) return null;

  return (
    <motion.section variants={sectionContainer} initial="hidden" animate="visible">
      <motion.div variants={sectionTitle} className="flex items-center gap-2.5 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
          À surveiller
        </h2>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold">
          {items.length}
        </span>
      </motion.div>

      <div className="space-y-2">
        {items.map((item) => (
          <BriefingItem key={item.id} item={item} accent="amber" />
        ))}
      </div>
    </motion.section>
  );
}
