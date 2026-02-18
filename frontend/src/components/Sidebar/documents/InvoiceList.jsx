import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Receipt, Plus, Send, Check, MoreVertical, Trash2, Mail, Bell, ExternalLink, Link2
} from 'lucide-react';
import Button from '../../ui/Button';
import { InvoiceStatusBadge } from '../../ui/Badge';

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
  onGeneratePortalLink,
  onSyncAbaNinja,
  generateMailtoLink,
  formatCurrency,
  getDaysOverdue
}) {
  return (
    <section>
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
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Aucune facture</p>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => {
            const mailtoLink = generateMailtoLink('invoice', invoice);
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

                  {/* Reminder count */}
                  {invoice.reminderCount > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                      Relance {invoice.reminderCount}/4
                    </span>
                  )}

                  {/* AbaNinja badge */}
                  {invoice.abaNinjaId && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                      AN
                    </span>
                  )}

                  {/* Mail button */}
                  {mailtoLink && (
                    <a
                      href={mailtoLink}
                      className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                      title="Envoyer par email"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}

                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === `invoice-${invoice._id}` ? null : `invoice-${invoice._id}`)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
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
                          Générer lien portal
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
                            className="w-full px-4 py-2 text-sm text-left text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
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
