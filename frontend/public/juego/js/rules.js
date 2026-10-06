// Reglas del juego, sin DOM ni canvas: a partir del estado de Tino decide qué hace el personaje.

export const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const STAGE_VERB = { spread: 'se extiende', explode: 'explota', escalate: 'empeora' };
export const ROUND_SECONDS = 150;
export const STRESS_ALERT = 70;
const STRESS_FULL = 24;

/**
 * Reloj de la partida (lo decide el backend): estado, motivo del final y segundos transcurridos y restantes,
 * extrapolados entre consultas mientras se juega.
 * @param {{ round?: { status: string, reason: string | null, limitSeconds: number, elapsedSeconds: number } } | null} state
 * @param {number} secondsSinceState
 */
export function evaluateRound(state, secondsSinceState) {
  const round = state?.round;
  if (!round) return { status: 'waiting', reason: null, limit: ROUND_SECONDS, elapsed: 0, remaining: ROUND_SECONDS };
  const playing = round.status === 'playing';
  const elapsed = Math.min(round.limitSeconds, round.elapsedSeconds + (playing ? secondsSinceState : 0));
  const remaining = round.status === 'waiting' ? round.limitSeconds : Math.max(0, round.limitSeconds - elapsed);
  return { status: round.status, reason: round.reason, limit: round.limitSeconds, elapsed, remaining };
}

/**
 * Progreso, si está resuelta y cuánto falta para la próxima consecuencia de cada tarea. Entre consultas
 * se extrapola mientras se juega: la tarea con timer avanza y el peligro de las demás crece a la velocidad
 * que mandó el backend (`dangerRate`: 0, 1 o el doble si se trabaja en algo menos urgente).
 * @param {{ tasks?: Array<object>, activeTimer?: { taskId: string | null, paused: boolean } | null, round?: object } | null} state
 * @param {number} secondsSinceState
 */
export function evaluateTasks(state, secondsSinceState) {
  const all = state?.tasks ?? [];
  const since = (state?.round?.status ?? 'playing') === 'playing' ? secondsSinceState : 0;
  const running = state?.activeTimer && !state.activeTimer.paused ? state.activeTimer.taskId : null;

  const tasks = all.map((task) => {
    const isRunning = task.id === running;
    const worked = task.workedSeconds + (isRunning ? since : 0);
    const progress = task.status === 'DONE' ? 1 : task.action ? Math.min(1, worked / Math.max(1, task.workSeconds)) : 0;
    const solved = Boolean(task.solved) || task.status === 'DONE' || (Boolean(task.action) && progress >= 1);

    let danger = task.danger ?? null;
    let rate = 0;
    if (danger !== null && !solved) {
      rate = isRunning ? 0 : task.dangerRate ?? 0;
      danger += since * rate;
    }
    const nextStage = solved ? null : task.nextStage ?? null;
    const remaining = nextStage && danger !== null && rate > 0 ? Math.max(0, (nextStage.at - danger) / rate) : null;
    const stageRatio = nextStage && danger !== null ? Math.min(1, danger / nextStage.at) : 0;
    return { ...task, progress, solved, danger, nextStage, remaining, stageRatio };
  });

  for (const parent of tasks) {
    const children = tasks.filter((task) => task.parentTaskId === parent.id);
    if (!children.length) continue;
    parent.solved = parent.status === 'DONE' || children.every((child) => child.solved);
    parent.progress = children.reduce((sum, child) => sum + child.progress, 0) / children.length;
  }
  return tasks;
}

/** Estrés de 0 a 100: suma de los fuegos activos según su prioridad y lo cerca que están de empeorar; baja de golpe al resolver uno. */
export function computeStress(tasks) {
  const load = tasks
    .filter((task) => task.action && !task.solved)
    .reduce((sum, task) => sum + (PRIORITY_RANK[task.priority] ?? 1) * (1 + (task.stageRatio ?? 0)), 0);
  return Math.min(100, Math.round((load / STRESS_FULL) * 100));
}

/** La tarea sin resolver más urgente: mayor prioridad y, si empatan, la que antes empeora. */
export function mostUrgent(tasks) {
  const soon = (task) => (task.remaining === null || task.remaining === undefined ? Infinity : task.remaining);
  return tasks
    .filter((task) => task.action && !task.solved)
    .reduce((best, task) => {
      if (!best) return task;
      const byPriority = PRIORITY_RANK[task.priority] - PRIORITY_RANK[best.priority];
      if (byPriority !== 0) return byPriority > 0 ? task : best;
      return soon(task) < soon(best) ? task : best;
    }, null);
}

/**
 * Qué hace el personaje:
 *   work       camina al objeto de la tarea con timer y trabaja
 *   paused     espera al lado del objeto (timer en pausa)
 *   finished   la tarea ya está resuelta pero el timer sigue o falta marcarla Hecha
 *   idle       espera a que el visitante inicie un timer
 *   celebrate  todo resuelto
 * `message` es la frase corta del globo (las instrucciones las da el coach) y `warning` avisa si se eligió
 * algo menos urgente.
 * @param {Array<object>} tasks
 * @param {{ taskId: string | null, paused: boolean } | null} activeTimer
 * @param {(action: string) => string} [sayFor]
 * @param {{ status: string, reason: string | null }} [round]
 */
export function decideBehavior(tasks, activeTimer, sayFor = () => '', round = { status: 'playing', reason: null }) {
  const known = tasks.filter((task) => task.action);
  const active = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) : null;

  if (round.status === 'finished') {
    return round.reason === 'cleared'
      ? { mode: 'celebrate', taskId: null, message: '¡Apagamos todo!' }
      : { mode: 'idle', taskId: null, message: round.reason === 'ended' ? '¡Hasta la próxima!' : '¡Uf! Se acabó el tiempo.' };
  }

  if (active?.action) {
    if (active.solved) {
      return { mode: 'finished', taskId: active.id, message: active.status === 'DONE' ? '¡Hecho!' : '¡Listo! Marcala como Hecha.' };
    }
    if (activeTimer.paused) {
      return { mode: 'paused', taskId: active.id, message: 'Pausa...' };
    }
    const urgent = mostUrgent(known);
    const warning =
      urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[active.priority]
        ? `¡Ojo! "${urgent.title}" es más urgente.`
        : null;
    return { mode: 'work', taskId: active.id, message: sayFor(active.action), warning };
  }

  if (activeTimer) {
    const parent = activeTimer.taskId ? tasks.find((task) => task.id === activeTimer.taskId) : null;
    return { mode: 'idle', taskId: null, message: parent ? '¿Cuál subtarea hago?' : 'Ese timer no es de acá.' };
  }

  if (known.length > 0 && known.every((task) => task.solved)) {
    const pending = known.find((task) => task.status !== 'DONE');
    return { mode: 'celebrate', taskId: null, message: pending ? '¡Falta marcarla como Hecha!' : '¡Lo logramos!' };
  }

  const urgent = mostUrgent(known);
  if (urgent && urgent.remaining !== null && urgent.remaining !== undefined && urgent.remaining < 12) {
    return { mode: 'idle', taskId: null, message: `¡Rápido, que ${STAGE_VERB[urgent.nextStage.kind]}!` };
  }

  if (known.some((task) => task.solved && task.status !== 'DONE')) {
    return { mode: 'idle', taskId: null, message: '¡Marcala como Hecha!' };
  }

  return { mode: 'idle', taskId: null, message: urgent ? '¡Ayuda! Iniciá un timer en Tino.' : 'Esperando a Tino...' };
}
