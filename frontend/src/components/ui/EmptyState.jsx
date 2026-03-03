import { motion } from 'framer-motion';
import TopoOverlay from './TopoOverlay';

/**
 * SWIGS Empty State
 * Full-surface topographic background at 6% opacity,
 * expressive typography, optional accent CTA button.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  className = '',
}) {
  return (
    <div className={`relative overflow-hidden flex flex-col items-center justify-center py-16 px-6 text-center rounded-[8px] ${className}`}>
      <TopoOverlay opacity={0.065} />

      <div className="relative z-10 flex flex-col items-center max-w-sm">
        {Icon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-14 h-14 rounded-[10px] bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mb-5"
          >
            <Icon className="w-7 h-7 text-primary-500 dark:text-primary-400" />
          </motion.div>
        )}

        <motion.h3
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="font-display font-bold text-xl tracking-tight text-slate-900 dark:text-white mb-2"
        >
          {title}
        </motion.h3>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed mb-6"
          >
            {description}
          </motion.p>
        )}

        {action && onAction && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            onClick={onAction}
            className="
              inline-flex items-center gap-2 px-4 py-2
              bg-primary-500 hover:bg-primary-600 text-white
              rounded-[6px] text-sm font-semibold
              transition-all duration-200 active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950
            "
          >
            {action}
          </motion.button>
        )}
      </div>
    </div>
  );
}
