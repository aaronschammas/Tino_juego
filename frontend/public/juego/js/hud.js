import { PRIORITY_LABEL } from './rules.js';

const STAGE_LABEL = { spread: 'Se extiende', explode: 'Explota', escalate: 'Empeora' };

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

/** Interfaz HTML sobre el canvas: título, lista de tareas con progreso, avisos y globo de diálogo. */
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
    this.toastTimer = null;
    this.doc = doc;
  }

  setScenario(name, intro) {
    if (this.title.textContent !== name) this.title.textContent = name;
    if (this.intro.textContent !== intro) this.intro.textContent = intro;
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

  renderTasks(tasks, activeTimer) {
    const items = panelRows(tasks).map(({ task, kind, done, total }) => {
      const li = this.doc.createElement('li');
      const classes = ['task', kind, `priority-${task.priority.toLowerCase()}`];
      if (task.solved) classes.push('solved');
      if (activeTimer?.taskId === task.id) classes.push('active');
      li.className = classes.join(' ');

      const chip = this.doc.createElement('span');
      chip.className = 'chip';
      chip.textContent = PRIORITY_LABEL[task.priority] ?? task.priority;

      const title = this.doc.createElement('span');
      title.className = 'task-title';
      title.textContent = kind === 'sub' ? `└ ${task.title}` : task.title;

      const bar = this.doc.createElement('span');
      bar.className = 'bar';
      const fill = this.doc.createElement('span');
      fill.className = 'fill';
      fill.style.width = `${Math.round(task.progress * 100)}%`;
      bar.append(fill);

      const state = this.doc.createElement('span');
      state.className = 'task-state';
      state.textContent = kind === 'group'
        ? `${done}/${total} subtareas · el timer va en cada subtarea`
        : taskStatusLabel(task, activeTimer);

      li.append(chip, title, bar, state);

      const warning = kind === 'group' ? null : dangerLabel(task);
      if (warning) {
        const danger = this.doc.createElement('span');
        danger.className = `danger${task.remaining < 8 ? ' urgent' : ''}`;
        danger.textContent = `⚠ ${warning}`;
        li.append(danger);
      }
      return li;
    });
    this.list.replaceChildren(...items);
  }

  /** Globo sobre la cabeza del personaje, en coordenadas de página. */
  setBubble(text, warning, point) {
    this.bubble.hidden = !text;
    if (!text) return;
    if (this.bubbleText.textContent !== text) this.bubbleText.textContent = text;
    const warn = warning ?? '';
    if (this.bubbleWarning.textContent !== warn) this.bubbleWarning.textContent = warn;
    this.bubbleWarning.hidden = !warning;
    this.bubble.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -100%)`;
  }
}
