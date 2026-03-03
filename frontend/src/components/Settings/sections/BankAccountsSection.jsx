import { useState, useEffect, useCallback } from 'react';
import { Landmark, Plus, Trash2, Star, Pencil, X, Check } from 'lucide-react';
import { bankAccountsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import Button from '../../ui/Button';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#f97316', '#64748b'];

export default function BankAccountsSection() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', iban: '', qrIban: '', bankName: '', currency: 'CHF', color: '#6366f1' });
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  const loadAccounts = useCallback(async () => {
    try {
      const { data } = await bankAccountsApi.getAll();
      setAccounts(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const resetForm = () => {
    setForm({ name: '', iban: '', qrIban: '', bankName: '', currency: 'CHF', color: '#6366f1' });
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (account) => {
    setForm({
      name: account.name,
      iban: account.iban,
      qrIban: account.qrIban || '',
      bankName: account.bankName || '',
      currency: account.currency || 'CHF',
      color: account.color || '#6366f1'
    });
    setEditId(account._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.iban) {
      addToast({ type: 'error', message: 'Nom et IBAN requis' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await bankAccountsApi.update(editId, form);
        addToast({ type: 'success', message: 'Compte mis à jour' });
      } else {
        await bankAccountsApi.create(form);
        addToast({ type: 'success', message: 'Compte créé' });
      }
      resetForm();
      loadAccounts();
    } catch (error) {
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce compte bancaire ?')) return;
    try {
      await bankAccountsApi.remove(id);
      addToast({ type: 'success', message: 'Compte supprimé' });
      loadAccounts();
    } catch {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await bankAccountsApi.setDefault(id);
      loadAccounts();
    } catch {
      addToast({ type: 'error', message: 'Erreur' });
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
            <Landmark className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Comptes bancaires</h2>
          </div>
          <Button size="sm" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            Ajouter
          </Button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Organisez vos comptes bancaires. L'IBAN est utilisé pour lier automatiquement les imports CAMT.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editId ? 'Modifier le compte' : 'Nouveau compte'}
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
                placeholder="Raiffeisen CHF"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Banque</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="Raiffeisen"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">IBAN *</label>
              <input
                type="text"
                value={form.iban}
                onChange={(e) => setForm(f => ({ ...f, iban: e.target.value }))}
                placeholder="CH93 0076 2011 6238 5295 7"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">QR-IBAN (optionnel)</label>
              <input
                type="text"
                value={form.qrIban}
                onChange={(e) => setForm(f => ({ ...f, qrIban: e.target.value }))}
                placeholder="CH44 3199 9123 0008 8901 2"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-dark-card text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
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

      {/* Account List */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aucun compte bancaire configuré</p>
          <p className="text-xs mt-1">Les comptes sont créés automatiquement lors de l'import CAMT ou manuellement ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => (
            <div
              key={account._id}
              className="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color || '#6366f1' }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{account.name}</span>
                    {account.isDefault && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                        DÉFAUT
                      </span>
                    )}
                    {account.bankName && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{account.bankName}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {account.iban} · {account.currency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!account.isDefault && (
                  <button
                    onClick={() => handleSetDefault(account._id)}
                    title="Définir par défaut"
                    className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleEdit(account)}
                  className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(account._id)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
