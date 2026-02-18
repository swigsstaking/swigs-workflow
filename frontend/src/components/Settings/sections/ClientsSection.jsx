import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import Button from '../../ui/Button';
import Input, { Textarea } from '../../ui/Input';
import { clientsApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';

export default function ClientsSection() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState(null);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: ''
  });
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data } = await clientsApi.getAll();
      setClients(data.data);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du chargement des clients' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) {
      addToast({ type: 'error', message: 'Le nom du client est requis' });
      return;
    }

    setSaving(true);
    try {
      await clientsApi.create(newClient);
      await loadClients();
      setNewClient({ name: '', email: '', phone: '', company: '', address: '' });
      setShowNewClientForm(false);
      addToast({ type: 'success', message: 'Client créé avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la création du client' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClient = async (id) => {
    if (!editingClient.name.trim()) {
      addToast({ type: 'error', message: 'Le nom du client est requis' });
      return;
    }

    setSaving(true);
    try {
      await clientsApi.update(id, editingClient);
      await loadClients();
      setEditingClient(null);
      addToast({ type: 'success', message: 'Client mis à jour avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la mise à jour du client' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      return;
    }

    try {
      await clientsApi.delete(id);
      await loadClients();
      addToast({ type: 'success', message: 'Client supprimé avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression du client' });
    }
  };

  const startEdit = (client) => {
    setEditingClient({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Clients</h2>
        </div>
        <Button
          onClick={() => setShowNewClientForm(!showNewClientForm)}
          icon={showNewClientForm ? X : Plus}
          variant={showNewClientForm ? 'secondary' : 'primary'}
        >
          {showNewClientForm ? 'Annuler' : 'Nouveau client'}
        </Button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Gérez vos clients pour les assigner à des projets.
      </p>

      {showNewClientForm && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6 mb-6">
          <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-4">
            Nouveau client
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Nom"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder="Nom du client"
              required
            />
            <Input
              label="Société"
              value={newClient.company}
              onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
              placeholder="Nom de la société"
            />
            <Input
              label="Email"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              placeholder="client@example.com"
            />
            <Input
              label="Téléphone"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              placeholder="+41 22 123 45 67"
            />
          </div>
          <div className="mb-4">
            <Textarea
              label="Adresse"
              value={newClient.address}
              onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
              placeholder="Rue de la Poste 1, 1200 Genève"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowNewClientForm(false);
                setNewClient({ name: '', email: '', phone: '', company: '', address: '' });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateClient}
              icon={Save}
              loading={saving}
              disabled={saving || !newClient.name.trim()}
            >
              Créer le client
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {clients.length === 0 ? (
          <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              Aucun client enregistré. Créez-en un pour commencer.
            </p>
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client._id}
              className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6"
            >
              {editingClient && editingClient._id === client._id ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Nom"
                      value={editingClient.name}
                      onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                      placeholder="Nom du client"
                      required
                    />
                    <Input
                      label="Société"
                      value={editingClient.company}
                      onChange={(e) => setEditingClient({ ...editingClient, company: e.target.value })}
                      placeholder="Nom de la société"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={editingClient.email}
                      onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                      placeholder="client@example.com"
                    />
                    <Input
                      label="Téléphone"
                      value={editingClient.phone}
                      onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                      placeholder="+41 22 123 45 67"
                    />
                  </div>
                  <div className="mb-4">
                    <Textarea
                      label="Adresse"
                      value={editingClient.address}
                      onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                      placeholder="Rue de la Poste 1, 1200 Genève"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setEditingClient(null)}
                      icon={X}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={() => handleUpdateClient(client._id)}
                      icon={Save}
                      loading={saving}
                      disabled={saving || !editingClient.name.trim()}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                        {client.name}
                      </h3>
                      {client.company && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {client.company}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingClient({ ...client, _id: client._id });
                        }}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {client.email && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Email:</span>{' '}
                        <span className="text-slate-700 dark:text-slate-200">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Téléphone:</span>{' '}
                        <span className="text-slate-700 dark:text-slate-200">{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="md:col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">Adresse:</span>{' '}
                        <span className="text-slate-700 dark:text-slate-200">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
