'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useMobileTasks } from '@/hooks/useMobileTasks';
import { useProjects } from '@/hooks/useProjects';
import MobileTaskCard from './MobileTaskCard';
import MobileTaskFilters from './MobileTaskFilters';

export default function MobileTasksScreen() {
  const state = useMobileTasks();
  const { projects } = useProjects();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = Boolean(state.filters.search || state.filters.projectId || state.filters.status || state.filters.priority || state.filters.assignedTo || state.filters.overdue !== null);

  return (
    <section aria-labelledby="mobile-tasks-title">
      <div className="mobile-page-heading"><div><p className="mobile-eyebrow">Espacio de trabajo</p><h1 id="mobile-tasks-title">Tareas</h1></div><button className="mobile-filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={18} aria-hidden="true" />Filtros</button></div>
      <label className="mobile-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Buscar tareas</span><input value={state.filters.search} onChange={(e) => state.setFilters({ search: e.target.value })} placeholder="Buscar tareas" maxLength={100} /></label>
      <div className="mobile-quick-filters" aria-label="Filtros rapidos">
        <button aria-pressed={!state.filters.assignedTo && state.filters.overdue === null} onClick={() => state.setFilters({ assignedTo: '', overdue: null })}>Todas</button>
        <button aria-pressed={state.filters.assignedTo === 'me'} onClick={() => state.setFilters({ assignedTo: 'me', overdue: null })}>Mias</button>
        <button aria-pressed={state.filters.overdue === true} onClick={() => state.setFilters({ overdue: true, assignedTo: '' })}>Vencidas</button>
      </div>
      {filtersOpen && <MobileTaskFilters filters={state.filters} projects={projects} onChange={state.setFilters} />}

      {state.isLoading ? <div className="space-y-3" aria-label="Cargando tareas">{[1,2,3].map((key) => <div key={key} className="mobile-task-skeleton" />)}</div>
        : state.error ? <div className="mobile-message" role="alert"><p>{state.error}</p><button onClick={() => void state.retry()}>Reintentar</button></div>
        : state.items.length === 0 ? <div className="mobile-message"><h2>{hasFilters ? 'No hay resultados' : 'No hay tareas'}</h2><p>{hasFilters ? 'Prueba ajustando la busqueda o los filtros.' : 'Esta organizacion todavia no tiene tareas accesibles.'}</p></div>
        : <div className="space-y-3">{state.items.map((task) => <MobileTaskCard key={task.id} task={task} />)}</div>}

      {state.page < state.totalPages && !state.isLoading && <button className="mobile-load-more" disabled={state.isLoadingMore} aria-live="polite" onClick={() => void state.loadMore()}>{state.isLoadingMore ? 'Cargando mas tareas...' : 'Cargar mas'}</button>}
    </section>
  );
}
