// La "Tino" de la partida, sin DOM ni canvas: tareas, timer, vencimientos, puntaje y qué hace el personaje.

export const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const LIMIT_SECONDS = 240;
export const POINTS = { onTime: 100, late: 40, bonus: 30, mistake: 25 };

/** Más urgente primero: mayor prioridad y, si empatan, la que vence antes. */
export function byUrgency(a, b) {
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.due - b.due;
}

/** Calidad del minijuego de 0 a 1: baja con cada error y con cada segundo después de los primeros 8. */
export function qualityFrom({ seconds, mistakes }) {
  return Math.max(0, Math.min(1, 1 - mistakes * 0.2 - Math.max(0, seconds - 8) * 0.04));
}

/** Estado de una tarea para el panel y las estadísticas: pending | on-time | late. */
export function outcomeOf(task) {
  if (task.status !== 'DONE') return 'pending';
  return task.doneAt > task.due ? 'late' : 'on-time';
}

/**
 * La partida. El reloj arranca con el primer timer; las tareas llegan en `appearAt` y vencen `dueIn`
 * segundos después. Termina cuando todas están completadas o a los LIMIT_SECONDS.
 */
export class OfficeSim {
  constructor(defs) {
    this.tasks = defs.map((def) => ({
      ...def,
      due: def.appearAt + def.dueIn,
      appeared: def.appearAt <= 0,
      status: 'TODO',
      worked: 0,
      solved: false,
      quality: 0,
      started: false,
      mistake: false,
      overdue: false,
      doneAt: null,
    }));
    this.started = false;
    this.elapsed = 0;
    this.activeId = null;
    this.picks = 0;
    this.goodPicks = 0;
    this.mistakes = 0;
    this.finished = null;
    this.events = [];
  }

  get visible() {
    return this.tasks.filter((task) => task.appeared);
  }

  get active() {
    return this.tasks.find((task) => task.id === this.activeId) ?? null;
  }

