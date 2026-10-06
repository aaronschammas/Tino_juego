// Tino dentro del juego: la página del proyecto con sus tarjetas, tablero, cronómetro, temporizador flotante y
// "¡Tiempo cumplido!", con los mismos textos y pasos que la app real. Todo lo que se toca acá llama a OfficeSim.
import {
  ACTIVE_TIMER_ERROR,
  clockLabel,
  formatTimer,
  minutesToHMS,
  normalizeDuration,
  outcomeOf,
  parseDuration,
  PRIORITY_LABEL,
  STATUS,
  STATUS_LABEL,
} from './sim.js';

/** Acciones del menú "→" según el estado actual (las mismas de TaskItem en Tino). */
export const STATUS_ACTIONS = {
  TODO: [[STATUS.IN_PROGRESS, 'Mover a En progreso'], [STATUS.BLOCKED, 'Mover a Bloqueadas'], [STATUS.DONE, 'Marcar como completada']],
  IN_PROGRESS: [[STATUS.DONE, 'Mover a Completadas'], [STATUS.BLOCKED, 'Mover a Bloqueadas'], [STATUS.TODO, 'Volver a Por hacer']],
  BLOCKED: [[STATUS.IN_PROGRESS, 'Mover a En progreso'], [STATUS.DONE, 'Marcar como completada'], [STATUS.TODO, 'Volver a Por hacer']],
  DONE: [[STATUS.IN_PROGRESS, 'Reabrir en En progreso'], [STATUS.BLOCKED, 'Mover a Bloqueadas'], [STATUS.TODO, 'Volver a Por hacer']],
};
export const UNSOLVED_NOTICE = 'Todavía no está hecha: iniciá el ⏱ y resolvela en la oficina.';
const DURATION_ERROR = 'La estimación máxima permitida es de 999 h 59 min';

/** Chip de vencimiento "📅 09:45": rojo si venció sin completarse o se completó tarde. */
export function dueChip(task, remaining) {
  const late = task.status === STATUS.DONE ? outcomeOf(task) === 'late' : remaining < 0;
  return { text: `📅 ${clockLabel(task.due)}`, tone: late ? 'late' : '' };
}

