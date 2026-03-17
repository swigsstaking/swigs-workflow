import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Paintbrush, Save, Upload, Trash2, Eye, FileText, Type,
  LayoutTemplate, Send, AlignLeft, AlignCenter, AlignRight,
  Tag, Palette, Settings2, X, ChevronDown, ChevronUp,
  RefreshCw, Mail, FileUp, CheckCircle
} from 'lucide-react';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import { settingsApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const templates = [
  { id: 'professional', label: 'Pro',       description: 'Net, sobre, style comptable' },
  { id: 'modern',       label: 'Moderne',   description: 'Couleurs vives, coins arrondis' },
  { id: 'classic',      label: 'Classique', description: 'Formel, bordures, tons chauds' },
  { id: 'minimal',      label: 'Minimal',   description: 'Ultra-simple, focus contenu' },
  { id: 'swiss',        label: 'Swiss',     description: 'Typographique, accent rouge' },
  { id: 'elegant',      label: 'Elégant',   description: 'Aéré, léger, raffiné' },
  { id: 'bold',         label: 'Bold',      description: 'En-tête coloré, startup' },
  { id: 'envelope',     label: 'Enveloppe', description: 'Adresse client en fenêtre' }
];

const fonts = [
  { value: 'Inter',     label: 'Inter (Sans-serif)' },
  { value: 'Helvetica', label: 'Helvetica (Sans-serif)' },
  { value: 'Georgia',   label: 'Georgia (Serif)' }
];

const tableHeaderStyles = [
  { value: 'colored', label: 'Couleur principale' },
  { value: 'dark',    label: 'Sombre' },
  { value: 'light',   label: 'Clair' },
  { value: 'none',    label: 'Sans fond' }
];

const logoPositions = [
  { id: 'left',   label: 'Gauche', Icon: AlignLeft },
  { id: 'center', label: 'Centre', Icon: AlignCenter },
  { id: 'right',  label: 'Droite', Icon: AlignRight }
];

const DEFAULTS = {
  template: 'modern',
  primaryColor: '#3B82F6',
  accentColor: '#1E40AF',
  fontFamily: 'Inter',
  showLogo: true,
  logoPosition: 'left',
  logoSize: 18,
  logoOffsetX: 0,
  logoOffsetY: 0,
  showCompanyName: true,
  showCompanyAddress: true,
  showCompanyContact: true,
  showVatNumber: true,
  showSiret: false,
  showIban: true,
  showQrBill: true,
  showProjectName: true,
  showPaymentTerms: true,
  showDateBlock: true,
  tableHeaderStyle: 'colored',
  footerText: '',
  headerText: '',
  notesTemplate: '',
  labelInvoice: 'Facture',
  labelQuote: 'Devis',
  labelServices: 'Prestations'
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToggleItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-hover cursor-pointer transition-colors">
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-slate-300 dark:bg-dark-border peer-checked:bg-primary-600 rounded-full transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
      </div>
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

function AccordionSection({ id, icon: Icon, title, openId, setOpenId, children }) {
  const isOpen = openId === id;
  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpenId(isOpen ? null : id)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-dark-border pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-300 dark:border-dark-border cursor-pointer bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg text-slate-900 dark:text-white font-mono"
          maxLength={7}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, step = 1, unit = 'mm', onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {label} : <span className="font-semibold text-slate-800 dark:text-slate-200">{value}{unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary-600"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview panel
// ---------------------------------------------------------------------------

function LivePreview({ previewHtml, loading, onRefresh, onDownloadPdf }) {
  const iframeRef = useRef(null);

  // A4 at 96 dpi → 794 × 1123 px — we target ~350px container width
  const A4_W = 794;
  const A4_H = 1123;
  const CONTAINER_W = 350;
  const scale = CONTAINER_W / A4_W;
  const scaledH = Math.round(A4_H * scale);

  return (
    <div className="sticky top-6 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-hover flex-shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Aperçu en direct
          </span>
          {loading && (
            <RefreshCw className="w-3.5 h-3.5 text-primary-500 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRefresh}
            title="Actualiser l'aperçu"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            title="Télécharger le PDF"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-border transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Iframe wrapper */}
      <div
        className="relative bg-slate-200 dark:bg-slate-700 mx-auto"
        style={{ width: CONTAINER_W, height: scaledH }}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-dark-card/60 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Actualisation…</span>
            </div>
          </div>
        )}

        {previewHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            title="Aperçu facture"
            style={{
              width: A4_W,
              height: A4_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: 'none',
              background: '#fff'
            }}
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <Eye className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Modifiez un paramètre pour voir l'aperçu
            </p>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-dark-border flex-shrink-0">
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Mise à jour automatique · format A4
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InvoiceDesignTab({ settings, onSettingsUpdate }) {
  const [formData, setFormData]       = useState(DEFAULTS);
  const [logo, setLogo]               = useState(null);
  const [hasChanges, setHasChanges]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [testEmail, setTestEmail]     = useState('');
  const [openSection, setOpenSection] = useState('template');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [hasLetterhead, setHasLetterhead] = useState(false);
  const [useLetterhead, setUseLetterhead] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);

  const fileInputRef    = useRef(null);
  const letterheadInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const { addToast }    = useToastStore();

  // -------------------------------------------------------------------------
  // Init from props
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (settings?.invoiceDesign) {
      const d = settings.invoiceDesign;
      const nextData = {
        template:           d.template           || DEFAULTS.template,
        primaryColor:       d.primaryColor       || DEFAULTS.primaryColor,
        accentColor:        d.accentColor        || DEFAULTS.accentColor,
        fontFamily:         d.fontFamily         || DEFAULTS.fontFamily,
        showLogo:           d.showLogo           ?? DEFAULTS.showLogo,
        logoPosition:       d.logoPosition       || DEFAULTS.logoPosition,
        logoSize:           d.logoSize           ?? d.logoMaxHeight ?? DEFAULTS.logoSize,
        logoOffsetX:        d.logoOffsetX        ?? DEFAULTS.logoOffsetX,
        logoOffsetY:        d.logoOffsetY        ?? DEFAULTS.logoOffsetY,
        showCompanyName:    d.showCompanyName    ?? DEFAULTS.showCompanyName,
        showCompanyAddress: d.showCompanyAddress ?? DEFAULTS.showCompanyAddress,
        showCompanyContact: d.showCompanyContact ?? DEFAULTS.showCompanyContact,
        showVatNumber:      d.showVatNumber      ?? DEFAULTS.showVatNumber,
        showSiret:          d.showSiret          ?? DEFAULTS.showSiret,
        showIban:           d.showIban           ?? DEFAULTS.showIban,
        showQrBill:         d.showQrBill         ?? DEFAULTS.showQrBill,
        showProjectName:    d.showProjectName    ?? DEFAULTS.showProjectName,
        showPaymentTerms:   d.showPaymentTerms   ?? DEFAULTS.showPaymentTerms,
        showDateBlock:      d.showDateBlock      ?? DEFAULTS.showDateBlock,
        tableHeaderStyle:   d.tableHeaderStyle   || DEFAULTS.tableHeaderStyle,
        footerText:         d.footerText         || '',
        headerText:         d.headerText         || '',
        notesTemplate:      d.notesTemplate      || '',
        labelInvoice:       d.labelInvoice       || DEFAULTS.labelInvoice,
        labelQuote:         d.labelQuote         || DEFAULTS.labelQuote,
        labelServices:      d.labelServices      || DEFAULTS.labelServices
      };
      setFormData(nextData);
      setHasChanges(false);
      // Auto-load preview once on mount when settings are ready
      refreshPreview(nextData);
    }
    if (settings?.company?.logo) {
      setLogo(settings.company.logo);
    }
    if (settings?.invoiceDesign) {
      setHasLetterhead(!!settings.invoiceDesign._hasLetterhead);
      setUseLetterhead(!!settings.invoiceDesign.useLetterhead);
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Field update + debounced auto-save + auto-preview
  // -------------------------------------------------------------------------

  const refreshPreview = useCallback(async (data) => {
    setPreviewLoading(true);
    try {
      await settingsApi.update({ invoiceDesign: data });
      const html = await settingsApi.getInvoicePreviewHTML();
      // API may return { data: string } or a plain string depending on impl
      setPreviewHtml(typeof html === 'string' ? html : html?.data ?? '');
    } catch {
      // Silent — do not toast on auto-refresh
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const updateField = useCallback((field, value, immediate = false) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (immediate) {
        // Instant refresh for position/template changes
        refreshPreview(next);
      } else {
        debounceTimerRef.current = setTimeout(() => {
          refreshPreview(next);
        }, 800);
      }
      return next;
    });
    setHasChanges(true);
  }, [refreshPreview]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Manual save
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ invoiceDesign: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Design des factures sauvegardé' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Manual preview refresh
  // -------------------------------------------------------------------------

  const handleManualRefresh = useCallback(async () => {
    setPreviewLoading(true);
    try {
      if (hasChanges) {
        const { data } = await settingsApi.update({ invoiceDesign: formData });
        onSettingsUpdate(data.data);
        setHasChanges(false);
      }
      const html = await settingsApi.getInvoicePreviewHTML();
      setPreviewHtml(typeof html === 'string' ? html : html?.data ?? '');
    } catch {
      addToast({ type: 'error', message: "Erreur lors de la génération de l'aperçu" });
    } finally {
      setPreviewLoading(false);
    }
  }, [formData, hasChanges, onSettingsUpdate, addToast]);

  // -------------------------------------------------------------------------
  // Download PDF
  // -------------------------------------------------------------------------

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      if (hasChanges) {
        const { data } = await settingsApi.update({ invoiceDesign: formData });
        onSettingsUpdate(data.data);
        setHasChanges(false);
      }
      const response = await settingsApi.getInvoicePreview();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'apercu-facture.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      addToast({ type: 'error', message: "Erreur lors de la génération du PDF" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // -------------------------------------------------------------------------
  // Logo handlers
  // -------------------------------------------------------------------------

  const handleLogoUpload = async (file) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      addToast({ type: 'error', message: 'Le logo ne doit pas dépasser 500 KB' });
      return;
    }
    setUploading(true);
    try {
      const { data } = await settingsApi.uploadLogo(file);
      setLogo(data.data.logo);
      addToast({ type: 'success', message: 'Logo mis à jour' });
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || "Erreur lors de l'upload" });
    } finally {
      setUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogo(null);
      addToast({ type: 'success', message: 'Logo supprimé' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleLogoUpload(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // -------------------------------------------------------------------------
  // Letterhead handlers
  // -------------------------------------------------------------------------

  const handleLetterheadUpload = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', message: 'Le PDF ne doit pas dépasser 2 MB' });
      return;
    }
    setUploadingLetterhead(true);
    try {
      await settingsApi.uploadLetterhead(file);
      setHasLetterhead(true);
      setUseLetterhead(true);
      addToast({ type: 'success', message: 'Papier à lettres importé' });
      refreshPreview(formData);
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || "Erreur lors de l'upload" });
    } finally {
      setUploadingLetterhead(false);
    }
  };

  const handleLetterheadDelete = async () => {
    try {
      await settingsApi.deleteLetterhead();
      setHasLetterhead(false);
      setUseLetterhead(false);
      addToast({ type: 'success', message: 'Papier à lettres supprimé' });
      refreshPreview(formData);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    }
  };

  const handleToggleLetterhead = async (enabled) => {
    setUseLetterhead(enabled);
    try {
      await settingsApi.update({ invoiceDesign: { ...formData, useLetterhead: enabled } });
      // Fetch preview without re-saving (refreshPreview would call update again)
      const html = await settingsApi.getInvoicePreviewHTML();
      setPreviewHtml(typeof html === 'string' ? html : html?.data ?? '');
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la mise à jour' });
    }
  };

  // -------------------------------------------------------------------------
  // Test email handlers
  // -------------------------------------------------------------------------

  const handleSendTestInvoice = async () => {
    if (!testEmail) {
      addToast({ type: 'error', message: 'Entrez une adresse email' });
      return;
    }
    setSendingTest(true);
    try {
      if (hasChanges) {
        const { data } = await settingsApi.update({ invoiceDesign: formData });
        onSettingsUpdate(data.data);
        setHasChanges(false);
      }
      const { data } = await settingsApi.sendTestEmail(testEmail);
      addToast({ type: 'success', message: data.message || 'Email de test envoyé' });
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || "Erreur lors de l'envoi" });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendTestReminder = async () => {
    if (!testEmail) {
      addToast({ type: 'error', message: 'Entrez une adresse email' });
      return;
    }
    setSendingReminder(true);
    try {
      const { data } = await settingsApi.sendTestReminder(testEmail);
      addToast({ type: 'success', message: data.message || 'Rappel de test envoyé' });
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || "Erreur lors de l'envoi" });
    } finally {
      setSendingReminder(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Paintbrush className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
              Design factures &amp; devis
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Personnalisez l'apparence de vos documents PDF.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          icon={Save}
          loading={saving}
          disabled={saving || !hasChanges}
        >
          {hasChanges ? 'Enregistrer' : 'Enregistré'}
        </Button>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-6 items-start">

        {/* ----------------------------------------------------------------
            Left column — settings panels (60%)
        ----------------------------------------------------------------- */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Section 1 — Template */}
          <AccordionSection
            id="template"
            icon={LayoutTemplate}
            title="Template"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <div className="grid grid-cols-4 gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateField('template', t.id, true)}
                  className={[
                    'p-3 rounded-xl border-2 text-left transition-all',
                    formData.template === t.id
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-dark-hover'
                  ].join(' ')}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                    {t.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          </AccordionSection>

          {/* Section 2 — Couleurs & Police */}
          <AccordionSection
            id="colors"
            icon={Palette}
            title="Couleurs & Police"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ColorField
                  label="Couleur principale"
                  value={formData.primaryColor}
                  onChange={(v) => updateField('primaryColor', v)}
                />
                <ColorField
                  label="Couleur accent"
                  value={formData.accentColor}
                  onChange={(v) => updateField('accentColor', v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Police"
                  value={formData.fontFamily}
                  onChange={(e) => updateField('fontFamily', e.target.value)}
                  options={fonts}
                />
                <Select
                  label="Style en-tête tableau"
                  value={formData.tableHeaderStyle}
                  onChange={(e) => updateField('tableHeaderStyle', e.target.value)}
                  options={tableHeaderStyles}
                />
              </div>
            </div>
          </AccordionSection>

          {/* Section 3 — Logo */}
          <AccordionSection
            id="logo"
            icon={Upload}
            title="Logo"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            {/* Upload area or preview */}
            {logo ? (
              <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-dark-hover border border-slate-200 dark:border-dark-border">
                <img
                  src={logo}
                  alt="Logo de l'entreprise"
                  className="h-14 w-auto max-w-[140px] object-contain rounded-lg bg-white p-1"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    Changer
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={handleLogoDelete}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="
                  border-2 border-dashed border-slate-300 dark:border-dark-border rounded-xl
                  p-6 flex flex-col items-center justify-center gap-2 cursor-pointer mb-4
                  hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10
                  transition-colors
                "
              >
                <Upload className="w-7 h-7 text-slate-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Glissez votre logo ici ou cliquez pour choisir
                </p>
                <p className="text-xs text-slate-400">JPG, PNG ou SVG — max 500 KB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />

            {/* Position */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Position du logo
              </label>
              <div className="flex gap-2">
                {logoPositions.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateField('logoPosition', id, true)}
                    className={[
                      'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                      formData.logoPosition === id
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size & Position */}
            <div className="space-y-3">
              <SliderField
                label="Taille"
                value={formData.logoSize}
                min={6} max={60}
                onChange={(v) => updateField('logoSize', v)}
              />
              <div className="grid grid-cols-2 gap-x-6">
                <SliderField
                  label="Décalage horizontal"
                  value={formData.logoOffsetX}
                  min={-30} max={30}
                  onChange={(v) => updateField('logoOffsetX', v)}
                />
                <SliderField
                  label="Décalage vertical"
                  value={formData.logoOffsetY}
                  min={-15} max={15}
                  onChange={(v) => updateField('logoOffsetY', v)}
                />
              </div>
            </div>
          </AccordionSection>

          {/* Section 4 — Papier à lettres */}
          <AccordionSection
            id="letterhead"
            icon={FileUp}
            title="Papier à lettres (PDF)"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Importez un PDF de votre papier à lettres. Il sera utilisé comme fond pour toutes vos factures, devis et rappels — comme sur Bexio.
            </p>

            {hasLetterhead ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                      Papier à lettres importé
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Le PDF sera utilisé comme fond pour vos documents.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => letterheadInputRef.current?.click()}
                      loading={uploadingLetterhead}
                    >
                      Remplacer
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={handleLetterheadDelete}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>

                <ToggleItem
                  label="Activer le papier à lettres"
                  checked={useLetterhead}
                  onChange={handleToggleLetterhead}
                />
              </div>
            ) : (
              <div
                onClick={() => letterheadInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer?.files?.[0];
                  if (file) handleLetterheadUpload(file);
                }}
                onDragOver={(e) => e.preventDefault()}
                className="
                  border-2 border-dashed border-slate-300 dark:border-dark-border rounded-xl
                  p-8 flex flex-col items-center justify-center gap-2 cursor-pointer
                  hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10
                  transition-colors
                "
              >
                <FileUp className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Glissez votre PDF ici ou cliquez pour choisir
                </p>
                <p className="text-xs text-slate-400">
                  PDF uniquement — max 2 MB — page 1 utilisée comme fond
                </p>
              </div>
            )}

            <input
              ref={letterheadInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleLetterheadUpload(e.target.files?.[0])}
            />
          </AccordionSection>

          {/* Section 5 — Informations affichées */}
          <AccordionSection
            id="visibility"
            icon={FileText}
            title="Informations affichées"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  Entreprise
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                  <ToggleItem label="Logo"             checked={formData.showLogo}           onChange={(v) => updateField('showLogo', v)} />
                  <ToggleItem label="Nom entreprise"   checked={formData.showCompanyName}    onChange={(v) => updateField('showCompanyName', v)} />
                  <ToggleItem label="Adresse"          checked={formData.showCompanyAddress} onChange={(v) => updateField('showCompanyAddress', v)} />
                  <ToggleItem label="Email / Téléphone" checked={formData.showCompanyContact} onChange={(v) => updateField('showCompanyContact', v)} />
                  <ToggleItem label="Numéro TVA"       checked={formData.showVatNumber}      onChange={(v) => updateField('showVatNumber', v)} />
                  <ToggleItem label="N° IDE" checked={formData.showSiret}        onChange={(v) => updateField('showSiret', v)} />
                  <ToggleItem label="IBAN"             checked={formData.showIban}           onChange={(v) => updateField('showIban', v)} />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-dark-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  Document
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                  <ToggleItem label="Nom du projet"         checked={formData.showProjectName}  onChange={(v) => updateField('showProjectName', v)} />
                  <ToggleItem label="Bloc dates"            checked={formData.showDateBlock}     onChange={(v) => updateField('showDateBlock', v)} />
                  <ToggleItem label="Conditions de paiement" checked={formData.showPaymentTerms} onChange={(v) => updateField('showPaymentTerms', v)} />
                  <ToggleItem label="QR-Bill"               checked={formData.showQrBill}        onChange={(v) => updateField('showQrBill', v)} />
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* Section 5 — Libellés */}
          <AccordionSection
            id="labels"
            icon={Tag}
            title="Libellés"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label='Titre "Facture"'
                value={formData.labelInvoice}
                onChange={(e) => updateField('labelInvoice', e.target.value)}
                placeholder="Facture"
              />
              <Input
                label='Titre "Devis"'
                value={formData.labelQuote}
                onChange={(e) => updateField('labelQuote', e.target.value)}
                placeholder="Devis"
              />
              <Input
                label='Section prestations'
                value={formData.labelServices}
                onChange={(e) => updateField('labelServices', e.target.value)}
                placeholder="Prestations"
              />
            </div>
          </AccordionSection>

          {/* Section 6 — Textes personnalisés */}
          <AccordionSection
            id="texts"
            icon={Type}
            title="Textes personnalisés"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <div className="space-y-4">
              <Input
                label="En-tête personnalisé"
                value={formData.headerText}
                onChange={(e) => updateField('headerText', e.target.value)}
                placeholder="Texte affiché sous le titre du document"
              />
              <Input
                label="Pied de page personnalisé"
                value={formData.footerText}
                onChange={(e) => updateField('footerText', e.target.value)}
                placeholder="Texte affiché en bas du document"
              />
              <Textarea
                label="Template de notes (par défaut)"
                value={formData.notesTemplate}
                onChange={(e) => updateField('notesTemplate', e.target.value)}
                placeholder="Ce texte sera pré-rempli dans le champ notes lors de la création d'une facture…"
                rows={3}
              />
            </div>
          </AccordionSection>

          {/* Section 7 — Tester l'envoi */}
          <AccordionSection
            id="test-email"
            icon={Mail}
            title="Tester l'envoi"
            openId={openSection}
            setOpenId={setOpenSection}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Envoyez une facture ou un rappel de test pour vérifier le design et la configuration SMTP.
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <Input
                  label="Adresse email de test"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                />
              </div>
              <div className="flex gap-2 pb-[1px] flex-shrink-0">
                <Button
                  onClick={handleSendTestInvoice}
                  variant="secondary"
                  icon={Send}
                  loading={sendingTest}
                  disabled={!testEmail || sendingTest}
                  size="sm"
                >
                  Facture test
                </Button>
                <Button
                  onClick={handleSendTestReminder}
                  variant="secondary"
                  icon={Mail}
                  loading={sendingReminder}
                  disabled={!testEmail || sendingReminder}
                  size="sm"
                >
                  Rappel test
                </Button>
              </div>
            </div>
          </AccordionSection>

        </div>

        {/* ----------------------------------------------------------------
            Right column — live preview (40%)
        ----------------------------------------------------------------- */}
        <div className="w-[380px] flex-shrink-0">
          <LivePreview
            previewHtml={previewHtml}
            loading={previewLoading || downloadingPdf}
            onRefresh={handleManualRefresh}
            onDownloadPdf={handleDownloadPdf}
          />
        </div>

      </div>
    </div>
  );
}
