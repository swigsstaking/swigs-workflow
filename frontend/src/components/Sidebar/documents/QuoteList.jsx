import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText, Plus, Send, Check, Receipt, MoreVertical, Trash2, Mail, Pencil, ExternalLink, Link2, X
} from 'lucide-react';
import Button from '../../ui/Button';
import { QuoteStatusBadge } from '../../ui/Badge';

export default function QuoteList({
  project,
  quotes,
  settings,
  activeMenu,
  setActiveMenu,
  deleteQuoteConfirm,
  setDeleteQuoteConfirm,
  onStatusChange,
  onDelete,
  onShowQuoteModal,
  onEdit,
  onCreateInvoiceFromQuote,
  onGeneratePortalLink,
  onSyncAbaNinja,
  canDeleteQuote,
  generateMailtoLink,
  formatCurrency
}) {
  return (
    <section>
      {/* Click-outside overlay to close dropdown */}
      {activeMenu?.startsWith('quote-') && (
        <div className="fixed inset-0 z-[5]" onClick={() => setActiveMenu(null)} />
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">Devis</h3>
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={onShowQuoteModal}
        >
          Nouveau
        </Button>
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Aucun devis</p>
      ) : (
        <div className="space-y-2">
          {quotes.map(quote => {
            const mailtoLink = generateMailtoLink('quote', quote);
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

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(quote.total)}
                  </span>
                  <QuoteStatusBadge status={quote.status} />

                  {/* AbaNinja badge */}
                  {quote.abaNinjaId && (
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
                      onClick={() => setActiveMenu(activeMenu === `quote-${quote._id}` ? null : `quote-${quote._id}`)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === `quote-${quote._id}` && (
                      <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-10">
                        {/* Edit button - always available */}
                        <button
                          onClick={() => onEdit(quote)}
                          className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Modifier
                        </button>

                        {/* Portal link */}
                        <button
                          onClick={() => onGeneratePortalLink(quote._id, 'quote')}
                          className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Générer lien portal
                        </button>

                        {/* AbaNinja sync */}
                        {settings?.abaninja?.enabled && !quote.abaNinjaId && (
                          <button
                            onClick={() => onSyncAbaNinja(quote._id, 'quote')}
                            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                          >
                            <Link2 className="w-4 h-4" />
                            Sync AbaNinja
                          </button>
                        )}

                        {quote.status === 'draft' && (
                          <button
                            onClick={() => onStatusChange(quote._id, 'sent')}
                            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            Marquer envoyé
                          </button>
                        )}
                        {quote.status === 'sent' && (
                          <>
                            <button
                              onClick={() => onStatusChange(quote._id, 'signed')}
                              className="w-full px-4 py-2 text-sm text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Marquer signé
                            </button>
                            <button
                              onClick={() => onStatusChange(quote._id, 'refused')}
                              className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Marquer refusé
                            </button>
                          </>
                        )}
                        {(quote.status === 'signed' || quote.status === 'partial') && (
                          <button
                            onClick={() => onCreateInvoiceFromQuote(quote._id)}
                            className="w-full px-4 py-2 text-sm text-left text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2"
                          >
                            <Receipt className="w-4 h-4" />
                            Créer facture
                          </button>
                        )}

                        {/* Delete button - conditional */}
                        {canDeleteQuote(quote) && (
                          <button
                            onClick={() => {
                              setDeleteQuoteConfirm(quote);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        )}
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
