import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import { quoteTemplatesApi, servicesApi } from '../../services/api';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import ServicePicker from '../Sidebar/invoice/ServicePicker';
import { useToastStore } from '../../stores/toastStore';
import { formatCurrency } from '../../utils/format';

const TemplateModal = ({ isOpen, onClose, template, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0 }],
    discountType: '',
    discountValue: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        lines: template.lines?.length > 0
          ? template.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }))
          : [{ description: '', quantity: 1, unitPrice: 0 }],
        discountType: template.discountType || '',
        discountValue: template.discountValue || '',
        notes: template.notes || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        lines: [{ description: '', quantity: 1, unitPrice: 0 }],
        discountType: '',
        discountValue: '',
        notes: ''
      });
    }
  }, [template, isOpen]);

  const addLine = () => {
    setFormData({ ...formData, lines: [...formData.lines, { description: '', quantity: 1, unitPrice: 0 }] });
  };

  const removeLine = (index) => {
    if (formData.lines.length === 1) return;
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const addServiceLine = (service) => {
    const newLine = {
      description: service.description ? `${service.name}\n${service.description}` : service.name,
      quantity: service.defaultQuantity || 1,
      unitPrice: service.priceType === 'hourly' && service.estimatedHours
        ? service.unitPrice * service.estimatedHours
        : service.unitPrice
    };
    setFormData({
      ...formData,
      lines: [...formData.lines.filter(l => l.description || l.unitPrice), newLine]
    });
  };

  const getSubtotal = () => {
    return formData.lines.reduce((sum, l) => sum + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = formData.lines.filter(l => l.description && l.unitPrice);
    if (validLines.length === 0) return;

    setLoading(true);
    try {
      const data = {
        name: formData.name,
        description: formData.description,
        lines: validLines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice) || 0
        })),
        discountType: formData.discountType || '',
        discountValue: formData.discountValue ? parseFloat(formData.discountValue) : 0,
        notes: formData.notes
      };

      if (template) {
        await quoteTemplatesApi.update(template._id, data);
      } else {
        await quoteTemplatesApi.create(data);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={template ? 'Modifier le modèle' : 'Nouveau modèle de devis'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nom du modèle"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="ex: Forfait polish céramique"
          />
          <Input
            label="Description (optionnel)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description courte"
          />
        </div>

        {/* Service picker */}
        <ServicePicker onSelectService={addServiceLine} />

        {/* Lines editor */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Lignes du modèle</p>
          <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-center">Qté</div>
            <div className="col-span-2 text-center">Prix unit.</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {formData.lines.map((line, index) => {
            const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
            return (
              <div key={index} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/30">
                <div className="col-span-6">
                  <textarea
                    value={line.description}
                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                    placeholder="Description..."
                    rows={1}
                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                  />
                </div>
                <div className="col-span-2 pt-0.5">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 pt-0.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm text-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1 pt-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(lineTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={formData.lines.length === 1}
                    className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addLine}>
            Ajouter une ligne
          </Button>
        </div>

        {/* Discount */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Rabais</p>
          <div className="flex items-center gap-2">
            <select
              value={formData.discountType}
              onChange={(e) => setFormData({ ...formData, discountType: e.target.value, discountValue: e.target.value ? formData.discountValue : '' })}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white"
            >
              <option value="">Aucun</option>
              <option value="percentage">%</option>
              <option value="fixed">CHF</option>
            </select>
            {formData.discountType && (
              <Input
                type="number"
                min="0"
                step={formData.discountType === 'percentage' ? '1' : '0.01'}
                max={formData.discountType === 'percentage' ? '100' : undefined}
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                placeholder={formData.discountType === 'percentage' ? '10' : '100.00'}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        <Textarea
          label="Notes (optionnel)"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Conditions particulières, remarques..."
        />

        {/* Estimated total */}
        <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total estimé HT</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(getSubtotal())}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : template ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const QuoteTemplatesTab = () => {
  const { addToast } = useToastStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTemplates = async () => {
    try {
      const { data } = await quoteTemplatesApi.getAll();
      setTemplates(data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  useEffect(() => {
    fetchTemplates().finally(() => setLoading(false));
  }, []);

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleDelete = (template) => {
    setDeleteTarget(template);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await quoteTemplatesApi.delete(deleteTarget._id);
      addToast({ type: 'success', message: 'Modèle supprimé' });
      fetchTemplates();
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggle = async (template) => {
    try {
      await quoteTemplatesApi.update(template._id, { isActive: !template.isActive });
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const getEstimatedTotal = (template) => {
    return template.lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
  };

  if (loading) {
    return <div className="text-slate-500 dark:text-slate-400 p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 dark:text-slate-400">
          Créez des modèles de devis réutilisables avec des lignes pré-configurées.
        </p>
        <Button onClick={handleNewTemplate} className="flex items-center gap-2">
          <Plus size={16} />
          Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>Aucun modèle de devis</p>
          <p className="text-sm mt-1">Créez votre premier modèle pour gagner du temps</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template._id}
              className={`bg-white dark:bg-dark-card rounded-xl p-4 border border-slate-200 dark:border-dark-border ${
                !template.isActive ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {template.lines.length} ligne{template.lines.length > 1 ? 's' : ''}
                    </span>
                    {!template.isActive && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                        Inactif
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrency(getEstimatedTotal(template))} HT
                    </span>
                    {template.discountType && template.discountValue > 0 && (
                      <span className="text-slate-500 dark:text-slate-400">
                        Rabais: {template.discountType === 'percentage' ? `${template.discountValue}%` : formatCurrency(template.discountValue)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(template)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    title={template.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {template.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        template={editingTemplate}
        onSave={fetchTemplates}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le modèle"
        message={`Êtes-vous sûr de vouloir supprimer le modèle "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
};

export default QuoteTemplatesTab;
