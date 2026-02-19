import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, Clock, Calendar, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import { servicesApi } from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToastStore } from '../../stores/toastStore';

const CATEGORIES = [
  { value: 'development', label: 'Développement', color: 'bg-blue-500' },
  { value: 'design', label: 'Design', color: 'bg-purple-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-green-500' },
  { value: 'hosting', label: 'Hébergement', color: 'bg-orange-500' },
  { value: 'consulting', label: 'Consulting', color: 'bg-yellow-500' },
  { value: 'other', label: 'Autre', color: 'bg-gray-500' }
];

const PRICE_TYPES = [
  { value: 'fixed', label: 'Prix fixe', icon: DollarSign },
  { value: 'hourly', label: 'Taux horaire', icon: Clock },
  { value: 'monthly', label: 'Mensuel', icon: Calendar },
  { value: 'yearly', label: 'Annuel', icon: Calendar }
];

const ServiceModal = ({ isOpen, onClose, service, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    priceType: 'fixed',
    unitPrice: '',
    estimatedHours: '',
    defaultQuantity: 1
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        category: service.category || 'other',
        priceType: service.priceType || 'fixed',
        unitPrice: service.unitPrice?.toString() || '',
        estimatedHours: service.estimatedHours?.toString() || '',
        defaultQuantity: service.defaultQuantity || 1
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'other',
        priceType: 'fixed',
        unitPrice: '',
        estimatedHours: '',
        defaultQuantity: 1
      });
    }
  }, [service, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        unitPrice: parseFloat(formData.unitPrice) || 0,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        defaultQuantity: parseInt(formData.defaultQuantity) || 1
      };

      if (service) {
        await servicesApi.update(service._id, data);
      } else {
        await servicesApi.create(data);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={service ? 'Modifier le service' : 'Nouveau service'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du service"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="ex: Création site web"
        />

        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description optionnelle"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Catégorie</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.category === cat.value
                    ? `${cat.color} text-white`
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type de tarification</label>
          <div className="grid grid-cols-2 gap-2">
            {PRICE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priceType: type.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.priceType === type.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={formData.priceType === 'hourly' ? 'Taux horaire (CHF)' : 'Prix unitaire (CHF)'}
            type="number"
            step="0.01"
            min="0"
            value={formData.unitPrice}
            onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
            required
            placeholder="0.00"
          />

          {formData.priceType === 'hourly' && (
            <Input
              label="Heures estimées"
              type="number"
              step="0.5"
              min="0"
              value={formData.estimatedHours}
              onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
              placeholder="ex: 40"
            />
          )}

          <Input
            label="Quantité par défaut"
            type="number"
            min="1"
            value={formData.defaultQuantity}
            onChange={(e) => setFormData({ ...formData, defaultQuantity: e.target.value })}
          />
        </div>

        {formData.priceType === 'hourly' && formData.unitPrice && formData.estimatedHours && (
          <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Estimation totale: <span className="text-slate-900 dark:text-white font-medium">
                {(parseFloat(formData.unitPrice) * parseFloat(formData.estimatedHours)).toLocaleString('fr-CH')} CHF
              </span>
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : service ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ServicesTab = () => {
  const { addToast } = useToastStore();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchServices = async () => {
    try {
      const { data } = await servicesApi.getAll();
      setServices(data.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleEdit = (service) => {
    setEditingService(service);
    setModalOpen(true);
  };

  const handleDelete = (service) => {
    setDeleteTarget(service);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await servicesApi.delete(deleteTarget._id);
      addToast({ type: 'success', message: 'Service supprimé' });
      fetchServices();
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggle = async (id) => {
    try {
      await servicesApi.toggle(id);
      fetchServices();
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const handleNewService = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  const filteredServices = filterCategory === 'all'
    ? services
    : services.filter(s => s.category === filterCategory);

  const getCategoryInfo = (category) => CATEGORIES.find(c => c.value === category) || CATEGORIES[5];
  const getPriceTypeInfo = (priceType) => PRICE_TYPES.find(p => p.value === priceType) || PRICE_TYPES[0];

  const formatPrice = (service) => {
    const price = service.unitPrice.toLocaleString('fr-CH');
    switch (service.priceType) {
      case 'hourly':
        return `${price} CHF/h`;
      case 'monthly':
        return `${price} CHF/mois`;
      case 'yearly':
        return `${price} CHF/an`;
      default:
        return `${price} CHF`;
    }
  };

  if (loading) {
    return <div className="text-slate-500 dark:text-slate-400 p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 dark:text-slate-400">
          Définissez vos services pour les ajouter rapidement aux devis.
        </p>
        <Button onClick={handleNewService} className="flex items-center gap-2">
          <Plus size={16} />
          Nouveau service
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filterCategory === 'all'
              ? 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white'
              : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Tous ({services.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = services.filter(s => s.category === cat.value).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterCategory === cat.value
                  ? `${cat.color} text-white`
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Services list */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>Aucun service défini</p>
          <p className="text-sm mt-1">Créez votre premier service pour commencer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service) => {
            const catInfo = getCategoryInfo(service.category);
            const priceInfo = getPriceTypeInfo(service.priceType);
            const PriceIcon = priceInfo.icon;

            return (
              <div
                key={service._id}
                className={`bg-white dark:bg-dark-card rounded-xl p-4 border border-slate-200 dark:border-dark-border ${
                  !service.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{service.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${catInfo.color} text-white`}>
                        {catInfo.label}
                      </span>
                      {!service.isActive && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                          Inactif
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{service.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <PriceIcon size={14} />
                        {formatPrice(service)}
                      </span>
                      {service.priceType === 'hourly' && service.estimatedHours && (
                        <span className="text-slate-500 dark:text-slate-400">
                          ~{service.estimatedHours}h estimées ({(service.unitPrice * service.estimatedHours).toLocaleString('fr-CH')} CHF)
                        </span>
                      )}
                      {service.defaultQuantity > 1 && (
                        <span className="text-slate-500 dark:text-slate-400">
                          Qté par défaut: {service.defaultQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(service._id)}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      title={service.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {service.isActive ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(service)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
        onSave={fetchServices}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le service"
        message={`Êtes-vous sûr de vouloir supprimer le service "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
};

export default ServicesTab;