/** Chip de tiempo "⏱ Real: … / Est: …": rojo si se pasó de la estimación (como Tino). */
export function timeChip(task) {
  const real = minutesToHMS(task.actual);
  return {
    text: task.estimate ? `⏱ Real: ${real} / Est: ${minutesToHMS(task.estimate)}` : `⏱ Real: ${real}`,
    over: task.estimate > 0 && task.actual > task.estimate,
  };
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function setClass(node, className) {
  if (node.className !== className) node.className = className;
}

export class TinoApp {
  constructor(sim, { onMistake, onNotice, onChange }, doc = document) {
    this.sim = sim;
    this.doc = doc;
    this.onMistake = onMistake;
    this.onNotice = onNotice;
    this.onChange = onChange;
    this.cards = new Map();
    this.view = 'list';
    this.durationTask = null;
    this.menuTask = null;
    this.expiredShown = false;
    this.widgetOpen = false;
    this.hintKey = null;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      list: $('t-list'),
      board: $('t-board'),
      count: $('t-count'),
      timerPill: $('t-timer-pill'),
      kpiTasks: $('kpi-tasks'),
      kpiTasksSub: $('kpi-tasks-sub'),
      kpiEstimate: $('kpi-estimate'),
      kpiActual: $('kpi-actual'),
      kpiSubtasks: $('kpi-subtasks'),
      kpiSubtasksSub: $('kpi-subtasks-sub'),
      trackingOn: $('t-tracking-on'),
      trackingOff: $('t-tracking-off'),
      trackingTask: $('t-tracking-task'),
      menu: $('t-menu'),
      widget: $('t-widget'),
      widgetOpenButton: $('t-widget-open'),
      widgetRunning: $('t-widget-running'),
      widgetHead: $('t-widget-head'),
      widgetTime: $('t-widget-time'),
      widgetPause: $('t-widget-pause'),
      widgetBadge: $('t-widget-badge'),
      widgetToggle: $('t-widget-toggle'),
      widgetBar: $('t-widget-bar'),
      widgetBody: $('t-widget-body'),
      widgetTask: $('t-widget-task'),
      widgetStatus: $('t-widget-status'),
      widgetTarget: $('t-widget-target'),
      widgetLeft: $('t-widget-left'),
      widgetFinish: $('t-widget-finish'),
      duration: $('t-duration'),
      durationTask: $('t-duration-task'),
      durationHours: $('t-duration-hours'),
      durationMinutes: $('t-duration-minutes'),
      durationError: $('t-duration-error'),
      selector: $('t-selector'),
      selectorProject: $('t-selector-project'),
      selectorTask: $('t-selector-task'),
      selectorHours: $('t-selector-hours'),
      selectorMinutes: $('t-selector-minutes'),
      expired: $('t-expired'),
      expiredTask: $('t-expired-task'),
      expiredHours: $('t-expired-hours'),
      expiredMinutes: $('t-expired-minutes'),
    };
    this.bind();
  }

  /** Conecta botones fijos: vista, temporizador, modales y menú. */
  bind() {
    const { el, doc } = this;
    doc.querySelectorAll('.t-toggle button').forEach((button) => {
      button.addEventListener('click', () => {
        this.view = button.dataset.view;
        this.render();
      });
    });
    doc.getElementById('t-tracking-stop').addEventListener('click', () => this.act(() => this.sim.stopTimer()));

    el.widgetOpenButton.addEventListener('click', () => this.openSelector());
    el.widgetHead.addEventListener('click', () => {
      this.widgetOpen = !this.widgetOpen;
      this.render();
    });
    el.widgetPause.addEventListener('click', (event) => {
      event.stopPropagation();
      this.act(() => (this.sim.timer?.paused ? this.sim.resumeTimer() : this.sim.pauseTimer()));
    });
    el.widgetFinish.addEventListener('click', () => this.act(() => this.complete(() => this.sim.finishTimerTask())));
    doc.getElementById('t-widget-stop').addEventListener('click', () => this.act(() => this.sim.stopTimer()));

    for (const modal of [el.duration, el.selector]) {
      modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => this.closeModals()));
    }
    for (const [hours, minutes] of [[el.durationHours, el.durationMinutes], [el.selectorHours, el.selectorMinutes], [el.expiredHours, el.expiredMinutes]]) {
      const normalize = () => {
        const value = normalizeDuration(hours.value, minutes.value);
        hours.value = value.hours;
        minutes.value = value.minutes;
      };
      hours.addEventListener('blur', normalize);
      minutes.addEventListener('blur', normalize);
    }
    doc.getElementById('t-duration-start').addEventListener('click', () => this.startFromDuration());

    el.selectorTask.addEventListener('change', () => this.fillSuggestion(el.selectorTask.value, el.selectorHours, el.selectorMinutes));
    doc.getElementById('t-selector-start').addEventListener('click', () => this.startFromSelector());

    el.expired.querySelectorAll('[data-add]').forEach((button) => {
      button.addEventListener('click', () => this.act(() => this.sim.addTime(Number(button.dataset.add))));
    });
    doc.getElementById('t-expired-start').addEventListener('click', () => {
      const minutes = parseDuration(el.expiredHours.value, el.expiredMinutes.value);
      if (minutes) this.act(() => this.sim.addTime(minutes));
    });
    doc.getElementById('t-expired-finish').addEventListener('click', () => this.act(() => this.sim.dismissExpired()));

    doc.addEventListener('pointerdown', (event) => {
      if (this.menuTask && !event.target.closest('#t-menu, .t-status-btn')) this.closeMenu();
    });
    doc.getElementById('tino').addEventListener('scroll', () => this.closeMenu(), { passive: true });
  }

  /** Ejecuta una acción del usuario y redibuja. */
  act(action) {
    action();
    this.render();
    this.onChange?.();
  }

  /** Completar algo: si el trabajo no está hecho, avisa como un banner de Tino. */
  complete(action) {
    const result = action();
    if (result?.error === 'unsolved') this.onNotice(UNSOLVED_NOTICE);
  }

  // --- Tarjetas -------------------------------------------------------------

  make(tag, className, text) {
    const node = this.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  button(className, text, label, onClick) {
    const node = this.make('button', className, text);
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick(node);
    });
    return node;
  }

  /** Tarjeta de una tarea de la raíz (TaskItem de Tino), con sus subtareas si es tarea padre. */
  createCard(task) {
    const make = this.make.bind(this);
    const parent = this.sim.isParent(task);
    const card = { task, parent, subs: new Map() };
    card.root = make('article', 't-task');
    card.root.dataset.id = task.id;

    const top = make('div', 't-task-top');
    const main = make('div', 't-task-main');
    const labels = make('div', 't-task-labels');
    card.kind = make('span', 't-kind', parent ? 'Tarea padre' : 'Tarea');
    labels.append(card.kind);
    if (parent) {
      card.subCount = make('span', 't-subcount');
      labels.append(card.subCount);
    }
    main.append(labels, make('h3', 't-task-title', task.title));
    card.avatar = make('span', 't-avatar-lg');
    top.append(main, card.avatar);

    const tags = make('div', 't-task-tags');
    card.priority = make('span', `t-chip prio-${task.priority.toLowerCase()}`, PRIORITY_LABEL[task.priority]);
    card.status = make('span', 't-chip');
    card.live = make('span', 't-live', '⏱');
    tags.append(card.priority, card.status, card.live);

    const info = make('div', 't-task-info');
    card.due = make('span', 't-due');
    card.time = make('span', 't-time');
    info.append(card.due);
    if (!parent) info.append(card.time);

    card.root.append(top, tags);
    if (task.description) card.root.append(make('p', 't-task-desc', task.description));
    card.root.append(info);

    if (parent) {
      const box = make('div', 't-subs');
      const head = make('div', 't-subs-head');
      card.subTotal = make('span', 't-subs-total');
      head.append(make('span', null, 'Subtareas'), card.subTotal);
      const list = make('div', 't-subs-list');
      for (const child of this.sim.children(task)) {
        const sub = this.createSub(child);
        card.subs.set(child.id, sub);
        list.append(sub.root);
      }
      box.append(make('div', 't-subs-note', 'Esta tarea tiene subtareas. Inicia el timer en una subtarea.'), head, list);
      card.root.append(box);
    }

    const foot = make('footer', 't-task-foot');
    card.avatarSm = make('span', 't-avatar-sm');
    const actions = make('div', 't-task-actions');
    if (!parent) {
      card.timer = this.button('t-icon timer', '⏱️', 'Registrar tiempo', () => this.onTimer(task));
      card.timer.dataset.hint = `timer:${task.id}`;
      actions.append(card.timer);
    }
    card.take = this.button('t-icon', '✓', 'Tomar tarea', () => this.act(() => this.sim.take(task.id)));
    card.statusButton = this.button('t-icon t-status-btn', '→', 'Cambiar estado', (node) => this.toggleMenu(task, node));
    card.statusButton.dataset.hint = `status:${task.id}`;
    actions.append(card.take, card.statusButton);
    foot.append(card.avatarSm, actions);
    card.root.append(foot);
    card.root.addEventListener('animationend', () => card.root.classList.remove('shake', 'arrived'));
    return card;
  }

  /** Fila de una subtarea dentro de la tarjeta padre, con su propio cronómetro y menú de estado. */
  createSub(task) {
    const make = this.make.bind(this);
    const sub = { task, root: make('div', 't-sub') };
    const top = make('div', 't-sub-top');
    const who = make('div');
    sub.who = make('p', 't-sub-who');
    who.append(make('p', 't-sub-title', task.title), sub.who);
    sub.status = make('span', 't-chip sm');
    top.append(who, sub.status);

    const bottom = make('div', 't-sub-bottom');
    sub.time = make('span', 't-sub-time');
    sub.due = make('span', 't-due sm');
    const left = make('div', 't-sub-meta');
    left.append(sub.time, sub.due);
    const actions = make('div', 't-task-actions');
    sub.timer = this.button('t-icon sm timer-outline', '⏱', 'Iniciar timer', () => this.onTimer(task));
    sub.timer.dataset.hint = `timer:${task.id}`;
    sub.take = this.button('t-icon sm', '✓', 'Tomar subtarea', () => this.act(() => this.sim.take(task.id)));
    sub.statusButton = this.button('t-icon sm t-status-btn', '☰', 'Cambiar estado', (node) => this.toggleMenu(task, node));
    sub.statusButton.dataset.hint = `status:${task.id}`;
    actions.append(sub.timer, sub.take, sub.statusButton);
    bottom.append(left, actions);
    sub.root.append(top, bottom);
    sub.root.addEventListener('animationend', () => sub.root.classList.remove('shake'));
    return sub;
  }

  updateCard(card) {
    const { sim } = this;
    const task = card.task;
    const activeId = sim.timer?.taskId ?? null;
    const statusClass = `t-chip st-${task.status.toLowerCase()}`;
    setClass(card.status, statusClass);
    setText(card.status, STATUS_LABEL[task.status]);

    const due = dueChip(task, sim.remaining(task));
    setText(card.due, due.text);
    setClass(card.due, `t-due ${due.tone}`);

    const initials = task.assigned ? 'YO' : 'SA';
    setText(card.avatar, initials);
    setText(card.avatarSm, initials);
    card.take.hidden = task.assigned;
    card.root.classList.toggle(`border-${task.priority.toLowerCase()}`, card.parent);

    if (card.parent) {
      const children = sim.children(task);
      const done = children.filter((child) => child.status === STATUS.DONE).length;
      setText(card.subCount, `${done}/${children.length} completadas`);
      setText(card.subTotal, `${done}/${children.length}`);
      card.live.hidden = !children.some((child) => child.id === activeId);
      for (const sub of card.subs.values()) this.updateSub(sub, activeId);
    } else {
      const time = timeChip(task);
      setText(card.time, time.text);
      setClass(card.time, `t-time${time.over ? ' over' : ''}`);
      const active = activeId === task.id;
      card.live.hidden = !active;
      card.timer.classList.toggle('active', active);
      card.timer.title = active ? 'Detener tiempo' : 'Registrar tiempo';
    }
  }

  updateSub(sub, activeId) {
    const task = sub.task;
    setClass(sub.status, `t-chip sm st-${task.status.toLowerCase()}`);
    setText(sub.status, STATUS_LABEL[task.status]);
    setText(sub.who, task.assigned ? 'Vos' : 'Sin asignar');
    setText(sub.time, `${minutesToHMS(task.actual)} / ${minutesToHMS(task.estimate)}`);
    sub.time.classList.toggle('over', task.actual > task.estimate);
    const due = dueChip(task, this.sim.remaining(task));
    setText(sub.due, due.text);
    setClass(sub.due, `t-due sm ${due.tone}`);
    const active = activeId === task.id;
    sub.timer.classList.toggle('active', active);
    sub.timer.title = active ? 'Detener timer' : 'Iniciar timer';
    sub.take.hidden = task.assigned;
  }

  /** Ubica cada tarjeta en la lista o en la columna de su estado. */
  placeCards() {
    const board = this.view === 'board';
    this.el.list.hidden = board;
    this.el.board.hidden = !board;
    this.doc.querySelectorAll('.t-toggle button').forEach((button) => button.classList.toggle('on', button.dataset.view === this.view));
    const counts = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 };
    for (const task of this.sim.roots) {
      let card = this.cards.get(task.id);
      if (!card) {
        card = this.createCard(task);
        this.cards.set(task.id, card);
        if (this.sim.started) card.root.classList.add('arrived');
      }
      counts[task.status] += 1;
      const container = board
        ? this.el.board.querySelector(`[data-status="${task.status}"] .t-column-body`)
        : this.el.list;
      if (card.root.parentElement !== container) container.append(card.root);
      this.updateCard(card);
    }
    for (const [status, count] of Object.entries(counts)) {
      setText(this.el.board.querySelector(`[data-status="${status}"] header b`), String(count));
    }
  }

  // --- Acciones ---------------------------------------------------------------

  /** ⏱ de una tarea: detiene su timer, avisa si hay otro activo o abre "Configurar duración". */
  onTimer(task) {
    const { sim } = this;
    if (sim.finished) return;
    if (sim.timer?.taskId === task.id) {
      this.act(() => sim.stopTimer());
      return;
    }
    if (sim.timer) {
      this.onNotice(ACTIVE_TIMER_ERROR);
      return;
    }
    this.closeMenu();
    this.durationTask = task;
    setText(this.el.durationTask, task.title);
    this.fillSuggestion(task.id, this.el.durationHours, this.el.durationMinutes);
    this.el.durationError.hidden = true;
    this.el.duration.hidden = false;
    this.render();
  }

  fillSuggestion(taskId, hours, minutes) {
    const total = this.sim.suggestedMinutes(taskId ? this.sim.task(taskId) : null);
    hours.value = String(Math.floor(total / 60));
    minutes.value = String(total % 60);
  }

  /** Inicia el cronómetro con lo elegido y avisa errores de Tino o de prioridad. */
  start(taskId, hours, minutes, errorNode) {
    const total = parseDuration(hours.value, minutes.value);
    if (!total) {
      if (errorNode) errorNode.hidden = false;
      else this.onNotice(DURATION_ERROR);
      return;
    }
    const result = this.sim.startTimer(taskId, total);
    if (result.error === 'active') this.onNotice(ACTIVE_TIMER_ERROR);
    if (!result.ok) return;
    this.closeModals();
    if (result.urgentId) {
      this.shake(result.urgentId);
      this.onMistake(result.urgentId);
    }
    this.render();
    this.onChange?.();
  }

  startFromDuration() {
    if (this.durationTask) this.start(this.durationTask.id, this.el.durationHours, this.el.durationMinutes, this.el.durationError);
  }

  /** "Temporizador" → "Iniciar seguimiento": proyecto, tarea opcional y tiempo a trabajar. */
  openSelector() {
    const { sim, el } = this;
    if (sim.finished) return;
    const options = [this.make('option', null, 'Sin vincular')];
    options[0].value = '';
    for (const task of sim.work.filter((candidate) => candidate.status !== STATUS.DONE)) {
      const parent = task.parentId ? sim.task(task.parentId) : null;
      const option = this.make('option', null, parent ? `${parent.title} / ${task.title}` : task.title);
      option.value = task.id;
      options.push(option);
    }
    el.selectorTask.replaceChildren(...options);
    el.selectorProject.value = 'oficina';
    this.fillSuggestion('', el.selectorHours, el.selectorMinutes);
    el.selector.hidden = false;
  }

  startFromSelector() {
    if (!this.el.selectorProject.value) {
      this.onNotice('Elegí un proyecto.');
      return;
    }
    this.start(this.el.selectorTask.value || null, this.el.selectorHours, this.el.selectorMinutes, null);
  }

  closeModals(redraw = true) {
    this.el.duration.hidden = true;
    this.el.selector.hidden = true;
    this.durationTask = null;
    if (redraw) this.render();
  }

  /** Menú "→" con los cambios de estado de la tarea, pegado a su botón. */
  toggleMenu(task, anchor) {
    if (this.menuTask === task) {
      this.closeMenu();
      return;
    }
    const menu = this.el.menu;
    const items = STATUS_ACTIONS[task.status].map(([status, label]) => {
      const item = this.make('button', 't-menu-item', label);
      item.type = 'button';
      if (status === STATUS.DONE) item.dataset.hint = `complete:${task.id}`;
      item.addEventListener('click', () => {
        this.closeMenu();
        this.act(() => this.complete(() => this.sim.setStatus(task.id, status)));
      });
      return item;
    });
    menu.replaceChildren(...items);
    menu.hidden = false;
    const box = anchor.getBoundingClientRect();
    const height = menu.offsetHeight;
    const above = box.top - height - 8 > 0;
    menu.style.top = `${above ? box.top - height - 6 : box.bottom + 6}px`;
    menu.style.left = `${Math.max(8, box.right - menu.offsetWidth)}px`;
    this.menuTask = task;
    this.render();
  }

  closeMenu() {
    if (!this.menuTask) return;
    this.menuTask = null;
    this.el.menu.hidden = true;
  }

  /** Sacude la tarjeta (o la fila de subtarea) que era más urgente. */
  shake(taskId) {
    for (const card of this.cards.values()) {
      const node = card.task.id === taskId ? card.root : card.subs.get(taskId)?.root;
      if (!node) continue;
      node.classList.remove('shake');
      void node.offsetWidth;
      node.classList.add('shake');
    }
  }

  // --- Temporizador, avisos y pistas -----------------------------------------

  renderWidget() {
    const { sim, el } = this;
    const timer = sim.timer;
    el.widget.hidden = Boolean(sim.finished);
    el.widgetOpenButton.hidden = Boolean(timer);
    el.widgetRunning.hidden = !timer;
    el.timerPill.hidden = !timer;
    el.trackingOn.hidden = !timer;
    el.trackingOff.hidden = Boolean(timer);
    if (!timer) {
      this.widgetOpen = false;
      return;
    }
    const task = timer.taskId ? sim.task(timer.taskId) : null;
    if (sim.hint() === 'widget-finish') this.widgetOpen = true;
    const left = sim.timerRemaining();
    setText(el.widgetTime, formatTimer(left));
    setText(el.widgetLeft, formatTimer(left));
    setText(el.widgetTarget, `${Math.floor(timer.target / 60)}h ${timer.target % 60}m`);
    el.widgetBar.style.width = `${Math.min(100, (timer.elapsed / timer.target) * 100)}%`;
    el.widgetRunning.classList.toggle('paused', timer.paused);
    setText(el.widgetPause, timer.paused ? '▶' : '❚❚');
    el.widgetPause.setAttribute('aria-label', timer.paused ? 'Reanudar' : 'Pausar');
    el.widgetBadge.hidden = !timer.paused;
    el.widgetBody.hidden = !this.widgetOpen;
    setText(el.widgetToggle, this.widgetOpen ? 'Ocultar ▴' : 'Ver ▾');
    setText(el.widgetTask, task?.title ?? 'Tiempo registrado a nivel proyecto');
    setText(el.widgetStatus, task ? STATUS_LABEL[task.status] : '');
    el.widgetFinish.hidden = !task;
    setText(el.trackingTask, task?.title ?? 'Proyecto');
  }

  renderExpired() {
    const { sim, el } = this;
    if (sim.expired && !this.expiredShown) {
      const task = sim.expired.taskId ? sim.task(sim.expired.taskId) : null;
      setText(el.expiredTask, task?.title ?? '—');
      el.expiredHours.value = '0';
      el.expiredMinutes.value = '5';
      this.closeModals(false);
      this.closeMenu();
    }
    this.expiredShown = Boolean(sim.expired);
    el.expired.hidden = !sim.expired;
  }

  /** Resalta (sin texto) el control que hay que tocar ahora y lo trae a la vista. */
  renderHint() {
    let hint = this.sim.hint();
    if (!this.el.duration.hidden) hint = 'modal-start';
    else if (hint?.startsWith('status:') && this.menuTask?.id === hint.slice(7)) hint = `complete:${this.menuTask.id}`;
    this.doc.querySelectorAll('[data-hint]').forEach((node) => node.classList.toggle('hint', node.dataset.hint === hint));
    if (hint && hint !== this.hintKey && /^(timer|status):/.test(hint)) {
      this.doc.querySelector(`#tino [data-hint="${hint}"]`)?.closest('.t-sub, .t-task')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    this.hintKey = hint;
  }

  render() {
    const { sim, el } = this;
    const stats = sim.stats();
    setText(el.count, String(stats.tasks));
    setText(el.kpiTasks, String(stats.tasks));
    setText(el.kpiTasksSub, `${stats.done} completadas, ${stats.blocked} bloqueadas`);
    setText(el.kpiEstimate, minutesToHMS(stats.estimate));
    setText(el.kpiActual, minutesToHMS(stats.actual));
    setText(el.kpiSubtasks, String(stats.subtasks));
    setText(el.kpiSubtasksSub, `${stats.parents} tareas padre`);
    this.placeCards();
    this.renderWidget();
    this.renderExpired();
    this.renderHint();
  }
}
