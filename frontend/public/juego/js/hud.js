import { PRIORITY_LABEL } from './rules.js';

/** Texto de estado de una tarea en el panel. */
export function taskStatusLabel(task, activeTimer) {
  if (task.status === 'DONE') return 'Hecha ✓';
  if (task.solved) return '¡Resuelta! Marcala como Hecha';
  if (activeTimer?.taskId === task.id) return activeTimer.paused ? 'En pausa' : 'Trabajando...';
  if (task.progress > 0) return 'Empezada';
  return 'Sin empezar';
}

/** Interfaz HTML sobre el canvas: título, lista de tareas con progreso y globo de diálogo. */
export class Hud {
  constructor(doc = document) {
    this.title = doc.getElementById('title');
    this.intro = doc.getElementById('intro');
    this.list = doc.getElementById('tasks');
    this.bubble = doc.getElementById('bubble');
    this.bubbleText = doc.getElementById('bubble-text');
    this.bubbleWarning = doc.getElementById('bubble-warning');
    this.status = doc.getElementById('status');
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

  renderTasks(tasks, activeTimer) {
    const items = tasks
      .filter((task) => task.action)
      .map((task) => {
        const li = this.doc.createElement('li');
        li.className = `task priority-${task.priority.toLowerCase()}${task.solved ? ' solved' : ''}${activeTimer?.taskId === task.id ? ' active' : ''}`;

        const chip = this.doc.createElement('span');
        chip.className = 'chip';
        chip.textContent = PRIORITY_LABEL[task.priority] ?? task.priority;

        const title = this.doc.createElement('span');
        title.className = 'task-title';
        title.textContent = task.title;

        const bar = this.doc.createElement('span');
        bar.className = 'bar';
        const fill = this.doc.createElement('span');
        fill.className = 'fill';
        fill.style.width = `${Math.round(task.progress * 100)}%`;
        bar.append(fill);

        const state = this.doc.createElement('span');
        state.className = 'task-state';
        state.textContent = taskStatusLabel(task, activeTimer);

        li.append(chip, title, bar, state);
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
