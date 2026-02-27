import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Receipt, Plus, Send, Check, MoreVertical, Trash2, Mail, Bell, BellOff, ExternalLink, Link2, Clock, CheckCircle, XCircle, FileDown, Pencil, CreditCard, RotateCcw
} from 'lucide-react';
import Button from '../../ui/Button';
import { InvoiceStatusBadge } from '../../ui/Badge';
import { formatCurrency } from '../../../utils/format';

const REMINDER_LABELS = {
  reminder_1: '1er Rappel',
  reminder_2: '2ème Rappel',
  reminder_3: '3ème Rappel',
  final_notice: 'Mise en demeure'
};

export default function InvoiceList({
  project,
  invoices,
  settings,
  activeMenu,
  setActiveMenu,
  deleteConfirm,
  setDeleteConfirm,
  onStatusChange,
  onDelete,
  onShowInvoiceModal,
  onEdit,
  onRecordPayment,
  onSendReminder,
  onSendEmail,
  onGeneratePortalLink,
  onSyncAbaNinja,
  onDownloadPdf,
  onToggleSkipReminders,
  generateMailtoLink,
  getDaysOverdue
}) {
  return (
    <section>
      {/* Click-outside overlay to close dropdown */}
      {(activeMenu?.startsWith('invoice-') || activeMenu?.startsWith('reminder-')) && (
        <div className="fixed inset-0 z-[5]" onClick={() => setActiveMenu(null)} />
      )}
      <div className="flex items-center justify-between mb-3">
        <h3 className="swigs-section-label">Factures</h3>
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={onShowInvoiceModal}
        >
          Nouvelle
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center border border-dashed border-[rgb(var(--swigs-stone)/0.4)] dark:border-dark-border rounded-[8px] bg-[rgb(var(--swigs-cream)/0.3)] dark:bg-white/[0.02]">
          <Receipt className="w-8 h-8 text-[rgb(var(--swigs-stone))] mb-2" />
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 mb-0.5">Aucune facture</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">Créez votre première facture depuis les événements</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => {
            const hasSmtp = !!(settings?.smtp?.host && settings?.smtp?.user);
            const mailtoLink = !hasSmtp ? generateMailtoLink('invoice', invoice) : null;
            const isOverdueStatus = ['sent', 'partial'].includes(invoice.status) && new Date(invoice.dueDate) < new Date();
            const accentColor = invoice.status === 'paid'
              ? '#10b981'
              : isOverdueStatus
                ? '#ef4444'
                : invoice.status === 'partial'
                  ? '#f59e0b'
                  : invoice.status === 'sent'
                    ? 'rgb(var(--primary-500))'
                    : 'rgb(var(--swigs-stone))';
            return (
              <div
                key={invoice._id}
                className="p-3 bg-white dark:bg-dark-card rounded-[8px] space-y-2 border border-[rgb(var(--swigs-stone)/0.35)] dark:border-dark-border transition-all duration-200 hover:-translate-y-px hover:shadow-sm"
                style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
              >
                {/* Line 1: Icon + Number/Date ... Amount + Status + Menu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-display font-semibold text-slate-900 dark:text-white truncate">{invoice.number}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="swigs-amount text-[13px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(invoice.total)}
                    </span>
                    <InvoiceStatusBadge status={invoice.status} />

                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === `invoice-${invoice._id}` ? null : `invoice-${invoice._id}`)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenu === `invoice-${invoice._id}` && (
                        <div className="absolute right-0 bottom-full mb-1 w-52 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-10">
                          {/* Portal link */}
                          <button
                            onClick={() => onGeneratePortalLink(invoice._id, 'invoice')}
                            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Générer lien portail
                          </button>

                          {/* Edit draft */}
                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => { onEdit(invoice); setActiveMenu(null); }}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              <Pencil className="w-4 h-4" />
                              Modifier
                            </button>
                          )}

                          {/* Revert to draft */}
                          {invoice.status === 'sent' && (
                            <button
                              onClick={() => { onStatusChange(invoice._id, 'draft'); setActiveMenu(null); }}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Repasser en brouillon
                            </button>
                          )}

                          {/* Record payment */}
                          {['sent', 'partial'].includes(invoice.status) && (
                            <button
                              onClick={() => { onRecordPayment(invoice); setActiveMenu(null); }}
                              className="w-full px-4 py-2 text-sm text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                            >
                              <CreditCard className="w-4 h-4" />
                              Enregistrer paiement
                            </button>
                          )}

                          {/* Send reminder */}
                          {['sent', 'partial'].includes(invoice.status) && new Date(invoice.dueDate) < new Date() && (
                            <button
                              onClick={() => onSendReminder(invoice._id)}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              <Bell className="w-4 h-4" />
                              Envoyer relance
                            </button>
                          )}

                          {/* Toggle reminders */}
                          {settings?.reminders?.enabled && ['sent', 'partial'].includes(invoice.status) && (
                            <button
                              onClick={() => {
                                onToggleSkipReminders(invoice._id, !invoice.skipReminders);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              {invoice.skipReminders ? (
                                <>
                                  <Bell className="w-4 h-4" />
                                  Activer les relances
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-4 h-4" />
                                  Désactiver les relances
                                </>
                              )}
                            </button>
                          )}

                          {/* AbaNinja sync */}
                          {settings?.abaninja?.enabled && !invoice.abaNinjaId && (
                            <button
                              onClick={() => onSyncAbaNinja(invoice._id, 'invoice')}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              <Link2 className="w-4 h-4" />
                              Sync AbaNinja
                            </button>
                          )}

                          {invoice.status === 'draft' && (
                            <button
                              onClick={() => onStatusChange(invoice._id, 'sent')}
                              className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              Marquer envoyée
                            </button>
                          )}
                          {['sent', 'partial'].includes(invoice.status) && (
                            <button
                              onClick={() => onStatusChange(invoice._id, 'paid')}
                              className="w-full px-4 py-2 text-sm text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Marquer payée (totalité)
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeleteConfirm(invoice);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line 2: Badges + Action buttons — only if there's something to show */}
                {(() => {
                  const isOverdue = ['sent', 'partial'].includes(invoice.status) && new Date(invoice.dueDate) < new Date();
                  const isPartial = invoice.status === 'partial' && invoice.paidAmount > 0;
                  const hasReminders = invoice.reminderCount > 0 || invoice.reminders?.length > 0;
                  const hasAN = !!invoice.abaNinjaId;
                  const hasSkip = invoice.skipReminders && ['sent', 'partial'].includes(invoice.status);
                  const showLine2 = isOverdue || isPartial || hasReminders || hasAN || hasSkip || true; // always show for PDF/email
                  if (!showLine2) return null;
                  return (
                    <div className="flex items-center justify-between gap-2 pl-8">
                      {/* Left: conditional badges */}
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                            Retard {getDaysOverdue(invoice.dueDate)}j
                          </span>
                        )}

                        {isPartial && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                            {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.total)}
                          </span>
                        )}

                        {hasSkip && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded" title="Relances désactivées">
                            <BellOff className="w-3 h-3 inline" />
                          </span>
                        )}

                        {/* Reminder count — clickable to show history */}
                        {hasReminders && (
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenu(activeMenu === `reminder-${invoice._id}` ? null : `reminder-${invoice._id}`)}
                              className={`px-1.5 py-0.5 text-xs font-medium rounded hover:opacity-80 transition-colors cursor-pointer ${
                                invoice.reminders?.some(r => !r.emailSent)
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}
                              title="Voir l'historique des relances"
                            >
                              {invoice.reminderCount > 0
                                ? `Relance ${invoice.reminderCount}/4`
                                : 'Relance échouée'
                              }
                            </button>

                            {activeMenu === `reminder-${invoice._id}` && invoice.reminders?.length > 0 && (
                              <div className="absolute left-0 bottom-full mb-1 w-64 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border p-3 z-10">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  Historique des relances
                                </p>
                                <div className="space-y-1.5">
                                  {invoice.reminders.map((r, i) => (
                                    <div key={i}>
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                          {r.emailSent ? (
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                          ) : (
                                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                                          )}
                                          <span className={r.emailSent ? 'text-slate-700 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}>
                                            {REMINDER_LABELS[r.type] || r.type}
                                            {!r.emailSent && ' (échec)'}
                                          </span>
                                        </div>
                                        <span className="text-slate-500 dark:text-slate-400">
                                          {format(new Date(r.sentAt), 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                      </div>
                                      {r.error && (
                                        <p className="ml-5 mt-0.5 text-[10px] text-red-500 dark:text-red-400 truncate" title={r.error}>
                                          {r.error}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {invoice.nextReminderDate && ['sent', 'partial'].includes(invoice.status) && (
                                  <p className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500 dark:text-slate-400">
                                    Prochaine : {format(new Date(invoice.nextReminderDate), 'dd MMM yyyy', { locale: fr })}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {hasAN && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                            AN
                          </span>
                        )}
                      </div>

                      {/* Right: action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* PDF download */}
                        <button
                          onClick={() => onDownloadPdf(invoice)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                          title="Télécharger le PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        {/* Mail button — SMTP send or mailto fallback */}
                        {hasSmtp && project.client?.email ? (
                          <button
                            onClick={() => onSendEmail(invoice._id, 'invoice')}
                            className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="Envoyer par email (SMTP)"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        ) : mailtoLink ? (
                          <a
                            href={mailtoLink}
                            className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="Envoyer par email"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
