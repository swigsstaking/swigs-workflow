import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText, Plus, Send, Check, Receipt, MoreVertical, Trash2, Mail, Pencil, ExternalLink, Link2, X, FileDown
} from 'lucide-react';
import Button from '../../ui/Button';
import { QuoteStatusBadge } from '../../ui/Badge';
import { formatCurrency } from '../../../utils/format';

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
  onSendEmail,
  onGeneratePortalLink,
  onSyncAbaNinja,
  onDownloadPdf,
  canDeleteQuote,
  generateMailtoLink
}) {
  const [menuPos, setMenuPos] = useState(null);

  // Clear position when menu closes (e.g. parent resets activeMenu after action)
  useEffect(() => {
    if (!activeMenu?.startsWith('quote-')) setMenuPos(null);
  }, [activeMenu]);

  const handleMenuToggle = (e, quoteId) => {
    const id = `quote-${quoteId}`;
    if (activeMenu === id) {
      setActiveMenu(null);
      setMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPos({
        right: window.innerWidth - rect.right,
        ...(spaceAbove > spaceBelow
          ? { bottom: window.innerHeight - rect.top + 4, top: undefined }
          : { top: rect.bottom + 4, bottom: undefined }),
      });
      setActiveMenu(id);
    }
  };

  const closeMenu = () => { setActiveMenu(null); setMenuPos(null); };

  return (
    <section>
      {/* Click-outside overlay — portaled to escape overflow */}
      {activeMenu?.startsWith('quote-') && createPortal(
        <div className="fixed inset-0 z-[9998]" onClick={closeMenu} />,
        document.body
      )}
      <div className="flex items-center justify-between mb-3">
        <h3 className="swigs-section-label">Devis</h3>
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
        <div className="flex flex-col items-center py-8 text-center border border-dashed border-[rgb(var(--swigs-stone)/0.4)] dark:border-dark-border rounded-[8px] bg-[rgb(var(--swigs-cream)/0.3)] dark:bg-white/[0.02]">
          <FileText className="w-8 h-8 text-[rgb(var(--swigs-stone))] mb-2" />
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 mb-0.5">Aucun devis</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">Créez un devis pour ce projet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map(quote => {
            const hasSmtp = !!(settings?.smtp?.host && settings?.smtp?.user);
            const mailtoLink = !hasSmtp ? generateMailtoLink('quote', quote) : null;
            const accentColor = quote.status === 'signed' || quote.status === 'invoiced'
              ? '#10b981'
              : quote.status === 'refused'
                ? '#ef4444'
                : quote.status === 'partial'
                  ? '#f59e0b'
                  : quote.status === 'sent'
                    ? 'rgb(var(--primary-500))'
                    : 'rgb(var(--swigs-stone))';
            return (
              <div
                key={quote._id}
                className="flex items-center justify-between p-3 bg-white dark:bg-dark-card rounded-[8px] border border-[rgb(var(--swigs-stone)/0.35)] dark:border-dark-border transition-all duration-200 hover:-translate-y-px hover:shadow-sm"
                style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[13px] font-display font-semibold text-slate-900 dark:text-white">{quote.number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {format(new Date(quote.issueDate), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="swigs-amount text-[13px] font-bold text-slate-900 dark:text-white">
                    {formatCurrency(quote.total)}
                  </span>
                  <QuoteStatusBadge status={quote.status} />

                  {/* AbaNinja badge */}
                  {quote.abaNinjaId && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                      AN
                    </span>
                  )}

                  {/* PDF download */}
                  <button
                    onClick={() => onDownloadPdf(quote)}
                    className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                    title="Télécharger le PDF"
                  >
                    <FileDown className="w-4 h-4" />
                  </button>

                  {/* Mail button — SMTP send or mailto fallback */}
                  {hasSmtp && project.client?.email ? (
                    <button
                      onClick={() => onSendEmail(quote._id, 'quote')}
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

                  <button
                    onClick={(e) => handleMenuToggle(e, quote._id)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown menu — portaled to escape overflow */}
                  {activeMenu === `quote-${quote._id}` && menuPos && createPortal(
                    <div
                      className="fixed w-52 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-slate-200 dark:border-dark-border py-1 z-[9999] max-h-[80vh] overflow-y-auto"
                      style={{
                        right: menuPos.right,
                        ...(menuPos.bottom != null ? { bottom: menuPos.bottom } : { top: menuPos.top }),
                      }}
                    >
                      {/* Edit button - always available */}
                      <button
                        onClick={() => { onEdit(quote); closeMenu(); }}
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
                        Générer lien portail
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
                            closeMenu();
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
