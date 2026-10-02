import React, { memo, useMemo } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { DashboardCriticalTask } from '@/types/analytics';
import { taskStatusLabels } from '@/types/task';
import { format, parseISO } from 'date-fns';
import { secondsToHMS } from '@/lib/time';
import { AlertCircle } from 'lucide-react';

const priorityLabels: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const priorityClasses: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-100',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-100',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-100',
  LOW: 'bg-slate-50 text-slate-500 border-slate-200',
};

interface Props {
  data: DashboardCriticalTask[];
  total: number;
  nextCursor?: string | null;
  selectedTaskId?: string | null;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

const TaskTable = ({
  data,
  total,
  nextCursor,
  selectedTaskId,
  isLoadingMore = false,
  onLoadMore,
  className = '',
}: Props) => {
  const orderedData = useMemo(
    () =>
      selectedTaskId
        ? [...data].sort((first, second) => Number(second.id === selectedTaskId) - Number(first.id === selectedTaskId))
        : data,
    [data, selectedTaskId],
  );

  const rows = useMemo(
    () =>
      orderedData.map((task) => ({
        ...task,
        estimatedTime: secondsToHMS(task.estimatedHours * 3600),
        actualTime: secondsToHMS(task.actualHours * 3600),
        deviationTime: secondsToHMS(Math.abs(task.deviationHours) * 3600),
        dueDateLabel: task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yyyy') : 'Sin fecha',
        isOver: task.deviationHours > 0 && task.estimatedHours > 0,
      })),
    [orderedData],
  );

  return (
    <Card className={`flex flex-col overflow-hidden ${className}`}>
      <div className="p-4.5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="app-section-title mb-0">Tareas que requieren atención</h3>
            <p className="mt-1 text-xs text-[var(--color-text-subtle)]">Vencidas, bloqueadas o con mayor desvío de esfuerzo</p>
          </div>
          <span className="app-badge bg-slate-100 text-slate-700 border border-slate-200 font-bold">{data.length} de {total} registros</span>
        </div>
      </div>

      <div className="app-table-container max-h-[500px] overflow-y-auto scrollbar-thin">
        <table className="app-table">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <tr>
              <th>Tarea</th>
              <th>Proyecto</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th className="text-right">Est. (HH:mm:ss)</th>
              <th className="text-right">Real (HH:mm:ss)</th>
              <th className="text-right">Desvío</th>
              <th>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              return (
                <tr key={task.id} className={task.id === selectedTaskId ? 'bg-blue-50/70' : undefined}>
                  <td className="font-medium">
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="text-[var(--color-primary-700)] hover:underline hover:text-[var(--color-primary-800)]"
                    >
                      {task.title}
                    </Link>
                  </td>
                  <td className="text-[var(--color-text-muted)]">
                    <Link href={`/projects/${task.projectId}`} className="hover:underline">
                      {task.projectName}
                    </Link>
                  </td>
                  <td><span className="app-badge">{taskStatusLabels[task.status]}</span></td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                      priorityClasses[task.priority] || 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>{priorityLabels[task.priority] || task.priority}</span>
                  </td>
                  <td className="text-right text-[var(--color-text-muted)] font-mono text-[13px]">
                    {task.estimatedTime}
                  </td>
                  <td className="text-right font-semibold font-mono text-[13px]">
                    {task.actualTime}
                  </td>
                  <td className={`text-right font-bold font-mono text-[13px] ${task.isOver ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                    {task.deviationHours > 0 ? '+' : ''}{task.deviationTime}
                  </td>
                  <td className="text-[var(--color-text-subtle)]">
                    {task.dueDateLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400 bg-white">
            <AlertCircle size={32} className="text-slate-300 mb-2.5" />
            <p className="text-sm font-bold text-slate-700 mb-1">Sin tareas que requieran atención</p>
            <p className="text-xs text-slate-400 max-w-[320px]">No se encontraron tareas vencidas, bloqueadas o desviadas en el rango seleccionado.</p>
          </div>
        ) : null}
      </div>
      {nextCursor ? (
        <div className="border-t bg-[var(--color-surface-2)] p-3 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {isLoadingMore ? 'Cargando…' : 'Cargar más tareas'}
          </button>
        </div>
      ) : null}
    </Card>
  );
};

export default memo(TaskTable);
