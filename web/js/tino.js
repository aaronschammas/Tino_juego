// Panel "Tino": las tareas del proyecto como tarjetas de Tino, con timer, vencimiento y completar.
import { formatClock, outcomeOf, PRIORITY_LABEL } from './sim.js';

const STATUS_LABEL = { TODO: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Completada' };
const DUE_SOON = 10;

/** Texto y tono del vencimiento de una tarea según cuánto le queda. */
export function dueLabel(task, remaining) {
  if (task.status === 'DONE') {
    return outcomeOf(task) === 'late' ? { text: 'Completada vencida', tone: 'late' } : { text: 'A tiempo ✓', tone: 'ok' };
  }
  if (remaining < 0) return { text: `Vencida hace ${formatClock(-remaining)}`, tone: 'late' };
  return { text: `Vence en ${formatClock(remaining)}`, tone: remaining <= DUE_SOON ? 'soon' : '' };
}

/** Cambia el texto de un nodo solo si es distinto (evita trabajo de layout innecesario). */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function setClass(node, className) {
  if (node.className !== className) node.className = className;
}

/** Lista de tareas de Tino. Las tarjetas se crean una vez por tarea y se actualizan en el lugar. */
export class TinoPanel {
  constructor({ onStart, onPause, onComplete }, doc = document) {
    this.doc = doc;
    this.pending = doc.getElementById('tino-tasks');
    this.done = doc.getElementById('tino-done');
    this.doneTitle = doc.getElementById('tino-done-title');
    this.clock = doc.getElementById('tino-clock');
    this.cards = new Map();
    this.handlers = { onStart, onPause, onComplete };
  }

  createCard(task) {
    const make = (tag, className, text) => {
      const node = this.doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const card = {
      li: make('li', 'tino-card'),
      priority: make('span', `tino-chip priority-${task.priority.toLowerCase()}`, PRIORITY_LABEL[task.priority]),
      status: make('span', 'tino-chip'),
      due: make('span', 'tino-due'),
      title: make('h3', 'tino-title', task.title),
      description: make('p', 'tino-desc', task.description),
      worked: make('span', 'tino-worked'),
      timer: make('button', 'tino-btn timer'),
      complete: make('button', 'tino-btn complete', '✓ Completar'),
    };
    const chips = make('div', 'tino-chips');
    chips.append(card.priority, card.status, card.due);
    const actions = make('div', 'tino-actions');
    actions.append(card.timer, card.complete);
    const footer = make('div', 'tino-footer');
    footer.append(card.worked, actions);
    card.li.append(chips, card.title, card.description, footer);
    card.timer.type = 'button';
    card.complete.type = 'button';
    card.timer.addEventListener('click', () => {
      if (card.timer.dataset.running === 'true') this.handlers.onPause(task.id);
      else this.handlers.onStart(task.id);
    });
    card.complete.addEventListener('click', () => this.handlers.onComplete(task.id));
    card.li.addEventListener('animationend', () => card.li.classList.remove('shake', 'arrived'));
    return card;
  }

  /** Dibuja el estado de la partida: tarjetas, botón resaltado (`hint`) y reloj. */
  render(sim) {
    setText(this.clock, `⏱ ${formatClock(sim.elapsed)}`);
    const hint = sim.hint();
    for (const task of sim.visible) {
      let card = this.cards.get(task.id);
      if (!card) {
        card = this.createCard(task);
        this.cards.set(task.id, card);
        if (sim.started) {
          this.pending.prepend(card.li);
          card.li.classList.add('arrived');
        } else {
          this.pending.append(card.li);
        }
      }
      const isDone = task.status === 'DONE';
      const list = isDone ? this.done : this.pending;
      if (card.li.parentElement !== list) list.prepend(card.li);

      const running = sim.activeId === task.id;
      const due = dueLabel(task, sim.remaining(task));
      setClass(card.status, `tino-chip status-${task.status.toLowerCase()}`);
      setText(card.status, task.solved && !isDone ? 'Lista' : STATUS_LABEL[task.status]);
      setText(card.due, due.text);
      setClass(card.due, `tino-due ${due.tone}`);
      setText(card.worked, `Real: ${formatClock(task.worked)}`);
      setText(card.timer, running ? '⏸ Pausar' : '▶ Iniciar');
      card.timer.dataset.running = String(running);
      card.timer.disabled = task.solved || Boolean(sim.finished);
      card.complete.disabled = !task.solved || isDone || Boolean(sim.finished);
      card.timer.classList.toggle('hint', hint?.taskId === task.id && hint.button === 'start');
      card.complete.classList.toggle('hint', hint?.taskId === task.id && hint.button === 'complete');
      card.li.classList.toggle('running', running);
      card.li.classList.toggle('is-done', isDone);
      card.li.classList.toggle('overdue', !isDone && sim.remaining(task) < 0);
    }
    this.doneTitle.hidden = this.done.children.length === 0;

    const hintKey = hint ? `${hint.taskId}:${hint.button}` : null;
    if (hintKey && hintKey !== this.hintKey) this.cards.get(hint.taskId)?.li.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    this.hintKey = hintKey;
  }

  /** Sacude la tarjeta de la tarea que era más urgente (error de prioridad). */
  shake(taskId) {
    const card = this.cards.get(taskId);
    if (!card) return;
    card.li.classList.remove('shake');
    void card.li.offsetWidth;
    card.li.classList.add('shake');
  }
}
