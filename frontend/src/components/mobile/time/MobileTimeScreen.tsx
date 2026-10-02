"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useMobileTime } from "@/hooks/useMobileTime";
import { secondsToHMS } from "@/lib/time";

const duration = (ms: number) => secondsToHMS(ms / 1000);

export default function MobileTimeScreen() {
  const state = useMobileTime();
  if (state.loading)
    return (
      <div
        className="mobile-time-skeleton"
        aria-label="Cargando registro de tiempo"
      />
    );
  const disabled = state.isLoading || state.actionPending;
  return (
    <section aria-labelledby="mobile-time-title" className="mobile-time-screen">
      <p className="mobile-eyebrow">Registro personal</p>
      <h1 id="mobile-time-title">Tiempo</h1>
      <div className="mobile-time-clock" aria-live="polite">
        <span>
          {state.activeTimer
            ? state.isPaused
              ? "Pausado"
              : "En curso"
            : "Detenido"}
        </span>
        <strong>
          {state.activeTimer
            ? secondsToHMS(state.elapsedSeconds)
            : "Sin timer activo"}
        </strong>
        {state.activeTimer && (
          <p>
            {state.activeTimer.project.name} ·{" "}
            {state.activeTimer.task?.title ?? "Sin tarea"}
          </p>
        )}
      </div>
      {state.error && (
        <div role="alert" className="mobile-message">
          <p>{state.error}</p>
          <button onClick={() => void state.refreshTimer()}>Reconciliar</button>
        </div>
      )}
      {!state.activeTimer && (
        <div className="mobile-time-selectors">
          <label>
            Proyecto
            <select
              value={state.projectId}
              onChange={(event) => void state.setProjectId(event.target.value)}
            >
              <option value="">Seleccionar proyecto</option>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tarea
            <select
              value={state.taskId}
              disabled={!state.projectId}
              onChange={(event) => state.setTaskId(event.target.value)}
            >
              <option value="">Registrar al proyecto</option>
              {state.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          {state.projectId && state.tasks.length === 0 && (
            <p>No hay tareas disponibles en este proyecto.</p>
          )}
        </div>
      )}
      <div className="mobile-time-actions">
        {!state.activeTimer && (
          <button
            disabled={disabled || !state.projectId}
            onClick={() => void state.start()}
          >
            <Play aria-hidden="true" />
            Iniciar
          </button>
        )}
        {state.activeTimer && !state.isPaused && (
          <button disabled={disabled} onClick={() => void state.pause()}>
            <Pause aria-hidden="true" />
            Pausar
          </button>
        )}
        {state.activeTimer && state.isPaused && (
          <button disabled={disabled} onClick={() => void state.resume()}>
            <RotateCcw aria-hidden="true" />
            Reanudar
          </button>
        )}
        {state.activeTimer && (
          <button disabled={disabled} onClick={() => void state.stop()}>
            <Square aria-hidden="true" />
            Detener
          </button>
        )}
      </div>
      <h2 className="text-base font-semibold">Horas confirmadas</h2>
      <p className="text-sm text-slate-600">
        Los totales incluyen registros finalizados por el servidor.
      </p>
      <div className="mobile-time-totals">
        <article>
          <span>Hoy</span>
          <strong>{duration(state.summary.todayMilliseconds)}</strong>
        </article>
        <article>
          <span>Esta semana</span>
          <strong>{duration(state.summary.weekMilliseconds)}</strong>
        </article>
      </div>
      <section aria-labelledby="time-history-title">
        <h2 id="time-history-title">Historial reciente</h2>
        {state.secondaryError && (
          <div role="alert" className="mobile-message">
            <p>{state.secondaryError}</p>
            <button onClick={() => void state.retry()}>Reintentar</button>
          </div>
        )}
        {!state.secondaryError && state.summary.items.length === 0 ? (
          <p className="mobile-message">
            Todavía no hay registros finalizados.
          </p>
        ) : (
          <ul className="mobile-time-history">
            {state.summary.items.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.task?.title ?? entry.project.name}</strong>
                <span>{entry.project.name}</span>
                <time dateTime={entry.startTime}>
                  {new Date(entry.startTime).toLocaleString("es-AR", {
                    timeZone: state.summary.timezone,
                  })}
                </time>
                <span>
                  {duration(
                    new Date(entry.endTime).getTime() -
                      new Date(entry.startTime).getTime() -
                      entry.totalPausedMs,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {state.summary.page < state.summary.totalPages && (
          <button
            className="mobile-load-more"
            onClick={() => void state.loadMore()}
          >
            Cargar más
          </button>
        )}
      </section>
    </section>
  );
}
