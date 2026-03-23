import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, CheckCircle2, Sparkles,
  Building2, Receipt, Landmark, Loader2, Search
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { companyLookupApi } from '../services/api';
import { trackEvent } from '../lib/posthog';

const STORAGE_KEY = 'swigs-pro-welcome-done';
const TOTAL_STEPS = 4;

const CANTONS = [
  { value: 'AG', label: 'AG — Argovie' }, { value: 'AI', label: 'AI — Appenzell Rh.-Int.' },
  { value: 'AR', label: 'AR — Appenzell Rh.-Ext.' }, { value: 'BE', label: 'BE — Berne' },
  { value: 'BL', label: 'BL — Bâle-Campagne' }, { value: 'BS', label: 'BS — Bâle-Ville' },
  { value: 'FR', label: 'FR — Fribourg' }, { value: 'GE', label: 'GE — Genève' },
  { value: 'GL', label: 'GL — Glaris' }, { value: 'GR', label: 'GR — Grisons' },
  { value: 'JU', label: 'JU — Jura' }, { value: 'LU', label: 'LU — Lucerne' },
  { value: 'NE', label: 'NE — Neuchâtel' }, { value: 'NW', label: 'NW — Nidwald' },
  { value: 'OW', label: 'OW — Obwald' }, { value: 'SG', label: 'SG — Saint-Gall' },
  { value: 'SH', label: 'SH — Schaffhouse' }, { value: 'SO', label: 'SO — Soleure' },
  { value: 'SZ', label: 'SZ — Schwyz' }, { value: 'TG', label: 'TG — Thurgovie' },
  { value: 'TI', label: 'TI — Tessin' }, { value: 'UR', label: 'UR — Uri' },
  { value: 'VD', label: 'VD — Vaud' }, { value: 'VS', label: 'VS — Valais' },
  { value: 'ZG', label: 'ZG — Zoug' }, { value: 'ZH', label: 'ZH — Zurich' },
];

const LEGAL_FORMS = [
  { value: 'raison_individuelle', label: 'Raison individuelle' },
  { value: 'sarl', label: 'Sàrl' },
  { value: 'sa', label: 'SA' },
  { value: 'snc', label: 'SNC (Société en nom collectif)' },
  { value: 'senc', label: 'SEnC (Société en commandite)' },
  { value: 'cooperative', label: 'Coopérative' },
  { value: 'association', label: 'Association' },
  { value: 'fondation', label: 'Fondation' },
];

