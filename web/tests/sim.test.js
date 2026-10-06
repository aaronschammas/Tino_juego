import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_TIMER_ERROR,
  clockLabel,
  formatTimer,
  LIMIT_MINUTES,
  minutesToHMS,
  normalizeDuration,
  OfficeSim,
  outcomeOf,
  parseDuration,
  POINTS,
  qualityFrom,
  resolveParentStatus,
  STATUS,
} from '../js/sim.js';
import { ACTIONS, MAP_ROWS, SLOTS, TASKS } from '../js/scenario.js';
import { dueChip, STATUS_ACTIONS, timeChip } from '../js/tino.js';
import { finalLines, placeBubble } from '../js/hud.js';

const DEFS = [
  {
    id: 'p',
    title: 'Padre',
    priority: 'CRITICAL',
    subtasks: [
      { id: 'a', title: 'A', priority: 'CRITICAL', minigame: 'cables', estimate: 10, dueIn: 30 },
      { id: 'b', title: 'B', priority: 'CRITICAL', minigame: 'pc', estimate: 10, dueIn: 50 },
    ],
  },
  { id: 'c', title: 'C', priority: 'MEDIUM', minigame: 'cafe', estimate: 10, dueIn: 90 },
  { id: 'd', title: 'D', priority: 'HIGH', minigame: 'tarjeta', estimate: 5, appearAt: 10, dueIn: 20 },
];

/** Hace una tarea entera como el jugador: timer, minijuego y "Finalizar y Completar Tarea". */
function doTask(sim, id, quality = 1) {
  sim.startTimer(id, sim.suggestedMinutes(sim.task(id)));
  sim.solve(id, quality);
  return sim.finishTimerTask();
}

test('el reloj de la oficina no corre hasta el primer cronómetro', () => {
  const sim = new OfficeSim(DEFS);
  sim.tick(5);
  assert.equal(sim.elapsed, 0);
  sim.startTimer('a', 10);
  sim.tick(3);
  assert.equal(sim.elapsed, 3);
  assert.equal(sim.task('a').actual, 3);
  assert.equal(clockLabel(sim.elapsed), '09:03');
});

test('iniciar el cronómetro asigna la tarea, la pasa a En progreso y actualiza la tarea padre', () => {
  const sim = new OfficeSim(DEFS);
  assert.equal(sim.startTimer('a', 10).ok, true);
  assert.equal(sim.task('a').assigned, true);
  assert.equal(sim.task('a').status, STATUS.IN_PROGRESS);
  assert.equal(sim.task('p').status, STATUS.IN_PROGRESS);
});

test('como Tino: una tarea padre no tiene cronómetro y no se puede tener dos timers', () => {
  const sim = new OfficeSim(DEFS);
  assert.equal(sim.startTimer('p', 10).error, 'parent');
  sim.startTimer('a', 10);
  assert.equal(sim.startTimer('b', 10).error, 'active');
  assert.equal(ACTIVE_TIMER_ERROR, 'Ya tienes un timer activo. Detenlo antes de cambiar de tarea.');
  sim.stopTimer();
  assert.equal(sim.startTimer('b', 10).ok, true);
});

test('la duración sugerida es lo que falta de la estimación, o 30 minutos', () => {
  const sim = new OfficeSim(DEFS);
  assert.equal(sim.suggestedMinutes(sim.task('a')), 10);
  sim.startTimer('a', 10);
  sim.tick(4);
  assert.equal(sim.suggestedMinutes(sim.task('a')), 6);
  sim.tick(20);
  assert.equal(sim.suggestedMinutes(sim.task('a')), 30);
  assert.equal(sim.suggestedMinutes(null), 30);
});

test('pausa: el tiempo no corre mientras el cronómetro está en pausa', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a', 10);
  sim.tick(2);
  sim.pauseTimer();
  sim.tick(5);
  assert.equal(sim.task('a').actual, 2);
  assert.equal(sim.hint(), 'widget-resume');
  sim.resumeTimer();
  sim.tick(1);
  assert.equal(sim.task('a').actual, 3);
});

test('¡Tiempo cumplido!: el cronómetro se detiene solo y se puede agregar tiempo o finalizar', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a', 5);
  sim.drainEvents();
  sim.tick(5);
  assert.equal(sim.timer, null);
  assert.deepEqual(sim.expired, { taskId: 'a' });
  assert.ok(sim.drainEvents().some((event) => event.type === 'expired'));
  assert.equal(sim.hint(), 'expired-add');
  assert.equal(sim.behavior().mode, 'wait');
  sim.addTime(5);
  assert.equal(sim.timer.taskId, 'a');
  assert.equal(sim.timer.target, 5);
  assert.equal(sim.mistakes, 0);
  sim.tick(5);
  sim.solve('a');
  assert.equal(sim.hint(), 'expired-finish');
  sim.dismissExpired();
  assert.equal(sim.expired, null);
  assert.equal(sim.hint(), 'status:a');
});

