import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, ChevronDown, Search, X } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);
  const searchRef = useRef(null);

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

  // Focus search when picker opens
  useEffect(() => {
    if (showPicker && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showPicker]);

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      (CATEGORIES[s.category]?.label || '').toLowerCase().includes(q)
    );
  }, [services, search]);

  if (services.length === 0) return null;

  const servicesByCategory = filteredServices.reduce((acc, service) => {
    const cat = service.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const handleSelect = (service) => {
    onSelectService(service);
    setShowPicker(false);
    setSearch('');
  };

  const handleToggle = () => {
    setShowPicker(!showPicker);
    if (showPicker) setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-4 py-2.5 w-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
      >
        <Package className="w-4 h-4" />
        <span>Ajouter depuis mes services</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {showPicker && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border max-h-80 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-dark-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un service..."
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-dark-border text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto">
            {filteredServices.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                Aucun service trouvé
              </div>
            ) : (
              Object.entries(servicesByCategory).map(([category, categoryServices]) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
