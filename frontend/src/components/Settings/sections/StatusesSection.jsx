import React, { useState, useEffect } from 'react';
import { List, Plus, Trash2, GripVertical } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { useProjectStore } from '../../../stores/projectStore';
import { statusesApi } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#6B7280', '#78716C', '#57534E'
];

function SortableStatusItem({ status, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: status._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-dark-bg rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>
      <div
        className="w-6 h-6 rounded-full border-2 border-white dark:border-dark-card shadow-sm"
        style={{ backgroundColor: status.color }}
      />
      <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">
        {status.name}
      </span>
      {status.isDefault && (
        <span className="text-xs text-slate-400">Par défaut</span>
      )}
      <button
        onClick={() => onDelete(status._id)}
        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function StatusesSection() {
  const { statuses, fetchStatuses } = useProjectStore();
  const { addToast } = useToastStore();
  const [newStatus, setNewStatus] = useState({ name: '', color: '#6B7280' });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = statuses.findIndex((s) => s._id === active.id);
      const newIndex = statuses.findIndex((s) => s._id === over.id);

      const reordered = arrayMove(statuses, oldIndex, newIndex);
      const statusIds = reordered.map((s) => s._id);

      try {
        await statusesApi.reorder(statusIds);
        await fetchStatuses();
        addToast({ type: 'success', message: 'Ordre des statuts mis à jour' });
      } catch (error) {
        addToast({ type: 'error', message: 'Erreur lors de la réorganisation' });
      }
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatus.name.trim()) {
      addToast({ type: 'error', message: 'Le nom du statut est requis' });
      return;
    }

    setCreating(true);
    try {
      await statusesApi.create(newStatus);
      await fetchStatuses();
      setNewStatus({ name: '', color: '#6B7280' });
      addToast({ type: 'success', message: 'Statut créé avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la création du statut' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStatus = (id) => {
    const status = statuses.find((s) => s._id === id);
    if (status?.isDefault) {
      addToast({ type: 'error', message: 'Impossible de supprimer le statut par défaut' });
      return;
    }
    setDeleteTarget(status);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await statusesApi.delete(deleteTarget._id);
      await fetchStatuses();
      addToast({ type: 'success', message: 'Statut supprimé avec succès' });
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de la suppression du statut' });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <List className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Statuts</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Gérez les statuts de vos projets. Glissez-déposez pour réorganiser.
      </p>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6 mb-6">
        <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-4">
          Nouveau statut
        </h3>

        <div className="space-y-4">
          <Input
            label="Nom du statut"
            value={newStatus.name}
            onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
            placeholder="Ex: En cours, Terminé..."
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Couleur
            </label>
            <div className="grid grid-cols-10 gap-2 mb-3">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewStatus({ ...newStatus, color })}
                  className={`
                    w-8 h-8 rounded-full transition-transform hover:scale-110
                    ${newStatus.color === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-dark-bg' : ''}
                  `}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={newStatus.color}
                onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                placeholder="#6B7280"
              />
              <div
                className="w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-dark-border flex-shrink-0"
                style={{ backgroundColor: newStatus.color }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleCreateStatus}
              icon={Plus}
              loading={creating}
              disabled={creating || !newStatus.name.trim()}
            >
              Ajouter le statut
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-6">
        <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-4">
          Statuts existants
        </h3>

        {statuses.length === 0 ? (
          <div className="text-center py-8">
            <List className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              Aucun statut défini. Créez-en un pour commencer.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={statuses.map((s) => s._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {statuses.map((status) => (
                  <SortableStatusItem
                    key={status._id}
                    status={status}
                    onDelete={handleDeleteStatus}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Les statuts définissent l'état d'avancement de vos projets. Vous pouvez les réorganiser
          en les glissant-déposant pour modifier leur ordre d'affichage.
        </p>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le statut"
        message={`Êtes-vous sûr de vouloir supprimer le statut "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
