import { motion } from 'framer-motion';
import BriefingItem, { BriefingSubItem } from '../items/BriefingItem';
import { sectionContainer, sectionTitle } from '../utils/animations';

export default function StatusSection({ items }) {
  if (!items.length) return null;

  return (
    <motion.section variants={sectionContainer} initial="hidden" animate="visible">
      <motion.div variants={sectionTitle} className="flex items-center gap-2 mb-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          Bilan
        </h2>
      </motion.div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>
            <BriefingItem item={item} accent="green" />
            {item.children?.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {item.children.map((child) => (
                  <BriefingSubItem key={child.id} child={child} accent="green" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
