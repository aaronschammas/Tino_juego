import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';

export const priorityLabels: Record<Priority, string> = {
  [Priority.LOW]: 'Baja', [Priority.MEDIUM]: 'Media', [Priority.HIGH]: 'Alta', [Priority.CRITICAL]: 'Critica',
};

export const priorityClasses: Record<Priority, string> = {
  [Priority.LOW]: 'bg-slate-100 text-slate-700',
  [Priority.MEDIUM]: 'bg-blue-50 text-blue-700',
  [Priority.HIGH]: 'bg-orange-100 text-orange-800',
  [Priority.CRITICAL]: 'bg-red-100 text-red-700',
};

export const statusClasses: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'bg-slate-100 text-slate-700',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700',
  [TaskStatus.BLOCKED]: 'bg-red-100 text-red-700',
  [TaskStatus.DONE]: 'bg-emerald-100 text-emerald-700',
};

export function dueDatePresentation(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const overdue = date.getTime() < Date.now();
  return {
    label: new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date),
    overdue,
  };
}
