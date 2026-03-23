import { motion } from 'framer-motion';
import UrgentSection from './sections/UrgentSection';
import WatchSection from './sections/WatchSection';
import StatusSection from './sections/StatusSection';
import ActionsSection from './sections/ActionsSection';
import AllClearState from './AllClearState';
import { feedContainer } from './utils/animations';

export default function BriefingFeed({ briefing, suggestions = [], onSendReminder, onSendAll, onItemClick }) {
  const { urgent, watch, status, allClear } = briefing;

  return (
    <motion.div
      variants={feedContainer}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {allClear && <AllClearState />}

      <UrgentSection
        items={urgent}
        onSendReminder={onSendReminder}
        onSendAll={onSendAll}
        onItemClick={onItemClick}
      />

      <WatchSection items={watch} onItemClick={onItemClick} />

      <ActionsSection
        suggestions={suggestions}
        hasUrgentItems={urgent.length > 0}
      />

      {status.length > 0 && <StatusSection items={status} />}
    </motion.div>
  );
}
