import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, Trash2, Pencil, X, Check, GripVertical, Sparkles } from 'lucide-react';
import { expenseCategoriesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#f97316', '#ef4444', '#64748b'];

export default function ExpenseCategoriesSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', icon: 'Folder', color: '#6366f1', accountNumber: '', budgetMonthly: '' });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { addToast } = useToastStore();

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await expenseCategoriesApi.getAll();
      setCategories(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const resetForm = () => {
    setForm({ name: '', icon: 'Folder', color: '#6366f1', accountNumber: '', budgetMonthly: '' });
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (cat) => {
    setForm({
      name: cat.name,
      icon: cat.icon || 'Folder',
      color: cat.color || '#6366f1',
      accountNumber: cat.accountNumber || '',
      budgetMonthly: cat.budgetMonthly || ''
    });
    setEditId(cat._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      addToast({ type: 'error', message: 'Nom requis' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        budgetMonthly: form.budgetMonthly ? parseFloat(form.budgetMonthly) : undefined
      };
      if (editId) {
        await expenseCategoriesApi.update(editId, payload);
        addToast({ type: 'success', message: 'Catégorie mise à jour' });
      } else {
        await expenseCategoriesApi.create(payload);
        addToast({ type: 'success', message: 'Catégorie créée' });
      }
      resetForm();
      loadCategories();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, isDefault) => {
    if (isDefault) {
      addToast({ type: 'error', message: 'Les catégories par défaut ne peuvent pas être supprimées' });
      return;
    }
    if (!confirm('Supprimer cette catégorie ?')) return;
    try {
      await expenseCategoriesApi.remove(id);
      addToast({ type: 'success', message: 'Catégorie supprimée' });
      loadCategories();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur' });
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data } = await expenseCategoriesApi.seed();
      if (data.data.seeded > 0) {
        addToast({ type: 'success', message: `${data.data.seeded} catégories créées` });
        loadCategories();
      } else {
        addToast({ type: 'info', message: data.data.message || 'Des catégories existent déjà' });
      }
    } catch {
      addToast({ type: 'error', message: 'Erreur' });
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Catégories de dépenses</h2>
          </div>
          <div className="flex items-center gap-2">
            {categories.length === 0 && (
              <Button variant="secondary" size="sm" icon={Sparkles} onClick={handleSeed} loading={seeding}>
                Catégories suisses
              </Button>
            )}
            <Button size="sm" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
              Ajouter
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Classifiez vos dépenses (DBIT) par catégorie pour un suivi comptable précis.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Infrastructure"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">N° comptable</label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="6200"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Budget mensuel (CHF)</label>
              <input
                type="number"
                value={form.budgetMonthly}
                onChange={(e) => setForm(f => ({ ...f, budgetMonthly: e.target.value }))}
                placeholder="Optionnel"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={resetForm}>Annuler</Button>
            <Button size="sm" icon={Check} onClick={handleSave} loading={saving}>
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aucune catégorie de dépenses</p>
          <p className="text-xs mt-1">Cliquez sur "Catégories suisses" pour créer les catégories par défaut du plan comptable.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map(cat => (
            <div
              key={cat._id}
              className="flex items-center justify-between px-4 py-3 bg-white dark:bg-dark-card rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 cursor-grab" />
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color || '#6366f1' }}
                />
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.name}</span>
                  {cat.accountNumber && (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-mono">{cat.accountNumber}</span>
                  )}
                </div>
                {cat.budgetMonthly > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Budget: {cat.budgetMonthly} CHF/mois
                  </span>
                )}
                {cat.isDefault && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                    DÉFAUT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(cat)}
                  className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {!cat.isDefault && (
                  <button
                    onClick={() => handleDelete(cat._id, cat.isDefault)}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
