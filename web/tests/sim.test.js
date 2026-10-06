import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, LIMIT_SECONDS, OfficeSim, outcomeOf, POINTS, qualityFrom } from '../js/sim.js';
import { MAP_ROWS, SLOTS, TASKS, ACTIONS } from '../js/scenario.js';
import { dueLabel } from '../js/tino.js';
import { finalLines, placeBubble } from '../js/hud.js';

const DEFS = [
  { id: 'a', title: 'A', priority: 'CRITICAL', minigame: 'cables', appearAt: 0, dueIn: 30 },
  { id: 'b', title: 'B', priority: 'MEDIUM', minigame: 'cafe', appearAt: 0, dueIn: 60 },
  { id: 'c', title: 'C', priority: 'HIGH', minigame: 'tarjeta', appearAt: 10, dueIn: 20 },
];

/** Resuelve y completa una tarea como lo haría el jugador. */
function finishTask(sim, id, quality = 1) {
  sim.startTimer(id);
  sim.solve(id, quality);
  return sim.complete(id);
}

test('el reloj no corre hasta el primer timer', () => {
  const sim = new OfficeSim(DEFS);
  sim.tick(5);
  assert.equal(sim.elapsed, 0);
  assert.equal(sim.started, false);
  sim.startTimer('a');
  sim.tick(2);
  assert.equal(sim.elapsed, 2);
  assert.equal(sim.task('a').worked, 2);
  assert.equal(sim.task('b').worked, 0);
});

test('las tareas llegan en su segundo y avisan', () => {
  const sim = new OfficeSim(DEFS);
  assert.deepEqual(sim.visible.map((task) => task.id), ['a', 'b']);
  sim.startTimer('a');
  sim.drainEvents();
  sim.tick(10);
  assert.deepEqual(sim.visible.map((task) => task.id), ['a', 'b', 'c']);
  assert.deepEqual(sim.drainEvents(), [{ type: 'new', taskId: 'c' }]);
  assert.equal(sim.task('c').due, 30);
});

test('si se completa todo lo visible, la próxima tarea llega antes y conserva su plazo', () => {
  const sim = new OfficeSim(DEFS);
  finishTask(sim, 'a');
  finishTask(sim, 'b');
  sim.tick(1);
  const c = sim.task('c');
  assert.equal(c.appeared, true);
  assert.equal(c.appearAt, 1);
  assert.equal(c.due, 21);
});

test('elegir algo menos urgente es un error de prioridad y avisa cuál era', () => {
  const sim = new OfficeSim(DEFS);
  const result = sim.startTimer('b');
  assert.equal(result.urgentId, 'a');
  assert.equal(sim.mistakes, 1);
  sim.pauseTimer();
  assert.equal(sim.startTimer('b').urgentId, null, 'retomar la misma tarea no vuelve a contar');
  assert.equal(sim.mistakes, 1);
  sim.startTimer('a');
  assert.equal(sim.score().efficiency, 50);
});

test('un solo timer activo: iniciar otro apaga el anterior', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a');
  sim.startTimer('b');
  assert.equal(sim.activeId, 'b');
  sim.tick(3);
  assert.equal(sim.task('a').worked, 0);
  assert.equal(sim.task('b').worked, 3);
});

test('resolver el minijuego apaga el timer y pide completar', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a');
  sim.solve('a', 0.5);
  assert.equal(sim.activeId, null);
  assert.deepEqual(sim.hint(), { taskId: 'a', button: 'complete' });
  assert.equal(sim.startTimer('a').ok, false, 'una tarea resuelta no vuelve a iniciar');
});

test('solo se completa lo resuelto', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a');
  assert.equal(sim.complete('a'), false);
  sim.solve('a');
  assert.equal(sim.complete('a'), true);
  assert.equal(sim.task('a').status, 'DONE');
});

test('completada después del vencimiento queda como completada vencida', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a');
  sim.tick(31);
  assert.ok(sim.drainEvents().some((event) => event.type === 'overdue' && event.taskId === 'a'));
  sim.solve('a');
  sim.complete('a');
  assert.equal(outcomeOf(sim.task('a')), 'late');
  assert.deepEqual(dueLabel(sim.task('a'), sim.remaining(sim.task('a'))), { text: 'Completada vencida', tone: 'late' });
  assert.ok(sim.drainEvents().some((event) => event.type === 'done' && event.late));
});

