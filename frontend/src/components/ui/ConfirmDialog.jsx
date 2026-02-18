import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default' // 'default' or 'danger'
}) {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog - centered with grid */}
          <div className="absolute inset-0 grid place-items-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="
                pointer-events-auto
                w-full max-w-md
                bg-white dark:bg-dark-card rounded-xl shadow-2xl
                overflow-hidden
              "
            >
              {/* Content */}
              <div className="p-6">
                {variant === 'danger' && (
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                )}

                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {title}
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  {message}
                </p>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                  >
                    {cancelLabel}
                  </Button>
                  <Button
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    onClick={handleConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
