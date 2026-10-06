'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Priority } from '@/types/project';
import { allowedTaskStatusTransitions, Task, TaskStatus, taskStatusLabels } from '@/types/task';
import { formatDateUTC, secondsToHMS } from '@/lib/time';
import { Clock3, ListChecks, Trash2, UserCheck } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onTakeTask?: (taskId: string) => void;
  onTrackTime?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onCreateSubTask?: (task: Task) => void;
  canDelete?: boolean;
  activeTaskId?: string | null;
  isStatusUpdating?: boolean;
  isFirst?: boolean;
}

const statusActionConfig: Record<TaskStatus, Array<{ status: TaskStatus; label: string }>> = {
  [TaskStatus.TODO]: [
    { status: TaskStatus.IN_PROGRESS, label: 'Mover a En progreso' },
    { status: TaskStatus.BLOCKED,     label: 'Mover a Bloqueadas' },
    { status: TaskStatus.DONE,        label: 'Marcar como completada' },
  ],
  [TaskStatus.IN_PROGRESS]: [
    { status: TaskStatus.DONE,        label: 'Mover a Completadas' },
    { status: TaskStatus.BLOCKED,     label: 'Mover a Bloqueadas' },
    { status: TaskStatus.TODO,        label: 'Volver a Por hacer' },
  ],
  [TaskStatus.BLOCKED]: [
    { status: TaskStatus.IN_PROGRESS, label: 'Mover a En progreso' },
    { status: TaskStatus.DONE,        label: 'Marcar como completada' },
    { status: TaskStatus.TODO,        label: 'Volver a Por hacer' },
  ],
  [TaskStatus.DONE]: [
    { status: TaskStatus.IN_PROGRESS, label: 'Reabrir en En progreso' },
    { status: TaskStatus.BLOCKED,     label: 'Mover a Bloqueadas' },
    { status: TaskStatus.TODO,        label: 'Volver a Por hacer' },
  ],
};

/** Deja abierto un solo menú de estado a la vez: al abrir uno se cierran los de las otras tareas. */
function closeOtherStatusMenus(menu: HTMLDetailsElement) {
  if (!menu.open) return;
  menu.ownerDocument.querySelectorAll<HTMLDetailsElement>('details[data-status-menu][open]').forEach((other) => {
    if (other !== menu) other.open = false;
  });
}

/** Cierra el menú de estado después de elegir una opción. */
function closeStatusMenu(option: HTMLElement) {
  const menu = option.closest<HTMLDetailsElement>('details[data-status-menu]');
  if (menu) menu.open = false;
}

