import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Clock, User, FileText, CheckSquare, Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';

export default function BlockDetailModal({ isOpen, block, onClose, onUpdate, onDelete }) {
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (block) {
      setNotes(block.notes || '');
      setTasks(block.tasks || []);
    }
  }, [block]);

  if (!isOpen || !block) return null;

  const startDate = new Date(block.start);
  const endDate = new Date(block.end);
  const projectName = block.project?.name || 'Projet';
  const clientName = block.project?.client?.name || '';
  const statusColor = block.project?.status?.color || '#6B7280';
  const statusName = block.project?.status?.name || 'Statut';

  const handleSave = async () => {
    await onUpdate(block._id, { notes, tasks });
    setIsEditing(false);
  };

  const handleAddTask = () => {
    if (newTask.trim()) {
      const updatedTasks = [...tasks, { id: Date.now(), text: newTask.trim(), completed: false }];
      setTasks(updatedTasks);
      setNewTask('');
      onUpdate(block._id, { tasks: updatedTasks });
    }
  };

  const handleToggleTask = (taskId) => {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updatedTasks);
    onUpdate(block._id, { tasks: updatedTasks });
  };

  const handleDeleteTask = (taskId) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    onUpdate(block._id, { tasks: updatedTasks });
  };

  const handleDelete = () => {
    onDelete(block._id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-dark-card rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with project color */}
        <div
          className="px-6 py-4 border-b border-slate-200 dark:border-dark-border"
          style={{ backgroundColor: `${statusColor}15` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3
                className="text-lg font-semibold truncate"
                style={{ color: statusColor }}
              >
                {projectName}
              </h3>
              {clientName && (
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5" />
                  {clientName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-dark-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Time info */}
          <div className="flex items-center gap-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{format(startDate, "EEEE d MMMM", { locale: fr })}</span>
            </div>
            <span className="font-medium">
              {format(startDate, 'HH:mm', { locale: fr })} - {format(endDate, 'HH:mm', { locale: fr })}
            </span>
          </div>

          {/* Status badge */}
          <div className="mt-3">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {statusName}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notes section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</h4>
            </div>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setIsEditing(true);
              }}
              placeholder="Ajouter des notes pour ce bloc..."
              className="w-full h-24 px-3 py-2 text-sm border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Tasks section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tâches ({tasks.filter(t => t.completed).length}/{tasks.length})
              </h4>
            </div>

            {/* Task list */}
            <div className="space-y-2 mb-3">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 group"
                >
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                      ${task.completed
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-primary-500'
                      }
                    `}
                  >
                    {task.completed && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm ${task.completed
                      ? 'text-slate-400 line-through'
                      : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {task.text}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add task input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Ajouter une tâche..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddTask}
                disabled={!newTask.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg">
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Fermer
            </Button>
            {isEditing && (
              <Button
                variant="primary"
                onClick={handleSave}
              >
                Enregistrer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
