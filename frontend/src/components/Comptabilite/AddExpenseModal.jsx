import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, PlusCircle, ArrowRight, ArrowLeft, Check, AlertCircle, Loader2, X, Camera } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import { bankApi, bankAccountsApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import useOcr from '../../hooks/useOcr';

const TABS = [
  { key: 'manual', label: 'Saisie manuelle', icon: PlusCircle },
  { key: 'csv', label: 'Import CSV', icon: FileSpreadsheet },
  { key: 'scanner', label: 'Scanner', icon: Camera },
];

const CATEGORY_MAP = {
  office: ['bureau', 'office', 'fourniture'],
  telecom: ['télécom', 'telecom', 'internet', 'téléphone'],
  transport: ['transport', 'déplacement', 'essence', 'parking'],
  food: ['alimentation', 'restaurant', 'repas'],
  software: ['logiciel', 'software', 'abonnement', 'saas'],
  insurance: ['assurance', 'insurance'],
  rent: ['loyer', 'rent', 'bail'],
};

function mapOcrCategory(ocrCategory, categories) {
  if (!ocrCategory) return '';
  const keywords = CATEGORY_MAP[ocrCategory] || [ocrCategory];
  const match = categories.find(c =>
    keywords.some(k => c.name.toLowerCase().includes(k))
  );
  return match?._id || '';
}

export default function AddExpenseModal({ open, onClose, categories = [], onSuccess }) {
  const [tab, setTab] = useState('manual');
  const [ocrPrefill, setOcrPrefill] = useState(null);

  const handleOcrComplete = useCallback((result) => {
    const prefill = {
      counterpartyName: result.vendor || '',
      bookingDate: result.date || new Date().toISOString().slice(0, 10),
      amount: String(result.amountGross || result.amountNet || ''),
      currency: result.currency || 'CHF',
      creditDebit: 'DBIT',
      expenseCategoryId: mapOcrCategory(result.category, categories),
      description: result.description || '',
    };
    setOcrPrefill(prefill);
    setTab('manual');
  }, [categories]);

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title="Ajouter une dépense" size="lg">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 -mt-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'manual' ? (
        <ManualTab categories={categories} onSuccess={onSuccess} onClose={onClose} initialValues={ocrPrefill} />
      ) : tab === 'scanner' ? (
        <ScannerTab onOcrComplete={handleOcrComplete} onClose={onClose} />
      ) : (
        <CsvTab categories={categories} onSuccess={onSuccess} onClose={onClose} />
      )}
    </Modal>
  );
}

/* ─────────────── Scanner Tab ─────────────── */

