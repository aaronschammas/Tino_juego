import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { memo } from 'react';

interface HealthStatusCardProps {
  overdueTasks: number;
  blockedTasks: number;
  remainingTasks: number;
  tasksWithoutTime: number;
  unassignedTasks: number;
  activeUsers: number;
  onOpenProjects: () => void;
}

const HealthStatusCard = ({
  overdueTasks,
  blockedTasks,
  remainingTasks,
  tasksWithoutTime,
  unassignedTasks,
  activeUsers,
  onOpenProjects,
}: HealthStatusCardProps) => {
  const hasIssues = overdueTasks > 0 || blockedTasks > 0;

  return (
    <Card className="p-6 shadow-sm border-gray-100 flex flex-col h-full">
      <div className="mb-6">
        <h3 className="text-[16px] font-bold text-gray-900">Fricción y riesgo</h3>
        <p className="text-[13px] text-gray-500 font-medium">Una lectura orientada a decisiones para saber si el sistema está sano o requiere acción inmediata</p>
      </div>

      {/* Sub-cards de alerta apiladas verticalmente */}
      <div className="flex-1 grid grid-cols-1 gap-3.5 mb-4.5">
        {overdueTasks > 0 ? (
          <div className="border-l-4 border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 rounded-lg">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-danger)]">Vencimientos</p>
              <p className="text-lg font-bold tracking-tight text-[var(--color-text)]">
                {overdueTasks} tarea{overdueTasks !== 1 ? 's' : ''} vencida{overdueTasks !== 1 ? 's' : ''}
              </p>
              <p className="app-body text-[13px] text-[var(--color-text-muted)]">Conviene reasignar o revisar fechas para evitar más arrastre.</p>
              <Button onClick={onOpenProjects} variant="secondary" size="sm" className="w-full">
                Ver proyectos
              </Button>
            </div>
          </div>
        ) : null}

        {blockedTasks > 0 ? (
          <div className="border-l-4 border-[var(--color-warn)] bg-[var(--color-warn-soft)] p-4 rounded-lg">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-warn)]">Bloqueos</p>
              <p className="text-lg font-bold tracking-tight text-[var(--color-text)]">
                {blockedTasks} tarea{blockedTasks !== 1 ? 's' : ''} bloqueada{blockedTasks !== 1 ? 's' : ''}
              </p>
              <p className="app-body text-[13px] text-[var(--color-text-muted)]">Hay dependencias activas que frenan la capacidad del equipo.</p>
              <Button onClick={onOpenProjects} variant="secondary" size="sm" className="w-full">
                Revisar backlog
              </Button>
            </div>
          </div>
        ) : null}

        {!hasIssues ? (
          <div className="border-l-4 border-[var(--color-success)] bg-[var(--color-success-soft)] p-4 rounded-lg">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-success)]">Salud operativa</p>
              <p className="text-lg font-bold tracking-tight text-[var(--color-text)]">Operación estable</p>
              <p className="app-body text-[13px] text-[var(--color-text-muted)]">
                No hay bloqueos ni vencimientos abiertos. Quedan {remainingTasks} tarea{remainingTasks !== 1 ? 's' : ''} por iniciar.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Chips de resumen en el pie */}
      <div className="mt-auto pt-4.5 border-t border-slate-100 flex flex-wrap gap-2.5">
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-100 text-[11px] font-bold rounded-xl px-3 py-1.5">
          {tasksWithoutTime} sin tiempo
        </span>
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-100 text-[11px] font-bold rounded-xl px-3 py-1.5">
          {unassignedTasks} sin asignar
        </span>
        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-100 text-[11px] font-bold rounded-xl px-3 py-1.5">
          {activeUsers} usuarios activos
        </span>
      </div>
    </Card>
  );
};

export default memo(HealthStatusCard);
