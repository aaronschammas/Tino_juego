// Reglas del juego, sin DOM ni canvas: a partir del estado de Tino decide qué hace el personaje.

export const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const STAGE_VERB = { spread: 'se extiende', explode: 'explota', escalate: 'empeora' };

/**
 * Progreso, si está resuelta y cuánto falta para la próxima consecuencia de cada tarea. Entre consultas
 * se extrapola: la tarea con timer avanza y el peligro de las demás crece (el doble si se trabaja en
 * algo menos urgente que ellas).
 * @param {{ tasks?: Array<object>, activeTimer?: { taskId: string | null, paused: boolean } | null } | null} state
 * @param {number} secondsSinceState
 */
export function evaluateTasks(state, secondsSinceState) {
  const all = state?.tasks ?? [];
  const running = state?.activeTimer && !state.activeTimer.paused ? state.activeTimer.taskId : null;
  const runningRank = PRIORITY_RANK[all.find((task) => task.id === running)?.priority] ?? 0;

  const tasks = all.map((task) => {
    const isRunning = task.id === running;
    const worked = task.workedSeconds + (isRunning ? secondsSinceState : 0);
    const progress = task.status === 'DONE' ? 1 : task.action ? Math.min(1, worked / Math.max(1, task.workSeconds)) : 0;
    const solved = Boolean(task.solved) || task.status === 'DONE' || (Boolean(task.action) && progress >= 1);

    let danger = task.danger ?? null;
    let rate = 0;
    if (danger !== null && !solved) {
      rate = isRunning ? 0 : running && runningRank < PRIORITY_RANK[task.priority] ? 2 : 1;
      danger += secondsSinceState * rate;
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
        ? `¡Ojo! "${urgent.title}" es más urgente y crece el doble.`
        : null;
    return { mode: 'work', taskId: active.id, message: sayFor(active.action), warning };
  }

  if (activeTimer) {
    const parent = activeTimer.taskId ? tasks.find((task) => task.id === activeTimer.taskId) : null;
    return {
      mode: 'idle',
      taskId: null,
      message: parent ? 'Ese timer no es de un problema: usá las subtareas.' : 'Ese timer no es de este escenario.',
    };
  }

  if (known.length > 0 && known.every((task) => task.solved)) {
    const pending = known.find((task) => task.status !== 'DONE');
    return pending
      ? { mode: 'celebrate', taskId: null, message: `Falta marcar como Hecha "${pending.title}".` }
      : { mode: 'celebrate', taskId: null, message: '¡Todo resuelto! Mirá tus números en el Dashboard.' };
  }

  const urgent = mostUrgent(known);
  if (urgent && urgent.remaining !== null && urgent.remaining !== undefined && urgent.remaining < 12) {
    return {
      mode: 'idle',
      taskId: null,
      message: `¡Rápido! "${urgent.title}" ${STAGE_VERB[urgent.nextStage.kind]} en ${Math.ceil(urgent.remaining)} s.`,
    };
  }

  const toClose = known.find((task) => task.solved && task.status !== 'DONE');
  if (toClose) {
    return { mode: 'idle', taskId: null, message: `Marcá como Hecha "${toClose.title}" en Tino.` };
  }

  return {
    mode: 'idle',
    taskId: null,
    message: urgent ? `Iniciá el timer de "${urgent.title}" en Tino.` : 'Esperando las tareas de Tino...',
  };
}