test('las tareas llegan en su minuto y avisan', () => {
  const sim = new OfficeSim(DEFS);
  assert.deepEqual(sim.roots.map((task) => task.id), ['p', 'c']);
  sim.startTimer('a', 30);
  sim.drainEvents();
  sim.tick(10);
  assert.deepEqual(sim.roots.map((task) => task.id), ['p', 'c', 'd']);
  assert.ok(sim.drainEvents().some((event) => event.type === 'new' && event.taskId === 'd'));
  assert.equal(sim.task('d').due, 30);
});

test('si se completa todo lo que hay, la tarea siguiente llega antes y conserva su plazo', () => {
  const sim = new OfficeSim(DEFS);
  doTask(sim, 'a');
  doTask(sim, 'b');
  doTask(sim, 'c');
  sim.tick(1);
  const d = sim.task('d');
  assert.equal(d.appeared, true);
  assert.equal(d.due - d.appearAt, 20);
});

test('error de prioridad: empezar algo menos urgente avisa cuál era y cuenta una vez', () => {
  const sim = new OfficeSim(DEFS);
  const result = sim.startTimer('c', 10);
  assert.equal(result.urgentId, 'a');
  assert.equal(sim.behavior().warning, '¡Había algo más urgente!');
  sim.stopTimer();
  assert.equal(sim.startTimer('c', 10).urgentId, null);
  assert.equal(sim.mistakes, 1);
  sim.stopTimer();
  sim.startTimer('a', 10);
  assert.equal(sim.score().efficiency, 50);
});

test('completar exige el trabajo hecho; con el timer activo, "Finalizar y Completar" lo detiene', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a', 10);
  assert.equal(sim.finishTimerTask().error, 'unsolved');
  assert.equal(sim.setStatus('a', STATUS.DONE).error, 'unsolved');
  sim.solve('a');
  assert.equal(sim.hint(), 'widget-finish');
  assert.equal(sim.finishTimerTask().ok, true);
  assert.equal(sim.timer, null);
  assert.equal(sim.task('a').status, STATUS.DONE);
  assert.equal(sim.task('p').status, STATUS.IN_PROGRESS);
});

test('la tarea padre sigue a sus subtareas y completarla completa todas', () => {
  assert.equal(resolveParentStatus([STATUS.DONE, STATUS.DONE]), STATUS.DONE);
  assert.equal(resolveParentStatus([STATUS.BLOCKED, STATUS.DONE]), STATUS.BLOCKED);
  assert.equal(resolveParentStatus([STATUS.TODO, STATUS.DONE]), STATUS.IN_PROGRESS);
  assert.equal(resolveParentStatus([STATUS.TODO, STATUS.TODO]), STATUS.TODO);

  const sim = new OfficeSim(DEFS);
  sim.startTimer('a', 10);
  sim.solve('a');
  sim.stopTimer();
  assert.equal(sim.setStatus('p', STATUS.DONE).error, 'unsolved');
  sim.startTimer('b', 10);
  sim.solve('b');
  sim.stopTimer();
  assert.equal(sim.setStatus('p', STATUS.DONE).ok, true);
  assert.equal(sim.task('a').status, STATUS.DONE);
  assert.equal(sim.task('b').status, STATUS.DONE);
});

test('mover a Bloqueadas o Por hacer cambia el estado y detiene su timer', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('c', 10);
  sim.setStatus('c', STATUS.BLOCKED);
  assert.equal(sim.task('c').status, STATUS.BLOCKED);
  assert.equal(sim.timer, null);
  sim.setStatus('a', STATUS.BLOCKED);
  assert.equal(sim.task('p').status, STATUS.BLOCKED);
  assert.equal(sim.stats().blocked, 2);
});

test('completada después del vencimiento queda vencida', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a', 60);
  sim.tick(31);
  assert.ok(sim.drainEvents().some((event) => event.type === 'overdue' && event.taskId === 'a'));
  sim.solve('a');
  sim.finishTimerTask();
  assert.equal(outcomeOf(sim.task('a')), 'late');
  assert.deepEqual(dueChip(sim.task('a'), sim.remaining(sim.task('a'))), { text: '📅 09:30', tone: 'late' });
});

