"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  allowedTaskStatusTransitions,
  Task,
  TaskStatus,
  taskStatusLabels,
} from "@/types/task";
import { Priority } from "@/types/project";
import { formatDateUTC, secondsToHMS } from "@/lib/time";
import Portal from "@/components/ui/Portal";
import TaskCommentsSection from "@/components/task-comments/TaskCommentsSection";

interface TaskDetailPanelProps {
  task: Task | null;
  activeTaskId?: string | null;
  canDelete?: boolean;
  onClose: () => void;
  onEditTask: (task: Task) => void;
  onSelectTask?: (task: Task) => void;
  onCreateSubTask: (parentTask: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTakeTask?: (taskId: string) => void;
  onTrackTime?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "bg-slate-100 text-slate-600",
  [TaskStatus.IN_PROGRESS]: "bg-blue-100  text-blue-700",
  [TaskStatus.BLOCKED]: "bg-red-100   text-red-700",
  [TaskStatus.DONE]: "bg-emerald-100 text-emerald-700",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "bg-slate-400",
  [TaskStatus.IN_PROGRESS]: "bg-blue-500",
  [TaskStatus.BLOCKED]: "bg-red-500",
  [TaskStatus.DONE]: "bg-emerald-500",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  [Priority.LOW]: "bg-slate-100  text-slate-600",
  [Priority.MEDIUM]: "bg-blue-50    text-blue-700",
  [Priority.HIGH]: "bg-orange-100 text-orange-700",
  [Priority.CRITICAL]: "bg-red-100    text-red-700",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  [Priority.LOW]: "Baja",
  [Priority.MEDIUM]: "Media",
  [Priority.HIGH]: "Alta",
  [Priority.CRITICAL]: "Crítica",
};

export default function TaskDetailPanel({
  task,
  activeTaskId,
  canDelete,
  onClose,
  onEditTask,
  onSelectTask,
  onCreateSubTask,
  onStatusChange,
  onTakeTask,
  onTrackTime,
  onDelete,
}: TaskDetailPanelProps) {
  const { user } = useAuth();

  if (!task) return null;

  const isSubTask = !!task.parentTaskId;
  const subTasks = task.subTasks ?? [];
  const hasSubTasks = subTasks.length > 0;
  const completedCount = subTasks.filter(
    (st) => st.status === TaskStatus.DONE,
  ).length;
  const totalCount = subTasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const estimatedHours = task.estimatedHours ?? 0;
  const actualHours = task.actualHours ?? 0;
  const isOver = estimatedHours > 0 && actualHours > estimatedHours;

  const responsibleLabel = task.assignedTo
    ? `${task.assignedTo.name} ${task.assignedTo.lastname}`.trim()
    : task.responsibles?.length
      ? task.responsibles
          .map((r) => `${r.name} ${r.lastname}`.trim())
          .join(", ")
      : null;

  return (
    <Portal>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
      />

      {/* ── Panel ── */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* ─ Header ─ */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {isSubTask ? "Subtarea" : "Tarea"}
            </p>
            <h2 className="break-words text-lg font-bold leading-snug text-slate-900">
              {task.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <button
              onClick={() => onEditTask(task)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
            >
              ✎ Editar
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─ Scrollable body ─ */}
        <div className="flex-1 overflow-y-auto app-scrollbar">
          {/* Chips: status · priority · due date · responsible */}
          <div className="flex flex-wrap gap-2 px-6 py-4 border-b border-slate-50">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[task.status]}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`}
              />
              {taskStatusLabels[task.status]}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_BADGE[task.priority]}`}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>

            {task.dueDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                📅{" "}
                {formatDateUTC(task.dueDate, {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            )}

            {task.externalUrl && (
              <a
                href={task.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                Ver en Trello ↗
              </a>
            )}

            {responsibleLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                👤 {responsibleLabel}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description ? (
            <div className="px-6 py-4 border-b border-slate-50">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Descripción
              </p>
              <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          ) : null}

          {/* Time */}
          <div className="px-6 py-4 border-b border-slate-50">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Tiempo registrado
            </p>
            <div className="flex items-stretch gap-3">
              <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Real
                </p>
                <p
                  className={`mt-1 font-mono text-xl font-bold ${isOver ? "text-red-600" : "text-slate-800"}`}
                >
                  {secondsToHMS(actualHours * 3600)}
                </p>
              </div>
              {estimatedHours > 0 && (
                <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Estimado
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-800">
                    {secondsToHMS(estimatedHours * 3600)}
                  </p>
                </div>
              )}
            </div>
            {isOver && (
              <p className="mt-2 text-center text-[10px] font-semibold text-red-500">
                ⚠ Superó la estimación por{" "}
                {secondsToHMS((actualHours - estimatedHours) * 3600)}
              </p>
            )}
          </div>

          {/* Subtasks section — only for parent tasks */}
          {!isSubTask && (
            <div className="px-6 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Subtareas
                </p>
                {hasSubTasks && (
                  <span className="text-xs font-bold text-slate-500">
                    {completedCount} / {totalCount} completadas
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {hasSubTasks && (
                <div className="mb-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100
                          ? "bg-emerald-500"
                          : progress >= 50
                            ? "bg-blue-500"
                            : "bg-slate-400"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] font-bold text-slate-400">
                    {progress}%
                  </p>
                </div>
              )}

              {/* Subtask rows */}
              {hasSubTasks ? (
                <div className="space-y-2">
                  {subTasks.map((subTask) => {
                    const subAssigned = subTask.assignedTo
                      ? `${subTask.assignedTo.name} ${subTask.assignedTo.lastname}`.trim()
                      : "Sin asignar";
                    const subActual = subTask.actualHours ?? 0;
                    const subEstimated = subTask.estimatedHours ?? 0;
                    const isSubActive = activeTaskId === subTask.id;
                    const subActions = (
                      allowedTaskStatusTransitions[subTask.status] ?? []
                    ).map((s) => ({
                      status: s,
                      label: taskStatusLabels[s],
                    }));

                    return (
                      <div
                        key={subTask.id}
                        onClick={() => onSelectTask?.(subTask)}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-white"
                      >
                        {/* Status dot */}
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[subTask.status]}`}
                        />

                        {/* Title + assignee */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${
                              subTask.status === TaskStatus.DONE
                                ? "text-slate-400 line-through"
                                : "text-slate-800"
                            }`}
                          >
                            {subTask.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {subAssigned}
                          </p>
                        </div>

                        {/* Time */}
                        <span className="shrink-0 font-mono text-[10px] font-bold text-slate-400 tabular-nums">
                          {secondsToHMS(subActual * 3600)}
                          {subEstimated > 0
                            ? ` / ${secondsToHMS(subEstimated * 3600)}`
                            : ""}
                        </span>

                        {/* Action buttons — visible on hover */}
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {/* Timer */}
                          {onTrackTime && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onTrackTime(subTask);
                              }}
                              title={
                                isSubActive ? "Detener timer" : "Iniciar timer"
                              }
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] transition-colors ${
                                isSubActive
                                  ? "border-red-400 bg-red-500 text-white"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600"
                              }`}
                            >
                              ⏱
                            </button>
                          )}

                          {/* Take task */}
                          {!subTask.assignedToId && user?.id && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onTakeTask?.(subTask.id);
                              }}
                              title="Tomar subtarea"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] text-slate-500 transition-colors hover:border-green-200 hover:text-green-600"
                            >
                              ✓
                            </button>
                          )}

                          {/* Status change */}
                          {subActions.length > 0 && (
                            <details
                              className="relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-600 [&::-webkit-details-marker]:hidden">
                                →
                              </summary>
                              <div className="absolute bottom-full right-0 z-20 mb-2 min-w-[160px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                                {subActions.map((action) => (
                                  <button
                                    key={action.status}
                                    type="button"
                                    onClick={() =>
                                      onStatusChange(subTask.id, action.status)
                                    }
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[action.status]}`}
                                    />
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </details>
                          )}

                          {/* Delete */}
                          {canDelete && onDelete && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDelete(subTask.id);
                              }}
                              title="Eliminar subtarea"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] text-slate-500 transition-colors hover:border-red-200 hover:text-red-500"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                  <p className="text-xs font-medium text-slate-400">
                    Esta tarea no tiene subtareas todavía.
                  </p>
                  <p className="mt-1 text-[10px] text-slate-300">
                    Usá el botón de abajo para agregar la primera.
                  </p>
                </div>
              )}
            </div>
          )}

          <TaskCommentsSection projectId={task.projectId} taskId={task.id} />
        </div>

        {/* ─ Footer — "Agregar subtarea" (only parent tasks) ─ */}
        {!isSubTask && (
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              onClick={() => onCreateSubTask(task)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-500 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600"
            >
              <span className="text-lg font-light leading-none">+</span>
              Agregar subtarea
            </button>
          </div>
        )}
      </aside>
    </Portal>
  );
}
