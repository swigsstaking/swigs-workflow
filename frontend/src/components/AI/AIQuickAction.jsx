import { Sparkles } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

const SIZE_CLASSES = {
  sm: 'px-2 py-1 text-[10px] gap-1',
  md: 'px-2.5 py-1.5 text-[11px] gap-1.5',
};

export default function AIQuickAction({ label, prompt, size = 'sm' }) {
  const { openSidebar, sendMessage } = useAIStore();

  const handleClick = () => {
    openSidebar();
    sendMessage(prompt);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center font-medium rounded-lg
        bg-transparent border border-primary-200 dark:border-primary-800/30
        text-primary-600 dark:text-primary-400
        hover:bg-primary-50 dark:hover:bg-primary-500/10
        hover:border-primary-300 dark:hover:border-primary-700/40
        transition-all duration-200
        ${SIZE_CLASSES[size] || SIZE_CLASSES.sm}
      `}
      title={label}
    >
      <Sparkles className="w-3 h-3" />
      {label}
    </button>
  );
}
