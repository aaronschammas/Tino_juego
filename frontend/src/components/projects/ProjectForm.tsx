'use client';

import { useEffect, useState } from 'react';
import { Project, CreateProjectDto, Priority } from '@/types/project';
import { translateErrorMessage } from '@/lib/errorMessages';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

import Portal from '@/components/ui/Portal';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: CreateProjectDto) => Promise<void>;
  onCancel: () => void;
}

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export default function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dueDate: '',
    priority: Priority.MEDIUM,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        dueDate: project.dueDate ? project.dueDate.split('T')[0] : '',
        priority: project.priority,
      });
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data: CreateProjectDto = {
        name: formData.name,
        priority: formData.priority,
      };

      if (formData.description) data.description = formData.description;
      if (formData.dueDate) data.dueDate = new Date(formData.dueDate).toISOString();

      await onSubmit(data);
    } catch (err) {
      const message = translateErrorMessage(
        err instanceof Error ? err.message : undefined,
        'Error al guardar proyecto',
      );
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]">
        <Card onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-0 shadow-[var(--shadow-lg)] animate-page-enter">
          <div className="border-b border-[var(--color-border)] px-6 py-5 bg-[var(--color-surface-2)]/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="app-caption uppercase tracking-wider font-semibold">Proyecto</p>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                  {project ? 'Editar proyecto' : 'Nuevo proyecto'}
                </h2>
              </div>
              <button
                onClick={onCancel}
                aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
            <div>
              <label htmlFor="name" className="app-label">
                Nombre <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="app-input"
                placeholder="Ej. Rediseño del portal"
              />
            </div>

            <div>
              <label htmlFor="description" className="app-label">
                Descripcion
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="app-textarea"
                placeholder="Resume el objetivo y el alcance del proyecto."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="priority" className="app-label">
                  Prioridad
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                  className="app-select"
                >
                  <option value="LOW">{priorityLabels.LOW}</option>
                  <option value="MEDIUM">{priorityLabels.MEDIUM}</option>
                  <option value="HIGH">{priorityLabels.HIGH}</option>
                  <option value="CRITICAL">{priorityLabels.CRITICAL}</option>
                </select>
              </div>

              <div>
                <label htmlFor="dueDate" className="app-label">
                  Vencimiento
                </label>
                <input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="app-input"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-3 text-xs text-[var(--color-danger)] font-medium">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row sm:justify-end">
              <Button type="button" onClick={onCancel} variant="secondary">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : project ? 'Actualizar proyecto' : 'Crear proyecto'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Portal>
  );
}
