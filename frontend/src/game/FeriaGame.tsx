'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export interface DemoScenarioSummary {
  key: string;
  name: string;
  intro: string;
}

const ROTATION_KEY = 'feria:rotation';

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

/** Pantalla de juego: Tino real a la izquierda (el proyecto del escenario) y el juego a la derecha. */
export default function FeriaGame() {
  const [scenarios, setScenarios] = useState<DemoScenarioSummary[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (key: string) => {
    setIsResetting(true);
    setError(null);
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
        <Link href="/" className="text-sm font-bold text-blue-100 hover:text-white">
          Volver al inicio
        </Link>
      </header>

      {error ? (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-2 pb-2">
        {projectId && current ? (
          <>
            <iframe
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
    </main>
  );
}
