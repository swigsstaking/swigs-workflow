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
      className="hidden lg:block w-[300px] flex-shrink-0 sticky top-4 self-start space-y-3"
    >
      <ClientReliabilityList clients={clientIntelligence} />
      <CashFlowCompact forecasts={cashFlowForecast} />
    </motion.aside>
  );
}
