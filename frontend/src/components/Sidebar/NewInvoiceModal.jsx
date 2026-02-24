import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { eventsApi, quotesApi, invoicesApi, recurringInvoicesApi } from '../../services/api';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import InvoiceModeSelector from './invoice/InvoiceModeSelector';
import StandardInvoiceForm from './invoice/StandardInvoiceForm';
import CustomInvoiceForm from './invoice/CustomInvoiceForm';
import RecurringInvoiceForm from './invoice/RecurringInvoiceForm';
import InvoiceSummary from './invoice/InvoiceSummary';
import { formatCurrency } from '../../utils/format';

export default function NewInvoiceModal({ project, isOpen, onClose, preselectedQuoteId, vatRate }) {
  const { createInvoice } = useProjectStore();
  const { addToast } = useToastStore();
  const { settings, fetchSettings } = useSettingsStore();

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('standard'); // 'standard' | 'custom' | 'recurring'

  // Standard mode state
  const [unbilledEvents, setUnbilledEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [invoiceableQuotes, setInvoiceableQuotes] = useState([]);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [quotePartials, setQuotePartials] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});

  // Custom mode state
  const [customLines, setCustomLines] = useState([
    { description: '', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [autoSend, setAutoSend] = useState(false);

  // Recurring mode state
  const [recurringForm, setRecurringForm] = useState({
    lines: [{ description: '', quantity: 1, unitPrice: 0 }],
    frequency: 'monthly',
    dayOfMonth: 1,
    startDate: new Date().toISOString().slice(0, 10),
    hasEndDate: false,
    endDate: '',
    notes: '',
    autoSend: false,
  });

  // Reminder opt-out
  const [skipReminders, setSkipReminders] = useState(false);

  // Shared advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customIssueDate, setCustomIssueDate] = useState('');

  useEffect(() => {
    if (isOpen && project?._id) {
      loadData();
      if (!settings) fetchSettings();
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
      setAutoSend(false);
      setRecurringForm({
        lines: [{ description: '', quantity: 1, unitPrice: 0 }],
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: new Date().toISOString().slice(0, 10),
        hasEndDate: false,
        endDate: '',
        notes: '',
        autoSend: false,
      });
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

  // Service line handler (shared for custom & recurring)
  const addServiceLine = (service) => {
    const newLine = {
      description: service.description
        ? `${service.name} - ${service.description}`
        : service.name,
      quantity: service.defaultQuantity || 1,
      unitPrice: service.priceType === 'hourly' && service.estimatedHours
        ? service.unitPrice * service.estimatedHours
        : service.unitPrice
    };

    if (mode === 'recurring') {
      setRecurringForm(f => ({
        ...f,
        lines: [...f.lines.filter(l => l.description || l.unitPrice), newLine]
      }));
    } else {
      setCustomLines(prev => [...prev.filter(l => l.description || l.unitPrice), newLine]);
    }
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

  const isRecurringValid = () => {
    return recurringForm.lines.every(l =>
      l.description.trim() !== '' && parseFloat(l.quantity) > 0
    ) && recurringForm.startDate;
  };

  const handleSubmit = async () => {
    if (mode === 'standard' && selectedEvents.length === 0 && selectedQuotes.length === 0) return;
    if (mode === 'custom' && !isCustomValid()) return;
    if (mode === 'recurring' && !isRecurringValid()) return;

    setLoading(true);
    try {
      if (mode === 'recurring') {
        const showDayOfMonth = ['monthly', 'quarterly', 'yearly'].includes(recurringForm.frequency);
        await recurringInvoicesApi.create({
          project: project._id,
          customLines: recurringForm.lines.map(l => ({
            description: l.description,
            quantity: parseFloat(l.quantity) || 1,
            unitPrice: parseFloat(l.unitPrice) || 0,
          })),
          frequency: recurringForm.frequency,
          dayOfMonth: showDayOfMonth ? (parseInt(recurringForm.dayOfMonth) || 1) : undefined,
          startDate: recurringForm.startDate,
          endDate: recurringForm.hasEndDate && recurringForm.endDate ? recurringForm.endDate : undefined,
          vatRate: vatRate ? vatRate * 100 : (settings?.invoicing?.vatRate ?? 8.1),
          paymentTermsDays: 30,
          notes: recurringForm.notes || undefined,
          autoSend: recurringForm.autoSend,
        });
        addToast({ type: 'success', message: 'Récurrence créée avec succès' });
        resetForm();
        onClose();
        return;
      }

      let invoiceData = {};

      if (mode === 'custom') {
        invoiceData = {
          invoiceType: 'custom',
          customLines: customLines.map(line => ({
            description: line.description,
            quantity: parseFloat(line.quantity) || 1,
            unitPrice: parseFloat(line.unitPrice) || 0
          })),
          notes: notes || undefined,
          skipReminders: skipReminders || undefined
        };
      } else {
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
          quotePartials: Object.keys(cleanedPartials).length > 0 ? cleanedPartials : undefined,
          skipReminders: skipReminders || undefined
        };
      }

      if (customIssueDate) {
        invoiceData.issueDate = customIssueDate;
      }

      const invoice = await createInvoice(project._id, invoiceData);

      // Auto-send via SMTP if enabled
      if (autoSend && invoice?._id) {
        try {
          const { data: sendResult } = await invoicesApi.send(invoice._id);
          addToast({ type: 'success', message: sendResult.message || 'Facture créée et envoyée' });
        } catch (sendErr) {
          addToast({ type: 'warning', message: 'Facture créée mais l\'envoi a échoué : ' + (sendErr.response?.data?.error || sendErr.message) });
        }
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating invoice:', error);
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de la création' });
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
    setAutoSend(false);
    setSkipReminders(false);
    setMode('standard');
    setRecurringForm({
      lines: [{ description: '', quantity: 1, unitPrice: 0 }],
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: new Date().toISOString().slice(0, 10),
      hasEndDate: false,
      endDate: '',
      notes: '',
      autoSend: false,
    });
  };

  const totalSelected = mode === 'standard'
    ? selectedEvents.length + selectedQuotes.length
    : mode === 'custom'
      ? (isCustomValid() ? customLines.length : 0)
      : (isRecurringValid() ? recurringForm.lines.length : 0);

  const submitLabel = mode === 'recurring' ? 'Créer la récurrence' : 'Créer la facture';

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
                getQuoteAmount={getQuoteAmount}
              />
            ) : mode === 'custom' ? (
              <CustomInvoiceForm
                customLines={customLines}
                updateCustomLine={updateCustomLine}
                removeCustomLine={removeCustomLine}
                addCustomLine={addCustomLine}
                notes={notes}
                setNotes={setNotes}
                onSelectService={addServiceLine}
              />
            ) : (
              <RecurringInvoiceForm
                form={recurringForm}
                setForm={setRecurringForm}
                onSelectService={addServiceLine}
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
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            customIssueDate={customIssueDate}
            setCustomIssueDate={setCustomIssueDate}
            vatRate={vatRate}
            recurringForm={recurringForm}
            setRecurringForm={setRecurringForm}
            autoSend={autoSend}
            setAutoSend={setAutoSend}
            skipReminders={skipReminders}
            setSkipReminders={setSkipReminders}
            settings={settings}
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
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
