import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, Trash2, Eye, Tag, Repeat, Search, Check, Loader2, Paperclip, X, Pencil } from 'lucide-react';
import Modal from '../ui/Modal';
import { bankApi, invoicesApi } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useToastStore } from '../../stores/toastStore';

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtSize = (bytes) => bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} Ko`;

export default function TransactionDetailModal({
  transaction,
  onClose,
  categories = [],
  recurringCharges,
  onTransactionUpdated,
  onRecurringChanged
}) {
  const { addToast } = useToastStore();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Recurring charge state
  const [recurringToggle, setRecurringToggle] = useState(false);
  const [existingCharge, setExistingCharge] = useState(null);
  const [rcForm, setRcForm] = useState({ frequency: 'monthly', expectedAmount: 0, expenseCategory: '' });
  const [creatingRC, setCreatingRC] = useState(false);

  // CRDT invoice matching
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoices, setInvoices] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [matching, setMatching] = useState(false);

  // Fetch full transaction if partial (drill-down items don't have creditDebit)
  useEffect(() => {
    if (!transaction) return;

    if (transaction.creditDebit) {
      // Full object
      setTx(transaction);
      setNotes(transaction.notes || '');
    } else {
      // Partial — fetch full
      setLoading(true);
      bankApi.getTransaction(transaction._id)
        .then(({ data }) => {
          setTx(data.data);
          setNotes(data.data.notes || '');
        })
        .catch(() => addToast({ type: 'error', message: 'Erreur chargement transaction' }))
        .finally(() => setLoading(false));
    }
  }, [transaction, addToast]);

  // Init recurring form when tx loads
  useEffect(() => {
    if (!tx) return;
    setRcForm({
      frequency: 'monthly',
      expectedAmount: tx.amount || 0,
      expenseCategory: tx.expenseCategory?._id || tx.expenseCategory || ''
    });
  }, [tx]);

  // Check existing recurring charge
  useEffect(() => {
    if (!tx || !recurringCharges?.charges) {
      setExistingCharge(null);
      return;
    }
    const match = recurringCharges.charges.find(
      c => c.counterpartyName?.toLowerCase() === tx.counterpartyName?.toLowerCase()
    );
    setExistingCharge(match || null);
    setRecurringToggle(!!match);
  }, [tx, recurringCharges]);

  const handleSaveNotes = async () => {
    if (!tx) return;
    setSavingNotes(true);
    try {
      await bankApi.updateTransaction(tx._id, { notes });
      addToast({ type: 'success', message: 'Notes sauvegardées' });
    } catch {
      addToast({ type: 'error', message: 'Erreur sauvegarde notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveName = async () => {
    if (!tx || !editName.trim()) return;
    setSavingName(true);
    try {
      await bankApi.updateTransaction(tx._id, { counterpartyName: editName.trim() });
      setTx(prev => ({ ...prev, counterpartyName: editName.trim() }));
      setEditingName(false);
      addToast({ type: 'success', message: 'Nom modifié' });
      onTransactionUpdated?.();
    } catch {
      addToast({ type: 'error', message: 'Erreur modification nom' });
    } finally {
      setSavingName(false);
    }
  };

  const handleCategorize = async (categoryId) => {
    if (!tx) return;
    try {
      const { data } = await bankApi.categorizeTransaction(tx._id, categoryId);
      setTx(prev => ({ ...prev, expenseCategory: data.data.expenseCategory }));
      addToast({ type: 'success', message: 'Catégorie assignée' });
      onTransactionUpdated?.();
    } catch {
      addToast({ type: 'error', message: 'Erreur catégorisation' });
    }
  };

  // --- Attachments ---
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !tx) return;
    e.target.value = '';

    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', message: 'Fichier trop volumineux (max 2 Mo)' });
      return;
    }

    setUploading(true);
    try {
      const { data } = await bankApi.addAttachment(tx._id, file);
      setTx(data.data);
      addToast({ type: 'success', message: 'Document ajouté' });
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (aid) => {
    if (!tx) return;
    try {
      const { data } = await bankApi.removeAttachment(tx._id, aid);
      setTx(data.data);
      addToast({ type: 'success', message: 'Document supprimé' });
    } catch {
      addToast({ type: 'error', message: 'Erreur suppression' });
    }
  };

  const handlePreviewAttachment = (att) => {
    if (att.mimeType === 'application/pdf') {
      const byteChars = atob(att.data);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
    // Images are shown inline via data URL
  };

  // --- Recurring charge ---
  const handleCreateRecurring = async () => {
    if (!tx) return;
    setCreatingRC(true);
    try {
      await bankApi.createRecurringCharge({
        counterpartyName: tx.counterpartyName,
        frequency: rcForm.frequency,
        expectedAmount: rcForm.expectedAmount,
        expenseCategory: rcForm.expenseCategory || undefined,
        sampleTransactionIds: [tx._id]
      });
      addToast({ type: 'success', message: 'Charge récurrente créée' });
      onRecurringChanged?.();
    } catch (err) {
      if (err.response?.status === 409) {
        addToast({ type: 'error', message: 'Cette charge existe déjà' });
      } else {
        addToast({ type: 'error', message: 'Erreur création charge' });
      }
    } finally {
      setCreatingRC(false);
    }
  };

  const handleDeleteRecurring = async () => {
    if (!existingCharge) return;
    if (!confirm('Supprimer cette charge récurrente ?')) return;
    try {
      await bankApi.deleteRecurringCharge(existingCharge._id);
      setExistingCharge(null);
      setRecurringToggle(false);
      addToast({ type: 'success', message: 'Charge supprimée' });
      onRecurringChanged?.();
    } catch {
      addToast({ type: 'error', message: 'Erreur suppression' });
    }
  };

  // --- CRDT: Invoice matching ---
  const loadInvoices = useCallback(async () => {
    if (invoices) return;
    setLoadingInvoices(true);
    try {
      const { data } = await invoicesApi.getAll({ status: 'sent,partial', limit: 50 });
      setInvoices(data.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [invoices]);

  const handleMatchInvoice = async (invoiceId) => {
    if (!tx) return;
    setMatching(true);
    try {
      const { data } = await bankApi.matchTransaction(tx._id, invoiceId);
      setTx(prev => ({ ...prev, matchStatus: 'matched', matchedInvoice: data.data.matchedInvoice }));
      addToast({ type: 'success', message: 'Transaction rapprochée' });
      onTransactionUpdated?.();
    } catch {
      addToast({ type: 'error', message: 'Erreur rapprochement' });
    } finally {
      setMatching(false);
    }
  };

  const getInvoiceClientName = (inv) =>
    inv.clientSnapshot?.name || inv.project?.client?.name || inv.project?.client?.company || '';

  const filteredInvoices = invoices?.filter(inv => {
    if (!invoiceSearch) return true;
    const q = invoiceSearch.toLowerCase();
    return (
      inv.number?.toLowerCase().includes(q) ||
      getInvoiceClientName(inv).toLowerCase().includes(q)
    );
  }) || [];

  const isDbit = tx?.creditDebit === 'DBIT';
  const isCrdt = tx?.creditDebit === 'CRDT';
  const attachments = tx?.attachments || [];
  const catObj = typeof tx?.expenseCategory === 'object' ? tx.expenseCategory : null;

  return (
    <Modal
      isOpen={!!transaction}
      onClose={onClose}
      title={loading ? 'Chargement...' : tx ? `${tx.counterpartyName || 'Transaction'}` : 'Transaction'}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
        </div>
      ) : !tx ? (
        <p className="text-sm text-slate-400 text-center py-8">Transaction introuvable</p>
      ) : (
        <div className="space-y-6">
          {/* A. Header */}
          <div className="flex items-center justify-between">
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                    className="text-lg font-semibold bg-transparent border-b-2 border-primary-500 text-slate-900 dark:text-white outline-none py-0"
                  />
                  <button onClick={handleSaveName} disabled={savingName} className="text-xs px-2 py-1 rounded bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50">
                    {savingName ? '...' : 'OK'}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tx.counterpartyName || '—'}</h3>
                  <button
                    onClick={() => { setEditName(tx.counterpartyName || ''); setEditingName(true); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
                    title="Modifier le nom"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400">{fmtDate(tx.bookingDate)}</p>
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold ${isDbit ? 'text-red-500' : 'text-emerald-500'}`}>
                {isDbit ? '-' : '+'}{formatCurrency(tx.amount)}
              </p>
              {tx.importFilename && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {tx.importFilename}
                </span>
              )}
            </div>
          </div>

          {/* B. DBIT: Info & Category */}
          {isDbit && (
            <div className="space-y-4">
              {/* Reference / Description (readonly) */}
              {(tx.reference || tx.unstructuredReference) && (
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  {tx.reference && <p><span className="font-medium">Réf:</span> {tx.reference}</p>}
                  {tx.unstructuredReference && <p><span className="font-medium">Description:</span> {tx.unstructuredReference}</p>}
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie</label>
                <select
                  value={catObj?._id || ''}
                  onChange={(e) => handleCategorize(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">— Aucune —</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}{c.accountNumber ? ` (${c.accountNumber})` : ''}</option>
                  ))}
                </select>
                {catObj && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catObj.color }} />
                    <span className="text-xs text-slate-500">{catObj.name}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  placeholder="Notes internes..."
                />
                {notes !== (tx.notes || '') && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-1 text-xs px-3 py-1 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    {savingNotes ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* B. CRDT: Invoice matching */}
          {isCrdt && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Assignation facture
              </h4>

              {tx.matchStatus === 'matched' && tx.matchedInvoice ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {tx.matchedInvoice.number}
                      </span>
                      {tx.matchedInvoice.clientSnapshot?.name && (
                        <span className="text-xs text-slate-500">{tx.matchedInvoice.clientSnapshot.name}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">Total: {formatCurrency(tx.matchedInvoice.total)}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                    <Check className="w-3 h-3" /> Rapproché
                  </span>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      onFocus={loadInvoices}
                      placeholder="Rechercher facture (numéro ou client)..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {loadingInvoices && (
                    <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement factures...
                    </div>
                  )}

                  {invoices && !loadingInvoices && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredInvoices.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-3">Aucune facture impayée trouvée</p>
                      ) : (
                        filteredInvoices.map(inv => (
                          <button
                            key={inv._id}
                            onClick={() => handleMatchInvoice(inv._id)}
                            disabled={matching}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-500">{inv.number}</span>
                                <span className="text-sm text-slate-700 dark:text-slate-300">{getInvoiceClientName(inv) || '—'}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(inv.total)}</span>
                              {Math.abs(inv.total - tx.amount) < 0.01 ? (
                                <span className="block text-[10px] text-emerald-500">Montant exact</span>
                              ) : (
                                <span className="block text-[10px] text-amber-500">
                                  {inv.total > tx.amount ? '+' : ''}{formatCurrency(inv.total - tx.amount)}
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reference / Description (readonly) for CRDT */}
              {(tx.reference || tx.unstructuredReference) && (
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {tx.reference && <p><span className="font-medium">Réf:</span> {tx.reference}</p>}
                  {tx.unstructuredReference && <p><span className="font-medium">Description:</span> {tx.unstructuredReference}</p>}
                </div>
              )}
            </div>
          )}

          {/* C. Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Documents
                <span className="text-slate-400 font-normal">{attachments.length}/5</span>
              </h4>
              {attachments.length < 5 && (
                <label className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? 'Upload...' : 'Ajouter'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun document joint</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div key={att._id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-slate-800">
                    {/* Preview thumbnail for images */}
                    {att.mimeType?.startsWith('image/') ? (
                      <img
                        src={`data:${att.mimeType};base64,${att.data}`}
                        alt={att.filename}
                        className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700 cursor-pointer"
                        onClick={() => {
                          const byteChars = atob(att.data);
                          const byteArr = new Uint8Array(byteChars.length);
                          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                          const blob = new Blob([byteArr], { type: att.mimeType });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded bg-red-50 dark:bg-red-900/20 flex items-center justify-center cursor-pointer"
                        onClick={() => handlePreviewAttachment(att)}
                      >
                        <FileText className="w-5 h-5 text-red-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{att.filename}</p>
                      <p className="text-[10px] text-slate-400">
                        {fmtSize(att.size)} {att.uploadedAt && `· ${fmtDate(att.uploadedAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => att.mimeType?.startsWith('image/')
                          ? window.open(`data:${att.mimeType};base64,${att.data}`, '_blank')
                          : handlePreviewAttachment(att)
                        }
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Aperçu"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveAttachment(att._id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D. DBIT: Recurring charge toggle */}
          {isDbit && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" /> Charge récurrente
                </h4>
                <button
                  onClick={() => {
                    if (recurringToggle && existingCharge) {
                      handleDeleteRecurring();
                    } else {
                      setRecurringToggle(!recurringToggle);
                    }
                  }}
                  className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                    recurringToggle ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    recurringToggle ? 'left-4' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {recurringToggle && existingCharge && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-900 dark:text-white">{existingCharge.counterpartyName}</span>
                    {' — '}
                    {existingCharge.frequency === 'monthly' ? 'Mensuel' : existingCharge.frequency === 'quarterly' ? 'Trimestriel' : 'Annuel'}
                    {' · '}{formatCurrency(existingCharge.expectedAmount)}
                  </div>
                </div>
              )}

              {recurringToggle && !existingCharge && (
                <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Fréquence</label>
                      <select
                        value={rcForm.frequency}
                        onChange={(e) => setRcForm(f => ({ ...f, frequency: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="monthly">Mensuel</option>
                        <option value="quarterly">Trimestriel</option>
                        <option value="yearly">Annuel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Montant</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rcForm.expectedAmount}
                        onChange={(e) => setRcForm(f => ({ ...f, expectedAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Catégorie</label>
                    <select
                      value={rcForm.expenseCategory}
                      onChange={(e) => setRcForm(f => ({ ...f, expenseCategory: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">— Aucune —</option>
                      {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateRecurring}
                    disabled={creatingRC || rcForm.expectedAmount <= 0}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {creatingRC ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
                    {creatingRC ? 'Création...' : 'Créer la charge récurrente'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
