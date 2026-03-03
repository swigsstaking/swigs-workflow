import { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { quoteTemplatesApi } from '../../../services/api';
import { formatCurrency } from '../../../utils/format';

export default function TemplatePicker({ onSelectTemplate, className = '' }) {
  const [templates, setTemplates] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    quoteTemplatesApi.getAll({ active: true })
      .then(({ data }) => setTemplates(data.data.filter(t => t.isActive)))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  if (templates.length === 0) return null;

  const getTotal = (template) => {
    return template.lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
  };

  const handleSelect = (template) => {
    onSelectTemplate(template);
    setShowPicker(false);
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-4 py-2.5 w-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        <span>Appliquer un modèle</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {showPicker && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border max-h-80 overflow-y-auto">
          {templates.map(template => (
            <button
              key={template._id}
              type="button"
              onClick={() => handleSelect(template)}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center justify-between border-b border-slate-100 dark:border-dark-border last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template.description}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {template.lines.length} ligne{template.lines.length > 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap ml-3">
                {formatCurrency(getTotal(template))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
