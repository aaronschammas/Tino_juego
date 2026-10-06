// La "Tino" de la partida, sin DOM ni canvas: tareas y subtareas, estados, cronómetro con duración,
// vencimientos, puntaje y qué hace el personaje. El tiempo corre en minutos de oficina (1 s real = 1 min).

export const PRIORITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const PRIORITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const STATUS = { TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', BLOCKED: 'BLOCKED', DONE: 'DONE' };
export const STATUS_LABEL = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', BLOCKED: 'Bloqueada', DONE: 'Completada' };
export const COLUMN_LABEL = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', BLOCKED: 'Bloqueadas', DONE: 'Completadas' };
export const MINUTES_PER_SECOND = 1;
export const DAY_START = 9 * 60;
export const LIMIT_MINUTES = 240;
export const DEFAULT_TIMER_MINUTES = 30;
export const POINTS = { onTime: 100, late: 40, bonus: 30, estimate: 20, mistake: 25 };
export const ACTIVE_TIMER_ERROR = 'Ya tienes un timer activo. Detenlo antes de cambiar de tarea.';

/** Más urgente primero: mayor prioridad y, si empatan, la que vence antes. */
export function byUrgency(a, b) {
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.due - b.due;
}

/** Estado de una tarea padre según sus subtareas (misma regla que el backend de Tino). */
export function resolveParentStatus(statuses) {
  if (!statuses.length) return null;
  if (statuses.every((status) => status === STATUS.DONE)) return STATUS.DONE;
  if (statuses.some((status) => status === STATUS.BLOCKED)) return STATUS.BLOCKED;
  if (statuses.some((status) => status === STATUS.IN_PROGRESS || status === STATUS.DONE)) return STATUS.IN_PROGRESS;
  return STATUS.TODO;
}

/** Calidad del minijuego de 0 a 1: baja con cada error y con cada segundo después de los primeros 8. */
export function qualityFrom({ seconds, mistakes }) {
  return Math.max(0, Math.min(1, 1 - mistakes * 0.2 - Math.max(0, seconds - 8) * 0.04));
}

/** Resultado de una tarea para las estadísticas: pending | on-time | late. */
export function outcomeOf(task) {
  if (task.status !== STATUS.DONE || task.doneAt === null) return 'pending';
  return task.doneAt > task.due ? 'late' : 'on-time';
}

/** Minutos como "HH:MM:SS" (como `secondsToHMS` de Tino). */
export function minutesToHMS(minutes) {
  const total = Math.max(0, Math.round(minutes * 60));
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Minutos como el reloj del temporizador de Tino: "MM:SS" o "HH:MM:SS". */
export function formatTimer(minutes) {
  const total = Math.max(0, Math.floor(minutes * 60));
  const pad = (value) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  return `${hours > 0 ? `${pad(hours)}:` : ''}${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Minuto de la partida como hora de la oficina ("09:45"). */
export function clockLabel(minutes) {
  const total = DAY_START + Math.floor(minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Duración ingresada en horas y minutos (como `parseTaskDuration` de Tino); null si no es válida. */
export function parseDuration(hours, minutes) {
  if (!/^\d{1,3}$/.test(String(hours)) || !/^\d{1,2}$/.test(String(minutes))) return null;
  if (Number(minutes) > 59) return null;
  return Number(hours) * 60 + Number(minutes);
}

/** Minutos de una sesión normalizados en horas y minutos (los minutos de más pasan a horas). */
export function normalizeDuration(hours, minutes) {
  const total = (Number.parseInt(hours, 10) || 0) * 60 + (Number.parseInt(minutes, 10) || 0);
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

/**
 * La partida. Las tareas son las de un proyecto de Tino: tareas simples y una tarea padre con subtareas.
 * Solo las tareas simples y las subtareas tienen trabajo (minijuego), estimación y cronómetro.
 */
export class OfficeSim {
  constructor(defs) {
    this.tasks = [];
    for (const def of defs) {
      const { subtasks = [], ...rest } = def;
      this.tasks.push(this.createTask(rest, null));
      for (const sub of subtasks) this.tasks.push(this.createTask({ appearAt: def.appearAt ?? 0, ...sub }, def.id));
    }
    for (const parent of this.tasks.filter((task) => this.isParent(task))) {
      parent.due = Math.max(...this.children(parent).map((child) => child.due));
    }
    this.started = false;
    this.elapsed = 0;
    this.timer = null;
    this.loose = 0;
    this.picks = 0;
    this.goodPicks = 0;
    this.mistakes = 0;
    this.finished = null;
    this.events = [];
  }

  createTask(def, parentId) {
    return {
      description: '',
      estimate: 0,
      appearAt: 0,
      ...def,
      parentId,
      due: (def.appearAt ?? 0) + (def.dueIn ?? 0),
      appeared: (def.appearAt ?? 0) <= 0,
      status: STATUS.TODO,
      assigned: false,
      actual: 0,
      solved: false,
      quality: 0,
      started: false,
      mistake: false,
      overdue: false,
      doneAt: null,
    };
  }

  task(id) {
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  children(parent) {
    return this.tasks.filter((task) => task.parentId === parent.id);
  }

  isParent(task) {
    return this.tasks.some((candidate) => candidate.parentId === task.id);
  }

  /** Tareas de la raíz que ya llegaron, en el orden del proyecto. */
  get roots() {
    return this.tasks.filter((task) => !task.parentId && task.appeared);
  }

  /** Tareas con trabajo (simples y subtareas) que ya llegaron. */
  get work() {
    return this.tasks.filter((task) => task.minigame && task.appeared);
  }

  get running() {
    return Boolean(this.timer && !this.timer.paused);
  }

  /** La tarea con trabajo sin resolver más urgente. */
  urgent() {
    return this.work.filter((task) => !task.solved).sort(byUrgency)[0] ?? null;
  }

  /** Minutos que le quedan a una tarea antes de vencer (negativo si ya venció). */
  remaining(task) {
    return task.due - this.elapsed;
  }

  /** Minutos que le quedan al cronómetro (negativo si ya se cumplió). */
  timerRemaining() {
    return this.timer ? this.timer.target - this.timer.elapsed : 0;
  }

  /** Minutos sugeridos al iniciar el cronómetro: lo que falta de la estimación o 30 (como Tino). */
  suggestedMinutes(task) {
    const left = task?.estimate ? Math.round(task.estimate - task.actual) : 0;
    return left > 0 ? left : DEFAULT_TIMER_MINUTES;
  }

  /** Avanza el reloj de la oficina: cronómetro, tareas que llegan, vencimientos y fin de la partida. */
  tick(dt) {
    if (!this.started || this.finished) return;
    const minutes = dt * MINUTES_PER_SECOND;
    this.elapsed += minutes;

    if (this.running) {
      this.timer.elapsed += minutes;
      const task = this.task(this.timer.taskId);
      if (task) task.actual += minutes;
      else this.loose += minutes;
      if (!this.timer.overtime && this.timer.elapsed >= this.timer.target) {
        this.timer.overtime = true;
        this.events.push({ type: 'overtime', taskId: this.timer.taskId });
      }
    }

    const waiting = this.tasks.filter((task) => !task.appeared && !task.parentId);
    const allDone = this.work.every((task) => task.status === STATUS.DONE);
    for (const task of waiting) {
      if (this.elapsed < task.appearAt && !(allDone && task === waiting[0])) continue;
      const early = Math.max(0, task.appearAt - this.elapsed);
      for (const target of [task, ...this.children(task)]) {
        target.due -= early;
        target.appearAt -= early;
        target.appeared = true;
      }
      this.events.push({ type: 'new', taskId: task.id });
    }

    for (const task of this.work) {
      if (task.overdue || task.status === STATUS.DONE || this.elapsed <= task.due) continue;
      task.overdue = true;
      this.events.push({ type: 'overdue', taskId: task.id });
    }

    if (this.elapsed >= LIMIT_MINUTES) this.finish('timeout');
  }

  /**
   * Inicia el cronómetro de una tarea por `minutes` (null = sin vincular). Como Tino: no se puede con otro timer
   * activo ni en una tarea padre; se asigna sola y pasa a En progreso. Si había algo más urgente sin resolver,
   * cuenta como error de prioridad la primera vez y devuelve cuál era.
   */
  startTimer(taskId, minutes) {
    if (this.finished) return { ok: false, error: 'finished' };
    if (this.timer) return { ok: false, error: 'active' };
    if (!(minutes > 0)) return { ok: false, error: 'duration' };
    const task = taskId ? this.task(taskId) : null;
    if (taskId && (!task?.appeared || this.isParent(task))) return { ok: false, error: 'parent' };

    this.started = true;
    this.timer = { taskId: task?.id ?? null, target: minutes, elapsed: 0, paused: false, overtime: false };
    if (!task) return { ok: true, urgentId: null };

    task.assigned = true;
    this.setStatusRaw(task, STATUS.IN_PROGRESS);
    if (task.started || task.solved) return { ok: true, urgentId: null };

    task.started = true;
    this.picks += 1;
    const urgent = this.urgent();
    if (urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[task.priority]) {
      task.mistake = true;
      this.mistakes += 1;
      return { ok: true, urgentId: urgent.id };
    }
    this.goodPicks += 1;
    return { ok: true, urgentId: null };
  }

  pauseTimer() {
    if (this.timer) this.timer.paused = true;
  }

  resumeTimer() {
    if (this.timer) this.timer.paused = false;
  }

  /** "Detener temporizador": se registra lo trabajado y la tarea queda como estaba. */
  stopTimer() {
    this.timer = null;
  }

  /** "TIEMPO CUMPLIDO" → +5 / +10 / +15 min del temporizador: suma minutos a la sesión en curso. */
  addMinutes(minutes) {
    if (!this.timer || !(minutes > 0)) return;
    this.timer.target += minutes;
    this.timer.overtime = this.timer.elapsed >= this.timer.target;
    this.timer.paused = false;
  }

  /** "Finalizar y Completar Tarea" del temporizador: completa la tarea del timer y lo detiene. */
  finishTimerTask() {
    const taskId = this.timer?.taskId;
    if (!taskId) return { ok: false };
    return this.setStatus(taskId, STATUS.DONE);
  }

  /** "Tomar tarea": se asigna a quien juega. */
  take(id) {
    const task = this.task(id);
    if (task) task.assigned = true;
  }

  /** El minijuego quedó resuelto: el trabajo está hecho, falta completarla en Tino. */
  solve(id, quality = 1) {
    const task = this.task(id);
    if (!task || task.solved) return;
    task.solved = true;
    task.quality = quality;
    this.events.push({ type: 'solved', taskId: id });
  }

  /**
   * Cambia el estado desde el menú de la tarjeta. Completar exige que el trabajo esté hecho (en una tarea padre,
   * el de todas sus subtareas) y detiene el timer de esa tarea; una tarea padre arrastra a sus subtareas.
   */
  setStatus(id, status) {
    const task = this.task(id);
    if (this.finished || !task) return { ok: false };
    const targets = this.isParent(task) ? this.children(task) : [task];
    if (status === STATUS.DONE && targets.some((target) => !target.solved)) return { ok: false, error: 'unsolved' };
    if (this.timer && targets.some((target) => target.id === this.timer.taskId) && status !== STATUS.IN_PROGRESS) {
      this.timer = null;
    }
    for (const target of targets) {
      if (status !== STATUS.DONE && target.status === STATUS.DONE && this.isParent(task)) continue;
      this.setStatusRaw(target, status);
    }
    if (this.isParent(task)) this.syncParent(task);
    if (status === STATUS.DONE) {
      this.events.push({ type: 'done', taskId: id, late: targets.some((target) => outcomeOf(target) === 'late') });
      if (this.tasks.filter((candidate) => candidate.minigame).every((candidate) => candidate.status === STATUS.DONE)) {
        this.finish('cleared');
      }
    }
    return { ok: true };
  }

  setStatusRaw(task, status) {
    task.status = status;
    if (task.minigame) task.doneAt = status === STATUS.DONE ? (task.doneAt ?? this.elapsed) : null;
    const parent = task.parentId ? this.task(task.parentId) : null;
    if (parent) this.syncParent(parent);
  }

  syncParent(parent) {
    parent.status = resolveParentStatus(this.children(parent).map((child) => child.status)) ?? parent.status;
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = reason;
    this.timer = null;
    this.events.push({ type: 'finished', reason });
  }

  drainEvents() {
    return this.events.splice(0);
  }

  /**
   * Qué control de Tino resaltar (el juego no tiene instrucciones escritas):
   *   widget-finish  "Finalizar y Completar Tarea" (el trabajo del timer ya está hecho)
   *   widget-resume  el timer quedó en pausa
   *   widget-add     se cumplió el tiempo y el trabajo no está hecho: +5 min
   *   status:<id>    completar una tarea resuelta sin timer
   *   timer:<id>     iniciar el cronómetro de lo más urgente
   */
  hint() {
    if (this.finished) return null;
    const active = this.timer?.taskId ? this.task(this.timer.taskId) : null;
    if (active?.solved) return 'widget-finish';
    if (this.timer?.paused) return 'widget-resume';
    if (this.timer?.overtime) return 'widget-add';
    if (this.timer) return null;
    const solved = this.work.find((task) => task.solved && task.status !== STATUS.DONE);
    if (solved) return `status:${solved.id}`;
    const urgent = this.urgent();
    return urgent ? `timer:${urgent.id}` : null;
  }

  points() {
    const earned = this.tasks.reduce((sum, task) => {
      const outcome = outcomeOf(task);
      if (!task.minigame || outcome === 'pending') return sum;
      const base = outcome === 'on-time' ? POINTS.onTime : POINTS.late;
      const estimate = task.actual <= task.estimate ? POINTS.estimate : 0;
      return sum + base + estimate + Math.round(task.quality * POINTS.bonus);
    }, 0);
    return Math.max(0, earned - this.mistakes * POINTS.mistake);
  }

  /** Números del proyecto (las tarjetas de arriba de Tino). */
  stats() {
    const roots = this.roots;
    const subtasks = this.tasks.filter((task) => task.parentId && task.appeared);
    return {
      tasks: roots.length,
      done: roots.filter((task) => task.status === STATUS.DONE).length,
      blocked: roots.filter((task) => task.status === STATUS.BLOCKED).length,
      estimate: this.work.reduce((sum, task) => sum + task.estimate, 0),
      actual: this.work.reduce((sum, task) => sum + task.actual, 0) + this.loose,
      subtasks: subtasks.length,
      parents: roots.filter((task) => this.isParent(task)).length,
    };
  }

  /** Estadísticas de la pantalla final. */
  score() {
    const work = this.tasks.filter((task) => task.minigame);
    const outcomes = work.map(outcomeOf);
    return {
      reason: this.finished,
      total: work.length,
      onTime: outcomes.filter((outcome) => outcome === 'on-time').length,
      late: outcomes.filter((outcome) => outcome === 'late').length,
      pending: outcomes.filter((outcome) => outcome === 'pending').length,
      withinEstimate: work.filter((task, index) => outcomes[index] !== 'pending' && task.actual <= task.estimate).length,
      efficiency: this.picks ? Math.round((this.goodPicks / this.picks) * 100) : null,
      minutes: this.elapsed,
      actual: work.reduce((sum, task) => sum + task.actual, 0) + this.loose,
      estimate: work.reduce((sum, task) => sum + task.estimate, 0),
      points: this.points(),
      tasks: work.map((task, index) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        actual: task.actual,
        estimate: task.estimate,
        outcome: outcomes[index],
      })),
    };
  }

  /**
   * Qué hace el personaje:
   *   work       camina a la tarea del timer y trabaja (ahí se abre el minijuego)
   *   wait       espera al lado de la tarea (timer en pausa o trabajo terminado)
   *   idle       espera en su lugar
   *   celebrate  todo completado
   */
  behavior(sayFor = () => '') {
    if (this.finished) {
      return this.finished === 'cleared'
        ? { mode: 'celebrate', taskId: null, message: '¡Oficina en orden!' }
        : { mode: 'idle', taskId: null, message: '¡Uf! Se terminó el día.' };
    }
    const active = this.timer?.taskId ? this.task(this.timer.taskId) : null;
    if (this.timer && !active) return { mode: 'idle', taskId: null, message: 'Ese tiempo no es de ninguna tarea.' };
    if (active?.solved) return { mode: 'wait', taskId: active.id, message: '¡Listo! Finalizá y completá la tarea.' };
    if (active && this.timer.paused) return { mode: 'wait', taskId: active.id, message: 'Pausa...' };
    if (active) {
      const urgent = this.urgent();
      const warning = urgent && PRIORITY_RANK[urgent.priority] > PRIORITY_RANK[active.priority] ? '¡Había algo más urgente!' : null;
      return { mode: 'work', taskId: active.id, message: sayFor(active.id), warning };
    }
    if (this.work.some((task) => task.solved && task.status !== STATUS.DONE)) {
      return { mode: 'idle', taskId: null, message: '¡Falta marcarla como completada!' };
    }
    return { mode: 'idle', taskId: null, message: this.started ? '¿Qué hago ahora?' : '¡Ayuda! Iniciá el ⏱ de una tarea.' };
  }
}