test('puntos: a tiempo, dentro de lo estimado, bonus del minijuego y errores', () => {
  const sim = new OfficeSim(DEFS);
  doTask(sim, 'a', 1);
  assert.equal(sim.points(), POINTS.onTime + POINTS.estimate + POINTS.bonus);

  const late = new OfficeSim(DEFS);
  late.startTimer('a', 60);
  late.tick(40);
  late.solve('a', 0);
  late.finishTimerTask();
  assert.equal(late.points(), POINTS.late);

  const wrong = new OfficeSim(DEFS);
  wrong.startTimer('c', 10);
  assert.equal(wrong.points(), 0, 'nunca negativo');
});

test('la partida termina con todo completado o al final del día', () => {
  const sim = new OfficeSim(DEFS);
  doTask(sim, 'a');
  doTask(sim, 'b');
  sim.tick(10);
  doTask(sim, 'd');
  doTask(sim, 'c');
  assert.equal(sim.finished, 'cleared');
  const score = sim.score();
  assert.equal(score.onTime, 4);
  assert.equal(score.withinEstimate, 4);
  assert.equal(score.efficiency, 100);
  assert.equal(sim.behavior().mode, 'celebrate');

  const slow = new OfficeSim(DEFS);
  slow.startTimer('a', 999);
  slow.tick(LIMIT_MINUTES);
  assert.equal(slow.finished, 'timeout');
  assert.equal(slow.score().pending, 4);
});

test('números del proyecto como las tarjetas de Tino', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer(null, 10);
  sim.tick(2);
  const stats = sim.stats();
  assert.equal(stats.tasks, 2);
  assert.equal(stats.subtasks, 2);
  assert.equal(stats.parents, 1);
  assert.equal(stats.estimate, 30);
  assert.equal(stats.actual, 2, 'el tiempo sin vincular también cuenta');
  assert.equal(sim.behavior().message, 'Ese tiempo no es de ninguna tarea.');
});

test('formatos y duraciones como Tino', () => {
  assert.equal(minutesToHMS(15), '00:15:00');
  assert.equal(minutesToHMS(90.5), '01:30:30');
  assert.equal(formatTimer(11.5), '11:30');
  assert.equal(formatTimer(75), '01:15:00');
  assert.equal(parseDuration('0', '15'), 15);
  assert.equal(parseDuration('1', '75'), null);
  assert.equal(parseDuration('a', '5'), null);
  assert.deepEqual(normalizeDuration('0', '75'), { hours: '1', minutes: '15' });
  assert.deepEqual(timeChip({ actual: 16, estimate: 15 }), { text: '⏱ Real: 00:16:00 / Est: 00:15:00', over: true });
  assert.deepEqual(STATUS_ACTIONS.IN_PROGRESS[0], [STATUS.DONE, 'Mover a Completadas']);
});

test('calidad del minijuego', () => {
  assert.equal(qualityFrom({ seconds: 5, mistakes: 0 }), 1);
  assert.equal(qualityFrom({ seconds: 5, mistakes: 2 }), 0.6);
  assert.equal(qualityFrom({ seconds: 60, mistakes: 0 }), 0);
});

test('pantalla final y globo', () => {
  const lines = finalLines({ onTime: 2, total: 4, late: 1, pending: 1, withinEstimate: 3, efficiency: null, actual: 30, estimate: 50, minutes: 75 });
  assert.deepEqual(lines[0], ['Completadas a tiempo', '2 de 4']);
  assert.deepEqual(lines.at(-1), ['Terminaste a las', '10:15']);
  const spot = placeBubble({ x: 5, y: 5 }, { width: 100, height: 30 }, { left: 0, right: 300, top: 0 });
  assert.equal(spot.x, 54);
  assert.equal(spot.y, 34);
});

test('el escenario es consistente: cada tarea con trabajo tiene acción, minijuego y lugar en el mapa', async () => {
  const { MINIGAMES } = await import('../js/minigames/index.js');
  const work = TASKS.flatMap((task) => (task.subtasks ? task.subtasks : [task]));
  const text = MAP_ROWS.join('');
  for (const task of work) {
    assert.ok(ACTIONS[task.id], `${task.id} sin acción`);
    assert.ok(text.includes(String(SLOTS.indexOf(task.id) + 1)), `${task.id} no está en el mapa`);
    assert.ok(MINIGAMES[task.minigame], `${task.minigame} no existe`);
    assert.ok(task.estimate > 0, `${task.id} sin estimación`);
  }
  assert.equal(new Set(work.map((task) => task.minigame)).size, 4, 'un minijuego distinto por tarea');
  assert.ok(TASKS.some((task) => task.subtasks?.length), 'hay una tarea padre con subtareas');
});
