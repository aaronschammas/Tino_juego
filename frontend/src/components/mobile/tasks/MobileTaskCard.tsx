'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, UserRound } from 'lucide-react';
import { taskStatusLabels } from '@/types/task';
import type { TaskListItem } from '@/types/task-list';
import { dueDatePresentation, priorityClasses, priorityLabels, statusClasses } from '@/lib/task-presentation';

export default function MobileTaskCard({ task }: { task: TaskListItem }) {
  const due = dueDatePresentation(task.dueDate);
  const assignee = task.assignedTo ? `${task.assignedTo.name} ${task.assignedTo.lastname}`.trim() : 'Sin responsable';
  return (
    <article className="mobile-task-card">
      <Link href={`/mobile/tasks/${task.projectId}/${task.id}`} className="mobile-task-card-link" aria-label={`Abrir tarea ${task.title}`}>
        <div className="min-w-0 flex-1">
          <p className="mobile-task-project">{task.project.name}</p>
          <h2 className="mobile-task-title">{task.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`mobile-task-badge ${statusClasses[task.status]}`}>{taskStatusLabels[task.status]}</span>
            <span className={`mobile-task-badge ${priorityClasses[task.priority]}`}>{priorityLabels[task.priority]}</span>
          </div>
          <div className="mobile-task-meta">
            <span><UserRound size={15} aria-hidden="true" />{assignee}</span>
            {due && <span className={due.overdue && task.status !== 'DONE' ? 'text-[var(--color-danger)] font-semibold' : ''}><CalendarDays size={15} aria-hidden="true" />{due.overdue && task.status !== 'DONE' ? 'Vencida · ' : ''}{due.label}</span>}
          </div>
          {task.assignmentSource === 'subtask' && <p className="mt-2 text-xs font-medium text-[var(--color-info)]">Participas en una subtarea</p>}
        </div>
        <ChevronRight className="shrink-0 text-[var(--color-text-subtle)]" size={20} aria-hidden="true" />
      </Link>
    </article>
  );
}
