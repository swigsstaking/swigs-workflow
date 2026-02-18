import { useState, useEffect, useRef, memo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Check, Clock, Receipt, FileText, ChevronDown, ChevronUp, Percent
} from 'lucide-react';

// Separate component for partial input to prevent focus loss
const PartialInput = memo(({ type, value, onChange, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  };

  const handleBlur = () => {
    onChange(localValue);
  };

  // Sync from parent only when value prop changes and we're not focused
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value || '');
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className={`px-2 py-1 text-xs text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${type === 'percent' ? 'w-14' : 'w-20'}`}
    />
  );
});

export default function StandardInvoiceForm({
  unbilledEvents,
  invoiceableQuotes,
  selectedEvents,
  setSelectedEvents,
  selectedQuotes,
  setSelectedQuotes,
  quotePartials,
  setQuotePartial,
  clearQuotePartial,
  collapsedSections,
  toggleSection,
  toggleAllInSection,
  formatCurrency,
  getQuoteAmount
}) {
  const hoursEvents = unbilledEvents.filter(e => e.type === 'hours');
  const expenseEvents = unbilledEvents.filter(e => e.type === 'expense');
  const actionEvents = unbilledEvents.filter(e => e.type === 'action');

  const hasNoStandardItems = unbilledEvents.length === 0 && invoiceableQuotes.length === 0;

  // Section component
  const Section = ({ title, icon: Icon, items, sectionKey, color, renderItem, selectedItems, setSelectedItems }) => {
    if (items.length === 0) return null;

    const isCollapsed = collapsedSections[sectionKey];
    const selectedCount = items.filter(item => selectedItems.includes(item._id)).length;
    const allSelected = selectedCount === items.length;

    return (
      <div className="rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedCount}/{items.length} sélectionné{selectedCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAllInSection(items, selectedItems, setSelectedItems);
              }}
              className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {!isCollapsed && (
          <div className="px-2 pb-2">
            <div className="rounded-lg overflow-hidden bg-white dark:bg-slate-800/50 divide-y divide-slate-100 dark:divide-slate-700/50">
              {items.map(item => renderItem(item))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEventItem = (event) => {
    const isSelected = selectedEvents.includes(event._id);
    const total = event.type === 'hours'
      ? event.hours * event.hourlyRate
      : event.amount || 0;

    return (
      <button
        key={event._id}
        onClick={() => {
          setSelectedEvents(prev =>
            prev.includes(event._id)
              ? prev.filter(id => id !== event._id)
              : [...prev, event._id]
          );
        }}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all
          ${isSelected
            ? 'bg-primary-50/80 dark:bg-primary-900/20'
            : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
          }
        `}
      >
        <div
          className={`
            w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
            ${isSelected
              ? 'bg-primary-500 border-primary-500'
              : 'border-slate-300 dark:border-slate-500'
            }
          `}
        >
          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {event.description}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {format(new Date(event.date), 'dd MMM yyyy', { locale: fr })}
            {event.type === 'hours' && ` • ${event.hours}h`}
          </p>
        </div>

        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatCurrency(total)}
        </span>
      </button>
    );
  };

  const renderQuoteItem = (quote) => {
    const isSelected = selectedQuotes.includes(quote._id);
    const partial = quotePartials[quote._id];
    const displayAmount = getQuoteAmount(quote);
    const isPartiallyInvoiced = quote.status === 'partial' || (quote.invoicedAmount && quote.invoicedAmount > 0);
    const remainingAmount = quote.remainingAmount ?? quote.subtotal;

    return (
      <div key={quote._id} className={`
        transition-all
        ${isSelected ? 'bg-primary-50/80 dark:bg-primary-900/20' : ''}
      `}>
        <button
          onClick={() => {
            setSelectedQuotes(prev => {
              if (prev.includes(quote._id)) {
                clearQuotePartial(quote._id);
                return prev.filter(id => id !== quote._id);
              }
              return [...prev, quote._id];
            });
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div
            className={`
              w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
              ${isSelected
                ? 'bg-primary-500 border-primary-500'
                : 'border-slate-300 dark:border-slate-500'
              }
            `}
          >
            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {quote.number}
              </p>
              {isPartiallyInvoiced && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  Partiel
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signé le {format(new Date(quote.signedAt), 'dd MMM yyyy', { locale: fr })}
              {isPartiallyInvoiced && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}• Reste {formatCurrency(remainingAmount)}
                </span>
              )}
            </p>
          </div>

          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {partial && parseFloat(partial.value) > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {formatCurrency(displayAmount)}
                <span className="text-xs text-slate-400 ml-1">/ {formatCurrency(remainingAmount)}</span>
              </span>
            ) : (
              formatCurrency(remainingAmount)
            )}
          </span>
        </button>

        {isSelected && (
          <div className="px-3 pb-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-100/80 dark:bg-slate-700/30">
              <Percent className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Acompte :</span>
              <div className="flex items-center gap-1">
                <PartialInput
                  type="percent"
                  placeholder="100"
                  value={partial?.type === 'percent' ? partial.value : ''}
                  onChange={(val) => setQuotePartial(quote._id, 'percent', val)}
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
              <span className="text-xs text-slate-400">ou</span>
              <div className="flex items-center gap-1">
                <PartialInput
                  type="amount"
                  placeholder={remainingAmount.toFixed(0)}
                  value={partial?.type === 'amount' ? partial.value : ''}
                  onChange={(val) => setQuotePartial(quote._id, 'amount', val)}
                />
                <span className="text-xs text-slate-500">CHF</span>
              </div>
              {partial && parseFloat(partial.value) > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearQuotePartial(quote._id);
                  }}
                  className="ml-auto text-xs text-slate-400 hover:text-red-500"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (hasNoStandardItems) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Aucun élément à facturer</p>
        <p className="text-sm mt-1">Ajoutez des événements ou des devis signés</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section
        title="Heures"
        icon={Clock}
        items={hoursEvents}
        sectionKey="hours"
        color="#3B82F6"
        renderItem={renderEventItem}
        selectedItems={selectedEvents}
        setSelectedItems={setSelectedEvents}
      />
      <Section
        title="Frais"
        icon={Receipt}
        items={expenseEvents}
        sectionKey="expenses"
        color="#F59E0B"
        renderItem={renderEventItem}
        selectedItems={selectedEvents}
        setSelectedItems={setSelectedEvents}
      />
      {actionEvents.length > 0 && (
        <Section
          title="Actions"
          icon={Clock}
          items={actionEvents}
          sectionKey="actions"
          color="#8B5CF6"
          renderItem={renderEventItem}
          selectedItems={selectedEvents}
          setSelectedItems={setSelectedEvents}
        />
      )}
      <Section
        title="Devis signés"
        icon={FileText}
        items={invoiceableQuotes}
        sectionKey="quotes"
        color="#10B981"
        renderItem={renderQuoteItem}
        selectedItems={selectedQuotes}
        setSelectedItems={setSelectedQuotes}
      />
    </div>
  );
}
