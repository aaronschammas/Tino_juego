'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { clearLastGameProject, writeLastGameProject } from '@/lib/feria';
import { type CoachTarget, FrameHighlighter, TinoHighlighter } from './tinoCoach';
import { DASHBOARD_TOUR } from './dashboardTour';

export interface DemoScenarioSummary {
  key: string;
  name: string;
  intro: string;
}

export interface RoundScore {
  fires: number;
  firesOut: number;
  choices: number;
  goodChoices: number;
  efficiency: number | null;
  seconds: number;
  points: number;
}

interface RoundResult {
  scenario: string;
  score: RoundScore;
}

const ROTATION_KEY = 'feria:rotation';
const TINO_REFRESH_EVENTS = ['task:updated', 'time:updated', 'projects:updated', 'focus'];
export const STATS_SECONDS = 20;
export const NEXT_PROMPT_SECONDS = 10;
const HIGHLIGHT_MS = 200;

/** Respuesta de la API: el backend envuelve los datos en `data`. */
async function readData<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return (body?.data ?? body) as T;
}

/** Escenario con el que arranca el próximo visitante: el de la URL o el siguiente de la rotación. */
export function pickScenario(scenarios: DemoScenarioSummary[], requested: string | null, rotation: number): string {
  if (requested && scenarios.some((scenario) => scenario.key === requested)) return requested;
  return scenarios[Math.abs(rotation) % scenarios.length].key;
}

/** Escenario que sigue al actual en la lista (vuelve al primero después del último). */
export function nextScenario(scenarios: DemoScenarioSummary[], current: string | null): DemoScenarioSummary | null {
  if (!scenarios.length) return null;
  const index = scenarios.findIndex((scenario) => scenario.key === current);
  return scenarios[(index + 1) % scenarios.length];
}

/** Dashboard real de Tino filtrado por el proyecto de la partida. */
export function dashboardUrl(projectId: string | null): string {
  return projectId ? `/dashboard?projectId=${encodeURIComponent(projectId)}` : '/dashboard';
}

/** Segundos como "m:ss". */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** KPIs del juego que Tino no calcula, para la franja de la pantalla final. */
export function scoreKpis(score: RoundScore): Array<{ label: string; value: string }> {
  return [
    { label: 'Canal', value: 'Tino Web' },
    { label: 'Fuegos apagados', value: `${score.firesOut} de ${score.fires}` },
    {
      label: 'Eficiencia de priorización',
      value: score.efficiency === null ? '—' : `${score.efficiency}%`,
    },
    { label: 'Tiempo', value: formatSeconds(score.seconds) },
    { label: 'Puntos', value: String(score.points) },
  ];
}

