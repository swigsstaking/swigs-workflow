import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Clock, Receipt, Briefcase, Trash2,
  Check, X, Edit2, FileText, Send, FileSignature, Copy
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';
import NewQuoteModal from './NewQuoteModal';

const eventTypeConfig = {
  hours: { icon: Clock, label: 'Heures', color: '#3B82F6' },
  action: { icon: Briefcase, label: 'Action', color: '#8B5CF6' },
  expense: { icon: Receipt, label: 'Frais', color: '#F59E0B' }
};

const quoteStatusConfig = {
  draft: { label: 'Brouillon', color: '#6B7280' },
  sent: { label: 'Envoyé', color: '#3B82F6' },
  signed: { label: 'Signé', color: '#10B981' },
  refused: { label: 'Refusé', color: '#EF4444' },
  expired: { label: 'Expiré', color: '#F59E0B' },
  invoiced: { label: 'Facturé', color: '#8B5CF6' }
};

export default function EventsTab({ project }) {
  const {
    projectEvents,
    projectQuotes,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchProjectEvents,
    updateQuoteStatus,
    fetchProjectQuotes,
    createQuote
  } = useProjectStore();
  const { addToast } = useToastStore();

  const [showForm, setShowForm] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    type: 'hours',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    hourlyRate: '50',
    amount: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      type: formData.type,
      description: formData.description,
      date: new Date(formData.date)
    };

    if (formData.type === 'hours') {
      data.hours = parseFloat(formData.hours);
      data.hourlyRate = parseFloat(formData.hourlyRate);
    } else if (formData.type === 'expense') {
      data.amount = parseFloat(formData.amount);
    }

    try {
      if (editingId) {
        await updateEvent(editingId, data);
        setEditingId(null);
      } else {
        await createEvent(project._id, data);
      }
      resetForm();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleEdit = (event) => {
    setEditingId(event._id);
    setFormData({
      type: event.type,
      description: event.description,
      date: format(new Date(event.date), 'yyyy-MM-dd'),
      hours: event.hours?.toString() || '',
      hourlyRate: event.hourlyRate?.toString() || '50',
      amount: event.amount?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteEvent(deleteConfirm);
      await fetchProjectEvents(project._id);
      setDeleteConfirm(null);
    } catch (error) {
      addToast({
        type: 'error',
        message: error.response?.data?.error || 'Erreur lors de la suppression'
      });
    }
  };

  const handleDuplicateQuote = async (quote) => {
    try {
      const duplicatedData = {
        lines: quote.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice
        })),
        vatRate: quote.vatRate,
        notes: quote.notes || ''
      };
      await createQuote(project._id, duplicatedData);
      await fetchProjectQuotes(project._id);
      addToast({
        type: 'success',
        message: 'Devis dupliqué avec succès'
      });
    } catch (error) {
      console.error('Error duplicating quote:', error);
      addToast({
        type: 'error',
        message: 'Erreur lors de la duplication du devis'
      });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      type: 'hours',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      hours: '',
      hourlyRate: '50',
      amount: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  const getEventTotal = (event) => {
    if (event.type === 'hours') {
      return event.hours * event.hourlyRate;
    }
    if (event.type === 'expense') {
      return event.amount;
    }
    return 0;
  };

  return (
    <div className="p-6">
      {/* Add buttons */}
      {!showForm && (
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setShowForm(true)}
            icon={Plus}
            className="flex-1"
          >
            Événement
          </Button>
          <Button
            onClick={() => setShowQuoteModal(true)}
            variant="secondary"
            icon={FileText}
            className="flex-1"
          >
            Devis
          </Button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-dark-bg rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {editingId ? 'Modifier' : 'Nouvel événement'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
            options={[
              { value: 'hours', label: 'Heures' },
              { value: 'action', label: 'Action' },
              { value: 'expense', label: 'Frais' }
            ]}
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description de l'événement..."
            required
          />

          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            required
          />

          {formData.type === 'hours' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Heures"
                type="number"
                step="0.25"
                value={formData.hours}
                onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="2.5"
                required
              />
              <Input
                label="Taux horaire (CHF)"
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                required
              />
            </div>
          )}

          {formData.type === 'expense' && (
            <Input
              label="Montant (CHF)"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="150.00"
              required
            />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              {editingId ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </form>
      )}

      {/* Events list */}
      {projectEvents.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Événements ({projectEvents.length})
          </h4>
          <div className="space-y-2">
            {projectEvents.map(event => {
              const config = eventTypeConfig[event.type];
              const Icon = config.icon;
              const total = getEventTotal(event);

              return (
                <div
                  key={event._id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{event.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(event.date), 'dd MMM yyyy', { locale: fr })}
                        {event.type === 'hours' && ` • ${event.hours}h × ${event.hourlyRate} CHF`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(total)}
                    </span>
                    {event.billed ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        title={event.invoice?.number ? `Facturé dans ${event.invoice.number}` : 'Facturé'}
                      >
                        <Check className="w-3 h-3" />
                        Facturé
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(event)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(event._id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quotes list */}
      {projectQuotes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Devis ({projectQuotes.length})
          </h4>
          <div className="space-y-2">
            {projectQuotes.map(quote => {
              const statusConfig = quoteStatusConfig[quote.status] || quoteStatusConfig.draft;

              return (
                <div
                  key={quote._id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{quote.number}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(quote.issueDate), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(quote.total)}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}
                    >
                      {statusConfig.label}
                    </span>
                    {quote.status === 'draft' && (
                      <button
                        onClick={() => updateQuoteStatus(quote._id, 'sent')}
                        className="p-1 text-slate-400 hover:text-blue-500"
                        title="Marquer comme envoyé"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {quote.status === 'sent' && (
                      <button
                        onClick={() => updateQuoteStatus(quote._id, 'signed')}
                        className="p-1 text-slate-400 hover:text-emerald-500"
                        title="Marquer comme signé"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicateQuote(quote)}
                      className="p-1 text-slate-400 hover:text-primary-500"
                      title="Dupliquer ce devis"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {projectEvents.length === 0 && projectQuotes.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">Aucune heure ou dépense enregistrée</p>
        </div>
      )}

      {/* Quote Modal */}
      <NewQuoteModal
        project={project}
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer l'événement"
        message="Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </div>
  );
}
