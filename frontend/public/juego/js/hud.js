import { PRIORITY_LABEL, STRESS_ALERT } from './rules.js';

const STAGE_LABEL = { spread: 'Se extiende', explode: 'Explota', escalate: 'Empeora' };
const CLOCK_URGENT = 20;
const FINAL_TITLE = {
  cleared: '¡Apagaste todos los incendios!',
  timeout: '¡Se acabó el tiempo!',
  ended: '¡Partida terminada!',
};

/** Texto de estado de una tarea en el panel. */
export function taskStatusLabel(task, activeTimer) {
  if (task.status === 'DONE') return 'Hecha ✓';
  if (task.solved) return '¡Resuelta! Marcala como Hecha';
  if (activeTimer?.taskId === task.id) return activeTimer.paused ? 'En pausa' : 'Trabajando...';
  if (task.progress > 0) return 'Empezada';
  return 'Sin empezar';
}

/** Aviso de la próxima consecuencia ("Explota en 8 s"), o null si no hay. */
export function dangerLabel(task) {
  if (task.solved || !task.nextStage || task.remaining === null || task.remaining === undefined) return null;
  return `${STAGE_LABEL[task.nextStage.kind]} en ${Math.ceil(task.remaining)} s`;
}

/** Tareas del panel: las de la raíz y, debajo de cada una, sus subtareas. Se omiten tareas ajenas al juego. */
export function panelRows(tasks) {
  const rows = [];
  for (const root of tasks.filter((task) => !task.parentTaskId)) {
    const children = tasks.filter((task) => task.parentTaskId === root.id && task.action);
    if (children.length) {
      rows.push({ task: root, kind: 'group', done: children.filter((child) => child.solved).length, total: children.length });
      for (const child of children) rows.push({ task: child, kind: 'sub' });
    } else if (root.action) {
      rows.push({ task: root, kind: 'task' });
    }
  }
  return rows;
}

/** Segundos como reloj "m:ss", redondeando hacia arriba (el reloj llega a 0:00 recién al final). */
export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Filas de la pantalla de fin: fuegos apagados, eficiencia de priorización, tiempo y puntos. */
export function finalLines(score) {
  return [
    ['Fuegos apagados', `${score.firesOut} de ${score.fires}`],
    ['Eficiencia de priorización', score.efficiency === null ? '—' : `${score.efficiency}%`],
    ['Tiempo', formatClock(score.seconds)],
    ['Puntos', String(score.points)],
  ];
}

/** Etiqueta chica del diálogo del coach: bienvenida o número de paso. */
export function coachStepLabel(dialog, intro, steps) {
  if (intro) return `Bienvenida ${intro.index + 1} de ${intro.total}`;
  return dialog.step ? `Paso ${dialog.step} de ${steps}` : '';
}

/**
 * Dónde dibujar el globo (centro x, base y) para que quede sobre la cabeza pero sin salirse de la escena,
 * y cuánto correr la colita para que siga apuntando al personaje.
 */
export function placeBubble(point, size, bounds, margin = 4) {
  const half = size.width / 2;
  const x = Math.min(Math.max(point.x, bounds.left + half + margin), bounds.right - half - margin);
  const y = Math.max(point.y, bounds.top + size.height + margin);
  const tail = Math.min(Math.max(point.x - x + half, 10), size.width - 10);
  return { x, y, tail };
}

/** Cambia el texto de un nodo solo si es distinto (evita trabajo de layout innecesario). */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/** Interfaz HTML sobre el canvas: título, reloj, estrés, tareas con progreso, avisos, globo, coach y pantalla de fin. */
export class Hud {
  constructor(doc = document) {
    this.title = doc.getElementById('title');
    this.intro = doc.getElementById('intro');
    this.list = doc.getElementById('tasks');
    this.bubble = doc.getElementById('bubble');
    this.bubbleText = doc.getElementById('bubble-text');
    this.bubbleWarning = doc.getElementById('bubble-warning');
    this.status = doc.getElementById('status');
    this.toast = doc.getElementById('toast');
    this.clock = doc.getElementById('clock');
    this.stress = doc.getElementById('stress');
    this.stressFill = this.stress?.querySelector('.fill') ?? null;
    this.points = doc.getElementById('points');
    this.final = doc.getElementById('final');
    this.finalTitle = doc.getElementById('final-title');
    this.finalKpis = doc.getElementById('final-kpis');
    this.coach = doc.getElementById('coach');
    this.coachArrow = doc.getElementById('coach-arrow');
    this.coachStep = doc.getElementById('coach-step');
    this.coachTitle = doc.getElementById('coach-title');
    this.coachText = doc.getElementById('coach-text');
    this.coachNext = doc.getElementById('coach-next');
    this.coachHide = doc.getElementById('coach-hide');
    this.bubbleSize = { width: 0, height: 0 };
    this.toastTimer = null;
    this.signature = null;
    this.rows = [];
    this.doc = doc;
  }

  setScenario(name, intro) {
    setText(this.title, name);
    setText(this.intro, intro);
  }

  setStatus(text) {
    this.status.hidden = !text;
    this.status.textContent = text ?? '';
  }

