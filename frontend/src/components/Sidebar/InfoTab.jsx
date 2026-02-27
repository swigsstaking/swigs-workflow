/**
 * SWIGS InfoTab — "Carte Alpine" redesign.
 * Financial summary (Non facturé / Facturé) as impactful SwigCard panels.
 * Section labels in Swiss small-caps style.
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  User, Mail, Phone, Building2, MapPin,
  Edit2, Save, X, Trash2, TrendingUp, Clock,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useToastStore } from '../../stores/toastStore';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';
import SwigCard from '../ui/SwigCard';
import { formatCurrency } from '../../utils/format';

export default function InfoTab({ project }) {
  const { statuses, updateProject, changeProjectStatus, archiveProject, fetchProjects } = useProjectStore();
  const { closeSidebar } = useUIStore();
  const { addToast } = useToastStore();

  const [editing, setEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [formData, setFormData] = useState(() => ({
    name: project.name,
    description: project.description || '',
    clientName: project.client?.name || '',
    clientEmail: project.client?.email || '',
    clientPhone: project.client?.phone || '',
    clientCompany: project.client?.company || '',
    clientStreet: project.client?.street || '',
    clientZip: project.client?.zip || '',
    clientCity: project.client?.city || '',
    clientChe: project.client?.che || '',
  }));

  useEffect(() => {
    setFormData({
      name: project.name,
      description: project.description || '',
      clientName: project.client?.name || '',
      clientEmail: project.client?.email || '',
      clientPhone: project.client?.phone || '',
      clientCompany: project.client?.company || '',
      clientStreet: project.client?.street || '',
      clientZip: project.client?.zip || '',
      clientCity: project.client?.city || '',
      clientChe: project.client?.che || '',
    });
    setEditing(false);
  }, [project._id]);

  const handleStatusChange = async (e) => {
    try {
      await changeProjectStatus(project._id, e.target.value);
      addToast({ type: 'success', message: 'Statut mis à jour' });
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    }
  };

  const handleSave = async () => {
    try {
      await updateProject(project._id, {
        name: formData.name,
        description: formData.description,
        client: {
          name: formData.clientName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
          company: formData.clientCompany,
          street: formData.clientStreet,
          zip: formData.clientZip,
          city: formData.clientCity,
          che: formData.clientChe,
        },
      });
      addToast({ type: 'success', message: 'Projet mis à jour' });
      setEditing(false);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la mise à jour' });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveProject(project._id);
      addToast({ type: 'success', message: 'Projet archivé' });
      closeSidebar();
      await fetchProjects();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de l\'archivage' });
    }
  };

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setEditing(false);
    setFormData({
      name: project.name,
      description: project.description || '',
      clientName: project.client?.name || '',
      clientEmail: project.client?.email || '',
      clientPhone: project.client?.phone || '',
      clientCompany: project.client?.company || '',
      clientStreet: project.client?.street || '',
      clientZip: project.client?.zip || '',
      clientCity: project.client?.city || '',
      clientChe: project.client?.che || '',
    });
  };

  return (
    <div className="p-5 space-y-6">

      {/* ── Financial Summary — impactful metric cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Non facturé */}
        <SwigCard accentBorder hover className="border-l-amber-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="swigs-section-label" style={{ color: '#D97706' }}>Non facturé</span>
              <div className="w-7 h-7 rounded-[6px] bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
            </div>
            <div className="swigs-amount text-xl font-extrabold text-amber-700 dark:text-amber-300 leading-tight">
              {formatCurrency(project.stats?.unbilledTotal || 0)}
            </div>
          </div>
        </SwigCard>

        {/* Facturé */}
        <SwigCard accentBorder hover className="border-l-primary-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="swigs-section-label" style={{ color: 'rgb(var(--primary-600))' }}>Facturé</span>
              <div className="w-7 h-7 rounded-[6px] bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
              </div>
            </div>
            <div className="swigs-amount text-xl font-extrabold text-primary-700 dark:text-primary-300 leading-tight">
              {formatCurrency(project.stats?.billedTotal || 0)}
            </div>
          </div>
        </SwigCard>
      </div>

      {/* ── Statut ── */}
      <div>
        <p className="swigs-section-label mb-2">Statut</p>
        <select
          value={project.status?._id || ''}
          onChange={handleStatusChange}
          className="
            w-full px-3 py-2.5
            text-sm font-semibold
            bg-white dark:bg-zinc-950
            border-2 rounded-[6px]
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-zinc-950
            cursor-pointer
          "
          style={{
            borderColor: project.status?.color,
            color: project.status?.color,
            focusRingColor: project.status?.color,
          }}
        >
          {statuses.map((status) => (
            <option key={status._id} value={status._id}>
              {status.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Projet ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="swigs-section-label">Projet</p>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] rounded-[6px] transition-all duration-200"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={resetForm}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-[rgb(var(--swigs-stone)/0.12)] dark:hover:bg-white/[0.05] rounded-[6px] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                className="p-1.5 text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-[6px] transition-all"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Input label="Nom du projet" name="name" value={formData.name} onChange={handleChange} />
            <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} />
          </div>
        ) : (
          <SwigCard hover={false} className="bg-[rgb(var(--swigs-cream)/0.35)] dark:bg-zinc-950/60">
            <div className="p-3.5">
              <p className="font-medium text-slate-900 dark:text-white text-[13.5px]">{project.name}</p>
              {project.description && (
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">{project.description}</p>
              )}
              <p className="text-[10.5px] text-[rgb(var(--swigs-stone))] dark:text-zinc-600 mt-2">
                Créé le {format(new Date(project.createdAt), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </SwigCard>
        )}
      </div>

      {/* ── Client ── */}
      <div className="space-y-3">
        <p className="swigs-section-label">Client</p>

        {editing ? (
          <div className="space-y-3">
            <Input label="Nom" name="clientName" value={formData.clientName} onChange={handleChange} />
            <Input label="Société" name="clientCompany" value={formData.clientCompany} onChange={handleChange} />
            <Input label="Email" name="clientEmail" type="email" value={formData.clientEmail} onChange={handleChange} />
            <Input label="Téléphone" name="clientPhone" value={formData.clientPhone} onChange={handleChange} />
            <Input label="Rue" name="clientStreet" value={formData.clientStreet} onChange={handleChange} placeholder="Rue de la Poste 1" />
            <div className="grid grid-cols-3 gap-2">
              <Input label="NPA" name="clientZip" value={formData.clientZip} onChange={handleChange} placeholder="1200" />
              <div className="col-span-2">
                <Input label="Localité" name="clientCity" value={formData.clientCity} onChange={handleChange} placeholder="Genève" />
              </div>
            </div>
            <Input label="N° IDE (CHE)" name="clientChe" value={formData.clientChe} onChange={handleChange} placeholder="CHE-123.456.789" />
          </div>
        ) : (
          <SwigCard hover={false} className="bg-[rgb(var(--swigs-cream)/0.35)] dark:bg-zinc-950/60">
            <div className="p-3.5 space-y-2.5">
              {project.client?.name && (
                <div className="flex items-center gap-2.5">
                  <User className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0" />
                  <span className="text-[13px] text-slate-700 dark:text-zinc-300">{project.client.name}</span>
                </div>
              )}
              {project.client?.company && (
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0" />
                  <span className="text-[13px] text-slate-700 dark:text-zinc-300">{project.client.company}</span>
                </div>
              )}
              {project.client?.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0" />
                  <a href={`mailto:${project.client.email}`} className="text-[13px] text-primary-600 dark:text-primary-400 hover:underline truncate">
                    {project.client.email}
                  </a>
                </div>
              )}
              {project.client?.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0" />
                  <a href={`tel:${project.client.phone}`} className="text-[13px] text-primary-600 dark:text-primary-400 hover:underline">
                    {project.client.phone}
                  </a>
                </div>
              )}
              {(project.client?.street || project.client?.address) && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-[rgb(var(--swigs-stone))] flex-shrink-0 mt-0.5" />
                  <span className="text-[13px] text-slate-700 dark:text-zinc-300">
                    {project.client.street ? (
                      <>{project.client.street}{(project.client.zip || project.client.city) && <br />}{[project.client.zip, project.client.city].filter(Boolean).join(' ')}</>
                    ) : project.client.address}
                  </span>
                </div>
              )}
            </div>
          </SwigCard>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="pt-2 border-t border-[rgb(var(--swigs-stone)/0.2)] dark:border-dark-border">
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setShowArchiveConfirm(true)} className="w-full">
          Archiver le projet
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchive}
        title="Archiver le projet"
        message={`Êtes-vous sûr de vouloir archiver le projet "${project.name}" ?`}
        confirmLabel="Archiver"
        variant="danger"
      />
    </div>
  );
}
