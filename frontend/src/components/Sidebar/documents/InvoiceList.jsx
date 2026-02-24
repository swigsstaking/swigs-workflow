import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Receipt, Plus, Send, Check, MoreVertical, Trash2, Mail, Bell, BellOff, ExternalLink, Link2, Clock, CheckCircle, XCircle, FileDown
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Factures</h3>
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
        <div className="flex flex-col items-center py-8 text-center">
          <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Aucune facture</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Créez votre première facture depuis les événements</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => {
            const hasSmtp = !!(settings?.smtp?.host && settings?.smtp?.user);
            const mailtoLink = !hasSmtp ? generateMailtoLink('invoice', invoice) : null;
            return (
              <div
                key={invoice._id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-dark-bg rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{invoice.number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(invoice.total)}
                  </span>
                  <InvoiceStatusBadge status={invoice.status} />

                  {/* Overdue badge */}
                  {invoice.status === 'sent' && new Date(invoice.dueDate) < new Date() && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                      Retard {getDaysOverdue(invoice.dueDate)}j
                    </span>
                  )}

                  {/* Skip reminders badge */}
                  {invoice.skipReminders && invoice.status === 'sent' && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded" title="Relances désactivées">
                      <BellOff className="w-3 h-3 inline" />
                    </span>
                  )}

                  {/* Reminder count — clickable to show history */}
                  {invoice.reminderCount > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === `reminder-${invoice._id}` ? null : `reminder-${invoice._id}`)}
                        className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                        title="Voir l'historique des relances"
                      >
                        Relance {invoice.reminderCount}/4
                      </button>

                      {activeMenu === `reminder-${invoice._id}` && invoice.reminders?.length > 0 && (
                        <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border p-3 z-10">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Historique des relances
                          </p>
                          <div className="space-y-1.5">
                            {invoice.reminders.map((r, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  {r.emailSent ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {REMINDER_LABELS[r.type] || r.type}
                                  </span>
                                </div>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {format(new Date(r.sentAt), 'dd MMM yyyy', { locale: fr })}
                                </span>
                              </div>
                            ))}
                          </div>
                          {invoice.nextReminderDate && invoice.status === 'sent' && (
                            <p className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-500 dark:text-slate-400">
                              Prochaine : {format(new Date(invoice.nextReminderDate), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AbaNinja badge */}
                  {invoice.abaNinjaId && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                      AN
                    </span>
                  )}

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

                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === `invoice-${invoice._id}` ? null : `invoice-${invoice._id}`)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === `invoice-${invoice._id}` && (
                      <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-10">
                        {/* Portal link */}
                        <button
                          onClick={() => onGeneratePortalLink(invoice._id, 'invoice')}
                          className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Générer lien portail
                        </button>

                        {/* Send reminder */}
                        {invoice.status === 'sent' && new Date(invoice.dueDate) < new Date() && (
                          <button
                            onClick={() => onSendReminder(invoice._id)}
                            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                          >
                            <Bell className="w-4 h-4" />
                            Envoyer relance
                          </button>
                        )}

                        {/* Toggle reminders */}
                        {settings?.reminders?.enabled && invoice.status === 'sent' && (
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
                        {invoice.status === 'sent' && (
                          <button
                            onClick={() => onStatusChange(invoice._id, 'paid')}
                            className="w-full px-4 py-2 text-sm text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Marquer payée
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
            );
          })}
        </div>
      )}
    </section>
  );
}
