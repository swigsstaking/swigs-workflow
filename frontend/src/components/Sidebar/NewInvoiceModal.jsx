import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { eventsApi, quotesApi } from '../../services/api';
import { useProjectStore } from '../../stores/projectStore';
import InvoiceModeSelector from './invoice/InvoiceModeSelector';
import StandardInvoiceForm from './invoice/StandardInvoiceForm';
import CustomInvoiceForm from './invoice/CustomInvoiceForm';
import InvoiceSummary from './invoice/InvoiceSummary';

export default function NewInvoiceModal({ project, isOpen, onClose, preselectedQuoteId, vatRate }) {
  const { createInvoice } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('standard'); // 'standard' or 'custom'

  // Standard mode state
  const [unbilledEvents, setUnbilledEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [invoiceableQuotes, setInvoiceableQuotes] = useState([]);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [quotePartials, setQuotePartials] = useState({}); // { quoteId: { type: 'percent'|'amount', value: number } }
  const [collapsedSections, setCollapsedSections] = useState({});

  // Custom mode state
  const [customLines, setCustomLines] = useState([
    { description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');

  // Shared advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customIssueDate, setCustomIssueDate] = useState('');

  useEffect(() => {
    if (isOpen && project?._id) {
      loadData();
    }
  }, [isOpen, project?._id, preselectedQuoteId]);

  const loadData = async () => {
    try {
      const [eventsRes, quotesRes] = await Promise.all([
        eventsApi.getUnbilled(project._id),
        quotesApi.getInvoiceable(project._id)
      ]);

      setUnbilledEvents(eventsRes.data.data);
      setInvoiceableQuotes(quotesRes.data.data);

      if (preselectedQuoteId) {
        setSelectedEvents([]);
        setSelectedQuotes([preselectedQuoteId]);
        setMode('standard');
      } else {
        setSelectedEvents(eventsRes.data.data.map(e => e._id));
        setSelectedQuotes([]);
      }

      setQuotePartials({});
      setCollapsedSections({});
      setShowAdvanced(false);
      setCustomIssueDate('');
      setCustomLines([{ description: '', quantity: 1, unitPrice: 0 }]);
      setNotes('');
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Standard mode handlers
  const toggleEvent = (eventId) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleQuote = (quoteId) => {
    setSelectedQuotes(prev => {
      if (prev.includes(quoteId)) {
        const newPartials = { ...quotePartials };
        delete newPartials[quoteId];
        setQuotePartials(newPartials);
        return prev.filter(id => id !== quoteId);
      }
      return [...prev, quoteId];
    });
  };

  const setQuotePartial = (quoteId, type, value) => {
    // Keep the string value to preserve input state
    setQuotePartials(prev => ({
      ...prev,
      [quoteId]: { type, value: value === '' ? '' : value }
    }));
  };

  const clearQuotePartial = (quoteId) => {
    setQuotePartials(prev => {
      const newPartials = { ...quotePartials };
      delete newPartials[quoteId];
      return newPartials;
    });
  };

  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const toggleAllInSection = (items, selectedItems, setSelectedItems) => {
    const itemIds = items.map(item => item._id);
    const allSelected = itemIds.every(id => selectedItems.includes(id));

    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedItems(prev => [...new Set([...prev, ...itemIds])]);
    }
  };

  // Custom mode handlers
  const addCustomLine = () => {
    setCustomLines([...customLines, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeCustomLine = (index) => {
    if (customLines.length > 1) {
      setCustomLines(customLines.filter((_, i) => i !== index));
    }
  };

  const updateCustomLine = (index, field, value) => {
    const newLines = [...customLines];
    newLines[index][field] = value;
    setCustomLines(newLines);
  };

  // Calculations
  const getEventsTotal = () => {
    return unbilledEvents
      .filter(e => selectedEvents.includes(e._id))
      .reduce((sum, e) => {
        if (e.type === 'hours') return sum + (e.hours * e.hourlyRate);
        if (e.type === 'expense') return sum + e.amount;
        return sum;
      }, 0);
  };

  const getQuoteAmount = (quote) => {
    const partial = quotePartials[quote._id];
    const numValue = parseFloat(partial?.value) || 0;

    // Use remaining amount if quote is partially invoiced
    const remainingAmount = quote.remainingAmount ?? quote.subtotal;

    if (!partial || numValue === 0) {
      return remainingAmount;
    }
    if (partial.type === 'percent') {
      return quote.subtotal * (numValue / 100);
    }
    return Math.min(numValue, remainingAmount);
  };

  const getQuotesTotal = () => {
    return invoiceableQuotes
      .filter(q => selectedQuotes.includes(q._id))
      .reduce((sum, q) => sum + getQuoteAmount(q), 0);
  };

  const getCustomLineTotal = (line) => {
    const quantity = parseFloat(line.quantity);
    const unitPrice = parseFloat(line.unitPrice);
    if (isNaN(quantity) || isNaN(unitPrice)) return 0;
    return quantity * unitPrice;
  };

  const getCustomTotal = () => {
    return customLines.reduce((sum, line) => sum + getCustomLineTotal(line), 0);
  };

  const getSelectedTotal = () => {
    if (mode === 'custom') {
      return getCustomTotal();
    }
    return getEventsTotal() + getQuotesTotal();
  };

  const isCustomValid = () => {
    return customLines.every(line =>
      line.description.trim() !== '' &&
      parseFloat(line.quantity) > 0 &&
      parseFloat(line.unitPrice) > 0
    );
  };

  const handleSubmit = async () => {
    if (mode === 'standard' && selectedEvents.length === 0 && selectedQuotes.length === 0) return;
    if (mode === 'custom' && !isCustomValid()) return;

    setLoading(true);
    try {
      let invoiceData = {};

      if (mode === 'custom') {
        invoiceData = {
          invoiceType: 'custom',
          customLines: customLines.map(line => ({
            description: line.description,
            quantity: parseFloat(line.quantity) || 1,
            unitPrice: parseFloat(line.unitPrice) || 0
          })),
          notes: notes || undefined
        };
      } else {
        // Convert string values to numbers for quotePartials
        const cleanedPartials = {};
        for (const [quoteId, partial] of Object.entries(quotePartials)) {
          const numValue = parseFloat(partial.value);
          if (numValue > 0) {
            cleanedPartials[quoteId] = { type: partial.type, value: numValue };
          }
        }

        invoiceData = {
          eventIds: selectedEvents,
          quoteIds: selectedQuotes,
          quotePartials: Object.keys(cleanedPartials).length > 0 ? cleanedPartials : undefined
        };
      }

      if (customIssueDate) {
        invoiceData.issueDate = customIssueDate;
      }

      await createInvoice(project._id, invoiceData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedEvents([]);
    setSelectedQuotes([]);
    setQuotePartials({});
    setCustomLines([{ description: '', quantity: 1, unitPrice: 0 }]);
    setNotes('');
    setMode('standard');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  const totalSelected = mode === 'standard'
    ? selectedEvents.length + selectedQuotes.length
    : (isCustomValid() ? customLines.length : 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Créer une facture"
      size="2xl"
    >
      <div className="flex flex-col -m-6">
        {/* Mode selector */}
        <InvoiceModeSelector mode={mode} setMode={setMode} />

        {/* Content - two columns */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left column */}
          <div className="flex-1 overflow-y-auto max-h-[50vh] lg:max-h-none px-6 py-4 lg:border-r border-slate-200 dark:border-slate-700/50">
            {mode === 'standard' ? (
              <StandardInvoiceForm
                unbilledEvents={unbilledEvents}
                invoiceableQuotes={invoiceableQuotes}
                selectedEvents={selectedEvents}
                setSelectedEvents={setSelectedEvents}
                selectedQuotes={selectedQuotes}
                setSelectedQuotes={setSelectedQuotes}
                quotePartials={quotePartials}
                setQuotePartial={setQuotePartial}
                clearQuotePartial={clearQuotePartial}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                toggleAllInSection={toggleAllInSection}
                formatCurrency={formatCurrency}
                getQuoteAmount={getQuoteAmount}
              />
            ) : (
              <CustomInvoiceForm
                customLines={customLines}
                updateCustomLine={updateCustomLine}
                removeCustomLine={removeCustomLine}
                addCustomLine={addCustomLine}
                getCustomLineTotal={getCustomLineTotal}
                notes={notes}
                setNotes={setNotes}
                formatCurrency={formatCurrency}
              />
            )}
          </div>

          {/* Right column - Summary */}
          <InvoiceSummary
            mode={mode}
            totalSelected={totalSelected}
            selectedEvents={selectedEvents}
            selectedQuotes={selectedQuotes}
            quotePartials={quotePartials}
            getEventsTotal={getEventsTotal}
            getQuotesTotal={getQuotesTotal}
            getCustomTotal={getCustomTotal}
            getSelectedTotal={getSelectedTotal}
            customLines={customLines}
            formatCurrency={formatCurrency}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            customIssueDate={customIssueDate}
            setCustomIssueDate={setCustomIssueDate}
            vatRate={vatRate}
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={totalSelected === 0}
          >
            Créer la facture
          </Button>
        </div>
      </div>
    </Modal>
  );
}
