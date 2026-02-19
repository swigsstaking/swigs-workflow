import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { headerVariants, chipContainer, chipItem } from './utils/animations';

const chipColors = {
  red: 'bg-red-500/15 text-red-300 border-red-500/20',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
};

export default function BriefingHeader({ greeting, summary, chips, loading, onRefresh }) {
  return (
    <motion.header
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      className="mb-8"
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {greeting}
          </h1>
          <p className="text-white/50 text-sm mt-1.5 max-w-[600px]">
            {summary}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.1] transition-all text-sm flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {chips.length > 0 && (
        <motion.div
          variants={chipContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap gap-2 mt-4"
        >
          {chips.map((chip) => (
            <motion.span
              key={chip.id}
              variants={chipItem}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${chipColors[chip.color] || chipColors.green}`}
            >
              <span className="text-white/40">{chip.label}</span>
              <span className="font-semibold">{chip.value}</span>
            </motion.span>
          ))}
        </motion.div>
      )}
    </motion.header>
  );
}
