import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Clock, Receipt, Briefcase, Trash2,
  Check, X, Edit2, FileText, Send, FileSignature, Copy, Timer
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useTimerStore } from '../../stores/timerStore';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';
import NewQuoteModal from './NewQuoteModal';
import { formatCurrency } from '../../utils/format';

// Event type visual config
const eventTypeConfig = {
  hours:   { icon: Clock,     label: 'Heures', borderColor: '#3B82F6', dotColor: 'bg-blue-500',   iconBg: 'bg-blue-50 dark:bg-blue-500/10',   iconColor: 'text-blue-500 dark:text-blue-400' },
  action:  { icon: Briefcase, label: 'Action', borderColor: '#8B5CF6', dotColor: 'bg-violet-500', iconBg: 'bg-violet-50 dark:bg-violet-500/10', iconColor: 'text-violet-500 dark:text-violet-400' },
  expense: { icon: Receipt,   label: 'Frais',  borderColor: '#F59E0B', dotColor: 'bg-amber-500',  iconBg: 'bg-amber-50 dark:bg-amber-500/10',  iconColor: 'text-amber-500 dark:text-amber-400' },
};

const quoteStatusConfig = {
  draft:    { label: 'Brouillon', color: '#6B7280' },
  sent:     { label: 'Envoyé',   color: '#3B82F6' },
  signed:   { label: 'Signé',    color: '#10B981' },
  refused:  { label: 'Refusé',   color: '#EF4444' },
  expired:  { label: 'Expiré',   color: '#F59E0B' },
  invoiced: { label: 'Facturé',  color: '#8B5CF6' }
};

