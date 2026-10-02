'use client';

import { useState, useEffect } from 'react';
import { CreateTaskDto, getTaskStatusOptions, Task, TaskStatus, taskStatusLabels } from '@/types/task';
import { Priority } from '@/types/project';
import { apiGet } from '@/lib/api';
import { translateErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth';
import Button from '@/components/ui/Button';
import { MAX_TASK_HOURS, MAX_TASK_MINUTES, parseTaskDuration, TASK_DURATION_ERROR } from '@/lib/taskDuration';

import Portal from '@/components/ui/Portal';

interface TaskFormProps {
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
  task?: Task;
  parentTaskId?: string;
  parentTaskTitle?: string;
  canFullyEdit?: boolean;
  onSubmit: (data: CreateTaskDto, selectedProjectId: string) => Promise<void>;
  onCancel: () => void;
}

const priorityLabels = {
  [Priority.LOW]: 'Baja',
  [Priority.MEDIUM]: 'Media',
  [Priority.HIGH]: 'Alta',
  [Priority.CRITICAL]: 'Critica',
};

export default function TaskForm({
  projectId: initialProjectId,
  projects = [],
  task,
  parentTaskId,
  parentTaskTitle,
  canFullyEdit,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [projectMembers, setProjectMembers] = useState<
    Array<{ user: { id: string; name: string; lastname: string; email: string } }>
  >([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: '',
    assignedToId: '',
  });
  const [estHours, setEstHours] = useState('0');
  const [estMinutes, setEstMinutes] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const statusOptions = getTaskStatusOptions(task?.status);
  const hasSubTasks = (task?.subTasks?.length ?? 0) > 0;

  const { user, activeMembership } = useAuth();
  // Members editing an existing task can only change its status, or take it
  // when unassigned (backend: canEditTaskDetailed in permissions.ts). Sending
  // any other field - even unchanged - trips that guard, so beyond disabling
  // the inputs we also scope the submitted payload down below.
  const hasFullEditPermission =
    canFullyEdit ?? (isAdmin(user) || activeMembership?.role === 'ORG_OWNER');
  const isRestrictedMember = Boolean(task) && !hasFullEditPermission;
  const canReassign = !isRestrictedMember || !task?.assignedToId;
  const isTakingTask = isRestrictedMember && formData.assignedToId === user?.id;

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        assignedToId: task.assignedToId || '',
      });
      if (task.estimatedHours !== undefined && task.estimatedHours !== null) {
        const totalMinutes = Math.round(task.estimatedHours * 60);
        setEstHours(Math.floor(totalMinutes / 60).toString());
        setEstMinutes((totalMinutes % 60).toString());
      } else {
        setEstHours('0');
        setEstMinutes('0');
      }
    }
  }, [task]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const members = await apiGet<
          Array<{ user: { id: string; name: string; lastname: string; email: string } }>
        >(`/projects/${selectedProjectId}/members`);
        setProjectMembers(members);
      } catch {
        setProjectMembers([]);
      }
    };

    if (selectedProjectId) {
      fetchMembers();
    } else {
      setProjectMembers([]);
    }
  }, [selectedProjectId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!selectedProjectId) {
        throw new Error('Debes seleccionar un proyecto');
      }

      let data: CreateTaskDto;

      if (isRestrictedMember) {
        // Only send what a member is allowed to change: the status, and the
        // assignee only when taking an unassigned task for themselves.
        const restrictedData: Partial<CreateTaskDto> = { status: formData.status };
        if (canReassign && isTakingTask && user?.id) {
          restrictedData.assignedToId = user.id;
        }
        data = restrictedData as CreateTaskDto;
      } else {
        data = {
          title: formData.title,
          status: formData.status,
          priority: formData.priority,
        };

        if (formData.description) data.description = formData.description;
        if (formData.dueDate) data.dueDate = new Date(formData.dueDate).toISOString();
        if (formData.assignedToId) data.assignedToId = formData.assignedToId;
        if (!task && parentTaskId) data.parentTaskId = parentTaskId;

        if (!hasSubTasks) {
          const totalMinutes = parseTaskDuration(estHours, estMinutes);
          if (totalMinutes === null) throw new Error(TASK_DURATION_ERROR);
          if (totalMinutes > 0) {
            data.estimatedHours = totalMinutes / 60;
          }
        }
      }

      await onSubmit(data, selectedProjectId);
    } catch (submitError: unknown) {
      setError(
        translateErrorMessage(
          submitError instanceof Error ? submitError.message : undefined,
          'Error al guardar tarea',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary)]/40 p-4 backdrop-blur-[2px]">
        <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] animate-page-enter">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-subtle)]">
                {parentTaskTitle ? 'Subtarea' : hasSubTasks ? 'Tarea padre' : 'Tarea'}
              </p>
              <h2 className="text-2xl font-bold text-[var(--color-text)]">
                {task ? 'Editar tarea' : parentTaskTitle ? 'Nueva subtarea' : 'Nueva tarea'}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRestrictedMember && (
              <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Como miembro, solo podés cambiar el estado{canReassign ? ' o tomar la tarea' : ''}. El resto de los campos está deshabilitado.
              </div>
            )}
            {!initialProjectId && projects.length > 0 && (
              <div>
                <label htmlFor="projectId" className="app-label">
                  Proyecto <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  id="projectId"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                  className="app-select"
                >
                  <option value="">Selecciona un proyecto...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="title" className="app-label">
                Nombre <span className="text-[var(--color-danger)]">*</span>
              </label>
              {parentTaskTitle ? (
                <p className="mb-2 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-medium text-[var(--color-text-subtle)]">
                  Pertenece a: <span className="font-semibold text-[var(--color-text)]">{parentTaskTitle}</span>
                </p>
              ) : null}
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                required
                disabled={isRestrictedMember}
                className="app-input disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Ej: Diseñar wireframes"
              />
            </div>

            <div>
              <label htmlFor="description" className="app-label">
                Descripcion
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                disabled={isRestrictedMember}
                className="app-textarea disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Agrega contexto breve..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="status" className="app-label">
                  Estado
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(event) =>
                    setFormData({ ...formData, status: event.target.value as TaskStatus })
                  }
                  className="app-select"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {taskStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="app-label">
                  Prioridad
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(event) =>
                    setFormData({ ...formData, priority: event.target.value as Priority })
                  }
                  disabled={isRestrictedMember}
                  className="app-select disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {Object.entries(priorityLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="dueDate" className="app-label">
                  Vencimiento
                </label>
                <input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
                  disabled={isRestrictedMember}
                  className="app-input disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label className="app-label">
                  Estimacion (HH:mm)
                </label>
                {hasSubTasks ? (
                  <p className="rounded-[var(--radius-md)] border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                    Las horas se calculan desde las subtareas.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max={MAX_TASK_HOURS}
                        step="1"
                        value={estHours}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEstHours(Math.min(val, MAX_TASK_HOURS).toString());
                        }}
                        disabled={isRestrictedMember}
                        className="app-input text-center font-mono disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="HH"
                      />
                      <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-400 font-bold uppercase">HRS</span>
                    </div>
                    <span className="text-xl font-bold text-gray-300">:</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max={MAX_TASK_MINUTES}
                        step="1"
                        value={estMinutes}
                        onChange={(e) => setEstMinutes(e.target.value)}
                        disabled={isRestrictedMember}
                        className="app-input text-center font-mono disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="MM"
                      />
                      <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-400 font-bold uppercase">MIN</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="assignedToId" className="app-label">
                Responsable
              </label>
              {isRestrictedMember && canReassign ? (
                <Button
                  type="button"
                  variant={isTakingTask ? 'secondary' : 'primary'}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      assignedToId: isTakingTask ? '' : (user?.id ?? ''),
                    })
                  }
                  disabled={!user?.id}
                  fullWidth
                >
                  {isTakingTask ? 'No tomar tarea' : 'Tomar tarea'}
                </Button>
              ) : (
                <select
                  id="assignedToId"
                  value={formData.assignedToId}
                  onChange={(event) => setFormData({ ...formData, assignedToId: event.target.value })}
                  disabled={!canReassign}
                  className="app-select disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Sin asignar</option>
                  {projectMembers.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name} {member.user.lastname}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-3 text-xs text-[var(--color-danger)] font-medium">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3 border-t border-[var(--color-border)] pt-5 mt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                fullWidth
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Guardando...' : task ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
