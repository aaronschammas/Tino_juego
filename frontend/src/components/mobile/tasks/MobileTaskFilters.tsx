'use client';

import { Priority } from '@/types/project';
import { TaskStatus, taskStatusLabels } from '@/types/task';
import type { MobileTaskFilters } from '@/types/task-list';
import type { Project } from '@/types/project';
import { priorityLabels } from '@/lib/task-presentation';

export default function MobileTaskFilters({ filters, projects, onChange }: { filters: MobileTaskFilters; projects: Project[]; onChange: (next: Partial<MobileTaskFilters>) => void }) {
  return (
    <div className="mobile-task-filters" aria-label="Filtros de tareas">
      <label><span>Estado</span><select value={filters.status} onChange={(e) => onChange({ status: e.target.value as TaskStatus | '' })}><option value="">Todos</option>{Object.values(TaskStatus).map((value) => <option key={value} value={value}>{taskStatusLabels[value]}</option>)}</select></label>
      <label><span>Proyecto</span><select value={filters.projectId} onChange={(e) => onChange({ projectId: e.target.value })}><option value="">Todos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><span>Prioridad</span><select value={filters.priority} onChange={(e) => onChange({ priority: e.target.value as Priority | '' })}><option value="">Todas</option>{Object.values(Priority).map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
    </div>
  );
}