function readRotation(): number {
  try {
    return Number(window.localStorage.getItem(ROTATION_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeRotation(value: number) {
  try {
    window.localStorage.setItem(ROTATION_KEY, String(value));
  } catch {
    // Sin localStorage (modo privado): la rotación arranca siempre del primero.
  }
}

/** Hace que el Tino del iframe vuelva a leer tareas y timer (mismo origen: se le disparan sus propios eventos). */
export function refreshTino(frame: HTMLIFrameElement | null) {
  const target = frame?.contentWindow;
  if (!target) return;
  for (const name of TINO_REFRESH_EVENTS) target.dispatchEvent(new Event(name));
}

/** Vuelve al cartel de inicio (modo atracción) cuando nadie sigue jugando. */
function goHome() {
  window.location.assign('/');
}

/**
 * Pantalla de juego: Tino real a la izquierda (el proyecto del escenario) y el juego a la derecha. Al terminar
 * la partida muestra el dashboard real con los KPIs del juego y ofrece el siguiente escenario; si nadie
 * contesta, o se toca "Volver al inicio", borra las partidas y llama a `onIdle` (por defecto vuelve al inicio).
 */
export default function FeriaGame({ onIdle = goHome }: { onIdle?: () => void } = {}) {
  const tinoFrame = useRef<HTMLIFrameElement>(null);
  const highlighter = useRef(new TinoHighlighter(() => tinoFrame.current));
  const dashboardFrame = useRef<HTMLIFrameElement>(null);
  const dashboardHighlighter = useRef(new FrameHighlighter(() => dashboardFrame.current));
  const [scenarios, setScenarios] = useState<DemoScenarioSummary[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const start = useCallback(async (key: string) => {
    setIsResetting(true);
    setError(null);
    setResult(null);
    setCountdown(null);
    setWatching(false);
    setTourStep(null);
    highlighter.current.setTarget(null);
    try {
      const response = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: key }),
      });
      const result = await readData<{ projectId: string }>(response);
      setCurrent(key);
      setProjectId(result.projectId);
      setRound((value) => value + 1);
    } catch {
      setError('No se pudo preparar el escenario. ¿Está levantado Tino con DEMO_MODE=true?');
    } finally {
      setIsResetting(false);
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'feria:tino-changed') refreshTino(tinoFrame.current);
      if (event.data?.type === 'feria:coach')
        highlighter.current.setTarget((event.data.target ?? null) as CoachTarget | null);
      if (event.data?.type === 'feria:finished' && event.data.score) {
        setResult(
          (previous) =>
            previous ?? {
              scenario: String(event.data.scenario),
              score: event.data.score as RoundScore,
            },
        );
        highlighter.current.setTarget(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/demo/scenarios')
      .then((response) => readData<DemoScenarioSummary[]>(response))
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setScenarios(list);
        const rotation = readRotation();
        const key = pickScenario(list, new URLSearchParams(window.location.search).get('escenario'), rotation);
        writeRotation(rotation + 1);
        void start(key);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo conectar con Tino. ¿Está levantado el backend?');
      });
    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      highlighter.current.tick();
      dashboardHighlighter.current.tick();
    }, HIGHLIGHT_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    dashboardHighlighter.current.setFinder(result && tourStep !== null ? DASHBOARD_TOUR[tourStep].find : null);
  }, [result, tourStep]);

  const finishRound = useCallback(async () => {
    if (!current) return;
    try {
      const response = await fetch('/api/demo/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: current }),
      });
      const state = await readData<{ score: RoundScore }>(response);
      setResult((previous) => previous ?? { scenario: current, score: state.score });
      highlighter.current.setTarget(null);
    } catch {
      setError('No se pudo finalizar la partida. Probá de nuevo.');
    }
  }, [current]);

  const leave = useCallback(async () => {
    try {
      await fetch('/api/demo/reset-all', { method: 'POST', keepalive: true });
    } catch {
      // Si el backend no responde igual se vuelve al inicio; la próxima partida reinicia su escenario.
    }
    clearLastGameProject();
    onIdle();
  }, [onIdle]);

  useEffect(() => {
    if (result && projectId) writeLastGameProject(projectId);
  }, [result, projectId]);

  useEffect(() => {
    if (!result || watching) return;
    const timer = window.setTimeout(() => setCountdown(NEXT_PROMPT_SECONDS), STATS_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [result, watching]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      void leave();
      return;
    }
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, leave]);

  const next = nextScenario(scenarios, current);
  const playedName = scenarios.find((scenario) => scenario.key === result?.scenario)?.name ?? '';

  return (
    <main className="flex h-screen flex-col bg-[#1e3a5f]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-2 text-white">
        <span className="mr-auto text-lg font-extrabold">Apagá el incendio con Tino</span>
        <nav className="flex flex-wrap gap-2" aria-label="Escenarios">
          {scenarios.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              onClick={() => void start(scenario.key)}
              disabled={isResetting}
              aria-pressed={scenario.key === current}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60',
                scenario.key === current ? 'bg-orange-500 text-white' : 'bg-white/10 text-blue-100 hover:bg-white/20',
              )}
            >
              {scenario.name}
            </button>
          ))}
          {current && projectId && !result ? (
            <button
              type="button"
              onClick={() => void finishRound()}
              disabled={isResetting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Finalizar partida
            </button>
          ) : null}
          {current ? (
            <button
              type="button"
              onClick={() => void start(current)}
              disabled={isResetting}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-blue-100 hover:bg-white/20 disabled:opacity-60"
            >
              {isResetting ? 'Preparando...' : 'Reiniciar'}
            </button>
          ) : null}
        </nav>
        <button type="button" onClick={() => void leave()} className="text-sm font-bold text-blue-100 hover:text-white">
          Volver al inicio
        </button>
      </header>

      {error ? (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">
          {error}
        </p>
      ) : null}

      {result ? (
        <section aria-label="Resultado de la partida" className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/10 px-3 py-1.5 text-white">
            <div className="mr-auto min-w-0">
              <h2 className="text-lg font-extrabold leading-tight">¡Gracias por jugar!</h2>
              <p className="text-xs text-blue-100">
                Abajo: el Dashboard real de Tino con los datos de tu partida
                {playedName ? ` en «Feria · ${playedName}»` : ''}. En Proyectos la vas a ver marcada.
              </p>
            </div>
            {watching && tourStep === null ? (
              <button
                type="button"
                onClick={() => setTourStep(0)}
                className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-orange-600"
              >
                Ver recorrido del Dashboard
              </button>
            ) : null}
            <dl className="flex flex-wrap gap-1.5">
              {scoreKpis(result.score).map((kpi) => (
                <div key={kpi.label} className="rounded-lg bg-white/10 px-2.5 py-0.5 text-center">
                  <dt className="text-[10px] font-bold text-blue-100">{kpi.label}</dt>
                  <dd className="text-sm font-extrabold">{kpi.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {countdown !== null ? (
            <div
              role="dialog"
              aria-label="¿Jugás el siguiente?"
              className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-1 text-white"
            >
              <span className="text-sm font-extrabold">¿Jugás el siguiente? ({countdown} s)</span>
              {next ? (
                <button
                  type="button"
                  onClick={() => void start(next.key)}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50"
                >
                  Sí, jugar {next.name}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCountdown(null);
                  setWatching(true);
                  setTourStep(0);
                }}
                className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
              >
                Seguir mirando
              </button>
            </div>
          ) : null}
          {tourStep !== null ? (
            <div
              role="dialog"
              aria-label="Recorrido del Dashboard"
              className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2 text-slate-900 shadow"
            >
              <span className="rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                Recorrido {tourStep + 1} de {DASHBOARD_TOUR.length}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{DASHBOARD_TOUR[tourStep].title}</p>
                <p className="text-xs text-slate-600">{DASHBOARD_TOUR[tourStep].text}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTourStep((step) => (step ? step - 1 : 0))}
                  disabled={tourStep === 0}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTourStep((step) => (step !== null && step + 1 < DASHBOARD_TOUR.length ? step + 1 : null))
                  }
                  className="rounded-lg bg-[#1e3a5f] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#16304f]"
                >
                  {tourStep + 1 < DASHBOARD_TOUR.length ? 'Siguiente' : 'Terminar'}
                </button>
                <button
                  type="button"
                  onClick={() => setTourStep(null)}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cerrar recorrido
                </button>
              </div>
            </div>
          ) : null}
          <iframe
            ref={dashboardFrame}
            src={dashboardUrl(projectId)}
            title="Dashboard"
            className="min-h-0 w-full flex-1 rounded-xl border-0 bg-white"
          />
        </section>
      ) : null}

      {result ? null : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-2 pb-2">
          {projectId && current ? (
            <>
              <iframe
                ref={tinoFrame}
                key={`tino-${round}`}
                src={`/projects/${projectId}`}
                title="Tino"
                className="h-full w-full rounded-xl border-0 bg-white"
              />
              <iframe
                key={`juego-${round}`}
                src={`/juego/index.html?escenario=${encodeURIComponent(current)}`}
                title="Juego"
                className="h-full w-full rounded-xl border-0 bg-[#1a1c2c]"
              />
            </>
          ) : (
            <div className="col-span-2 flex items-center justify-center text-lg font-bold text-blue-100">
              {error ? null : 'Preparando el escenario...'}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
