import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { pulseAnimation, itemVariant } from './utils/animations';

export default function AllClearState() {
  return (
    <motion.div
      variants={itemVariant}
      className="flex flex-col items-center py-10 text-center"
    >
      <motion.div animate={pulseAnimation}>
        <CheckCircle2 className="w-12 h-12 text-emerald-400/80" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mt-4">
        Tout est en ordre
      </h3>
      <p className="text-sm text-white/40 mt-1 max-w-[340px]">
        Aucune action urgente requise. Votre administratif est à jour.
      </p>
    </motion.div>
  );
}
