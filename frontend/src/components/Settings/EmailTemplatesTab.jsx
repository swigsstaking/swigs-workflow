import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input, { Textarea } from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';
import { emailTemplatesApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';

const categoryColors = {
  order: 'blue',
  customer: 'green',
  project: 'purple',
  invoice: 'orange',
  quote: 'cyan',
  reminder: 'yellow',
  general: 'gray'
};

const categoryLabels = {
  order: 'Commande',
  customer: 'Client',
  project: 'Projet',
  invoice: 'Facture',
  quote: 'Devis',
  reminder: 'Rappel',
  general: 'Général'
};

export default function EmailTemplatesTab() {
  const { addToast } = useToastStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general'
  });
  const [creatingDefaults, setCreatingDefaults] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await emailTemplatesApi.getAll();
      setTemplates(data.data);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du chargement des templates' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    setCreatingDefaults(true);
    try {
      await emailTemplatesApi.createDefaults();
      await loadTemplates();
      addToast({ type: 'success', message: 'Templates par défaut créés' });
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de la création' });
    } finally {
      setCreatingDefaults(false);
    }
  };

  const handleNew = () => {
    setFormData({ name: '', subject: '', body: '', category: 'general' });
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category
    });
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      addToast({ type: 'error', message: 'Tous les champs sont requis' });
      return;
    }

    try {
      if (editingTemplate) {
        await emailTemplatesApi.update(editingTemplate._id, formData);
        addToast({ type: 'success', message: 'Template mis à jour' });
      } else {
        await emailTemplatesApi.create(formData);
        addToast({ type: 'success', message: 'Template créé' });
      }
      await loadTemplates();
      setShowModal(false);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'enregistrement' });
    }
  };

  const handleDelete = (template) => {
    setDeleteTarget(template);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await emailTemplatesApi.delete(deleteTarget._id);
      await loadTemplates();
      addToast({ type: 'success', message: 'Template supprimé' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePreview = async () => {
    if (!formData.body) return;
    try {
      const sampleData = {
        clientName: 'Jean Dupont',
        projectName: 'Site Web E-commerce',
        number: 'FAC-2026-001',
        total: '1500.00 CHF',
        companyName: 'Ma Société',
        paymentTerms: '30'
      };

      const { data } = await emailTemplatesApi.preview(editingTemplate?._id || 'preview', {
        ...formData,
        data: sampleData
      });

      setPreviewHtml(data.data);
      setShowPreview(true);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la génération de l\'aperçu' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gérez vos templates d'emails pour les automations.
        </p>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="secondary"
              icon={Sparkles}
              onClick={handleCreateDefaults}
              loading={creatingDefaults}
            >
              Créer templates par défaut
            </Button>
          )}
          <Button icon={Plus} onClick={handleNew}>
            Nouveau template
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            Aucun template. Créez-en un ou générez les templates par défaut.
          </div>
        ) : (
          templates.map(template => (
            <div
              key={template._id}
              className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {template.name}
                    </h3>
                    <span
                      className={`
                        px-2 py-0.5 text-xs font-medium rounded-full
                        ${categoryColors[template.category] === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}
                        ${categoryColors[template.category] === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}
                        ${categoryColors[template.category] === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}
                        ${categoryColors[template.category] === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}
                        ${categoryColors[template.category] === 'cyan' && 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'}
                        ${categoryColors[template.category] === 'yellow' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}
                        ${categoryColors[template.category] === 'gray' && 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}
                      `}
                    >
                      {categoryLabels[template.category]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {template.subject}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? 'Modifier le template' : 'Nouveau template'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom du template"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Confirmation de commande"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Catégorie
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 text-sm bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Sujet de l'email"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Ex: Votre commande {{number}}"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Corps du message
            </label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={12}
              placeholder="Bonjour {{clientName}},&#10;&#10;Votre commande {{number}} a été créée..."
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Variables disponibles: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{clientName}}'}</code>{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{number}}'}</code>{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{projectName}}'}</code>{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{total}}'}</code>{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{'{{companyName}}'}</code>
            </p>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="secondary" icon={Eye} onClick={handlePreview}>
              Aperçu
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave}>
                {editingTemplate ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Aperçu du template"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Sujet: {formData.subject}
            </p>
          </div>
          <div
            className="prose dark:prose-invert max-w-none bg-white dark:bg-dark-bg rounded-lg p-4 border border-slate-200 dark:border-dark-border"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le template"
        message={`Êtes-vous sûr de vouloir supprimer le template "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