export default function EventsTab({ project }) {
  const {
    projectEvents, projectQuotes,
    createEvent, updateEvent, deleteEvent, fetchProjectEvents,
    updateQuoteStatus, fetchProjectQuotes, createQuote
  } = useProjectStore();
  const { addToast } = useToastStore();
  const { activeTimer, start: startTimer, loading: timerLoading } = useTimerStore();

  const [showForm, setShowForm] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [quoteStatusConfirm, setQuoteStatusConfirm] = useState(null);
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
    if (formData.type === 'hours') { data.hours = parseFloat(formData.hours); data.hourlyRate = parseFloat(formData.hourlyRate); }
    else if (formData.type === 'expense') { data.amount = parseFloat(formData.amount); }
    try {
      if (editingId) { await updateEvent(editingId, data); setEditingId(null); }
      else { await createEvent(project._id, data); }
      resetForm();
    } catch {
      addToast({ type: 'error', message: "Erreur lors de l'enregistrement de l'événement" });
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
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de la suppression' });
    }
  };

  const handleDuplicateQuote = async (quote) => {
    try {
      await createQuote(project._id, {
        lines: quote.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
        vatRate: quote.vatRate,
        notes: quote.notes || ''
      });
      await fetchProjectQuotes(project._id);
      addToast({ type: 'success', message: 'Devis dupliqué' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la duplication du devis' });
    }
  };

  const resetForm = () => {
    setShowForm(false); setEditingId(null);
    setFormData({ type: 'hours', description: '', date: format(new Date(), 'yyyy-MM-dd'), hours: '', hourlyRate: '50', amount: '' });
  };

  const handleQuoteStatusConfirm = async () => {
    if (!quoteStatusConfirm) return;
    try {
      await updateQuoteStatus(quoteStatusConfirm.quoteId, quoteStatusConfirm.status);
      await fetchProjectQuotes(project._id);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut du devis' });
    } finally { setQuoteStatusConfirm(null); }
  };

  const handleStartTimer = async () => {
    try {
      await startTimer({ projectId: project._id });
      addToast({ type: 'success', message: `Timer démarré pour ${project.name}` });
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors du démarrage du timer' });
    }
  };

  const getEventTotal = (event) => {
    if (event.type === 'hours') return event.hours * event.hourlyRate;
    if (event.type === 'expense') return event.amount;
    return 0;
  };

  return (
    <div className="p-5">
      {/* Action buttons */}
      {!showForm && (
        <div className="flex gap-2 mb-5">
          <Button onClick={() => setShowForm(true)} icon={Plus} className="flex-1">Événement</Button>
          <Button onClick={() => setShowQuoteModal(true)} variant="secondary" icon={FileText} className="flex-1">Devis</Button>
          {!activeTimer && (
            <Button onClick={handleStartTimer} variant="secondary" icon={Timer} loading={timerLoading} className="flex-1" title="Démarrer un timer pour ce projet">Timer</Button>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[rgb(var(--swigs-cream)/0.4)] dark:bg-zinc-950/50 border border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border rounded-[8px] p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white">{editingId ? 'Modifier' : 'Nouvel événement'}</h3>
            <button type="button" onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-[6px] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Select label="Type" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
            options={[{ value: 'hours', label: 'Heures' }, { value: 'action', label: 'Action' }, { value: 'expense', label: 'Frais' }]} />
          <Textarea label="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Description de l'événement..." required />
          <Input label="Date" type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} required />
          {formData.type === 'hours' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Heures" type="number" step="0.25" value={formData.hours} onChange={e => setFormData(p => ({ ...p, hours: e.target.value }))} placeholder="2.5" required />
              <Input label="Taux (CHF/h)" type="number" value={formData.hourlyRate} onChange={e => setFormData(p => ({ ...p, hourlyRate: e.target.value }))} required />
            </div>
          )}
          {formData.type === 'expense' && (
            <Input label="Montant (CHF)" type="number" step="0.01" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} placeholder="150.00" required />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1">{editingId ? 'Modifier' : 'Ajouter'}</Button>
          </div>
        </form>
      )}

      {/* Events list */}
      {projectEvents.length > 0 && (
        <div className="mb-6">
          <p className="swigs-section-label mb-3 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Événements ({projectEvents.length})
          </p>
          <div className="space-y-2">
            {projectEvents.map(event => {
              const config = eventTypeConfig[event.type] || eventTypeConfig.hours;
              const Icon = config.icon;
              const total = getEventTotal(event);

              return (
                <div
                  key={event._id}
                  className="
                    relative flex items-center gap-3 px-3.5 py-2.5
                    bg-white dark:bg-dark-card
                    border border-l-[3px] border-[rgb(var(--swigs-stone)/0.35)] dark:border-dark-border
                    rounded-[8px] transition-all duration-200
                    hover:shadow-sm hover:border-[rgb(var(--swigs-stone)/0.6)] dark:hover:border-zinc-600
                  "
                  style={{ borderLeftColor: config.borderColor }}
                >
                  <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{event.description}</p>
                    <p className="text-[11px] text-[rgb(var(--swigs-stone))] dark:text-zinc-500 mt-0.5">
                      {format(new Date(event.date), 'dd MMM yyyy', { locale: fr })}
                      {event.type === 'hours' && ` · ${event.hours}h × ${event.hourlyRate} CHF`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="swigs-amount text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(total)}
                    </span>
                    {event.billed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-[4px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <Check className="w-3 h-3" />
                        Facturé
                      </span>
                    ) : (
                      <div className="flex gap-0.5">
                        <button onClick={() => handleEdit(event)} className="p-1.5 text-[rgb(var(--swigs-stone))] hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] rounded-[6px] transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirm(event._id)} className="p-1.5 text-[rgb(var(--swigs-stone))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-[6px] transition-all">
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
          <p className="swigs-section-label mb-3 flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Devis ({projectQuotes.length})
          </p>
          <div className="space-y-2">
            {projectQuotes.map(quote => {
              const statusConfig = quoteStatusConfig[quote.status] || quoteStatusConfig.draft;
              return (
                <div
                  key={quote._id}
                  className="
                    flex items-center gap-3 px-3.5 py-2.5
                    bg-white dark:bg-dark-card
                    border border-[rgb(var(--swigs-stone)/0.35)] dark:border-dark-border
                    rounded-[8px] transition-all duration-200
                    hover:shadow-sm hover:border-[rgb(var(--swigs-stone)/0.6)] dark:hover:border-zinc-600
                  "
                >
                  <div className="w-7 h-7 rounded-[6px] bg-[rgb(var(--swigs-cream)/0.6)] dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-[13px] text-slate-900 dark:text-white">{quote.number}</p>
                    <p className="text-[11px] text-[rgb(var(--swigs-stone))] dark:text-zinc-500">
                      {format(new Date(quote.issueDate), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="swigs-amount text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(quote.total)}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-[4px]" style={{ backgroundColor: `${statusConfig.color}1A`, color: statusConfig.color }}>
                      {statusConfig.label}
                    </span>
                    {quote.status === 'draft' && (
                      <button onClick={() => setQuoteStatusConfirm({ quoteId: quote._id, status: 'sent', number: quote.number })} className="p-1.5 text-[rgb(var(--swigs-stone))] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-[6px] transition-all" title="Marquer comme envoyé">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {quote.status === 'sent' && (
                      <button onClick={() => setQuoteStatusConfirm({ quoteId: quote._id, status: 'signed', number: quote.number })} className="p-1.5 text-[rgb(var(--swigs-stone))] hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-[6px] transition-all" title="Marquer comme signé">
                        <FileSignature className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDuplicateQuote(quote)} className="p-1.5 text-[rgb(var(--swigs-stone))] hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-[6px] transition-all" title="Dupliquer">
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
        <div className="flex flex-col items-center py-10 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[rgb(var(--swigs-cream)/0.6)] dark:bg-zinc-800 border border-[rgb(var(--swigs-stone)/0.3)] dark:border-dark-border flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-[rgb(var(--swigs-stone))]" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-1">Aucune heure ou dépense</p>
          <p className="text-xs text-[rgb(var(--swigs-stone))] dark:text-zinc-500">Ajoutez un événement ou créez un devis</p>
        </div>
      )}

      <NewQuoteModal project={project} isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete}
        title="Supprimer l'événement" message="Supprimer cet événement ? Action irréversible." confirmLabel="Supprimer" cancelLabel="Annuler" variant="danger" />

      <ConfirmDialog isOpen={!!quoteStatusConfirm} onClose={() => setQuoteStatusConfirm(null)} onConfirm={handleQuoteStatusConfirm}
        title={quoteStatusConfirm?.status === 'sent' ? 'Marquer le devis comme envoyé' : 'Marquer le devis comme signé'}
        message={quoteStatusConfirm?.status === 'sent'
          ? `Marquer le devis ${quoteStatusConfirm?.number} comme envoyé ?`
          : `Marquer le devis ${quoteStatusConfirm?.number} comme signé ? Il pourra ensuite être facturé.`}
        confirmLabel={quoteStatusConfirm?.status === 'sent' ? 'Marquer envoyé' : 'Marquer signé'}
        cancelLabel="Annuler" />
    </div>
  );
}
