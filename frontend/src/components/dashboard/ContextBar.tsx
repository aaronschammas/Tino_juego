import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { memo } from 'react';

interface ProjectOption {
  id: string;
  name: string;
}

interface ContextBarProps {
  selectedProjectId: string;
  timePeriod: 'week' | 'month' | 'total';
  projects: ProjectOption[];
  periodLabels: Record<'week' | 'month' | 'total', string>;
  onProjectChange: (value: string) => void;
  onPeriodChange: (value: 'week' | 'month' | 'total') => void;
}

const ContextBar = ({
  selectedProjectId,
  timePeriod,
  projects,
  periodLabels,
  onProjectChange,
  onPeriodChange,
}: ContextBarProps) => {
  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-col gap-2">
        <p className="app-caption uppercase tracking-[0.16em]">Contexto y filtros</p>
        <p className="app-body">
          Ajusta el alcance del dashboard para revisar la organizacion completa o un proyecto puntual.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <label className="app-caption block uppercase tracking-[0.12em]">Espacio de analisis</label>
          <select
            value={selectedProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className="app-select"
          >
            <option value="all">Todos mis proyectos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="app-caption block uppercase tracking-[0.12em]">Ventana temporal</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(periodLabels) as Array<'week' | 'month' | 'total'>).map((period) => (
              <button
                key={period}
                onClick={() => onPeriodChange(period)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  timePeriod === period
                    ? 'bg-[var(--color-primary-600)] text-white shadow-[0_10px_24px_rgba(47,75,255,0.18)]'
                    : 'bg-[var(--color-ink-050)] text-[var(--color-ink-700)] hover:bg-[var(--color-primary-050)]'
                )}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default memo(ContextBar);
