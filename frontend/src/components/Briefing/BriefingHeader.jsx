import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { headerVariants, chipContainer, chipItem } from './utils/animations';

const chipColors = {
  red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/20',
  amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
  violet: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/20',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/20',
};

export default function BriefingHeader({ greeting, summary, chips, loading, onRefresh }) {
  return (
    <motion.header
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      className="mb-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 dark:text-white/30 text-xs font-medium uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}
          </h1>
          <p className="text-slate-500 dark:text-white/40 text-sm mt-1 max-w-[600px]">
            {summary}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:border-white/[0.08] dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.1] transition-all text-xs flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {chips.length > 0 && (
        <motion.div
          variants={chipContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap gap-1.5 mt-3"
        >
          {chips.map((chip) => (
            <motion.span
              key={chip.id}
              variants={chipItem}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${chipColors[chip.color] || chipColors.green}`}
            >
              <span className="text-slate-400 dark:text-white/40">{chip.label}</span>
              <span className="font-semibold">{chip.value}</span>
            </motion.span>
          ))}
        </motion.div>
      )}
    </motion.header>
  );
}
