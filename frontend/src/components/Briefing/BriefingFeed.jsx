import { motion } from 'framer-motion';
import UrgentSection from './sections/UrgentSection';
import WatchSection from './sections/WatchSection';
import StatusSection from './sections/StatusSection';
import AllClearState from './AllClearState';
import { feedContainer } from './utils/animations';

export default function BriefingFeed({ briefing, onSendReminder, onSendAll }) {
  const { urgent, watch, status, allClear } = briefing;

  return (
    <motion.div
      variants={feedContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {allClear && <AllClearState />}

      <UrgentSection
        items={urgent}
        onSendReminder={onSendReminder}
        onSendAll={onSendAll}
      />

      <WatchSection items={watch} />

      {status.length > 0 && <StatusSection items={status} />}
    </motion.div>
  );
}
