import { Building2, Receipt, Palette, Users, Package, Tag, Server, Mail, Bell, Link2, Landmark } from 'lucide-react';

const settingsNav = [
  {
    category: 'Général',
    items: [
      { id: 'company', label: 'Entreprise', icon: Building2 },
      { id: 'invoicing', label: 'Facturation', icon: Receipt },
      { id: 'personalization', label: 'Personnalisation', icon: Palette },
    ]
  },
  {
    category: 'Données',
    items: [
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'services', label: 'Services', icon: Package },
      { id: 'statuses', label: 'Statuts', icon: Tag },
    ]
  },
  {
    category: 'Communication',
    items: [
      { id: 'smtp', label: 'SMTP', icon: Server },
      { id: 'emails', label: 'Templates email', icon: Mail },
      { id: 'reminders', label: 'Relances', icon: Bell },
    ]
  },
  {
    category: 'Intégrations',
    items: [
      { id: 'abaninja', label: 'AbaNinja', icon: Link2 },
      { id: 'cms', label: 'CMS E-commerce', icon: Link2 },
      { id: 'bank', label: 'Import bancaire', icon: Landmark },
    ]
  }
];

export default function SettingsNav({ activeSection, onSectionChange }) {
  const allItems = settingsNav.flatMap(category => category.items);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:block space-y-6">
        {settingsNav.map((category, idx) => (
          <div key={idx}>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">
              {category.category}
            </h3>
            <div className="space-y-1">
              {category.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <select
          value={activeSection}
          onChange={(e) => onSectionChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-dark-bg border border-slate-300 dark:border-dark-border rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {settingsNav.map((category, idx) => (
            <optgroup key={idx} label={category.category}>
              {category.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  );
}
