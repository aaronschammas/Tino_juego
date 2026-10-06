// Informe "Resumen operativo" de Tino con los datos de la partida: números, tareas por estado, tiempo real vs.
// estimado y tareas con más tiempo; se descarga en Excel (CSV) o PDF (imprimir). Al terminar suma el resultado.
import { clockLabel, minutesToHMS, outcomeOf, PRIORITY_LABEL, STATUS, STATUS_LABEL } from './sim.js';

export const PROJECT_NAME = 'Oficina · Hoy';
const STATUS_COLORS = { TODO: '#94a3b8', IN_PROGRESS: '#3b82f6', BLOCKED: '#f59e0b', DONE: '#10b981' };
const OUTCOME_LABEL = { 'on-time': 'A tiempo', late: 'Vencida', pending: 'Sin terminar' };
const FINAL_TITLE = { cleared: '¡Oficina en orden!', timeout: '¡Se terminó el día!' };
const BEST_KEY = 'tino-oficina:best';

/** Minutos con signo como "HH:MM:SS" (el desvío puede ser negativo). */
export function formatHours(minutes) {
  return `${minutes < 0 ? '-' : ''}${minutesToHMS(Math.abs(minutes))}`;
}

/** Datos del informe con los filtros de Tino (estado y usuario) sobre las tareas con trabajo. */
export function buildReport(sim, { status = 'all', user = 'all' } = {}) {
  const tasks = sim.tasks.filter((task) => {
    if (!task.minigame || !task.appeared) return false;
    if (status !== 'all' && task.status !== status) return false;
    if (user === 'me' && !task.assigned) return false;
    if (user === 'none' && task.assigned) return false;
    return true;
  });
  const completed = tasks.filter((task) => task.status === STATUS.DONE).length;
  const actual = tasks.reduce((sum, task) => sum + task.actual, 0);
  const estimate = tasks.reduce((sum, task) => sum + task.estimate, 0);
  return {
    summary: {
      total: tasks.length,
      completed,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      incomplete: tasks.length - completed,
      overdue: tasks.filter((task) => task.status !== STATUS.DONE && sim.remaining(task) < 0).length,
      lateDone: tasks.filter((task) => outcomeOf(task) === 'late').length,
      actual,
      estimate,
      deviation: actual - estimate,
    },
    statusDistribution: Object.values(STATUS).map((key) => ({
      status: key,
      label: STATUS_LABEL[key],
      count: tasks.filter((task) => task.status === key).length,
    })),
    tasks: [...tasks]
      .sort((a, b) => b.actual - a.actual)
      .map((task) => {
        const parent = task.parentId ? sim.task(task.parentId) : null;
        return {
          id: task.id,
          title: task.title,
          parent: parent?.title ?? null,
          project: PROJECT_NAME,
          user: task.assigned ? 'Vos' : 'Sin asignar',
          status: task.status,
          priority: task.priority,
          due: task.due,
          actual: task.actual,
          estimate: task.estimate,
          outcome: outcomeOf(task),
        };
      }),
  };
}