export default function TaskItem({
  task,
  onEdit,
  onStatusChange,
  onTakeTask,
  onTrackTime,
  onDelete,
  onCreateSubTask,
  canDelete,
  activeTaskId,
  isStatusUpdating = false,
  isFirst = false,
}: TaskItemProps) {
  const { user } = useAuth();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const priorityColors = {
    [Priority.LOW]: 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]',
    [Priority.MEDIUM]: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]',
    [Priority.HIGH]: 'bg-[var(--color-warning-100)] text-[var(--color-warning-700)]',
    [Priority.CRITICAL]: 'bg-[var(--color-danger-100)] text-[var(--color-danger-700)]',
  };

  const priorityBorderColors = {
    [Priority.LOW]: 'border-l-[var(--color-ink-300)]',
    [Priority.MEDIUM]: 'border-l-[var(--color-primary-500)]',
    [Priority.HIGH]: 'border-l-[var(--color-warning-500)]',
    [Priority.CRITICAL]: 'border-l-[var(--color-danger-500)]',
  };

  const priorityLabels = {
    [Priority.LOW]: 'Baja',
    [Priority.MEDIUM]: 'Media',
    [Priority.HIGH]: 'Alta',
    [Priority.CRITICAL]: 'Crítica',
  };

  const statusColors = {
    [TaskStatus.TODO]: 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]',
    [TaskStatus.IN_PROGRESS]: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]',
    [TaskStatus.BLOCKED]: 'bg-[var(--color-danger-100)] text-[var(--color-danger-700)]',
    [TaskStatus.DONE]: 'bg-[var(--color-success-100)] text-[var(--color-success-700)]',
  };

  const availableStatusActions = statusActionConfig[task.status].filter((action) =>
    allowedTaskStatusTransitions[task.status].includes(action.status),
  );

  const assignedLabel = task.assignedTo
    ? `${task.assignedTo.name} ${task.assignedTo.lastname}`.trim()
    : task.responsibles?.length
      ? task.responsibles
          .map((responsible) => `${responsible.name} ${responsible.lastname}`.trim())
          .join(', ')
    : 'Sin asignar';
  const assignedInitials = useMemo(() => {
    const person = task.assignedTo ?? task.responsibles?.[0];
    if (!person) return 'SA';
    const parts = [person.name, person.lastname]
      .filter(Boolean)
      .flatMap((value) => value.split(' '))
      .filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'US';
  }, [task.assignedTo, task.responsibles]);

  const estimatedHours = task.estimatedHours ?? 0;
  const actualHours = task.actualHours ?? 0;
  const hasEstimate = estimatedHours > 0;
  const isOverEstimate = hasEstimate && actualHours > estimatedHours;
  const isActiveTaskTimer = activeTaskId === task.id;
  const subTasks = task.subTasks || [];
  const hasSubTasks = subTasks.length > 0;
  const completedSubTasks = subTasks.filter((subTask) => subTask.status === TaskStatus.DONE).length;
  const isSubTask = Boolean(task.parentTaskId);
  const taskKindLabel = hasSubTasks ? 'Tarea padre' : isSubTask ? 'Subtarea' : 'Tarea';

  const dueDateLabel = task.dueDate
    ? formatDateUTC(task.dueDate, { day: '2-digit', month: 'short' })
    : null;

  return (
    <article
      draggable="true"
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
      onClick={() => onEdit(task)}
      className={`group relative flex flex-col rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md md:hover:-translate-y-0.5 cursor-pointer animate-card-enter has-[details[open]]:z-50 ${
        isLeaving ? 'animate-card-leave' : ''
      } ${
        isDragging
          ? 'opacity-40 border-dashed border-slate-300 shadow-none scale-[0.98]'
          : hasSubTasks
            ? `border-[rgba(15,23,42,0.12)] border-l-4 ${priorityBorderColors[task.priority]}`
            : 'border-[rgba(15,23,42,0.08)]'
      }`}
    >
      {/* Top section - Title & Avatar */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {taskKindLabel}
            </span>
            {hasSubTasks ? (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {completedSubTasks}/{subTasks.length} completadas
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-bold leading-snug text-[var(--color-ink-900)] break-words hover:text-[var(--color-primary-700)] transition-colors">
            {task.title}
          </h3>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--color-primary-100),rgba(255,255,255,0.92))] text-xs font-bold text-[var(--color-primary-700)]">
          {assignedInitials}
        </div>
      </div>

      {/* Tags section - Priority & Status */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-2">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${priorityColors[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusColors[task.status]}`}>
          {taskStatusLabels[task.status]}
        </span>
        {isActiveTaskTimer && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger-100)] text-[10px] animate-pulse">
            ⏱
          </span>
        )}
      </div>

      {/* Description if exists */}
      {task.description ? (
        <div className="px-4 pb-3">
          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--color-ink-500)]">{task.description}</p>
        </div>
      ) : null}

      {/* Info row - Hours & Due Date */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <div className="flex items-center gap-2">
          {dueDateLabel && (
            <span className="flex items-center gap-1 rounded-md bg-[var(--color-warning-050)] px-2 py-1 text-[10px] font-semibold text-[var(--color-warning-700)] border border-[rgba(180,117,16,0.12)]">
              <span>📅</span> {dueDateLabel}
            </span>
          )}
          {(estimatedHours > 0 || actualHours > 0) && (
            <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border transition-colors ${
              isOverEstimate
                ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[rgba(220,38,38,0.16)]'
                : 'bg-slate-50 text-slate-600 border-slate-200/60'
            }`}>
              <span>⏱</span>
              {estimatedHours > 0 ? (
                <>
                  <span className="font-bold">Real:</span>
                  <span className="font-mono font-bold text-[11px]">{secondsToHMS(actualHours * 3600)}</span>
                  <span className="text-slate-300 font-normal">/</span>
                  <span className="font-bold">Est:</span>
                  <span className="font-mono font-bold text-[11px]">{secondsToHMS(estimatedHours * 3600)}</span>
                </>
              ) : (
                <>
                  <span className="font-bold">Real:</span>
                  <span className="font-mono font-bold text-[11px]">{secondsToHMS(actualHours * 3600)}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {hasSubTasks ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-medium leading-snug text-blue-800">
            Esta tarea tiene subtareas. Inicia el timer en una subtarea.
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Subtareas
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {completedSubTasks}/{subTasks.length}
            </span>
          </div>
          <div className="space-y-2 border-l-2 border-slate-200 pl-3">
            {subTasks.map((subTask) => {
              const subAssignedLabel = subTask.assignedTo
                ? `${subTask.assignedTo.name} ${subTask.assignedTo.lastname}`.trim()
                : 'Sin asignar';
              const subEstimatedHours = subTask.estimatedHours ?? 0;
              const subActualHours = subTask.actualHours ?? 0;
              const isActiveSubTaskTimer = activeTaskId === subTask.id;
              const subStatusActions = statusActionConfig[subTask.status].filter((action) =>
                allowedTaskStatusTransitions[subTask.status].includes(action.status),
              );

              return (
                <div
                  key={subTask.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(subTask);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-slate-800">{subTask.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{subAssignedLabel}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${statusColors[subTask.status]}`}>
                      {taskStatusLabels[subTask.status]}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      {secondsToHMS(subActualHours * 3600)}
                      {subEstimatedHours > 0 ? ` / ${secondsToHMS(subEstimatedHours * 3600)}` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      {onTrackTime && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTrackTime(subTask);
                          }}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] transition-colors ${
                            isActiveSubTaskTimer
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                          title={isActiveSubTaskTimer ? 'Detener timer' : 'Iniciar timer'}
                          aria-label={isActiveSubTaskTimer ? 'Detener timer' : 'Iniciar timer'}
                        >
                          <Clock3 size={14} aria-hidden="true" />
                        </button>
                      )}
                      {!subTask.assignedToId && user?.id && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTakeTask?.(subTask.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-green-200 hover:text-green-600"
                          title="Tomar subtarea"
                          aria-label="Tomar subtarea"
                        >
                          <UserCheck size={14} aria-hidden="true" />
                        </button>
                      )}
                      {subStatusActions.length > 0 && (
                        <details
                          data-status-menu
                          className="group/subdetails relative"
                          onClick={(event) => event.stopPropagation()}
                          onToggle={(event) => closeOtherStatusMenus(event.currentTarget)}
                        >
                          <summary
                            className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-600 [&::-webkit-details-marker]:hidden"
                            title="Cambiar estado"
                            aria-label="Cambiar estado"
                          >
                            {isStatusUpdating ? '...' : <ListChecks size={14} aria-hidden="true" />}
                          </summary>
                          <div className="absolute bottom-full right-0 z-40 mb-2 min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                            {subStatusActions.map((action) => (
                              <button
                                key={action.status}
                                type="button"
                                onClick={(event) => {
                                  closeStatusMenu(event.currentTarget);
                                  onStatusChange(subTask.id, action.status);
                                }}
                                disabled={isStatusUpdating}
                                className="flex w-full items-center rounded-md px-3 py-1.5 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                      {canDelete && onDelete && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(subTask.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 transition-colors hover:border-red-200 hover:text-red-600"
                          title="Eliminar subtarea"
                          aria-label="Eliminar subtarea"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Footer - Avatar & Actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/50 rounded-b-xl border-t border-[rgba(15,23,42,0.04)] transition-colors group-hover:bg-slate-50 sm:py-2">
        <div className="flex items-center gap-2">
           <div className="group/avatar relative">
             <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-600),var(--color-primary-700))] text-[10px] font-bold text-white shadow-sm ring-2 ring-white transition-transform group-hover/avatar:scale-110">
               {assignedInitials}
             </div>
             <div className="absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover/avatar:block">
               {assignedLabel}
             </div>
           </div>
        </div>
        <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          {onCreateSubTask && !task.parentTaskId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCreateSubTask(task); }}
              className="inline-flex items-center justify-center h-9 w-9 md:h-6 md:w-6 rounded-lg md:rounded-md bg-white text-slate-600 shadow-sm border border-slate-200 transition-all hover:text-blue-600 hover:border-blue-200"
              title="Crear subtarea"
            >
              +
            </button>
          )}

          {onTrackTime && !hasSubTasks && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTrackTime(task); }}
              className={`inline-flex items-center justify-center h-9 w-9 md:h-7 md:w-7 rounded-lg md:rounded-md transition-all ${
                isActiveTaskTimer
                  ? 'bg-red-500 text-white shadow-sm hover:bg-red-600'
                  : 'bg-blue-600 text-white shadow-sm border border-blue-600 hover:bg-blue-700 hover:border-blue-700'
              }`}
              title={isActiveTaskTimer ? 'Detener tiempo' : 'Registrar tiempo'}
              aria-label={isActiveTaskTimer ? 'Detener tiempo' : 'Registrar tiempo'}
            >
              ⏱️
            </button>
          )}

          {!task.assignedToId && user?.id && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTakeTask?.(task.id); }}
              className="inline-flex items-center justify-center h-9 w-9 md:h-6 md:w-6 rounded-lg md:rounded-md bg-white text-slate-600 shadow-sm border border-slate-200 transition-all hover:text-green-600 hover:border-green-200"
              title="Tomar tarea"
            >
              ✓
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="inline-flex items-center justify-center h-9 w-9 md:h-6 md:w-6 rounded-lg md:rounded-md bg-white text-slate-600 shadow-sm border border-slate-200 transition-all hover:text-slate-900 hover:border-slate-300"
            title="Editar"
          >
            ✎
          </button>
          
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="inline-flex items-center justify-center h-9 w-9 md:h-6 md:w-6 rounded-lg md:rounded-md bg-white text-slate-600 shadow-sm border border-slate-200 transition-all hover:text-red-600 hover:border-red-200"
              title="Eliminar tarea"
            >
              🗑
            </button>
          )}

          {availableStatusActions.length > 0 && (
            <details
              data-status-menu
              className="group/details relative"
              onClick={(e) => e.stopPropagation()}
              onToggle={(e) => closeOtherStatusMenus(e.currentTarget)}
            >
              <summary className="list-none inline-flex items-center justify-center h-9 w-9 md:h-6 md:w-6 rounded-lg md:rounded-md bg-white text-slate-600 shadow-sm border border-slate-200 transition-all hover:text-blue-600 hover:border-blue-200 cursor-pointer [&::-webkit-details-marker]:hidden">
                {isStatusUpdating ? '⟳' : '→'}
              </summary>
              <div className={`absolute ${isFirst ? 'top-full mt-1' : 'bottom-full mb-3'} right-0 z-30 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in ${isFirst ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'}`}>
                {availableStatusActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={(e) => {
                      closeStatusMenu(e.currentTarget);
                      setIsLeaving(true);
                      setTimeout(async () => {
                        try {
                          await onStatusChange(task.id, action.status);
                        } finally {
                          setIsLeaving(false);
                        }
                      }, 250);
                    }}
                    disabled={isStatusUpdating || isLeaving}
                    className="flex w-full items-center rounded-md px-3 py-1.5 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
