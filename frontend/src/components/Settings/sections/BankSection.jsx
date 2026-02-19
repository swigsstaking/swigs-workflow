import { useState, useEffect, useCallback, useRef } from 'react';
import { Landmark, Upload, CheckCircle2, AlertTriangle, XCircle, Search, FileText, ArrowRight, Mail, Save, RefreshCw } from 'lucide-react';
import { bankApi, invoicesApi, settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';

const statusBadge = {
  matched: { label: 'Rapproché', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  suggested: { label: 'Suggéré', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  unmatched: { label: 'Non rapproché', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  ignored: { label: 'Ignoré', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
};

export default function BankSection() {
  // --- Upload state ---
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [imports, setImports] = useState([]);
  const [importsLoaded, setImportsLoaded] = useState(false);
  const [matchModal, setMatchModal] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // --- IMAP state ---
  const [imapForm, setImapForm] = useState({
    enabled: false,
    host: '',
    port: 993,
    tls: true,
    user: '',
    pass: '',
    folder: 'INBOX'
  });
  const [imapHasPass, setImapHasPass] = useState(false);
  const [imapLastChecked, setImapLastChecked] = useState(null);
  const [imapHasChanges, setImapHasChanges] = useState(false);
  const [imapSaving, setImapSaving] = useState(false);
  const [imapTesting, setImapTesting] = useState(false);
  const [imapTestResult, setImapTestResult] = useState(null);
  const [imapFetching, setImapFetching] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const { addToast } = useToastStore();

  // Load settings for IMAP config
  useEffect(() => {
    (async () => {
      try {
        const { data } = await settingsApi.get();
        const bankImap = data.data?.bankImap || {};
        setImapForm({
          enabled: bankImap.enabled || false,
          host: bankImap.host || '',
          port: bankImap.port || 993,
          tls: bankImap.tls !== false,
          user: bankImap.user || '',
          pass: '',
          folder: bankImap.folder || 'INBOX'
        });
        setImapHasPass(bankImap._hasPass || false);
        setImapLastChecked(bankImap.lastCheckedAt || null);
        setSettingsLoaded(true);
      } catch {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  const loadImports = useCallback(async () => {
    try {
      const { data } = await bankApi.getImports();
      setImports(data.data);
      setImportsLoaded(true);
    } catch {
      // silent
    }
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.xml')) {
      addToast({ type: 'error', message: 'Seuls les fichiers XML sont acceptés' });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await bankApi.import(file);
      setImportResult(data.data);
      setTransactions(data.data.transactions || []);
      addToast({ type: 'success', message: `Import réussi: ${data.data.results.matched} rapprochées, ${data.data.results.suggested} suggérées, ${data.data.results.unmatched} non rapprochées` });
      loadImports();
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      addToast({ type: 'error', message: `Erreur d'import: ${msg}` });
    } finally {
      setImporting(false);
    }
  }, [addToast, loadImports]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const handleMatchClick = (tx) => {
    setMatchModal(tx);
    setInvoiceSearch('');
    setInvoiceResults([]);
  };

  const searchInvoices = async () => {
    if (!invoiceSearch.trim()) return;
    setSearching(true);
    try {
      const { data } = await invoicesApi.getAll({ status: 'sent', search: invoiceSearch.trim() });
      setInvoiceResults(data.data || []);
    } catch {
      setInvoiceResults([]);
    } finally {
      setSearching(false);
    }
  };

  const confirmMatch = async (invoiceId) => {
    if (!matchModal) return;
    try {
      const { data } = await bankApi.matchTransaction(matchModal._id, invoiceId);
      setTransactions(prev => prev.map(t => t._id === matchModal._id ? data.data : t));
      addToast({ type: 'success', message: 'Transaction rapprochée avec succès' });
      setMatchModal(null);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du rapprochement' });
    }
  };

  const handleIgnore = async (txId) => {
    try {
      const { data } = await bankApi.ignoreTransaction(txId);
      setTransactions(prev => prev.map(t => t._id === txId ? data.data : t));
    } catch {
      addToast({ type: 'error', message: 'Erreur' });
    }
  };

  const loadImportTransactions = async (importId) => {
    try {
      const { data } = await bankApi.getTransactions(importId);
      setTransactions(data.data || []);
      setImportResult(null);
    } catch {
      addToast({ type: 'error', message: 'Erreur de chargement' });
    }
  };

  // --- IMAP handlers ---
  const updateImapField = (field, value) => {
    setImapForm(prev => ({ ...prev, [field]: value }));
    setImapHasChanges(true);
  };

  const handleImapSave = async () => {
    setImapSaving(true);
    try {
      const payload = { ...imapForm };
      if (!payload.pass) delete payload.pass;
      await settingsApi.update({ bankImap: payload });
      setImapHasChanges(false);
      if (payload.pass) setImapHasPass(true);
      addToast({ type: 'success', message: 'Configuration IMAP enregistrée' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de l\'enregistrement' });
    } finally {
      setImapSaving(false);
    }
  };

  const handleImapTest = async () => {
    setImapTesting(true);
    setImapTestResult(null);
    try {
      const { data } = await bankApi.testImap({
        host: imapForm.host,
        port: imapForm.port,
        tls: imapForm.tls,
        user: imapForm.user,
        pass: imapForm.pass || undefined,
        folder: imapForm.folder
      });
      setImapTestResult(data.data);
    } catch (error) {
      setImapTestResult({ success: false, error: error.response?.data?.error || error.message });
    } finally {
      setImapTesting(false);
    }
  };

  const handleImapFetchNow = async () => {
    setImapFetching(true);
    try {
      const { data } = await bankApi.fetchImapNow();
      const count = data.data?.processed || 0;
      addToast({ type: 'success', message: count > 0 ? `${count} relevé(s) importé(s)` : 'Aucun nouveau relevé trouvé' });
      if (count > 0) loadImports();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur de récupération IMAP' });
    } finally {
      setImapFetching(false);
    }
  };

  if (!importsLoaded) loadImports();

  const fmt = (n) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(n || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Import bancaire
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Importez vos relevés bancaires ISO 20022 (camt.053/054) pour rapprocher automatiquement les paiements avec vos factures.
        </p>
      </div>

      {/* ============================================================ */}
      {/* SECTION: Auto IMAP */}
      {/* ============================================================ */}
      <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Import automatique (IMAP)</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Configurez votre banque pour envoyer les relevés camt par email. Le système les récupère automatiquement toutes les heures.
        </p>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-300">Activer l'import IMAP automatique</span>
          <button
            onClick={() => updateImapField('enabled', !imapForm.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              imapForm.enabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              imapForm.enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* IMAP Fields */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!imapForm.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Serveur IMAP</label>
            <input
              type="text"
              value={imapForm.host}
              onChange={(e) => updateImapField('host', e.target.value)}
              placeholder="imap.example.com"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={imapForm.port}
                onChange={(e) => updateImapField('port', parseInt(e.target.value) || 993)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imapForm.tls}
                  onChange={(e) => updateImapField('tls', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                TLS
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Utilisateur</label>
            <input
              type="text"
              value={imapForm.user}
              onChange={(e) => updateImapField('user', e.target.value)}
              placeholder="releves@example.com"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mot de passe</label>
            <input
              type="password"
              value={imapForm.pass}
              onChange={(e) => updateImapField('pass', e.target.value)}
              placeholder={imapHasPass ? 'Laisser vide pour conserver' : 'Mot de passe IMAP'}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            {imapHasPass && !imapForm.pass && (
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Mot de passe configuré</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dossier</label>
            <input
              type="text"
              value={imapForm.folder}
              onChange={(e) => updateImapField('folder', e.target.value)}
              placeholder="INBOX"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* IMAP Actions */}
        <div className={`flex flex-wrap items-center gap-2 ${!imapForm.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Button variant="secondary" size="sm" onClick={handleImapTest} loading={imapTesting} disabled={!imapForm.host || !imapForm.user}>
            Tester la connexion
          </Button>
          <Button variant="secondary" size="sm" onClick={handleImapFetchNow} loading={imapFetching} disabled={!imapHasPass && !imapForm.pass}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Récupérer maintenant
          </Button>
          {imapLastChecked && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Dernier check : {new Date(imapLastChecked).toLocaleString('fr-CH')}
            </span>
          )}
        </div>

        {/* IMAP Test Result */}
        {imapTestResult && (
          <div className={`p-3 rounded-lg flex items-start gap-2 ${
            imapTestResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {imapTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <span className="text-sm">
              {imapTestResult.success
                ? `Connexion OK — ${imapTestResult.messageCount} message(s) dans la boîte`
                : `Erreur : ${imapTestResult.error}`
              }
            </span>
          </div>
        )}

        {/* Save */}
        {imapHasChanges && (
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button icon={Save} size="sm" onClick={handleImapSave} loading={imapSaving}>
              Enregistrer
            </Button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION: Manual Upload */}
      {/* ============================================================ */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Import manuel</h3>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-primary-500' : 'text-slate-400'}`} />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {importing ? 'Import en cours...' : 'Glissez un fichier XML ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Formats acceptés : camt.053 (relevé) et camt.054 (avis débit/crédit) — 5 MB max
          </p>
          {importing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          )}
        </div>
      </div>

      {/* Import Result Summary */}
      {importResult && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Rapprochées</span>
            </div>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{importResult.results.matched}</p>
          </div>
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Suggérées</span>
            </div>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{importResult.results.suggested}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Non rapprochées</span>
            </div>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">{importResult.results.unmatched}</p>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Transactions ({transactions.length})
          </h3>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Contrepartie</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Référence</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Montant</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Statut</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Facture</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.map((tx) => {
                  const badge = statusBadge[tx.matchStatus] || statusBadge.unmatched;
                  return (
                    <tr key={tx._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {new Date(tx.bookingDate).toLocaleDateString('fr-CH')}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                        {tx.counterpartyName || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs max-w-[150px] truncate">
                        {tx.reference || tx.unstructuredReference || '-'}
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                        tx.creditDebit === 'CRDT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tx.creditDebit === 'CRDT' ? '+' : '-'}{fmt(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {tx.matchConfidence > 0 && tx.matchStatus !== 'ignored' && (
                          <span className="ml-1 text-xs text-slate-400">{tx.matchConfidence}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">
                        {tx.matchedInvoice?.number || '-'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {(tx.matchStatus === 'unmatched' || tx.matchStatus === 'suggested') && tx.creditDebit === 'CRDT' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleMatchClick(tx)}
                              className="px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            >
                              Rapprocher
                            </button>
                            <button
                              onClick={() => handleIgnore(tx._id)}
                              className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              Ignorer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Imports */}
      {imports.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Historique des imports
          </h3>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div
                key={imp._id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => loadImportTransactions(imp.importId)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{imp.filename}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(imp.createdAt).toLocaleDateString('fr-CH')} — {imp.fileType} — {imp.totalTransactions} transactions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{imp.matchedCount}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{imp.suggestedCount}</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{imp.unmatchedCount}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Comment configurer l'import automatique ?
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>Dans votre e-banking, activez l'envoi automatique du relevé camt.053 par email (quotidien)</li>
          <li>Renseignez les informations IMAP de la boîte mail réceptrice ci-dessus</li>
          <li>Testez la connexion puis activez l'import automatique</li>
          <li>Le système vérifie la boîte toutes les heures et importe les nouveaux relevés</li>
        </ol>
      </div>

      {/* Match Modal */}
      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setMatchModal(null)}>
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Rapprocher la transaction
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {matchModal.counterpartyName || 'Inconnu'} — {fmt(matchModal.amount)} le {new Date(matchModal.bookingDate).toLocaleDateString('fr-CH')}
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchInvoices()}
                placeholder="Rechercher par n° ou client..."
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <Button variant="secondary" size="sm" onClick={searchInvoices} loading={searching}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            {invoiceResults.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {invoiceResults.map((inv) => (
                  <button
                    key={inv._id}
                    onClick={() => confirmMatch(inv._id)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.number}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{inv.project?.client?.name || 'Client inconnu'}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(inv.total)}</span>
                  </button>
                ))}
              </div>
            ) : invoiceSearch && !searching ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Aucune facture trouvée</p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setMatchModal(null)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
