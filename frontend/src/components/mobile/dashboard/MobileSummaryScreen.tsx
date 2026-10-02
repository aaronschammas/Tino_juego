'use client';

import { useMobileSummary } from '@/hooks/useMobileSummary';
import { taskStatusLabels } from '@/types/task';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <article className="mobile-kpi"><span>{label}</span><strong>{value}</strong></article>;
}

function Loading({ label }: { label: string }) {
  return <div className="mobile-summary-skeleton" aria-label={label} />;
}

export default function MobileSummaryScreen() {
  const state = useMobileSummary();
  const own = state.self?.own;
  const organization = state.organization?.organization;
  return (
    <div className="mobile-dashboard-screen">
      <header className="mobile-dashboard-intro"><p className="mobile-eyebrow">Indicadores operativos</p><h1>Resumen</h1><p>Datos confirmados en {state.timezone}.</p></header>
      <div className="mobile-period-switch" role="group" aria-label="Período del resumen">
        <button aria-pressed={state.period === 'week'} onClick={() => state.setPeriod('week')}>Semana</button>
        <button aria-pressed={state.period === 'month'} onClick={() => state.setPeriod('month')}>Mes</button>
      </div>

      <section aria-labelledby="summary-own" className="mobile-summary-section">
        <h2 id="summary-own">Mi actividad</h2>
        {state.loading.self ? <Loading label="Cargando actividad propia" />
          : state.errors.self ? <div role="alert" className="mobile-block-error"><p>{state.errors.self}</p><button onClick={() => void state.retry('self')}>Reintentar</button></div>
          : own ? <>
            <div className="mobile-kpi-grid">
              <Kpi label="Pendientes" value={own.pendingTasks} />
              <Kpi label="En progreso" value={own.inProgressTasks} />
              <Kpi label="Bloqueadas" value={own.blockedTasks} />
              <Kpi label="Vencidas" value={own.overdueTasks} />
              <Kpi label="Horas confirmadas" value={`${own.confirmedHours.toFixed(2)} h`} />
              <Kpi label="Proyectos accesibles" value={own.activeProjects} />
            </div>
            <p className="mobile-metric-note">Completadas en el período: no disponible porque las tareas todavía no registran <code>completedAt</code>.</p>
          </> : null}
      </section>

      {state.isOwner && <section aria-labelledby="summary-team" className="mobile-summary-section">
        <h2 id="summary-team">Organización</h2>
        {state.loading.organization ? <Loading label="Cargando agregados de organización" />
          : state.errors.organization ? <div role="alert" className="mobile-block-error"><p>{state.errors.organization}</p><button onClick={() => void state.retry('organization')}>Reintentar agregados</button></div>
          : organization ? <>
            <div className="mobile-kpi-grid">
              <Kpi label="Horas del equipo" value={`${organization.confirmedHours.toFixed(2)} h`} />
              <Kpi label="Vencidas del equipo" value={organization.overdueTasks} />
              <Kpi label="Sin asignar" value={organization.unassignedTasks} />
              <Kpi label="Proyectos activos" value={organization.activeProjects} />
            </div>
            <h3>Distribución por estado</h3>
            <ul className="mobile-distribution">{organization.statusDistribution.map((item) => <li key={item.status}><span>{taskStatusLabels[item.status as keyof typeof taskStatusLabels] ?? item.status}</span><strong>{item.count}</strong></li>)}</ul>
            <h3>Horas por usuario</h3>
            {organization.hoursByUser.length ? <ul className="mobile-distribution">{organization.hoursByUser.map((item) => <li key={item.userId}><span>{item.name}</span><strong>{item.confirmedHours.toFixed(2)} h</strong></li>)}</ul> : <p className="mobile-block-empty">No hay usuarios activos.</p>}
          </> : null}
      </section>}
    </div>
  );
}
