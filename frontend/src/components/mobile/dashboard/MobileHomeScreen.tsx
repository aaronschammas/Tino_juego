'use client';

import Link from 'next/link';
import { ArrowRight, Clock3, ListTodo, PieChart, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMobileHome } from '@/hooks/useMobileHome';
import { useTimer } from '@/context/TimerContext';
import IntegrationActivityBanner from '@/components/integrations/IntegrationActivityBanner';
import type { MobileHomeTasks } from '@/types/mobile-dashboard';

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.max(0, seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function hours(milliseconds: number) {
  return `${(milliseconds / 3_600_000).toFixed(2)} h`;
}

const blockCopy: Record<keyof MobileHomeTasks, { title: string; empty: string }> = {
  overdue: { title: 'Vencidas', empty: 'No tenés tareas vencidas.' },
  upcoming: { title: 'Próximos 7 días', empty: 'No tenés vencimientos próximos.' },
  inProgress: { title: 'En progreso', empty: 'No tenés tareas en progreso.' },
};

function TaskBlock({ kind, state }: { kind: keyof MobileHomeTasks; state: ReturnType<typeof useMobileHome> }) {
  const status = state.status[kind];
  return (
    <section className="mobile-home-card" aria-labelledby={`home-${kind}`}>
      <div className="mobile-card-heading">
        <h2 id={`home-${kind}`}>{blockCopy[kind].title}</h2>
        <Link href="/mobile/tasks">Ver tareas</Link>
      </div>
      {status.loading ? <div className="mobile-dashboard-skeleton" aria-label={`Cargando ${blockCopy[kind].title}`} />
        : status.error ? <div role="alert" className="mobile-block-error"><p>{status.error}</p><button onClick={() => void state.retry(kind)}>Reintentar</button></div>
        : state.tasks[kind].length === 0 ? <p className="mobile-block-empty">{blockCopy[kind].empty}</p>
        : <ul className="mobile-home-task-list">{state.tasks[kind].map((task) => (
          <li key={task.id}><Link href={`/mobile/tasks/${task.projectId}/${task.id}`}><span>{task.title}</span><small>{task.project.name}{task.dueDate ? ` · ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(task.dueDate))}` : ''}</small></Link></li>
        ))}</ul>}
    </section>
  );
}

export default function MobileHomeScreen() {
  const { user, activeOrganization } = useAuth();
  const state = useMobileHome();
  const timer = useTimer();
  const timerLabel = timer.isPaused ? 'Timer pausado' : timer.isRunning ? 'Timer activo' : 'Sin timer activo';
  return (
    <div className="mobile-dashboard-screen">
      <header className="mobile-dashboard-intro">
        <p className="mobile-eyebrow">{activeOrganization?.name ?? 'Organización activa'}</p>
        <h1>Hola, {user?.name ?? 'equipo'}</h1>
        <p>Tu jornada, en una mirada.</p>
      </header>

      <IntegrationActivityBanner />

      <section className={`mobile-timer-card ${timer.activeTimer ? 'is-active' : ''}`} aria-labelledby="home-timer-title" aria-live="polite">
        <div><p className="mobile-eyebrow">Prioridad actual</p><h2 id="home-timer-title">{timerLabel}</h2></div>
        {timer.activeTimer ? <>
          <strong>{duration(timer.elapsedSeconds)}</strong>
          <p>{timer.activeTimer.project?.name}{timer.activeTimer.task?.title ? ` · ${timer.activeTimer.task.title}` : ''}</p>
          <Link href="/mobile/time">{timer.isPaused ? 'Continuar en Tiempo' : 'Pausar o revisar'}<ArrowRight size={18} aria-hidden="true" /></Link>
        </> : <Link href="/mobile/time"><Play size={18} aria-hidden="true" />Iniciar timer</Link>}
      </section>

      <TaskBlock kind="overdue" state={state} />
      <TaskBlock kind="upcoming" state={state} />
      <TaskBlock kind="inProgress" state={state} />

      <section className="mobile-home-card" aria-labelledby="home-hours">
        <div className="mobile-card-heading"><h2 id="home-hours">Horas confirmadas</h2><Link href="/mobile/time">Ver tiempo</Link></div>
        {state.status.time.loading ? <div className="mobile-dashboard-skeleton" aria-label="Cargando horas confirmadas" />
          : state.status.time.error ? <div role="alert" className="mobile-block-error"><p>{state.status.time.error}</p><button onClick={() => void state.retry('time')}>Reintentar</button></div>
          : state.time ? <dl className="mobile-hours-grid"><div><dt>Hoy</dt><dd>{hours(state.time.todayMilliseconds)}</dd></div><div><dt>Esta semana</dt><dd>{hours(state.time.weekMilliseconds)}</dd></div></dl> : null}
      </section>

      <nav className="mobile-quick-links" aria-label="Accesos rápidos">
        <Link href="/mobile/tasks"><ListTodo aria-hidden="true" />Tareas</Link>
        <Link href="/mobile/time"><Clock3 aria-hidden="true" />Tiempo</Link>
        <Link href="/mobile/summary"><PieChart aria-hidden="true" />Resumen</Link>
      </nav>
      <p className="sr-only">Las horas no incluyen el timer sin confirmar. Zona horaria {state.timezone}.</p>
    </div>
  );
}
