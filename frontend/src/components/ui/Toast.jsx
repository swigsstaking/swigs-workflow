import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const toastStyles = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800'
};

const iconStyles = {
  success: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-red-500 dark:text-red-400',
  warning: 'text-amber-500 dark:text-amber-400',
  info: 'text-blue-500 dark:text-blue-400'
};

const Toast = ({ id, type, message }) => {
  const { removeToast } = useToastStore();
  const Icon = toastIcons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        min-w-[320px] max-w-md
        ${toastStyles[type]}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[type]}`} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const ToastContainer = () => {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
