import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  User, Mail, Phone, Building2, MapPin,
  Edit2, Save, X, Trash2, RotateCcw
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useToastStore } from '../../stores/toastStore';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function InfoTab({ project }) {
  const { statuses, updateProject, changeProjectStatus, archiveProject, fetchProjects } = useProjectStore();
  const { closeSidebar } = useUIStore();
  const { addToast } = useToastStore();

  const [editing, setEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    clientName: project.client?.name || '',
    clientEmail: project.client?.email || '',
    clientPhone: project.client?.phone || '',
    clientCompany: project.client?.company || '',
    clientAddress: project.client?.address || ''
  });

  const handleStatusChange = async (e) => {
    try {
      await changeProjectStatus(project._id, e.target.value);
      addToast({ type: 'success', message: 'Statut mis à jour' });
    } catch (error) {
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
          address: formData.clientAddress
        }
      });
      addToast({ type: 'success', message: 'Projet mis à jour' });
      setEditing(false);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la mise à jour' });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveProject(project._id);
      addToast({ type: 'success', message: 'Projet archivé' });
      closeSidebar();
      await fetchProjects();
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'archivage' });
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Non facturé</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {formatCurrency(project.stats?.unbilledTotal || 0)}
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Facturé</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(project.stats?.billedTotal || 0)}
          </p>
        </div>
      </div>

      {/* Status selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Statut
        </label>
        <select
          value={project.status?._id || ''}
          onChange={handleStatusChange}
          className="
            w-full px-3 py-2.5
            text-sm font-medium
            bg-white dark:bg-dark-bg border-2 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-offset-2
            cursor-pointer
          "
          style={{
            borderColor: project.status?.color,
            color: project.status?.color
          }}
        >
          {statuses.map(status => (
            <option key={status._id} value={status._id}>
              {status.name}
            </option>
          ))}
        </select>
      </div>

      {/* Project Info */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Projet
          </h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    name: project.name,
                    description: project.description || '',
                    clientName: project.client?.name || '',
                    clientEmail: project.client?.email || '',
                    clientPhone: project.client?.phone || '',
                    clientCompany: project.client?.company || '',
                    clientAddress: project.client?.address || ''
                  });
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Input
              label="Nom du projet"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-dark-bg rounded-xl p-4">
            <p className="font-medium text-slate-900 dark:text-white">{project.name}</p>
            {project.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{project.description}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Créé le {format(new Date(project.createdAt), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        )}
      </div>

      {/* Client Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          Client
        </h3>

        {editing ? (
          <div className="space-y-3">
            <Input
              label="Nom"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
            />
            <Input
              label="Société"
              name="clientCompany"
              value={formData.clientCompany}
              onChange={handleChange}
            />
            <Input
              label="Email"
              name="clientEmail"
              type="email"
              value={formData.clientEmail}
              onChange={handleChange}
            />
            <Input
              label="Téléphone"
              name="clientPhone"
              value={formData.clientPhone}
              onChange={handleChange}
            />
            <Textarea
              label="Adresse"
              name="clientAddress"
              value={formData.clientAddress}
              onChange={handleChange}
            />
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-dark-bg rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{project.client?.name}</span>
            </div>

            {project.client?.company && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{project.client.company}</span>
              </div>
            )}

            {project.client?.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400" />
                <a
                  href={`mailto:${project.client.email}`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  {project.client.email}
                </a>
              </div>
            )}

            {project.client?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-400" />
                <a
                  href={`tel:${project.client.phone}`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  {project.client.phone}
                </a>
              </div>
            )}

            {project.client?.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{project.client.address}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-slate-200 dark:border-dark-border">
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={() => setShowArchiveConfirm(true)}
          className="w-full"
        >
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