function StepDots({ total, current }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-primary-500'
              : i < current
                ? 'w-3 bg-primary-300 dark:bg-primary-700'
                : 'w-3 bg-slate-300 dark:bg-dark-border'
          }`}
        />
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
      {children}
      {hint && <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-normal">{hint}</span>}
    </label>
  );
}

function SelectField({ label, hint, value, onChange, options, placeholder }) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-dark-card text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 dark:focus:border-primary-500/40 outline-none transition-all text-sm"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({ label, hint, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-dark-card text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 dark:focus:border-primary-500/40 outline-none transition-all text-sm"
      />
    </div>
  );
}

function CompanySearchField({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value changes
  useEffect(() => { setQuery(value); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await companyLookupApi.search(text.trim());
        if (data.success && data.data.length > 0) {
          setResults(data.data);
          setShowDropdown(true);
        } else {
          setResults([]);
          setShowDropdown(false);
        }
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelect = (company) => {
    setQuery(company.name);
    setShowDropdown(false);
    setResults([]);
    onSelect(company);
  };

  return (
    <div ref={containerRef} className="relative">
      <FieldLabel hint="recherche dans le registre suisse">Nom de l'entreprise</FieldLabel>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Tapez le nom de votre entreprise..."
          className="w-full px-3 py-2.5 pr-9 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-dark-card text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 dark:focus:border-primary-500/40 outline-none transition-all text-sm"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {results.map((company, i) => (
            <button
              key={`${company.uid}-${i}`}
              type="button"
              onClick={() => handleSelect(company)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{company.name}</span>
                {company.uid && (
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">{company.uid}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {company.zip && company.city && (
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{company.zip} {company.city}</span>
                )}
                {company.canton && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">{company.canton}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
      <div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {description && <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -40 : 40, opacity: 0 })
};

export default function WelcomeModal({ onClose }) {
  const { user } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form data — pre-filled from existing settings
  const [form, setForm] = useState({
    name: '', legalForm: 'raison_individuelle', canton: '',
    street: '', zip: '', city: '',
    email: '', phone: '',
    isVatSubject: true, vatDeclarationFrequency: 'quarterly',
    defaultVatRate: 8.1, defaultPaymentTerms: 30, defaultHourlyRate: 150,
    iban: '', qrIban: '',
  });

  // Sync from settings on load
  useEffect(() => {
    if (!settings) return;
    const c = settings.company || {};
    const inv = settings.invoicing || {};
    setForm(prev => ({
      ...prev,
      name: c.name || prev.name,
      legalForm: c.legalForm || prev.legalForm,
      canton: c.canton || prev.canton,
      street: c.street || prev.street,
      zip: c.zip || prev.zip,
      city: c.city || prev.city,
      email: c.email || prev.email,
      phone: c.phone || prev.phone,
      isVatSubject: c.isVatSubject !== false,
      vatDeclarationFrequency: c.vatDeclarationFrequency || prev.vatDeclarationFrequency,
      defaultVatRate: inv.defaultVatRate ?? prev.defaultVatRate,
      defaultPaymentTerms: inv.defaultPaymentTerms ?? prev.defaultPaymentTerms,
      defaultHourlyRate: inv.defaultHourlyRate ?? prev.defaultHourlyRate,
      iban: c.iban || prev.iban,
      qrIban: c.qrIban || prev.qrIban,
    }));
  }, [settings]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // When a company is selected from the lookup, pre-fill all fields
  const handleCompanySelect = (company) => {
    setForm(prev => ({
      ...prev,
      name: company.name || prev.name,
      legalForm: company.legalForm || prev.legalForm,
      canton: company.canton || prev.canton,
      street: company.street || prev.street,
      zip: company.zip || prev.zip,
      city: company.city || prev.city,
      isVatSubject: company.isVatSubject ?? prev.isVatSubject,
    }));
    trackEvent('welcome_company_selected', { uid: company.uid, name: company.name });
  };

  // Lock body scroll and force header behind modal
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => { document.body.classList.remove('modal-open'); };
  }, []);

  // Save current step data to backend
  const saveStep = useCallback(async () => {
    setSaving(true);
    try {
      const updates = {};
      if (step === 1) {
        updates.company = {
          name: form.name,
          legalForm: form.legalForm,
          canton: form.canton || null,
          street: form.street,
          zip: form.zip,
          city: form.city,
          address: [form.street, [form.zip, form.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          email: form.email,
          phone: form.phone,
        };
      } else if (step === 2) {
        updates.company = {
          isVatSubject: form.isVatSubject,
          vatDeclarationFrequency: form.vatDeclarationFrequency,
        };
        updates.invoicing = {
          defaultVatRate: Number(form.defaultVatRate),
          defaultPaymentTerms: Number(form.defaultPaymentTerms),
          defaultHourlyRate: Number(form.defaultHourlyRate),
        };
      } else if (step === 3) {
        updates.company = {
          iban: form.iban,
          qrIban: form.qrIban,
        };
      }
      if (Object.keys(updates).length > 0) {
        await updateSettings(updates);
      }
    } catch {
      // Non-blocking — user can continue even if save fails
    } finally {
      setSaving(false);
    }
  }, [step, form, updateSettings]);

  const markCompleted = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const goNext = async () => {
    trackEvent('welcome_wizard_step', { app: 'swigs-pro', step: step + 1 });
    if (step >= 1) await saveStep();
    setDirection(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goPrev = () => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 0));
  };

  const handleDismiss = () => {
    trackEvent('welcome_wizard_dismissed', { app: 'swigs-pro', at_step: step });
    markCompleted();
    onClose();
  };

  const handleFinish = async () => {
    trackEvent('welcome_wizard_completed', { app: 'swigs-pro' });
    await saveStep();
    markCompleted();
    onClose();
  };

  const firstName = user?.name?.split(' ')[0] || 'vous';
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <StepDots total={TOTAL_STEPS} current={step} />
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 0 — Welcome */}
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-8 pb-6"
              >
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="relative mb-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary-500/30">
                      {initials}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Bienvenue, {firstName} !
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
                    Configurons votre espace en quelques étapes pour que tout fonctionne parfaitement — factures, TVA et assistant comptable.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  {[
                    { icon: Building2, label: 'Entreprise', color: 'emerald' },
                    { icon: Receipt, label: 'TVA & Factures', color: 'blue' },
                    { icon: Landmark, label: 'Banque', color: 'amber' },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
                        <Icon className={`w-5 h-5 text-${item.color}-500`} />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleDismiss} className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    Plus tard
                  </button>
                  <button onClick={goNext} className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all">
                    Commencer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 1 — Entreprise */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    Votre entreprise
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ces infos apparaîtront sur vos factures et devis.
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <CompanySearchField
                    value={form.name}
                    onChange={v => updateField('name', v)}
                    onSelect={handleCompanySelect}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Forme juridique"
                      value={form.legalForm}
                      onChange={v => updateField('legalForm', v)}
                      options={LEGAL_FORMS}
                    />
                    <SelectField
                      label="Canton"
                      hint="pour les impôts"
                      value={form.canton}
                      onChange={v => updateField('canton', v)}
                      options={CANTONS}
                      placeholder="— Sélectionner —"
                    />
                  </div>

                  <TextField
                    label="Rue et numéro"
                    value={form.street}
                    onChange={v => updateField('street', v)}
                    placeholder="Rue de la Poste 1"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <TextField
                      label="NPA"
                      value={form.zip}
                      onChange={v => updateField('zip', v)}
                      placeholder="1200"
                    />
                    <div className="col-span-2">
                      <TextField
                        label="Ville"
                        value={form.city}
                        onChange={v => updateField('city', v)}
                        placeholder="Genève"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={v => updateField('email', v)}
                      placeholder="contact@acme.ch"
                    />
                    <TextField
                      label="Téléphone"
                      value={form.phone}
                      onChange={v => updateField('phone', v)}
                      placeholder="+41 22 123 45 67"
                    />
                  </div>
                </div>

                <StepNav onPrev={goPrev} onSkip={handleDismiss} onNext={goNext} saving={saving} nextLabel="Suivant" />
              </motion.div>
            )}

            {/* Step 2 — TVA & Facturation */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    TVA & Facturation
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Configurez les valeurs par défaut pour vos documents.
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  <Toggle
                    checked={form.isVatSubject}
                    onChange={v => updateField('isVatSubject', v)}
                    label="Assujetti à la TVA"
                    description="Obligatoire au-delà de 100'000 CHF/an de CA"
                  />

                  {form.isVatSubject && (
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="Taux TVA par défaut"
                        value={form.defaultVatRate}
                        onChange={v => updateField('defaultVatRate', v)}
                        options={[
                          { value: '8.1', label: '8.1% — Normal' },
                          { value: '2.6', label: '2.6% — Réduit' },
                          { value: '3.8', label: '3.8% — Hébergement' },
                        ]}
                      />
                      <SelectField
                        label="Déclaration TVA"
                        value={form.vatDeclarationFrequency}
                        onChange={v => updateField('vatDeclarationFrequency', v)}
                        options={[
                          { value: 'quarterly', label: 'Trimestrielle' },
                          { value: 'monthly', label: 'Mensuelle' },
                          { value: 'annual', label: 'Annuelle (TDFN)' },
                        ]}
                      />
                    </div>
                  )}

                  <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Valeurs par défaut pour vos factures</p>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label="Taux horaire (CHF)"
                        type="number"
                        value={form.defaultHourlyRate}
                        onChange={v => updateField('defaultHourlyRate', v)}
                        placeholder="150"
                      />
                      <TextField
                        label="Délai de paiement (jours)"
                        type="number"
                        value={form.defaultPaymentTerms}
                        onChange={v => updateField('defaultPaymentTerms', v)}
                        placeholder="30"
                      />
                    </div>
                  </div>
                </div>

                <StepNav onPrev={goPrev} onSkip={handleDismiss} onNext={goNext} saving={saving} nextLabel="Suivant" />
              </motion.div>
            )}

            {/* Step 3 — Banque */}
            {step === 3 && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-6 pt-6 pb-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    Coordonnées bancaires
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Pour générer des factures avec QR-code de paiement.
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <TextField
                    label="IBAN"
                    value={form.iban}
                    onChange={v => updateField('iban', v)}
                    placeholder="CH93 0076 2011 6238 5295 7"
                  />

                  <TextField
                    label="QR-IBAN"
                    hint="pour les QR-factures suisses"
                    value={form.qrIban}
                    onChange={v => updateField('qrIban', v)}
                    placeholder="CH44 3199 9123 0008 8901 2"
                  />

                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      Le QR-IBAN est un IBAN spécial fourni par votre banque pour les QR-factures (standard SIX).
                      Il commence généralement par CH et contient un identifiant QR.
                      Si vous ne l'avez pas, vous pouvez le demander à votre banque ou le configurer plus tard dans les paramètres.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={goPrev} className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={handleDismiss} className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    Plus tard
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Terminer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function StepNav({ onPrev, onSkip, onNext, saving, nextLabel }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onPrev} className="p-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <button onClick={onSkip} className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
        Plus tard
      </button>
      <button
        onClick={onNext}
        disabled={saving}
        className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {nextLabel}
        {!saving && <ArrowRight className="w-4 h-4" />}
      </button>
    </div>
  );
}
