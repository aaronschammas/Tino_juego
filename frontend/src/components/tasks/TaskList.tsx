'use client';

import { useState } from 'react';
import { Task, TaskStatus, taskStatusColumnLabels } from '@/types/task';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onCreateTask?: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void | Promise<void>;
  onTakeTask?: (taskId: string) => void;
  onTrackTime?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onCreateSubTask?: (task: Task) => void;
  canDelete?: boolean;
  activeTaskId?: string | null;
  groupByStatus?: boolean;
  pendingStatusTaskIds?: string[];
}

export default function TaskList({
  tasks,
  onEdit,
  onCreateTask,
  onStatusChange,
  onTakeTask,
  onTrackTime,
  onDelete,
  onCreateSubTask,
  canDelete,
  activeTaskId,
  groupByStatus = false,
  pendingStatusTaskIds = [],
}: TaskListProps) {
  const [activeDragStatus, setActiveDragStatus] = useState<TaskStatus | null>(null);
  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--color-ink-500)]">
        <p className="text-lg font-medium text-[var(--color-ink-700)]">No hay tareas</p>
        <p className="mt-1 text-sm">Crea una tarea para empezar a ordenar el trabajo.</p>
      </div>
    );
  }

  if (!groupByStatus) {
    return (
      <div className="space-y-4 sm:space-y-3 max-h-[600px] overflow-y-auto pr-2 pb-20 app-scrollbar">
        {tasks.map((task, index) => (
          <TaskItem
            key={task.id}
            task={task}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onTakeTask={onTakeTask}
            onTrackTime={onTrackTime}
            onDelete={onDelete}
            onCreateSubTask={onCreateSubTask}
            canDelete={canDelete}
            activeTaskId={activeTaskId}
            isStatusUpdating={pendingStatusTaskIds.includes(task.id)}
            isFirst={index === 0}
          />
        ))}
      </div>
    );
  }

  const tasksByStatus = {
    [TaskStatus.TODO]: tasks.filter((task) => task.status === TaskStatus.TODO),
    [TaskStatus.IN_PROGRESS]: tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS),
    [TaskStatus.BLOCKED]: tasks.filter((task) => task.status === TaskStatus.BLOCKED),
    [TaskStatus.DONE]: tasks.filter((task) => task.status === TaskStatus.DONE),
  };

  const statusColors = {
    [TaskStatus.TODO]: {
      column: 'bg-slate-100/70 border-slate-200/50',
      header: 'text-slate-700',
      dot: 'bg-slate-400',
      badge: 'bg-slate-200 text-slate-700',
    },
    [TaskStatus.IN_PROGRESS]: {
      column: 'bg-blue-50/70 border-blue-100/50',
      header: 'text-blue-900',
      dot: 'bg-blue-500',
      badge: 'bg-blue-100 text-blue-700',
    },
    [TaskStatus.BLOCKED]: {
      column: 'bg-red-50/70 border-red-100/50',
      header: 'text-red-900',
      dot: 'bg-red-500',
      badge: 'bg-red-100 text-red-700',
    },
    [TaskStatus.DONE]: {
      column: 'bg-emerald-50/70 border-emerald-100/50',
      header: 'text-emerald-900',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
    },
  };

  return (
    <div className="overflow-x-auto pb-6 app-scrollbar">
      <div className="flex gap-4 min-w-max px-2 mx-auto justify-center">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
          const colors = statusColors[status as TaskStatus];

          return (
            <section
              key={status}
              className={`flex w-[320px] flex-col rounded-2xl border ${colors.column} p-2 shadow-sm`}
            >
              <header className="mb-3 flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  <h3 className={`text-sm font-bold tracking-tight ${colors.header}`}>
                    {taskStatusColumnLabels[status as TaskStatus]}
                  </h3>
                </div>
                <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${colors.badge}`}>
                  {statusTasks.length}
                </span>
              </header>

              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={() => setActiveDragStatus(status as TaskStatus)}
                onDragLeave={() => setActiveDragStatus(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain');
                  if (taskId) {
                    onStatusChange(taskId, status as TaskStatus);
                  }
                  setActiveDragStatus(null);
                }}
                className={`flex flex-col gap-4 min-h-[280px] sm:gap-3 max-h-[600px] overflow-y-auto pr-1 pb-32 app-scrollbar rounded-xl transition-all duration-200 border-2 ${
                  activeDragStatus === status
                    ? 'bg-slate-500/5 border-dashed border-slate-300 scale-[0.99] shadow-inner'
                    : 'border-transparent'
                }`}
              >
                {statusTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200/60 py-8 px-4">
                    <p className="text-center text-[11px] font-medium text-slate-400">
                      {status === TaskStatus.TODO
                        ? 'Las nuevas tareas aparecerán aquí.'
                        : 'Mueve tareas aquí para cambiar su estado.'}
                    </p>
                  </div>
                ) : (
                  statusTasks.map((task, index) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onEdit={onEdit}
                      onStatusChange={onStatusChange}
                      onTakeTask={onTakeTask}
                      onTrackTime={onTrackTime}
                      onDelete={onDelete}
                      onCreateSubTask={onCreateSubTask}
                      canDelete={canDelete}
                      activeTaskId={activeTaskId}
                      isStatusUpdating={pendingStatusTaskIds.includes(task.id)}
                      isFirst={index === 0}
                    />
                  ))
                )}
              </div>

              <footer className="mt-4 px-1">
                <button
                  type="button"
                  onClick={onCreateTask}
                  disabled={!onCreateTask}
                  className="flex w-full items-center gap-2 rounded-lg py-2 px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-700"
                >
                  <span className="text-lg font-light">+</span>
                  Añadir una tarjeta
                </button>
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
