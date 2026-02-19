import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2
          text-sm text-slate-900 dark:text-white
          bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg
          disabled:bg-slate-50 dark:disabled:bg-dark-hover disabled:text-slate-500 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const Textarea = forwardRef(({
  label,
  error,
  className = '',
  rows = 3,
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full px-3 py-2
          text-sm text-slate-900 dark:text-white
          bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg
          disabled:bg-slate-50 dark:disabled:bg-dark-hover disabled:text-slate-500 disabled:cursor-not-allowed
          resize-none
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Sélectionner...',
  className = '',
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full px-3 py-2
          text-sm text-slate-900 dark:text-white
          bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg
          disabled:bg-slate-50 dark:disabled:bg-dark-hover disabled:text-slate-500 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Input;
