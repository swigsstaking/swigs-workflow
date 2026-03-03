import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, Pencil, X, Check, Lightbulb } from 'lucide-react';
import { counterpartyRulesApi, expenseCategoriesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../utils/format';

export default function CounterpartyRulesSection() {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ counterpartyName: '', counterpartyIban: '', expenseCategory: '', alias: '' });
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { addToast } = useToastStore();

  const loadAll = useCallback(async () => {
    try {
      const [rulesRes, catsRes] = await Promise.all([
        counterpartyRulesApi.getAll(),
        expenseCategoriesApi.getAll()
      ]);
      setRules(rulesRes.data.data);
      setCategories(catsRes.data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data } = await counterpartyRulesApi.getSuggestions();
      setSuggestions(data.data);
      setShowSuggestions(true);
    } catch {
      addToast({ type: 'error', message: 'Erreur lors du chargement des suggestions' });
    }
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  const resetForm = () => {
    setForm({ counterpartyName: '', counterpartyIban: '', expenseCategory: '', alias: '' });
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (rule) => {
    setForm({
      counterpartyName: rule.counterpartyName,
      counterpartyIban: rule.counterpartyIban || '',
      expenseCategory: rule.expenseCategory?._id || '',
      alias: rule.alias || ''
    });
    setEditId(rule._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.counterpartyName || !form.expenseCategory) {
      addToast({ type: 'error', message: 'Contrepartie et catégorie requises' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await counterpartyRulesApi.update(editId, form);
        addToast({ type: 'success', message: 'Règle mise à jour' });
      } else {
        await counterpartyRulesApi.create(form);
        addToast({ type: 'success', message: 'Règle créée' });
      }
      resetForm();
      loadAll();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette règle ?')) return;
    try {
      await counterpartyRulesApi.remove(id);
      addToast({ type: 'success', message: 'Règle supprimée' });
      loadAll();
    } catch {
      addToast({ type: 'error', message: 'Erreur' });
    }
  };

  const handleCreateFromSuggestion = (suggestion) => {
    setForm({
      counterpartyName: suggestion.counterpartyName,
      counterpartyIban: suggestion.counterpartyIban || '',
      expenseCategory: '',
      alias: ''
    });
    setShowForm(true);
    setShowSuggestions(false);
  };

  if (loading) {
    return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Règles fournisseurs</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={Lightbulb} onClick={loadSuggestions}>
              Suggestions
            </Button>
            <Button size="sm" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
              Ajouter
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Associez automatiquement une catégorie de dépenses à chaque fournisseur (contrepartie DBIT).
        </p>
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Contreparties non classifiées ({suggestions.length})
            </h3>
            <button onClick={() => setShowSuggestions(false)} className="text-amber-400 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {suggestions.map(s => (
              <button
                key={s.counterpartyName}
                onClick={() => handleCreateFromSuggestion(s)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors text-left"
              >
                <div>
                  <span className="text-sm text-amber-900 dark:text-amber-100">{s.counterpartyName}</span>
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">{s.count}x</span>
                </div>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{formatCurrency(s.totalAmount)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editId ? 'Modifier la règle' : 'Nouvelle règle'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom contrepartie *</label>
              <input
                type="text"
                value={form.counterpartyName}
                onChange={(e) => setForm(f => ({ ...f, counterpartyName: e.target.value }))}
                placeholder="SWISSCOM (SCHWEIZ) AG"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Alias (optionnel)</label>
              <input
                type="text"
                value={form.alias}
                onChange={(e) => setForm(f => ({ ...f, alias: e.target.value }))}
                placeholder="Swisscom"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie *</label>
              <select
                value={form.expenseCategory}
                onChange={(e) => setForm(f => ({ ...f, expenseCategory: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Sélectionner...</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}{cat.accountNumber ? ` (${cat.accountNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">IBAN (optionnel)</label>
              <input
                type="text"
                value={form.counterpartyIban}
                onChange={(e) => setForm(f => ({ ...f, counterpartyIban: e.target.value }))}
                placeholder="CH..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
              />
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

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aucune règle fournisseur</p>
          <p className="text-xs mt-1">Utilisez les suggestions pour créer des règles automatiquement.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Contrepartie</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Alias</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Catégorie</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Matches</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rules.map(rule => (
                <tr key={rule._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2 text-slate-900 dark:text-white max-w-[200px] truncate">
                    {rule.counterpartyName}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                    {rule.alias || '-'}
                  </td>
                  <td className="px-4 py-2">
                    {rule.expenseCategory ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: rule.expenseCategory.color || '#6366f1' }}
                        />
                        <span className="text-slate-700 dark:text-slate-300">{rule.expenseCategory.name}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-500 dark:text-slate-400">
                    {rule.matchCount || 0}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
