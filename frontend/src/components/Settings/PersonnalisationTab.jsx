import { Square, RectangleHorizontal, Maximize2, User, LayoutGrid, List } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const cardStyles = [
  {
    id: 'left-border',
    label: 'Bordure gauche',
    description: 'Bordure gauche colorée'
  },
  {
    id: 'full-border',
    label: 'Bordure complète',
    description: 'Bordure tout autour'
  },
  {
    id: 'top-gradient',
    label: 'Gradient haut',
    description: 'Barre dégradée en haut'
  }
];

const cardSizes = [
  { id: 'small', label: 'Petit', icon: Square },
  { id: 'medium', label: 'Moyen', icon: RectangleHorizontal },
  { id: 'large', label: 'Grand', icon: Maximize2 }
];

const viewModes = [
  {
    id: 'grid',
    label: 'Grille',
    description: 'Cartes en grille responsive',
    icon: LayoutGrid
  },
  {
    id: 'list',
    label: 'Liste',
    description: 'Lignes avec colonnes d\'info',
    icon: List
  }
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
    },
    'top-gradient': {
      className: 'border border-slate-200 dark:border-dark-border relative overflow-hidden',
      style: {}
    }
  };

  const currentStyle = styleVariants[style] || styleVariants['left-border'];

  return (
    <div
      className={`
        bg-white dark:bg-dark-card rounded-lg shadow-sm group/preview
        ${currentStyle.className}
        ${sizeClasses[size] || sizeClasses.medium}
      `}
      style={currentStyle.style}
    >
      {style === 'top-gradient' && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg transition-all duration-500 group-hover/preview:h-[4px]"
          style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #3B82F688 60%, transparent 100%)' }}
        />
      )}
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

function ViewModePreview({ mode, style }) {
  if (mode === 'grid') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <CardPreview key={i} style={style} size="small" />
        ))}
      </div>
    );
  }

  if (mode === 'list') {
    return (
      <div className="flex flex-col gap-1">
        {[
          { name: 'Site e-commerce', amount: 'CHF 2\'400', status: 'En cours' },
          { name: 'App mobile', amount: 'CHF 800', status: 'En attente' },
          { name: 'Refonte logo', amount: 'CHF 350', status: 'Terminé' }
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-white dark:bg-dark-card rounded-lg px-3 py-2 border border-slate-200 dark:border-dark-border shadow-sm"
            style={style === 'left-border' ? { borderLeftColor: '#3B82F6', borderLeftWidth: '4px' } : {}}
          >
            <span className="text-xs font-medium text-slate-900 dark:text-white">{item.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{item.amount}</span>
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // compact
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[1, 2, 3, 4].map(i => (
        <CardPreview key={i} style={style} size="small" />
      ))}
    </div>
  );
}

export default function PersonnalisationTab() {
  const { cardStyle, cardSize, viewMode, setCardStyle, setCardSize, setViewMode } = useUIStore();

  const currentStyle = cardStyle || 'left-border';
  const currentSize = cardSize || 'medium';
  const currentViewMode = viewMode || 'grid';

  return (
    <div className="space-y-8">
      {/* View Mode Selection */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Mode d'affichage
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Choisissez comment les projets sont affichés dans le workflow.
        </p>

        <div className="flex gap-4 mb-6">
          {viewModes.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`
                  flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                  ${currentViewMode === mode.id
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-dark-hover'
                  }
                `}
              >
                <Icon className={`w-7 h-7 ${
                  currentViewMode === mode.id ? 'text-primary-600' : 'text-slate-400 dark:text-slate-500'
                }`} />
                <div className="text-center">
                  <div className={`text-sm font-medium ${
                    currentViewMode === mode.id ? 'text-primary-600' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {mode.label}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {mode.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview */}
        <div className="bg-slate-50 dark:bg-dark-bg rounded-lg p-6">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">
            Aperçu
          </p>
          <ViewModePreview mode={currentViewMode} style={currentStyle} />
        </div>
      </div>

      {/* Card Style Selection */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Style des cartes
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Choisissez l'apparence des cartes de projet dans le workflow.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {cardStyles.map(style => (
            <button
              key={style.id}
              onClick={() => setCardStyle(style.id)}
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
            Aperçu
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
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Ajustez la taille des cartes selon vos préférences.
        </p>
        {currentViewMode === 'list' && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-4">
            La taille des cartes ne s'applique pas au mode liste.
          </p>
        )}

        <div className="flex gap-4">
          {cardSizes.map(size => {
            const Icon = size.icon;
            return (
              <button
                key={size.id}
                onClick={() => setCardSize(size.id)}
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
          Maintenez un clic long sur une carte dans le workflow pour la déplacer.
          Les positions sont sauvegardées automatiquement.
        </p>
      </div>
    </div>
  );
}