  /** Cartel grande con lo que acaba de pasar (explosión, fuego que se extiende, timer apagado). */
  showToast(text, kind = 'bad') {
    this.toast.textContent = text;
    this.toast.className = `toast-${kind}`;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.hidden = true;
    }, 4000);
  }

  /** Reloj (gris hasta el primer timer, titila en los últimos segundos), barra de estrés y puntos. */
  setMeters(round, stress, points) {
    setText(this.clock, round.status === 'waiting' ? `⏱ ${formatClock(round.limit)} · arranca con tu primer timer` : `⏱ ${formatClock(round.remaining)}`);
    this.clock.classList.toggle('waiting', round.status === 'waiting');
    this.clock.classList.toggle('urgent', round.status === 'playing' && round.remaining <= CLOCK_URGENT);
    this.stress.classList.toggle('high', stress >= STRESS_ALERT);
    const width = `${stress}%`;
    if (this.stressFill.style.width !== width) this.stressFill.style.width = width;
    setText(this.points, `${points} pts`);
  }

  /** Conecta los botones del coach: siguiente (bienvenida), ocultar/saltar y tocar el diálogo oculto para abrirlo. */
  onCoach({ next, hide, expand }) {
    this.coachNext.addEventListener('click', next);
    this.coachHide.addEventListener('click', (event) => {
      event.stopPropagation();
      hide();
    });
    this.coach.addEventListener('click', () => {
      if (this.coach.classList.contains('collapsed')) expand();
    });
    this.coach.addEventListener('animationend', () => this.coach.classList.remove('pop'));
  }

  /** Diálogo del coach: "salta" cuando cambia, apunta a Tino cuando hay que tocar algo allá y se puede ocultar. */
  renderCoach({ dialog, intro, hidden, popped }, steps) {
    this.coach.hidden = false;
    setText(this.coachStep, coachStepLabel(dialog, intro, steps));
    setText(this.coachTitle, dialog.title);
    setText(this.coachText, dialog.text);
    this.coachArrow.hidden = !(dialog.target || dialog.pointsLeft);
    this.coachNext.hidden = !intro;
    setText(this.coachHide, intro ? 'Saltar' : 'Entendido');

    const classes = [dialog.tone, hidden ? 'collapsed' : null];
    if (this.coach.classList.contains('pop') && !popped) classes.push('pop');
    const className = classes.filter(Boolean).join(' ');
    if (this.coach.className !== className) this.coach.className = className;
    if (popped) {
      void this.coach.offsetWidth;
      this.coach.classList.add('pop');
    }
  }

  /** Muestra el resultado de la partida sobre el juego. */
  showFinal(round, score) {
    setText(this.finalTitle, FINAL_TITLE[round.reason] ?? FINAL_TITLE.timeout);
    const items = finalLines(score).flatMap(([label, value]) => {
      const dt = this.doc.createElement('dt');
      dt.textContent = label;
      const dd = this.doc.createElement('dd');
      dd.textContent = value;
      return [dt, dd];
    });
    this.finalKpis.replaceChildren(...items);
    this.final.hidden = false;
  }

  /**
   * Panel de tareas. Las filas se crean solo cuando cambia qué tareas hay; si no, se actualizan en el lugar
   * (así las barras se animan con CSS y no se rehace el DOM cuatro veces por segundo).
   */
  renderTasks(tasks, activeTimer) {
    const rows = panelRows(tasks);
    const signature = rows.map(({ task, kind }) => `${kind}:${task.id}`).join('|');
    if (signature !== this.signature) {
      this.signature = signature;
      this.rows = rows.map(() => this.createRow());
      this.list.replaceChildren(...this.rows.map((row) => row.li));
    }
    rows.forEach((data, index) => this.updateRow(this.rows[index], data, activeTimer));
  }

  createRow() {
    const make = (tag, className) => {
      const node = this.doc.createElement(tag);
      if (className) node.className = className;
      return node;
    };
    const row = {
      li: make('li'),
      chip: make('span', 'chip'),
      title: make('span', 'task-title'),
      bar: make('span', 'bar'),
      fill: make('span', 'fill'),
      state: make('span', 'task-state'),
      danger: make('span', 'danger'),
    };
    row.bar.append(row.fill);
    row.li.append(row.chip, row.title, row.bar, row.state, row.danger);
    return row;
  }

  updateRow(row, { task, kind, done, total }, activeTimer) {
    const classes = ['task', kind, `priority-${task.priority.toLowerCase()}`];
    if (task.solved) classes.push('solved');
    if (activeTimer?.taskId === task.id) classes.push('active');
    const className = classes.join(' ');
    if (row.li.className !== className) row.li.className = className;

    setText(row.chip, PRIORITY_LABEL[task.priority] ?? task.priority);
    setText(row.title, kind === 'sub' ? `└ ${task.title}` : task.title);
    const width = `${Math.round(task.progress * 100)}%`;
    if (row.fill.style.width !== width) row.fill.style.width = width;
    setText(row.state, kind === 'group' ? `${done}/${total} subtareas · el timer va en cada subtarea` : taskStatusLabel(task, activeTimer));

    const warning = kind === 'group' ? null : dangerLabel(task);
    row.danger.hidden = !warning;
    setText(row.danger, warning ? `⚠ ${warning}` : '');
    const dangerClass = `danger${warning && task.remaining < 8 ? ' urgent' : ''}`;
    if (row.danger.className !== dangerClass) row.danger.className = dangerClass;
  }

  /** Globo sobre la cabeza del personaje (coordenadas de página), siempre dentro de `bounds` (la escena). */
  setBubble(text, warning, point, bounds) {
    this.bubble.hidden = !text;
    if (!text) return;
    const warn = warning ?? '';
    if (this.bubbleText.textContent !== text || this.bubbleWarning.textContent !== warn) {
      this.bubbleText.textContent = text;
      this.bubbleWarning.textContent = warn;
      this.bubbleWarning.hidden = !warning;
      this.bubbleSize = { width: this.bubble.offsetWidth, height: this.bubble.offsetHeight };
    }
    const spot = bounds ? placeBubble(point, this.bubbleSize, bounds) : { x: point.x, y: point.y, tail: this.bubbleSize.width / 2 };
    this.bubble.style.setProperty('--tail', `${Math.round(spot.tail)}px`);
    this.bubble.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px) translate(-50%, -100%)`;
  }
}
