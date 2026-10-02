import React, { memo } from 'react';
import { DashboardFilters } from '@/hooks/useDashboardV2';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/project';
import Card from '@/components/ui/Card';
import { ChevronDown, Calendar, Trash2 } from 'lucide-react';

interface Props {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  projects?: Project[];
  projectsLoading?: boolean;
  projectsError?: string | null;
}

interface DashboardSlicersViewProps extends Required<Pick<Props, 'filters' | 'setFilters'>> {
  projects: Project[];
  projectsLoading?: boolean;
  projectsError?: string | null;
}

const DashboardSlicersView = ({
  filters,
  setFilters,
  projects,
  projectsLoading,
  projectsError,
}: DashboardSlicersViewProps) => {
  const isProjectsLoading = projectsLoading ?? false;
  const projectError = projectsError ?? null;
  
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    setFilters(prev => {
      const nextFilters = { ...prev, startDate: newValue };
      if (newValue && prev.endDate && newValue > prev.endDate) {
        nextFilters.endDate = newValue;
      }
      return nextFilters;
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    setFilters(prev => {
      const nextFilters = { ...prev, endDate: newValue };
      if (newValue && prev.startDate && newValue < prev.startDate) {
        nextFilters.startDate = newValue;
      }
      return nextFilters;
    });
  };

  const hasActiveFilters = 
    filters.projectId !== 'all' || 
    filters.status !== 'all' || 
    filters.startDate !== null || 
    filters.endDate !== null;

  return (
    <Card className="p-4 md:p-5 shadow-sm border-slate-100 mb-6 mx-2 md:mx-0 rounded-[24px]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-filter" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">PROYECTO</label>
            <div className="relative">
              <select 
                id="project-filter"
                value={filters.projectId} 
                onChange={e => setFilters(prev => ({ ...prev, projectId: e.target.value }))}
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-[13px] font-semibold appearance-none focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#1e3a5f] transition-all cursor-pointer ${
                  filters.projectId !== 'all' ? 'border-[#1e3a5f] bg-blue-50/10' : 'border-slate-200'
                }`}
              >
                <option value="all">
                  {isProjectsLoading ? 'Cargando proyectos...' : 'Toda la organización'}
                </option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="status-filter" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">ESTADO</label>
            <div className="relative">
              <select 
                id="status-filter"
                value={filters.status} 
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-[13px] font-semibold appearance-none focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#1e3a5f] transition-all cursor-pointer ${
                  filters.status !== 'all' ? 'border-[#1e3a5f] bg-blue-50/10' : 'border-slate-200'
                }`}
              >
                <option value="all">Todos</option>
                <option value="TODO">Por Hacer</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="BLOCKED">Bloqueada</option>
                <option value="DONE">Completada</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="start-date-filter" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">FECHA INICIO</label>
            <div className="relative">
              <input 
                id="start-date-filter"
                type="date" 
                value={filters.startDate || ''}
                onChange={handleStartDateChange}
                max={filters.endDate || ''}
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-[13px] font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#1e3a5f] transition-all cursor-pointer ${
                  filters.startDate ? 'border-[#1e3a5f] bg-blue-50/10' : 'border-slate-200'
                }`}
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none bg-white" size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="end-date-filter" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">FECHA FIN</label>
            <div className="relative">
              <input 
                id="end-date-filter"
                type="date" 
                value={filters.endDate || ''}
                onChange={handleEndDateChange}
                min={filters.startDate || ''}
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-[13px] font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#1e3a5f] transition-all cursor-pointer ${
                  filters.endDate ? 'border-[#1e3a5f] bg-blue-50/10' : 'border-slate-200'
                }`}
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none bg-white" size={16} />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-[11px] font-bold text-[var(--color-primary-600)] bg-[var(--color-primary-050)] px-2.5 py-1 rounded-lg">
              Filtros activos
            </span>
            <button 
              onClick={() => setFilters({ projectId: 'all', startDate: null, endDate: null, status: 'all' })}
              className="flex items-center justify-center gap-1.5 text-[12px] text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold px-3.5 py-2 rounded-xl transition-all"
            >
              <Trash2 size={14} />
              Limpiar filtros
            </button>
          </div>
        )}
        {projectError ? (
          <p className="text-[11px] font-semibold text-rose-500">{projectError}</p>
        ) : null}
      </div>
    </Card>
  );
};

const DashboardSlicers = (props: Props) => {
  if (props.projects) {
    return (
      <DashboardSlicersView
        filters={props.filters}
        setFilters={props.setFilters}
        projects={props.projects}
        projectsLoading={props.projectsLoading}
        projectsError={props.projectsError}
      />
    );
  }

  return <DashboardSlicersWithProjects filters={props.filters} setFilters={props.setFilters} />;
};

const DashboardSlicersWithProjects = ({ filters, setFilters }: Props) => {
  const { projects, isLoading, error } = useProjects();

  return (
    <DashboardSlicersView
      filters={filters}
      setFilters={setFilters}
      projects={projects}
      projectsLoading={isLoading}
      projectsError={error}
    />
  );
};

export default memo(DashboardSlicers);
