import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Loader2, FileText, Check, Pencil, X, Camera } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { bankApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';

const CATEGORY_LABELS = {
  office: 'Bureau',
  telecom: 'Télécom',
  transport: 'Transport',
  food: 'Alimentation',
  software: 'Logiciels',
  insurance: 'Assurance',
  rent: 'Loyer',
  other: 'Autre'
};

export default function AIDocumentUpload() {
  const { ocrResult, isProcessingOcr, uploadDocument, clearOcrResult, openSidebar, sendMessage, isStreaming } = useAIStore();
  const { addToast } = useToastStore();

  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

  // Cleanup blob URL on unmount or when preview changes
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    // Revoke previous blob URL before creating a new one
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file));
    }
    uploadDocument(file);
  }, [uploadDocument]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleCreateExpense = async () => {
    if (!ocrResult || creating) return;
    setCreating(true);

    try {
      await bankApi.createTransaction({
        date: ocrResult.date || new Date().toISOString().split('T')[0],
        description: ocrResult.vendor || 'Document scanné',
        amount: -(ocrResult.amountGross || ocrResult.amountNet || 0), // Negative = expense
        currency: ocrResult.currency || 'CHF',
        type: 'DBIT',
        vatRate: ocrResult.vatRate || null,
        vatAmount: ocrResult.vatAmount || null,
        reference: ocrResult.invoiceNumber || null
      });
      addToast({ type: 'success', message: 'Dépense créée avec succès' });
      clearOcrResult();
      setPreview(null);
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setCreating(false);
    }
  };

  const handleCorrect = () => {
    const json = JSON.stringify(ocrResult, null, 2);
    sendMessage(`J'ai scanné ce document, voici ce que l'OCR a trouvé :\n\`\`\`json\n${json}\n\`\`\`\nEst-ce correct ? Que faut-il corriger ?`);
    clearOcrResult();
    setPreview(null);
  };

  // Don't show drop zone during streaming
  if (isStreaming && !isProcessingOcr && !ocrResult) return null;

  // OCR result display
  if (ocrResult) {
    return (
      <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
              {ocrResult.vendor || 'Document'}
            </span>
          </div>
          <button
            onClick={() => { clearOcrResult(); setPreview(null); }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[12px] text-emerald-700 dark:text-emerald-400 space-y-0.5">
          {ocrResult.date && <p>{new Date(ocrResult.date).toLocaleDateString('fr-CH')}</p>}
          <p>
            {ocrResult.amountGross != null && <span className="font-medium">{ocrResult.amountGross.toFixed(2)} {ocrResult.currency || 'CHF'} TTC</span>}
            {ocrResult.vatRate != null && <span className="ml-2 text-emerald-600 dark:text-emerald-500">TVA {ocrResult.vatRate}%</span>}
          </p>
          {ocrResult.category && (
            <p className="text-emerald-600 dark:text-emerald-500">
              {CATEGORY_LABELS[ocrResult.category] || ocrResult.category}
            </p>
          )}
          {ocrResult.confidence != null && ocrResult.confidence < 0.7 && (
            <p className="text-amber-600 dark:text-amber-400 text-[11px]">
              Confiance faible ({Math.round(ocrResult.confidence * 100)}%) — vérifiez les données
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleCreateExpense}
            disabled={creating}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Créer la dépense
          </button>
          <button
            onClick={handleCorrect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Corriger
          </button>
        </div>
      </div>
    );
  }

  // Processing state
  if (isProcessingOcr) {
    return (
      <div className="mx-4 mt-3 p-4 rounded-xl border border-dashed border-primary-300 dark:border-primary-700/40 bg-primary-50/50 dark:bg-primary-500/5 flex items-center gap-3">
        {preview && (
          <img src={preview} alt="Preview" className="w-10 h-10 rounded-lg object-cover shrink-0" />
        )}
        <div className="flex items-center gap-2 text-[12px] text-primary-600 dark:text-primary-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyse en cours...
        </div>
      </div>
    );
  }

  // Drop zone
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={isMobile ? undefined : handleClick}
      className={`
        mx-4 mt-3 px-4 py-3 rounded-xl border border-dashed transition-all duration-200
        ${!isMobile ? 'cursor-pointer' : ''}
        ${isDragging
          ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-500/10 scale-[1.02]'
          : 'border-slate-300 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-slate-50 dark:hover:bg-zinc-900'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
        />
      )}
      {isMobile ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[12px] text-primary-600 dark:text-primary-400 font-medium"
          >
            <Camera className="w-4 h-4 shrink-0" />
            Photo
          </button>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-zinc-500"
          >
            <Upload className="w-4 h-4 shrink-0" />
            Fichier
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-zinc-500">
          <Upload className={`w-4 h-4 shrink-0 ${isDragging ? 'text-primary-500' : ''}`} />
          <span>{isDragging ? 'Déposez le document' : 'Scanner un document (facture, ticket)'}</span>
        </div>
      )}
    </div>
  );
}
