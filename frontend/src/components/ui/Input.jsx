import { forwardRef, useId, useCallback, useRef, useEffect, useLayoutEffect } from 'react';

const Input = forwardRef(({
  label,
  error,
  id,
  className = '',
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
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
  id,
  className = '',
  rows = 3,
  autoResize = true,
  onChange,
  ...props
}, externalRef) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const internalRef = useRef(null);

  const resize = useCallback((el) => {
    if (!el || !autoResize) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [autoResize]);

  // Merge refs
  const setRef = useCallback((el) => {
    internalRef.current = el;
    if (typeof externalRef === 'function') externalRef(el);
    else if (externalRef) externalRef.current = el;
    if (el) resize(el);
  }, [externalRef, resize]);

  // Re-resize when value changes externally — useLayoutEffect for immediate sizing
  useLayoutEffect(() => {
    if (internalRef.current) resize(internalRef.current);
  }, [props.value, resize]);

  // Fallback: resize after paint for cases where layout isn't ready in useLayoutEffect
  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => resize(el));
    return () => cancelAnimationFrame(raf);
  }, [props.value, resize]);

  const handleChange = useCallback((e) => {
    if (autoResize) resize(e.target);
    if (onChange) onChange(e);
  }, [autoResize, resize, onChange]);

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <textarea
        ref={setRef}
        id={inputId}
        rows={rows}
        onChange={handleChange}
        className={`
          w-full px-3 py-2
          text-sm text-slate-900 dark:text-white
          bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:border-transparent dark:focus:ring-offset-dark-bg
          disabled:bg-slate-50 dark:disabled:bg-dark-hover disabled:text-slate-500 disabled:cursor-not-allowed
          resize-none overflow-hidden
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
  id,
  options = [],
  placeholder = 'Sélectionner...',
  className = '',
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
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
