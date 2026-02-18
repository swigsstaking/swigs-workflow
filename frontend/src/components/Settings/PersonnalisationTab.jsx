import { Square, RectangleHorizontal, Maximize2, User } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

const cardStyles = [
  {
    id: 'left-border',
    label: 'Style actuel',
    description: 'Bordure gauche colorée'
  },
  {
    id: 'full-border',
    label: 'Bordure complète',
    description: 'Bordure tout autour'
  }
];

const cardSizes = [
  { id: 'small', label: 'Petit', icon: Square },
  { id: 'medium', label: 'Moyen', icon: RectangleHorizontal },
  { id: 'large', label: 'Grand', icon: Maximize2 }
];

function CardPreview({ style, size }) {
  const sizeClasses = {
    small: 'p-2 text-xs',
    medium: 'p-3 text-sm',
    large: 'p-4 text-base'
  };

  const styleVariants = {
    'left-border': {
      className: 'border border-slate-200 dark:border-dark-border',
      style: { borderLeftColor: '#3B82F6', borderLeftWidth: '4px' }
    },
    'full-border': {
      className: '',
      style: { border: '2px solid #3B82F6' }
    }
  };

  const currentStyle = styleVariants[style] || styleVariants['left-border'];

  return (
    <div
      className={`
        bg-white dark:bg-dark-card rounded-lg shadow-sm
        ${currentStyle.className}
        ${sizeClasses[size] || sizeClasses.medium}
      `}
      style={currentStyle.style}
    >
      <div className="font-semibold text-slate-900 dark:text-white truncate">
        Exemple projet
      </div>
      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mt-1">
        <User className="w-3 h-3" />
        <span className="truncate">Client exemple</span>
      </div>
      <div className="mt-2">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}
        >
          En cours
        </span>
      </div>
    </div>
  );
}

export default function PersonnalisationTab() {
  const { personalization, updatePersonalization } = useSettingsStore();

  // Use settingsStore personalization (persisted in localStorage)
  const currentStyle = personalization?.cardStyle || 'left-border';
  const currentSize = personalization?.cardSize || 'medium';

  const handleStyleChange = (styleId) => {
    updatePersonalization({ cardStyle: styleId });
  };

  const handleSizeChange = (sizeId) => {
    updatePersonalization({ cardSize: sizeId });
  };

  return (
    <div className="space-y-8">
      {/* Card Style Selection */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Style des cartes
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Choisissez l'apparence des cartes de projet dans le workflow.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {cardStyles.map(style => (
            <button
              key={style.id}
              onClick={() => handleStyleChange(style.id)}
              className={`
                p-4 rounded-xl border-2 text-left transition-all
                ${currentStyle === style.id
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-dark-hover'
                }
              `}
            >
              <div className="font-medium text-slate-900 dark:text-white mb-1">
                {style.label}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {style.description}
              </div>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-6">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">
            Apercu
          </p>
          <div className="max-w-[200px]">
            <CardPreview style={currentStyle} size={currentSize} />
          </div>
        </div>
      </div>

      {/* Card Size Selection */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Taille des cartes
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Ajustez la taille des cartes selon vos preferences.
        </p>

        <div className="flex gap-4">
          {cardSizes.map(size => {
            const Icon = size.icon;
            return (
              <button
                key={size.id}
                onClick={() => handleSizeChange(size.id)}
                className={`
                  flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                  ${currentSize === size.id
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-dark-hover'
                  }
                `}
              >
                <Icon className={`
                  ${currentSize === size.id ? 'text-primary-600' : 'text-slate-400 dark:text-slate-500'}
                  ${size.id === 'small' ? 'w-6 h-6' : size.id === 'medium' ? 'w-8 h-8' : 'w-10 h-10'}
                `} />
                <span className={`
                  text-sm font-medium
                  ${currentSize === size.id ? 'text-primary-600' : 'text-slate-600 dark:text-slate-400'}
                `}>
                  {size.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info about drag and drop */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Repositionnement des cartes
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Maintenez un clic long sur une carte dans le workflow pour la deplacer.
          Les positions sont sauvegardees automatiquement.
        </p>
      </div>
    </div>
  );
}
