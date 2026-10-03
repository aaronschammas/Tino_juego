// Reglas del juego, sin DOM ni canvas: a partir del estado de Tino decide qué hace el personaje.

export const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

/**
 * Progreso (0 a 1) y si está resuelta cada tarea. A la tarea con timer corriendo se le suman
 * los segundos pasados desde que llegó el estado, para que avance suave entre consultas.
 */
export function evaluateTasks(state, secondsSinceState) {
  const running = state?.activeTimer && !state.activeTimer.paused ? state.activeTimer.taskId : null;
  return (state?.tasks ?? []).map((task) => {
    const worked = task.workedSeconds + (task.id === running ? secondsSinceState : 0);
    const progress = Math.min(1, worked / Math.max(1, task.workSeconds));
    return { ...task, progress, solved: task.status === 'DONE' || progress >= 1 };
  });
}

/** La tarea sin resolver más urgente (empata la que aparece primero). */
export function mostUrgent(tasks) {
  return tasks
    .filter((task) => task.action && !task.solved)
    .reduce((best, task) => (!best || PRIORITY_RANK[task.priority] > PRIORITY_RANK[best.priority] ? task : best), null);
}

/**
 * Qué hace el personaje:
 *   work       camina al objeto de la tarea con timer y trabaja
 *   paused     espera al lado del objeto (timer en pausa)
 *   finished   la tarea ya está resuelta pero el timer sigue o falta marcarla Hecha
 *   idle       espera a que el visitante inicie un timer
 *   celebrate  todo resuelto
 * `message` es lo que dice el globo y `warning` avisa si se eligió algo menos urgente.
 * @param {Array<object>} tasks
 * @param {{ taskId: string | null, paused: boolean } | null} activeTimer
 * @param {(action: string) => string} [sayFor]
 */
export function decideBehavior(tasks, activeTimer, sayFor = () => '') {
  const known = tasks.filter((task) => task.action);
  const active = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) : null;

  if (active?.action) {
    if (active.solved) {
      return {
        mode: 'finished',
        taskId: active.id,
        message: active.status === 'DONE' ? '¡Hecho! Detené el timer en Tino.' : '¡Listo! Detené el timer y marcala como Hecha.',
      };
    }
    if (activeTimer.paused) {
      return { mode: 'paused', taskId: active.id, message: 'Timer en pausa. Reanudalo en Tino.' };
    }
    const urgent = mostUrgent(known);
    const warning =
      urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[active.priority]
        ? `¡Ojo! "${urgent.title}" es más urgente.`
        : null;
    return { mode: 'work', taskId: active.id, message: sayFor(active.action), warning };
  }

  if (activeTimer) {
    return { mode: 'idle', taskId: null, message: 'Ese timer no es de este escenario.' };
  }

  if (known.length > 0 && known.every((task) => task.solved)) {
    const pending = known.find((task) => task.status !== 'DONE');
    return pending
      ? { mode: 'celebrate', taskId: null, message: `Falta marcar como Hecha "${pending.title}".` }
      : { mode: 'celebrate', taskId: null, message: '¡Todo resuelto! Mirá tus números en el Dashboard.' };
  }

  const toClose = known.find((task) => task.solved && task.status !== 'DONE');
  if (toClose) {
    return { mode: 'idle', taskId: null, message: `Marcá como Hecha "${toClose.title}" en Tino.` };
  }

  const urgent = mostUrgent(known);
  return {
    mode: 'idle',
    taskId: null,
    message: urgent ? `Iniciá el timer de "${urgent.title}" en Tino.` : 'Esperando las tareas de Tino...',
  };
}
