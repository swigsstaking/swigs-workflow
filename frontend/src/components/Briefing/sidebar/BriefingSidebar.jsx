import { motion } from 'framer-motion';
import ClientReliabilityList from './ClientReliabilityList';
import CashFlowCompact from './CashFlowCompact';
import { sidebarVariants } from '../utils/animations';

export default function BriefingSidebar({ clientIntelligence, cashFlowForecast }) {
  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      className="hidden xl:block w-[320px] flex-shrink-0 sticky top-8 self-start space-y-4"
    >
      <ClientReliabilityList clients={clientIntelligence} />
      <CashFlowCompact forecasts={cashFlowForecast} />
    </motion.aside>
  );
}