/** Informe como CSV para Excel (separado por ";" y con BOM, así abre bien en Excel en español). */
export function reportCsv(report) {
  const rows = [
    ['Tarea', 'Tarea padre', 'Proyecto', 'Usuario', 'Estado', 'Prioridad', 'Vencimiento', 'Tiempo real', 'Estimado', 'Desvío', 'Resultado'],
    ...report.tasks.map((task) => [
      task.title,
      task.parent ?? '',
      task.project,
      task.user,
      STATUS_LABEL[task.status],
      PRIORITY_LABEL[task.priority],
      clockLabel(task.due),
      minutesToHMS(task.actual),
      minutesToHMS(task.estimate),
      formatHours(task.actual - task.estimate),
      OUTCOME_LABEL[task.outcome],
    ]),
  ];
  const cell = (value) => (/[;"\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`;
}

/** Números del resultado de la partida que se suman al informe al terminar. */
export function resultLines(score) {
  return [
    ['Completadas a tiempo', `${score.onTime} de ${score.total}`],
    ['Dentro de lo estimado', `${score.withinEstimate} de ${score.total}`],
    ['Priorización', score.efficiency === null ? '—' : `${score.efficiency}%`],
    ['Terminaste a las', clockLabel(score.minutes)],
  ];
}

/** Lee y actualiza el mejor puntaje de este celular (si el navegador no deja guardar, no pasa nada). */
export function rememberBest(points, storage = globalThis.localStorage) {
  try {
    const best = Number(storage.getItem(BEST_KEY)) || 0;
    if (points > best) storage.setItem(BEST_KEY, String(points));
    return { best: Math.max(best, points), record: points > best && best > 0 };
  } catch {
    return { best: points, record: false };
  }
}

/** Ventana del informe (ReportModal de Tino). */
export class ReportView {
  constructor(sim, { tinoUrl = '' } = {}, doc = document) {
    this.sim = sim;
    this.doc = doc;
    this.tinoUrl = tinoUrl;
    this.final = null;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      root: $('t-report'),
      result: $('t-report-result'),
      main: $('t-report-main'),
      status: $('t-report-status'),
      user: $('t-report-user'),
    };
    $('t-report-close').addEventListener('click', () => this.close());
    $('t-report-refresh').addEventListener('click', () => this.render());
    $('t-report-excel').addEventListener('click', () => this.downloadExcel());
    $('t-report-pdf').addEventListener('click', () => this.print());
    this.el.status.addEventListener('change', () => this.render());
    this.el.user.addEventListener('change', () => this.render());
  }

  get isOpen() {
    return !this.el.root.hidden;
  }

  /** Abre el informe; con `final` (el puntaje) muestra arriba el resultado de la partida. */
  open(final = null) {
    if (final) this.final = { score: final, ...rememberBest(final.points) };
    this.render();
    this.el.root.hidden = false;
    this.el.root.querySelector('.t-report-body').scrollTop = 0;
  }

  close() {
    this.el.root.hidden = true;
  }

  report() {
    return buildReport(this.sim, { status: this.el.status.value, user: this.el.user.value });
  }

  make(tag, className, text) {
    const node = this.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  render() {
    this.renderResult();
    const make = this.make.bind(this);
    const { summary, statusDistribution, tasks } = this.report();

    const kpis = make('div', 't-report-kpis');
    const kpi = (label, value, note) => {
      const card = make('article', 't-report-kpi');
      card.append(make('small', null, label), make('strong', null, value));
      if (note) card.append(make('span', null, note));
      return card;
    };
    kpis.append(
      kpi('Completadas', String(summary.completed), `${summary.completionRate}% del total`),
      kpi('No completadas', String(summary.incomplete), `${summary.overdue} vencidas`),
      kpi('Tiempo real', formatHours(summary.actual), `Estimado ${formatHours(summary.estimate)}`),
      kpi('Desvío', formatHours(summary.deviation), summary.lateDone ? `${summary.lateDone} completadas vencidas` : 'Real − estimado'),
    );

    const byStatus = make('section', 't-report-panel');
    byStatus.append(make('h3', null, 'Tareas por estado'));
    const columns = make('div', 't-report-columns');
    const most = Math.max(1, ...statusDistribution.map((item) => item.count));
    for (const item of statusDistribution) {
      const column = make('div', 't-report-column');
      const bar = make('span', 't-report-column-bar');
      bar.style.height = `${(item.count / most) * 100}%`;
      bar.style.background = STATUS_COLORS[item.status];
      const track = make('div', 't-report-column-track');
      track.append(make('b', null, String(item.count)), bar);
      column.append(track, make('small', null, item.label));
      columns.append(column);
    }
    byStatus.append(columns);

    const deviation = make('section', 't-report-panel');
    deviation.append(make('h3', null, 'Tiempo real vs. estimado'));
    const longest = Math.max(1, ...tasks.map((task) => Math.max(task.actual, task.estimate)));
    const list = make('ul', 't-report-deviation');
    for (const task of tasks) {
      const li = make('li', task.actual > task.estimate ? 'over' : '');
      const head = make('div', 't-report-deviation-head');
      head.append(make('span', null, task.title), make('span', null, `${minutesToHMS(task.actual)} / ${minutesToHMS(task.estimate)}`));
      const track = make('span', 't-report-track');
      const fill = make('span', 't-report-fill');
      fill.style.width = `${Math.max(2, (task.actual / longest) * 100)}%`;
      const mark = make('span', 't-report-mark');
      mark.style.left = `${(task.estimate / longest) * 100}%`;
      track.append(fill, mark);
      li.append(head, track);
      list.append(li);
    }
    if (!tasks.length) list.append(make('li', 't-report-empty', 'No hay tareas para este filtro.'));
    deviation.append(list);

    const table = make('section', 't-report-panel');
    table.append(make('h3', null, 'Tareas con más tiempo registrado'));
    const wrap = make('div', 't-report-table-wrap');
    const grid = make('table', 't-report-table');
    const head = make('tr');
    for (const label of ['Tarea', 'Proyecto', 'Usuario', 'Estado', 'Tiempo']) head.append(make('th', null, label));
    grid.append(make('thead'), make('tbody'));
    grid.tHead.append(head);
    for (const task of tasks) {
      const row = make('tr');
      const title = make('td', 'strong', task.title);
      if (task.outcome === 'late') title.append(make('em', 't-report-late', 'Vencida'));
      row.append(title, make('td', null, task.project), make('td', null, task.user), make('td', null, STATUS_LABEL[task.status]), make('td', 'strong mono', minutesToHMS(task.actual)));
      grid.tBodies[0].append(row);
    }
    if (!tasks.length) {
      const empty = make('td', 't-report-empty', 'No hay tareas para este rango.');
      empty.colSpan = 5;
      const row = make('tr');
      row.append(empty);
      grid.tBodies[0].append(row);
    }
    wrap.append(grid);
    table.append(wrap);

    const charts = make('div', 't-report-charts');
    charts.append(byStatus, deviation);
    this.el.main.replaceChildren(kpis, charts, table);
  }

  /** Franja con el resultado de la partida (solo al terminar). */
  renderResult() {
    const result = this.el.result;
    result.hidden = !this.final;
    if (!this.final) return;
    const make = this.make.bind(this);
    const { score, best, record } = this.final;
    const top = make('div', 't-report-result-top');
    const title = make('div');
    title.append(make('h3', null, FINAL_TITLE[score.reason] ?? FINAL_TITLE.timeout), make('small', null, record ? '¡Nuevo récord!' : `Mejor: ${best} pts`));
    top.append(title, make('strong', 't-report-points', `${score.points} pts`));
    const chips = make('dl', 't-report-result-lines');
    for (const [label, value] of resultLines(score)) chips.append(make('dt', null, label), make('dd', null, value));
    const actions = make('div', 't-report-result-actions');
    const again = make('button', 't-btn primary', 'Jugar otra vez');
    again.type = 'button';
    again.addEventListener('click', () => location.reload());
    actions.append(again);
    if (this.tinoUrl) {
      const link = make('a', 't-btn secondary', 'Conocé Tino');
      link.href = this.tinoUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      actions.append(link);
    }
    result.replaceChildren(top, chips, actions);
  }

  /** "Excel": descarga el informe como CSV. */
  downloadExcel() {
    const blob = new Blob([reportCsv(this.report())], { type: 'text/csv;charset=utf-8' });
    const link = this.doc.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe-oficina-${clockLabel(this.sim.elapsed).replace(':', '')}.csv`;
    this.doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  /** "PDF": imprime solo el informe (el navegador ofrece "Guardar como PDF"). */
  print() {
    this.doc.body.classList.add('printing-report');
    window.print();
    setTimeout(() => this.doc.body.classList.remove('printing-report'), 500);
  }
}