function ScannerTab({ onOcrComplete, onClose }) {
  const { ocrResult, isProcessing, error, preview, fileInputRef, processFile, clear } = useOcr();
  const [dragOver, setDragOver] = useState(false);
  const cameraInputRef = useRef(null);
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // When OCR succeeds, pass result up
  useEffect(() => {
    if (ocrResult) {
      onOcrComplete(ocrResult);
    }
  }, [ocrResult, onOcrComplete]);

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isMobile && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          isMobile ? '' : 'cursor-pointer'
        } ${
          dragOver
            ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
        }`}
      >
        {isProcessing ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 mx-auto text-primary-500 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Analyse du document en cours...</p>
          </div>
        ) : (
          <>
            <Camera className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isMobile ? 'Photographiez ou importez un document' : (
                <>Glissez une <span className="font-semibold">facture</span> ou un <span className="font-semibold">ticket</span> ici</>
              )}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              JPEG, PNG, WebP ou PDF
            </p>
            {isMobile && (
              <div className="flex gap-2 justify-center mt-4">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Choisir un fichier
                </button>
              </div>
            )}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = '';
          }}
        />
        {isMobile && (
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
              e.target.value = '';
            }}
          />
        )}
      </div>

      {/* Preview image */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <img src={preview} alt="Document" className="max-h-48 w-full object-contain bg-slate-50 dark:bg-slate-800" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-medium text-slate-600 dark:text-slate-300">Comment ca marche</p>
        <p>Prenez en photo ou importez une facture/ticket. L'IA extrait automatiquement le fournisseur, la date, le montant et la catégorie.</p>
        <p>Les champs seront pré-remplis dans le formulaire de saisie manuelle.</p>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  );
}

/* ─────────────── Manual Tab ─────────────── */

function ManualTab({ categories, onSuccess, onClose, initialValues }) {
  const { addToast } = useToastStore();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState(null);
  const [ocrFields, setOcrFields] = useState(new Set());

  const defaultForm = {
    bookingDate: new Date().toISOString().slice(0, 10),
    amount: '',
    currency: 'CHF',
    creditDebit: 'DBIT',
    counterpartyName: '',
    description: '',
    expenseCategoryId: '',
    bankAccountId: '',
    notes: '',
  };

  const [form, setForm] = useState(() => {
    if (initialValues) {
      const merged = { ...defaultForm };
      const fields = new Set();
      for (const [k, v] of Object.entries(initialValues)) {
        if (v && v !== '' && k in merged) {
          merged[k] = v;
          fields.add(k);
        }
      }
      // defer setting ocrFields
      setTimeout(() => setOcrFields(fields), 0);
      return merged;
    }
    return defaultForm;
  });

  // When initialValues changes (OCR prefill), update form
  useEffect(() => {
    if (!initialValues) return;
    const fields = new Set();
    setForm(prev => {
      const updated = { ...prev };
      for (const [k, v] of Object.entries(initialValues)) {
        if (v && v !== '' && k in updated) {
          updated[k] = v;
          fields.add(k);
        }
      }
      return updated;
    });
    setOcrFields(fields);
  }, [initialValues]);

  // Lazy-load bank accounts on first render
  useState(() => {
    bankAccountsApi.getAll().then(r => setAccounts(r.data.data || [])).catch(() => setAccounts([]));
  });

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear OCR highlight when user edits a field
    if (ocrFields.has(k)) {
      setOcrFields(prev => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  };

  const selectedCat = categories.find(c => c._id === form.expenseCategoryId);

  const ocrFieldClass = (fieldName) =>
    ocrFields.has(fieldName)
      ? 'ring-2 ring-blue-300 dark:ring-blue-600 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg'
      : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bookingDate || !form.amount || Number(form.amount) <= 0) {
      addToast({ type: 'error', message: 'Date et montant (> 0) requis' });
      return;
    }
    setSaving(true);
    try {
      await bankApi.createTransaction({
        ...form,
        amount: Number(form.amount),
        expenseCategoryId: form.expenseCategoryId || undefined,
        bankAccountId: form.bankAccountId || undefined,
      });
      addToast({ type: 'success', message: 'Transaction ajoutée' });
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* OCR banner */}
      {ocrFields.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
          <Camera className="w-4 h-4 shrink-0" />
          <span>Champs pré-remplis par le scanner. Vérifiez et ajustez si nécessaire.</span>
        </div>
      )}

      {/* Row 1: Type toggle */}
      <div className={ocrFieldClass('creditDebit')}>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-[42px]">
          <button
            type="button"
            onClick={() => set('creditDebit', 'DBIT')}
            className={`flex-1 text-sm font-medium transition-colors ${
              form.creditDebit === 'DBIT'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            Dépense
          </button>
          <button
            type="button"
            onClick={() => set('creditDebit', 'CRDT')}
            className={`flex-1 text-sm font-medium transition-colors ${
              form.creditDebit === 'CRDT'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            Revenu
          </button>
        </div>
      </div>

      {/* Row 2: Date + Amount + Currency */}
      <div className="grid grid-cols-5 gap-3">
        <div className={`col-span-2 ${ocrFieldClass('bookingDate')}`}>
          <Input label="Date" type="date" value={form.bookingDate} onChange={e => set('bookingDate', e.target.value)} required />
        </div>
        <div className={`col-span-2 ${ocrFieldClass('amount')}`}>
          <Input label="Montant" type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" />
        </div>
        <div className={`col-span-1 ${ocrFieldClass('currency')}`}>
          <Select label="Devise" value={form.currency} onChange={e => set('currency', e.target.value)} options={[
            { value: 'CHF', label: 'CHF' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
          ]} />
        </div>
      </div>

      {/* Row 2: Counterparty + Description */}
      <div className="grid grid-cols-2 gap-3">
        <div className={ocrFieldClass('counterpartyName')}>
          <Input label="Fournisseur" value={form.counterpartyName} onChange={e => set('counterpartyName', e.target.value)} placeholder="Nom du fournisseur" />
        </div>
        <div className={ocrFieldClass('description')}>
          <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Libellé" />
        </div>
      </div>

      {/* Row 4: Category + Account */}
      <div className={`grid gap-3 ${form.creditDebit === 'DBIT' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {form.creditDebit === 'DBIT' && (
          <div className={ocrFieldClass('expenseCategoryId')}>
            <Select
              label={`Catégorie${selectedCat ? ` · TVA ${selectedCat.vatRate ?? 8.1}%` : ''}`}
              value={form.expenseCategoryId}
              onChange={e => set('expenseCategoryId', e.target.value)}
              options={[
                { value: '', label: '— Aucune —' },
                ...categories.map(c => ({ value: c._id, label: `${c.icon || ''} ${c.name}`.trim() }))
              ]}
            />
          </div>
        )}
        <div>
          {accounts && (
            <Select
              label="Compte bancaire"
              value={form.bankAccountId}
              onChange={e => set('bankAccountId', e.target.value)}
              options={[
                { value: '', label: '— Aucun —' },
                ...(accounts || []).map(a => ({ value: a._id, label: `${a.name}${a.iban ? ' (' + a.iban.slice(-4) + ')' : ''}` }))
              ]}
            />
          )}
        </div>
      </div>

      {/* Notes */}
      <Textarea label="Notes" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes internes (optionnel)" />

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={saving} icon={PlusCircle}>Ajouter</Button>
      </div>
    </form>
  );
}

/* ─────────────── CSV Tab ─────────────── */

function CsvTab({ categories, onSuccess, onClose }) {
  const { addToast } = useToastStore();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1); // 1=upload, 2=mapping, 3=result
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState(null);

  // Mapping state
  const [mapping, setMapping] = useState({ date: '', amount: '', debitAmount: '', creditAmount: '', counterparty: '', description: '' });
  const [dualAmountMode, setDualAmountMode] = useState(false);
  const [options, setOptions] = useState({ defaultCreditDebit: 'DBIT', defaultCategoryId: '', bankAccountId: '', currency: 'CHF' });

  // Result state
  const [result, setResult] = useState(null);

  useState(() => {
    bankAccountsApi.getAll().then(r => setAccounts(r.data.data || [])).catch(() => setAccounts([]));
  });

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const res = await bankApi.previewCsv(f);
      const data = res.data.data;
      setPreview(data);
      // Auto-map common column names (supports Raiffeisen, PostFinance, UBS, etc.)
      const autoMap = { date: '', amount: '', debitAmount: '', creditAmount: '', counterparty: '', description: '' };
      let hasDual = false;
      for (const h of data.headers) {
        const low = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Date
        if (!autoMap.date && (low.includes('date') || low.includes('datum') || low === 'valuta' || low.includes('buchung'))) autoMap.date = h;
        // Single amount
        if (!autoMap.amount && (low.includes('amount') || low.includes('montant') || low.includes('betrag') || low === 'solde')) autoMap.amount = h;
        // Debit column (Raiffeisen: "Belastung", "Debit", "Montant debit", "Ausgaben")
        if (!autoMap.debitAmount && (low.includes('belastung') || low.includes('debit') || low.includes('ausgab') || low.includes('montant debit') || low.includes('depense'))) {
          autoMap.debitAmount = h;
          hasDual = true;
        }
        // Credit column (Raiffeisen: "Gutschrift", "Credit", "Montant credit", "Einnahmen")
        if (!autoMap.creditAmount && (low.includes('gutschrift') || low.includes('credit') || low.includes('einnahm') || low.includes('montant credit') || low.includes('revenu'))) {
          autoMap.creditAmount = h;
          hasDual = true;
        }
        // Counterparty
        if (!autoMap.counterparty && (low.includes('counterparty') || low.includes('fournisseur') || low.includes('empfanger') || low.includes('auftraggeber') || low.includes('nom') || low.includes('name') || low.includes('beneficiaire'))) autoMap.counterparty = h;
        // Description
        if (!autoMap.description && (low.includes('description') || low.includes('libelle') || low.includes('reference') || low.includes('text') || low.includes('mitteilung') || low.includes('buchungstext') || low.includes('avis'))) autoMap.description = h;
      }
      // If dual columns detected AND they are different columns, prefer dual mode
      // Avoid false positive when a single column name contains both "credit" and "debit" (e.g. "Credit/Debit Amount")
      if (hasDual && autoMap.debitAmount && autoMap.creditAmount && autoMap.debitAmount !== autoMap.creditAmount) {
        setDualAmountMode(true);
      } else if (hasDual) {
        // Single column with credit/debit in name — treat as single amount
        if (!autoMap.amount) autoMap.amount = autoMap.debitAmount || autoMap.creditAmount;
        autoMap.debitAmount = '';
        autoMap.creditAmount = '';
      }
      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur de lecture du CSV' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!mapping.date || (!mapping.amount && !dualAmountMode) || (dualAmountMode && !mapping.debitAmount && !mapping.creditAmount)) {
      addToast({ type: 'error', message: 'Colonnes Date et Montant (ou Débit/Crédit) requises' });
      return;
    }
    setLoading(true);
    try {
      const res = await bankApi.confirmCsvImport(file, mapping, options);
      setResult(res.data.data);
      setStep(3);
      if (res.data.data.imported > 0) {
        onSuccess?.();
      }
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur d\'import' });
    } finally {
      setLoading(false);
    }
  };

  // Step 1 — Upload
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-10 h-10 mx-auto text-primary-500 animate-spin" />
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Glissez un fichier <span className="font-semibold">.csv</span> ici ou cliquez pour parcourir
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium text-slate-600 dark:text-slate-300">Formats supportés</p>
          <p>Export CSV de votre e-banking : <span className="font-medium">Raiffeisen, PostFinance, UBS, BCGE, BCV</span>, ou tout fichier CSV/TSV.</p>
          <p>Colonnes détectées automatiquement. Délimiteurs <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">;</code> et <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">,</code> supportés.</p>
          <p>Colonnes montant en une colonne (signée) ou deux colonnes (Débit / Crédit) supportées.</p>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
        </div>
      </div>
    );
  }

  // Step 2 — Mapping
  if (step === 2 && preview) {
    const headerOptions = [
      { value: '', label: '— Ignorer —' },
      ...preview.headers.map(h => ({ value: h, label: h })),
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <FileSpreadsheet className="w-4 h-4" />
          <span className="font-medium">{file?.name}</span>
          <span className="text-xs">— {preview.totalRows} lignes</span>
        </div>

        {/* Column mapping */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Colonne Date *" value={mapping.date} onChange={e => setMapping(m => ({ ...m, date: e.target.value }))} options={headerOptions} />
            {!dualAmountMode ? (
              <Select label="Colonne Montant *" value={mapping.amount} onChange={e => setMapping(m => ({ ...m, amount: e.target.value }))} options={headerOptions} />
            ) : (
              <>
                <div />
              </>
            )}
            {dualAmountMode && (
              <>
                <Select label="Colonne Débit *" value={mapping.debitAmount} onChange={e => setMapping(m => ({ ...m, debitAmount: e.target.value }))} options={headerOptions} />
                <Select label="Colonne Crédit" value={mapping.creditAmount} onChange={e => setMapping(m => ({ ...m, creditAmount: e.target.value }))} options={headerOptions} />
              </>
            )}
            <Select label="Colonne Contrepartie" value={mapping.counterparty} onChange={e => setMapping(m => ({ ...m, counterparty: e.target.value }))} options={headerOptions} />
            <Select label="Colonne Description" value={mapping.description} onChange={e => setMapping(m => ({ ...m, description: e.target.value }))} options={headerOptions} />
          </div>
          <button
            type="button"
            onClick={() => setDualAmountMode(!dualAmountMode)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            {dualAmountMode ? 'Utiliser une seule colonne montant' : 'Deux colonnes Débit / Crédit (Raiffeisen, etc.)'}
          </button>
        </div>

        {/* Global options */}
        <div className="grid grid-cols-4 gap-3">
          <Select label="Type par défaut" value={options.defaultCreditDebit} onChange={e => setOptions(o => ({ ...o, defaultCreditDebit: e.target.value }))} options={[
            { value: 'DBIT', label: 'Dépense' },
            { value: 'CRDT', label: 'Revenu' },
          ]} />
          <Select label="Catégorie" value={options.defaultCategoryId} onChange={e => setOptions(o => ({ ...o, defaultCategoryId: e.target.value }))} options={[
            { value: '', label: '— Aucune —' },
            ...categories.map(c => ({ value: c._id, label: `${c.icon || ''} ${c.name}`.trim() }))
          ]} />
          <Select label="Devise" value={options.currency} onChange={e => setOptions(o => ({ ...o, currency: e.target.value }))} options={[
            { value: 'CHF', label: 'CHF' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
          ]} />
          {accounts && (
            <Select label="Compte" value={options.bankAccountId} onChange={e => setOptions(o => ({ ...o, bankAccountId: e.target.value }))} options={[
              { value: '', label: '— Aucun —' },
              ...(accounts || []).map(a => ({ value: a._id, label: a.name }))
            ]} />
          )}
        </div>

        {/* Preview table */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-48">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
              <tr>
                {preview.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((row, ri) => (
                <tr key={ri} className="border-t border-slate-100 dark:border-slate-700/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => { setStep(1); setPreview(null); setFile(null); }}>
            Retour
          </Button>
          <Button onClick={handleImport} loading={loading} icon={ArrowRight} disabled={!mapping.date || (!mapping.amount && !dualAmountMode) || (dualAmountMode && !mapping.debitAmount && !mapping.creditAmount)}>
            Importer {preview.totalRows} lignes
          </Button>
        </div>
      </div>
    );
  }

  // Step 3 — Result
  if (step === 3 && result) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          {result.imported > 0 ? (
            <Check className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          ) : (
            <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
          )}
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {result.imported} transaction{result.imported > 1 ? 's' : ''} importée{result.imported > 1 ? 's' : ''}
          </p>
          {result.errors.length > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {result.errors.length > 0 && (
          <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 max-h-32 overflow-y-auto">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                Ligne {e.row}: {e.error}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    );
  }

  return null;
}