test('a tiempo suma más que vencida, el minijuego da bonus y los errores restan', () => {
  const onTime = new OfficeSim(DEFS);
  finishTask(onTime, 'a', 1);
  assert.equal(onTime.points(), POINTS.onTime + POINTS.bonus);

  const late = new OfficeSim(DEFS);
  late.startTimer('a');
  late.tick(40);
  late.solve('a', 0);
  late.complete('a');
  assert.equal(late.points(), POINTS.late);

  const wrong = new OfficeSim(DEFS);
  wrong.startTimer('b');
  assert.equal(wrong.points(), 0, 'nunca negativo');
});

test('la partida termina cuando todo está completado', () => {
  const sim = new OfficeSim(DEFS);
  finishTask(sim, 'a');
  finishTask(sim, 'b');
  sim.tick(10);
  finishTask(sim, 'c');
  assert.equal(sim.finished, 'cleared');
  const score = sim.score();
  assert.equal(score.onTime, 3);
  assert.equal(score.pending, 0);
  assert.equal(score.efficiency, 100);
  assert.equal(sim.behavior().mode, 'celebrate');
});

test('a los LIMIT_SECONDS termina y lo pendiente queda sin terminar', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('a');
  sim.tick(LIMIT_SECONDS);
  assert.equal(sim.finished, 'timeout');
  assert.equal(sim.activeId, null);
  assert.equal(sim.score().pending, 3);
  assert.equal(sim.startTimer('b').ok, false);
});

test('la pista va al iniciar de lo más urgente y desaparece con un timer activo', () => {
  const sim = new OfficeSim(DEFS);
  assert.deepEqual(sim.hint(), { taskId: 'a', button: 'start' });
  sim.startTimer('a');
  assert.equal(sim.hint(), null);
  sim.tick(10);
  sim.solve('a');
  sim.complete('a');
  assert.deepEqual(sim.hint(), { taskId: 'c', button: 'start' }, 'HIGH antes que MEDIUM');
});

test('el personaje avisa si trabaja en algo menos urgente', () => {
  const sim = new OfficeSim(DEFS);
  sim.startTimer('b');
  const behavior = sim.behavior((id) => `haciendo ${id}`);
  assert.equal(behavior.mode, 'work');
  assert.equal(behavior.message, 'haciendo b');
  assert.ok(behavior.warning);
});

test('calidad del minijuego', () => {
  assert.equal(qualityFrom({ seconds: 5, mistakes: 0 }), 1);
  assert.equal(qualityFrom({ seconds: 5, mistakes: 2 }), 0.6);
  assert.equal(qualityFrom({ seconds: 60, mistakes: 0 }), 0);
});

test('vencimiento en el panel', () => {
  const task = { status: 'TODO' };
  assert.deepEqual(dueLabel(task, 35), { text: 'Vence en 0:35', tone: '' });
  assert.deepEqual(dueLabel(task, 8), { text: 'Vence en 0:08', tone: 'soon' });
  assert.deepEqual(dueLabel(task, -4), { text: 'Vencida hace 0:04', tone: 'late' });
  assert.equal(formatClock(83.9), '1:23');
});

test('pantalla final y globo', () => {
  const lines = finalLines({ onTime: 2, total: 4, late: 1, pending: 1, efficiency: null, seconds: 90 });
  assert.deepEqual(lines[0], ['Completadas a tiempo', '2 de 4']);
  assert.deepEqual(lines[3], ['Priorización', '—']);
  const spot = placeBubble({ x: 5, y: 5 }, { width: 100, height: 30 }, { left: 0, right: 300, top: 0 });
  assert.equal(spot.x, 54);
  assert.equal(spot.y, 34);
});

test('el escenario es consistente: cada tarea tiene acción, minijuego y lugar en el mapa', async () => {
  const { MINIGAMES } = await import('../js/minigames/index.js').catch(() => ({ MINIGAMES: null }));
  const text = MAP_ROWS.join('');
  for (const task of TASKS) {
    assert.ok(ACTIONS[task.id], `${task.id} sin acción`);
    assert.ok(SLOTS.includes(task.id), `${task.id} sin lugar`);
    assert.ok(text.includes(String(SLOTS.indexOf(task.id) + 1)), `${task.id} no está en el mapa`);
    if (MINIGAMES) assert.ok(MINIGAMES[task.minigame], `${task.minigame} no existe`);
  }
  assert.ok(MAP_ROWS.every((row) => row.length === MAP_ROWS[0].length));
  assert.equal(new Set(TASKS.map((task) => task.minigame)).size, 4, 'un minijuego distinto por tarea');
});