  task(id) {
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  /** La tarea sin resolver más urgente de las que ya llegaron. */
  urgent() {
    return this.visible.filter((task) => !task.solved).sort(byUrgency)[0] ?? null;
  }

  /** Segundos que le quedan a una tarea antes de vencer (negativo si ya venció). */
  remaining(task) {
    return task.due - this.elapsed;
  }

  /** Avanza el reloj: suma tiempo al timer activo, hace llegar tareas, avisa vencimientos y termina la partida. */
  tick(dt) {
    if (!this.started || this.finished) return;
    this.elapsed += dt;
    const active = this.active;
    if (active && !active.solved) active.worked += dt;

    const waiting = this.tasks.filter((task) => !task.appeared);
    const allDone = this.visible.every((task) => task.status === 'DONE');
    for (const task of waiting) {
      if (this.elapsed < task.appearAt && !(allDone && task === waiting[0])) continue;
      if (this.elapsed < task.appearAt) {
        task.due -= task.appearAt - this.elapsed;
        task.appearAt = this.elapsed;
      }
      task.appeared = true;
      this.events.push({ type: 'new', taskId: task.id });
    }

    for (const task of this.visible) {
      if (task.overdue || task.status === 'DONE' || this.elapsed <= task.due) continue;
      task.overdue = true;
      this.events.push({ type: 'overdue', taskId: task.id });
    }

    if (this.elapsed >= LIMIT_SECONDS) this.finish('timeout');
  }

  /**
   * Inicia el timer de una tarea (apaga el que estaba, como Tino). Si había algo más urgente sin resolver
   * cuenta como error de prioridad la primera vez y devuelve cuál era.
   */
  startTimer(id) {
    const task = this.task(id);
    if (this.finished || !task?.appeared || task.solved) return { ok: false };
    this.started = true;
    this.activeId = id;
    task.status = 'IN_PROGRESS';
    if (task.started) return { ok: true, urgentId: null };

    task.started = true;
    this.picks += 1;
    const urgent = this.urgent();
    const wrong = urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[task.priority];
    if (wrong) {
      task.mistake = true;
      this.mistakes += 1;
      return { ok: true, urgentId: urgent.id };
    }
    this.goodPicks += 1;
    return { ok: true, urgentId: null };
  }

  pauseTimer() {
    this.activeId = null;
  }

  /** El minijuego quedó resuelto: se apaga el timer solo y falta marcarla como completada. */
  solve(id, quality = 1) {
    const task = this.task(id);
    if (!task || task.solved) return;
    task.solved = true;
    task.quality = quality;
    if (this.activeId === id) this.activeId = null;
    this.events.push({ type: 'solved', taskId: id });
  }

  /** Mueve a Completadas una tarea resuelta; si pasó su vencimiento queda como completada pero vencida. */
  complete(id) {
    const task = this.task(id);
    if (this.finished || !task?.solved || task.status === 'DONE') return false;
    task.status = 'DONE';
    task.doneAt = this.elapsed;
    this.events.push({ type: 'done', taskId: id, late: outcomeOf(task) === 'late' });
    if (this.tasks.every((candidate) => candidate.status === 'DONE')) this.finish('cleared');
    return true;
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = reason;
    this.activeId = null;
    this.events.push({ type: 'finished', reason });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  /** Qué botón de Tino resaltar: completar lo resuelto o, sin timer, iniciar lo más urgente. */
  hint() {
    if (this.finished) return null;
    const solved = this.visible.find((task) => task.solved && task.status !== 'DONE');
    if (solved) return { taskId: solved.id, button: 'complete' };
    if (this.activeId) return null;
    const urgent = this.urgent();
    return urgent ? { taskId: urgent.id, button: 'start' } : null;
  }

  points() {
    const earned = this.tasks.reduce((sum, task) => {
      const outcome = outcomeOf(task);
      if (outcome === 'pending') return sum;
      return sum + (outcome === 'on-time' ? POINTS.onTime : POINTS.late) + Math.round(task.quality * POINTS.bonus);
    }, 0);
    return Math.max(0, earned - this.mistakes * POINTS.mistake);
  }

  /** Estadísticas de la pantalla final. */
  score() {
    const outcomes = this.tasks.map(outcomeOf);
    return {
      reason: this.finished,
      total: this.tasks.length,
      onTime: outcomes.filter((outcome) => outcome === 'on-time').length,
      late: outcomes.filter((outcome) => outcome === 'late').length,
      pending: outcomes.filter((outcome) => outcome === 'pending').length,
      efficiency: this.picks ? Math.round((this.goodPicks / this.picks) * 100) : null,
      seconds: this.elapsed,
      points: this.points(),
      tasks: this.tasks.map((task, index) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        worked: task.worked,
        outcome: outcomes[index],
      })),
    };
  }

  /**
   * Qué hace el personaje:
   *   work       camina al objeto de la tarea con timer y trabaja (ahí se abre el minijuego)
   *   idle       espera a que se inicie un timer o se complete lo resuelto
   *   celebrate  todo completado
   */
  behavior(sayFor = () => '') {
    if (this.finished) {
      return this.finished === 'cleared'
        ? { mode: 'celebrate', taskId: null, message: '¡Oficina en orden!' }
        : { mode: 'idle', taskId: null, message: '¡Uf! Se terminó el día.' };
    }
    const active = this.active;
    if (active) {
      const urgent = this.urgent();
      const warning = urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[active.priority] ? '¡Había algo más urgente!' : null;
      return { mode: 'work', taskId: active.id, message: sayFor(active.id), warning };
    }
    if (this.visible.some((task) => task.solved && task.status !== 'DONE')) {
      return { mode: 'idle', taskId: null, message: '¡Listo! Completala en Tino.' };
    }
    return { mode: 'idle', taskId: null, message: this.started ? '¿Qué hago ahora?' : '¡Ayuda! Elegí una tarea.' };
  }
}

/** Segundos como reloj "m:ss". */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
