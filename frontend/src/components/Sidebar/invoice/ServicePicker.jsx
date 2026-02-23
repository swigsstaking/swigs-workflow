import { useState, useEffect, useRef } from 'react';
import { Package, ChevronDown } from 'lucide-react';
import { servicesApi } from '../../../services/api';

const CATEGORIES = {
  development: { label: 'Développement', color: 'bg-blue-500' },
  design: { label: 'Design', color: 'bg-purple-500' },
  maintenance: { label: 'Maintenance', color: 'bg-green-500' },
  hosting: { label: 'Hébergement', color: 'bg-orange-500' },
  consulting: { label: 'Consulting', color: 'bg-yellow-500' },
  other: { label: 'Autre', color: 'bg-gray-500' }
};

export default function ServicePicker({ onSelectService, className = '' }) {
  const [services, setServices] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    servicesApi.getAll({ active: true })
      .then(({ data }) => setServices(data.data.filter(s => s.isActive)))
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  if (services.length === 0) return null;

  const servicesByCategory = services.reduce((acc, service) => {
    const cat = service.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const handleSelect = (service) => {
    onSelectService(service);
    setShowPicker(false);
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-4 py-2.5 w-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
      >
        <Package className="w-4 h-4" />
        <span>Ajouter depuis mes services</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {showPicker && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border max-h-80 overflow-y-auto">
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <div className="px-3 py-2 bg-slate-50 dark:bg-dark-bg sticky top-0">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${CATEGORIES[category]?.color || 'bg-gray-500'}`}>
                  {CATEGORIES[category]?.label || category}
                </span>
              </div>
              {categoryServices.map(service => (
                <button
                  key={service._id}
                  type="button"
                  onClick={() => handleSelect(service)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-dark-hover flex items-center justify-between border-b border-slate-100 dark:border-dark-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{service.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {service.unitPrice.toLocaleString('fr-CH')} CHF
                    {service.priceType === 'hourly' && '/h'}
                    {service.priceType === 'monthly' && '/mois'}
                    {service.priceType === 'yearly' && '/an'}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
