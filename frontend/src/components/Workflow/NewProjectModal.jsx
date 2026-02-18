import { useState, useEffect, useRef } from 'react';
import { User, Plus, Search } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useToastStore } from '../../stores/toastStore';
import { clientsApi } from '../../services/api';

function ClientAutocomplete({ clients, selectedClientId, onSelect, formData, onCreateNew }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = clients.find(c => c._id === selectedClientId);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-4">
      <div ref={ref} className="relative">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Sélectionner un client
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={isOpen ? search : (selected ? (selected.company ? `${selected.name} (${selected.company})` : selected.name) : '')}
            onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
            onFocus={() => { setIsOpen(true); setSearch(''); }}
            placeholder="Rechercher un client..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-dark-bg border border-slate-200 dark:border-dark-border rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(client => (
              <button
                key={client._id}
                type="button"
                onClick={() => { onSelect(client._id); setIsOpen(false); }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center justify-between ${selectedClientId === client._id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
              >
                <div>
                  <span className="text-slate-900 dark:text-white">{client.name}</span>
                  {client.company && (
                    <span className="text-xs text-slate-400 ml-2">{client.company}</span>
                  )}
                </div>
                {client.email && (
                  <span className="text-xs text-slate-400 truncate ml-2 max-w-[140px]">{client.email}</span>
                )}
              </button>
            ))}

            {filtered.length === 0 && search && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                Aucun client trouvé
              </div>
            )}

            {filtered.length === 0 && !search && clients.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                Aucun client enregistré
              </div>
            )}

            {onCreateNew && search && (
              <button
                type="button"
                onClick={() => onCreateNew(search)}
                className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 border-t border-slate-100 dark:border-dark-border font-medium"
              >
                + Créer « {search} »
              </button>
            )}
          </div>
        )}
      </div>

      {selectedClientId && (
        <div className="p-3 bg-slate-50 dark:bg-dark-bg rounded-lg text-sm">
          <p className="font-medium text-slate-700 dark:text-slate-200">{formData.clientName}</p>
          {formData.clientCompany && <p className="text-slate-500 dark:text-slate-400">{formData.clientCompany}</p>}
          {formData.clientEmail && <p className="text-slate-500 dark:text-slate-400">{formData.clientEmail}</p>}
          {formData.clientPhone && <p className="text-slate-500 dark:text-slate-400">{formData.clientPhone}</p>}
        </div>
      )}
    </div>
  );
}

export default function NewProjectModal() {
  const { showNewProjectModal, toggleNewProjectModal } = useUIStore();
  const { statuses, createProject } = useProjectStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientMode, setClientMode] = useState('select'); // 'select' or 'new'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientCompany: '',
    status: ''
  });

  // Load clients when modal opens
  useEffect(() => {
    if (showNewProjectModal) {
      loadClients();
    }
  }, [showNewProjectModal]);

  const loadClients = async () => {
    try {
      const { data } = await clientsApi.getAll();
      setClients(data.data);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du chargement des clients' });
    }
  };

  const handleClientSelect = (clientId) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find(c => c._id === clientId);
      if (client) {
        setFormData(prev => ({
          ...prev,
          clientName: client.name,
          clientEmail: client.email || '',
          clientPhone: client.phone || '',
          clientCompany: client.company || ''
        }));
      }
    }
  };

  const validateEmail = (email) => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate email if provided
    if (formData.clientEmail && !validateEmail(formData.clientEmail)) {
      setEmailError('Format d\'email invalide');
      return;
    }
    setEmailError('');

    setLoading(true);

    try {
      await createProject({
        name: formData.name,
        description: formData.description,
        client: {
          name: formData.clientName,
          email: formData.clientEmail,
          phone: formData.clientPhone,
          company: formData.clientCompany
        },
        status: formData.status || undefined
      });

      addToast({ type: 'success', message: 'Projet créé avec succès' });
      toggleNewProjectModal();
      resetForm();
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la création du projet' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientCompany: '',
      status: ''
    });
    setSelectedClientId('');
    setClientMode('select');
    setEmailError('');
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear email error when user starts typing
    if (e.target.name === 'clientEmail' && emailError) {
      setEmailError('');
    }
  };

  return (
    <Modal
      isOpen={showNewProjectModal}
      onClose={() => { toggleNewProjectModal(); resetForm(); }}
      title="Nouveau projet"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Informations projet
          </h3>

          <Input
            label="Nom du projet"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ex: Site web Acme Corp"
            required
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Description courte du projet..."
          />

          <Select
            label="Statut initial"
            name="status"
            value={formData.status}
            onChange={handleChange}
            placeholder="Statut par défaut"
            options={statuses.map(s => ({
              value: s._id,
              label: s.name
            }))}
          />
        </div>

        {/* Client info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Client
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setClientMode('select'); setSelectedClientId(''); }}
                className={`
                  px-3 py-1 text-xs font-medium rounded-lg transition-colors
                  ${clientMode === 'select'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 dark:bg-dark-hover text-slate-600 dark:text-slate-300'
                  }
                `}
              >
                <User className="w-3 h-3 inline mr-1" />
                Existant
              </button>
              <button
                type="button"
                onClick={() => { setClientMode('new'); setSelectedClientId(''); setFormData(prev => ({ ...prev, clientName: '', clientEmail: '', clientPhone: '', clientCompany: '' })); }}
                className={`
                  px-3 py-1 text-xs font-medium rounded-lg transition-colors
                  ${clientMode === 'new'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 dark:bg-dark-hover text-slate-600 dark:text-slate-300'
                  }
                `}
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Nouveau
              </button>
            </div>
          </div>

          {clientMode === 'select' ? (
            <ClientAutocomplete
              clients={clients}
              selectedClientId={selectedClientId}
              onSelect={handleClientSelect}
              formData={formData}
              onCreateNew={(name) => {
                setClientMode('new');
                setSelectedClientId('');
                setFormData(prev => ({ ...prev, clientName: name, clientEmail: '', clientPhone: '', clientCompany: '' }));
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nom du client"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="Nom complet ou société"
                  required
                />

                <Input
                  label="Société"
                  name="clientCompany"
                  value={formData.clientCompany}
                  onChange={handleChange}
                  placeholder="Optionnel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Email"
                    name="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={handleChange}
                    placeholder="client@email.com"
                  />
                  {emailError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{emailError}</p>
                  )}
                </div>

                <Input
                  label="Téléphone"
                  name="clientPhone"
                  value={formData.clientPhone}
                  onChange={handleChange}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-dark-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => { toggleNewProjectModal(); resetForm(); }}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={!formData.name || !formData.clientName}
          >
            Créer le projet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
