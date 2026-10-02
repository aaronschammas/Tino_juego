import StatBox from '@/components/ui/StatBox';
import { memo } from 'react';

interface SummaryCardGroupProps {
  completedTasks: number;
  inProgressTasks: number;
  remainingTasks: number;
  blockedTasks: number;
}

const SummaryCardGroup = ({
  completedTasks,
  inProgressTasks,
  remainingTasks,
  blockedTasks,
}: SummaryCardGroupProps) => {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="app-caption uppercase tracking-[0.14em]">Resumen operativo</p>
        <h2 className="app-section-title">Vista sintetica del dia</h2>
        <p className="app-body">Los mismos datos clave, ordenados segun impacto y sin repetir formatos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatBox label="Completadas" value={completedTasks} meta="Tareas cerradas" tone="success" />
        <StatBox label="En progreso" value={inProgressTasks} meta="Trabajo en ejecucion" tone="primary" />
        <StatBox label="Por hacer" value={remainingTasks} meta="Pendientes por iniciar" tone="warning" />
        <StatBox label="Bloqueadas" value={blockedTasks} meta="Con impedimentos activos" tone="danger" />
      </div>
    </div>
  );
};

export default memo(SummaryCardGroup);
