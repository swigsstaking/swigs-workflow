import { useState, useEffect, useRef } from 'react';
import { Bell, Save, Edit2, X, Clock, AlertTriangle, Mail, ChevronDown, ChevronUp, FileText, Receipt } from 'lucide-react';
import { settingsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';

const TIER_META = [
  {
    key: 'reminder_1',
    label: '1er Rappel',
    badge: 'J+7',
    days: 7,
    color: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    dotBg: 'bg-sky-500',
    defaultSubject: 'Rappel : Facture {number} en attente de règlement',
    defaultBody:
      'Bonjour {clientName},\n\nNous vous rappelons que la facture {number} d\'un montant de {total} est arrivée à échéance le {dueDate}.\n\nMerci de procéder au règlement dans un délai de 15 jours.\n\nCordialement,\n{companyName}',
  },
  {
    key: 'reminder_2',
    label: '2ème Rappel',
    badge: 'J+14',
    days: 14,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    dotBg: 'bg-amber-500',
    defaultSubject: 'Relance : Facture {number} — {daysOverdue} jours de retard',
    defaultBody:
      'Bonjour {clientName},\n\nMalgré notre premier rappel, la facture {number} d\'un montant de {total} reste impayée depuis {daysOverdue} jours.\n\nNous vous demandons de régulariser cette situation dans les 15 jours.\n\nCordialement,\n{companyName}',
  },
  {
    key: 'reminder_3',
    label: '3ème Rappel',
    badge: 'J+30',
    days: 30,
    color: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    dotBg: 'bg-orange-500',
    defaultSubject: 'Relance urgente : Facture {number} impayée',
    defaultBody:
      'Bonjour {clientName},\n\nEn dépit de nos relances précédentes, la facture {number} d\'un montant de {total} demeure impayée depuis {daysOverdue} jours.\n\nCeci est notre dernière relance amiable. Veuillez régler cette facture dans les 15 jours afin d\'éviter une mise en demeure formelle.\n\nCordialement,\n{companyName}',
  },
  {
    key: 'final_notice',
    label: 'Mise en demeure',
    badge: 'J+45',
    days: 45,
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    dotBg: 'bg-red-500',
    defaultSubject: 'MISE EN DEMEURE — Facture {number}',
    defaultBody:
      'Bonjour {clientName},\n\nPar la présente, nous vous mettons en demeure de régler la facture {number} d\'un montant de {total}, impayée depuis {daysOverdue} jours (échue le {dueDate}).\n\nA défaut de règlement dans un délai de 15 jours, nous nous verrons contraints d\'engager des poursuites judiciaires.\n\nCordialement,\n{companyName}',
  },
];

const VARIABLES = [
  { name: '{number}', desc: 'Numéro de facture' },
  { name: '{clientName}', desc: 'Nom du client' },
  { name: '{total}', desc: 'Montant total' },
  { name: '{dueDate}', desc: "Date d'échéance" },
  { name: '{daysOverdue}', desc: 'Jours de retard' },
  { name: '{companyName}', desc: 'Votre entreprise' },
];

function buildDefaultSchedule() {
  return TIER_META.map((t) => ({
    type: t.key,
    days: t.days,
    subject: t.defaultSubject,
    body: t.defaultBody,
  }));
}

function mergeSchedule(savedSchedule) {
  return TIER_META.map((t) => {
    const saved = savedSchedule?.find((s) => s.type === t.key);
    return {
      type: t.key,
      days: saved?.days ?? t.days,
      subject: saved?.subject ?? t.defaultSubject,
      body: saved?.body ?? t.defaultBody,
    };
  });
}

const SEND_EMAIL_VARIABLES = [
  { name: '{number}', desc: 'Numéro du document' },
  { name: '{clientName}', desc: 'Nom du client' },
  { name: '{total}', desc: 'Montant total' },
  { name: '{projectName}', desc: 'Nom du projet' },
  { name: '{companyName}', desc: 'Votre entreprise' },
  { name: '{paymentTerms}', desc: 'Délai de paiement (jours)' },
];

export default function RemindersSection({ settings, onSettingsUpdate }) {
  const [formData, setFormData] = useState({
    enabled: false,
    schedule: buildDefaultSchedule(),
  });
  const [emailTemplates, setEmailTemplates] = useState({
    invoiceSubject: '',
    invoiceBody: '',
    quoteSubject: '',
    quoteBody: '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [hasEmailChanges, setHasEmailChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editingEmailType, setEditingEmailType] = useState(null); // 'invoice' | 'quote'
  const [emailEditDraft, setEmailEditDraft] = useState(null);
  const bodyTextareaRef = useRef(null);
  const emailBodyRef = useRef(null);
  const { addToast } = useToastStore();

  // Lock body scroll when edit modal is open
  useEffect(() => {
    if (editingIndex !== null) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e) => { if (e.key === 'Escape') handleCancelEdit(); };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [editingIndex]);

  useEffect(() => {
    if (settings?.reminders) {
      setFormData({
        enabled: settings.reminders.enabled ?? false,
        schedule: mergeSchedule(settings.reminders.schedule),
      });
      setHasChanges(false);
    }
  }, [settings]);

  // Load email templates from settings
  useEffect(() => {
    if (settings?.emailTemplates) {
      setEmailTemplates({
        invoiceSubject: settings.emailTemplates.invoiceSubject || '',
        invoiceBody: settings.emailTemplates.invoiceBody || '',
        quoteSubject: settings.emailTemplates.quoteSubject || '',
        quoteBody: settings.emailTemplates.quoteBody || '',
      });
      setHasEmailChanges(false);
    }
  }, [settings]);

  // Lock body scroll when email edit modal is open
  useEffect(() => {
    if (editingEmailType !== null) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e) => { if (e.key === 'Escape') handleCancelEmailEdit(); };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [editingEmailType]);

  const updateEnabled = (value) => {
    setFormData((prev) => ({ ...prev, enabled: value }));
    setHasChanges(true);
  };

  const handleOpenEdit = (index) => {
    const rule = formData.schedule[index];
    setEditDraft({ subject: rule.subject, body: rule.body });
    setEditingIndex(index);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editDraft) return;
    const newSchedule = formData.schedule.map((item, i) =>
      i === editingIndex ? { ...item, subject: editDraft.subject, body: editDraft.body } : item
    );
    setFormData((prev) => ({ ...prev, schedule: newSchedule }));
    setHasChanges(true);
    setEditingIndex(null);
    setEditDraft(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const handleInsertVariable = (varName) => {
    const textarea = bodyTextareaRef.current?.querySelector('textarea');
    if (!textarea) {
      setEditDraft((prev) => ({ ...prev, body: (prev.body || '') + varName }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentBody = editDraft?.body || '';
    const newBody = currentBody.slice(0, start) + varName + currentBody.slice(end);
    setEditDraft((prev) => ({ ...prev, body: newBody }));
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await settingsApi.update({ reminders: formData });
      onSettingsUpdate(data.data);
      setHasChanges(false);
      addToast({ type: 'success', message: 'Configuration des relances enregistrée avec succès' });
    } catch {
      addToast({ type: 'error', message: "Erreur lors de l'enregistrement" });
    } finally {
      setSaving(false);
    }
  };

  // Email template handlers
  const handleOpenEmailEdit = (type) => {
    const prefix = type; // 'invoice' or 'quote'
    setEmailEditDraft({
      subject: emailTemplates[`${prefix}Subject`],
      body: emailTemplates[`${prefix}Body`],
    });
    setEditingEmailType(type);
  };

  const handleSaveEmailEdit = () => {
    if (!editingEmailType || !emailEditDraft) return;
    const prefix = editingEmailType;
    setEmailTemplates((prev) => ({
      ...prev,
      [`${prefix}Subject`]: emailEditDraft.subject,
      [`${prefix}Body`]: emailEditDraft.body,
    }));
    setHasEmailChanges(true);
    setEditingEmailType(null);
    setEmailEditDraft(null);
  };

  const handleCancelEmailEdit = () => {
    setEditingEmailType(null);
    setEmailEditDraft(null);
  };

  const handleInsertEmailVariable = (varName) => {
    const textarea = emailBodyRef.current?.querySelector('textarea');
    if (!textarea) {
      setEmailEditDraft((prev) => ({ ...prev, body: (prev.body || '') + varName }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentBody = emailEditDraft?.body || '';
    const newBody = currentBody.slice(0, start) + varName + currentBody.slice(end);
    setEmailEditDraft((prev) => ({ ...prev, body: newBody }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    });
  };

  const handleSaveEmailTemplates = async () => {
    setSavingEmail(true);
    try {
      const { data } = await settingsApi.update({ emailTemplates });
      onSettingsUpdate(data.data);
      setHasEmailChanges(false);
      addToast({ type: 'success', message: 'Modèles d\'emails enregistrés avec succès' });
    } catch {
      addToast({ type: 'error', message: "Erreur lors de l'enregistrement" });
    } finally {
      setSavingEmail(false);
    }
  };

  const EMAIL_TYPES = [
    {
      type: 'invoice',
      label: 'Email d\'envoi de facture',
      icon: Receipt,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
      type: 'quote',
      label: 'Email d\'envoi de devis',
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Emails & Relances
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Personnalisez vos emails d'envoi et configurez les relances automatiques.
        </p>
      </div>

      {/* ──────── Email templates section ──────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Modèles d'emails d'envoi
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Personnalisez l'email envoyé avec vos factures et devis.
        </p>

        {EMAIL_TYPES.map(({ type, label, icon: Icon, color, bgColor }) => {
          const prefix = type;
          const subject = emailTemplates[`${prefix}Subject`];
          const body = emailTemplates[`${prefix}Body`];
          return (
            <div
              key={type}
              className="border border-slate-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-card"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 dark:text-white text-sm">{label}</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {subject || '(sujet par défaut)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEmailEdit(type)}
                  title="Modifier"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              {body && (
                <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 pt-2">
                  <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed line-clamp-3">
                    {body}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        {/* Variables reference for email templates */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-dark-border rounded-xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Variables disponibles :
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SEND_EMAIL_VARIABLES.map((v) => (
              <span
                key={v.name}
                title={v.desc}
                className="px-2 py-0.5 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded text-slate-600 dark:text-slate-400 font-mono cursor-default"
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>

        {/* Save email templates */}
        {hasEmailChanges && (
          <div className="flex justify-end">
            <Button icon={Save} onClick={handleSaveEmailTemplates} loading={savingEmail} disabled={savingEmail} size="sm">
              Enregistrer les modèles d'envoi
            </Button>
          </div>
        )}
      </div>

      {/* ──────── Divider ──────── */}
      <div className="border-t border-slate-200 dark:border-slate-700" />

      {/* ──────── Reminders section header ──────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Relances automatiques
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Configurez les emails de relance envoyés automatiquement pour les factures en retard.
        </p>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl">
        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
          Les rappels sont envoyés automatiquement. Chaque rappel génère un PDF &laquo;&nbsp;RAPPEL&nbsp;&raquo;
          distinct de la facture originale, avec 15 jours de délai de paiement.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-dark-border rounded-xl">
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            Activer les relances automatiques
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Les emails seront envoyés selon le planning ci-dessous
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateEnabled(!formData.enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-bg ${
            formData.enabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
          }`}
          aria-pressed={formData.enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              formData.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Timeline visualization */}
      <div className={`transition-opacity duration-200 ${!formData.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-2 py-5 bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-xl overflow-x-auto">
          <div className="flex items-center min-w-[480px]">
            {/* Start label */}
            <div className="flex flex-col items-center flex-shrink-0 w-14">
              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 mb-1" />
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center leading-tight">
                Échéance
              </span>
            </div>

            {TIER_META.map((tier, i) => (
              <div key={tier.key} className="flex items-center flex-1">
                {/* Connector line */}
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                {/* Node */}
                <div className="flex flex-col items-center flex-shrink-0 px-1">
                  <div className={`w-3 h-3 rounded-full ${tier.dotBg} ring-2 ring-white dark:ring-dark-card shadow-sm mb-1`} />
                  <span className={`text-xs font-semibold ${tier.badgeBg} px-1.5 py-0.5 rounded-full whitespace-nowrap`}>
                    {tier.badge}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 text-center leading-tight max-w-[60px]">
                    {tier.label}
                  </span>
                </div>
              </div>
            ))}

            {/* End cap */}
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex-shrink-0 ml-1">
              <AlertTriangle className="w-4 h-4 text-red-400 dark:text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Reminder tier cards */}
      <div className={`space-y-3 transition-opacity duration-200 ${!formData.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Contenu des relances
        </h3>

        {TIER_META.map((tier, index) => {
          const rule = formData.schedule[index];
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={tier.key}
              className="border border-slate-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-card"
            >
              {/* Card header — always visible */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800`}>
                  <Bell className={`w-4 h-4 ${tier.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white text-sm">
                      {tier.label}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.badgeBg}`}>
                      {tier.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {rule.subject}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(index)}
                    title="Modifier"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    title={isExpanded ? 'Réduire' : 'Aperçu'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Collapsible body preview */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Objet
                    </span>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 font-mono">
                      {rule.subject}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Corps du message
                    </span>
                    <pre className="mt-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed">
                      {rule.body}
                    </pre>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(index)}
                      className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      Modifier ce modèle
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Variables reference */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-3">
          Variables disponibles dans les modèles
        </p>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <span
              key={v.name}
              title={v.desc}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-dark-card border border-amber-200 dark:border-amber-700/50 text-xs font-mono text-amber-800 dark:text-amber-200 cursor-default"
            >
              {v.name}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Survolez une variable pour voir sa description. Ces balises sont remplacées automatiquement à l'envoi.
        </p>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button icon={Save} onClick={handleSave} loading={saving} disabled={saving}>
            Enregistrer les modifications
          </Button>
        </div>
      )}

      {/* Edit modal */}
      {editingIndex !== null && editDraft !== null && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCancelEdit} />
          <div className="absolute inset-0 grid place-items-center p-4 pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 ${TIER_META[editingIndex].color}`} />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Modifier — {TIER_META[editingIndex].label}
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_META[editingIndex].badgeBg}`}>
                  {TIER_META[editingIndex].badge}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Input
                label="Objet de l'email"
                value={editDraft.subject}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder={TIER_META[editingIndex].defaultSubject}
              />

              <div ref={bodyTextareaRef}>
                <Textarea
                  label="Corps de l'email"
                  value={editDraft.body}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, body: e.target.value }))}
                  rows={10}
                  placeholder={TIER_META[editingIndex].defaultBody}
                />
              </div>

              {/* Variables hint inside modal — clickable to insert */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Cliquez sur une variable pour l'insérer dans le corps :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      title={v.desc}
                      onClick={() => handleInsertVariable(v.name)}
                      className="px-2 py-0.5 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-colors cursor-pointer"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  Survolez pour voir la description
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-dark-border flex-shrink-0">
              <Button variant="secondary" onClick={handleCancelEdit} className="flex-1">
                Annuler
              </Button>
              <Button icon={Save} onClick={handleSaveEdit} className="flex-1">
                Enregistrer
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Email template edit modal */}
      {editingEmailType !== null && emailEditDraft !== null && (() => {
        const meta = EMAIL_TYPES.find((t) => t.type === editingEmailType);
        const Icon = meta?.icon || Mail;
        return (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleCancelEmailEdit} />
            <div className="absolute inset-0 grid place-items-center p-4 pointer-events-none">
              <div className="pointer-events-auto bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-border flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${meta?.color || ''}`} />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Modifier — {meta?.label || 'Email'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEmailEdit}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <Input
                    label="Objet de l'email"
                    value={emailEditDraft.subject}
                    onChange={(e) => setEmailEditDraft((prev) => ({ ...prev, subject: e.target.value }))}
                  />

                  <div ref={emailBodyRef}>
                    <Textarea
                      label="Corps de l'email"
                      value={emailEditDraft.body}
                      onChange={(e) => setEmailEditDraft((prev) => ({ ...prev, body: e.target.value }))}
                      rows={10}
                    />
                  </div>

                  {/* Variables hint — clickable to insert */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Cliquez sur une variable pour l'insérer dans le corps :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SEND_EMAIL_VARIABLES.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          title={v.desc}
                          onClick={() => handleInsertEmailVariable(v.name)}
                          className="px-2 py-0.5 text-xs bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-colors cursor-pointer"
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                      Survolez pour voir la description
                    </p>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-dark-border flex-shrink-0">
                  <Button variant="secondary" onClick={handleCancelEmailEdit} className="flex-1">
                    Annuler
                  </Button>
                  <Button icon={Save} onClick={handleSaveEmailEdit} className="flex-1">
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
