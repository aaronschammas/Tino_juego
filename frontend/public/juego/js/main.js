import { CONFIG } from './config.js';
import { GameMap } from './map.js';
import { Worker } from './player.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { Effects, drawAlert, drawCrawlers, drawFlies } from './effects.js';
import { TaskObject, createDecor } from './prop.js';
import { ACTIONS, SCENARIOS, legendFor } from './scenarios.js';
import { computeStress, decideBehavior, evaluateRound, evaluateTasks, PRIORITY_RANK, STRESS_ALERT } from './rules.js';
import { TinoClient } from './tino.js';
import { Hud } from './hud.js';
import { CoachFlow, coachStep, STEPS } from './coach.js';

// --- Escenario ------------------------------------------------------------
const requested = new URLSearchParams(location.search).get('escenario');
const scenarioKey = SCENARIOS[requested] ? requested : 'oficina';
const scenario = SCENARIOS[scenarioKey];

const map = new GameMap(scenario.rows, legendFor(scenario));
const spawn = map.marker('spawn');
const objects = map.markers
  .filter((m) => m.marker === 'slot')
  .map((m) => {
    const key = scenario.slots[m.slot];
    const object = new TaskObject(m.tx, m.ty, { ...ACTIONS[key], key }, null, map.index(m.tx, m.ty));
    object.visible = Boolean(object.action.furniture);
    if (object.visible) map.block(m.tx, m.ty);
    return object;
  });
const decor = map.markers
  .filter((m) => m.marker === 'decor')
  .map((m) => {
    map.block(m.tx, m.ty);
    return createDecor(m.decor, m.tx, m.ty, m.seed);
  });

const worker = new Worker(spawn.tx, spawn.ty);
const camera = new Camera();
camera.centerOn(map);
const renderer = new Renderer(document.getElementById('game'));
const effects = new Effects();
const hud = new Hud();
const coach = new CoachFlow();
let coachTarget = 'null';
hud.onCoach({
  next: () => coach.next(),
  hide: () => coach.dismiss(),
  expand: () => coach.show(),
});

// --- Estado de Tino -------------------------------------------------------
let latest = null;
let receivedAt = 0;
let primed = false;
let tasks = [];
let round = evaluateRound(null, 0);
let stress = 0;
let finished = false;
let behavior = { mode: 'idle', taskId: null, message: 'Conectando con Tino...' };
const pendingEvents = [];
const bursts = [];

const client = new TinoClient(scenarioKey, {
  onState(state) {
    latest = state;
    receivedAt = performance.now();
    hud.setScenario(state.scenario.name, state.scenario.intro);
    hud.setStatus(null);
    if (state.events?.length) {
      pendingEvents.push(...state.events);
      // Tino (el otro panel de /feria) tiene que mostrar el timer apagado y las tareas nuevas.
      window.parent?.postMessage({ type: 'feria:tino-changed' }, location.origin);
    }
  },
  onError() {
    hud.setStatus('Sin conexión con Tino. Reintentando...');
  },
});
client.start();

/** Índice de la celda donde está parado el personaje (sus partículas se dibujan en esa profundidad). */
function workerCell() {
  const { cx, cy } = worker.drawCell();
  return map.index(Math.min(map.width - 1, Math.max(0, cx)), Math.min(map.height - 1, Math.max(0, cy)));
}

/** De dos celdas, la que se dibuja más adelante (mayor x + y). */
function frontCell(a, b) {
  const depth = (idx) => (idx < 0 ? -1 : map.tiles[idx].tx + map.tiles[idx].ty);
  return depth(a) >= depth(b) ? a : b;
}

/** Aplica el estado de Tino a los objetos: progreso, si aparecieron y si el problema quedó resuelto. */
function syncObjects(since) {
  tasks = evaluateTasks(latest, since);
  round = evaluateRound(latest, since);
  stress = computeStress(tasks);
  let moved = false;
  for (const object of objects) {
    const task = tasks.find((candidate) => candidate.action === object.action.key) ?? null;
    object.task = task;
    object.progress = task?.progress ?? 0;

    const visible = Boolean(task) || Boolean(object.action.furniture);
    if (visible !== object.visible) {
      object.visible = visible;
      moved = true;
      if (visible) map.block(object.tx, object.ty);
      else map.unblock(object.tx, object.ty);
      if (visible && primed) effects.puff(object.effectPoint, 'dust', 1, 30, 20);
    }

    const solved = task ? task.solved : true;
    if (solved !== object.solved) {
      object.setSolved(solved);
      if (solved && task && primed) effects.sparkle(object.effectPoint);
    }
  }
  if (moved) worker.replan(map);
  if (latest) primed = true;
}

/** Anima lo que avisó el backend: fuego que salta, explosiones, reclamos y timers apagados. */
function playEvents() {
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    const origin = objects.find((object) => object.task?.title === event.from);
    const target = objects.find((object) => object.task?.title === event.title);
    if (event.type === 'auto-stop') {
      hud.showToast(event.message, 'good');
    } else if (event.type === 'spread') {
      hud.showToast(event.message, 'bad');
      if (origin && target) bursts.push({ from: origin.effectPoint, to: target.effectPoint, until: time + 1.2 });
    } else if (event.type === 'explode') {
      hud.showToast(event.message, 'bad');
      if (origin) effects.explosion(origin.effectPoint);
      camera.shake(0.7, 3);
    } else {
      hud.showToast(event.message, 'warn');
      if (origin) effects.puff(origin.effectPoint, 'sparks', 1, 40, 25);
    }
  }
}

/** Mueve al personaje según lo que decidieron las reglas y dispara los efectos de su trabajo. */
function driveWorker(dt) {
  behavior = latest
    ? decideBehavior(tasks, latest.activeTimer, (action) => ACTIONS[action]?.say ?? '', round)
    : { mode: 'idle', taskId: null, message: 'Conectando con Tino...' };
  const target = objects.find((object) => object.visible && object.task?.id === behavior.taskId);

  if (target && ['work', 'paused', 'finished'].includes(behavior.mode)) {
    const spot = map.workSpot(target.tx, target.ty);
    worker.goTo(map, spot);
    const atSpot = worker.arrived && spot && worker.isOn(spot);
    worker.mode = atSpot && behavior.mode === 'work' ? 'work' : 'idle';
    if (atSpot) worker.lookAt(target.tx, target.ty);
    if (atSpot && behavior.mode === 'work') emitWork(target, dt);
    return;
  }

  worker.goTo(map, spawn);
  worker.mode = behavior.mode === 'celebrate' ? 'celebrate' : 'idle';
  if (worker.arrived && worker.mode === 'idle') worker.facing = 'down';
}

/** Chorro o nube del trabajo; el chorro se dibuja en la profundidad del que esté más adelante (personaje u objeto). */
function emitWork(target, dt) {
  const kind = target.action.work;
  if (kind === 'foam' || kind === 'water' || kind === 'bubbles') {
    const to = { ...target.targetPoint, cell: frontCell(workerCell(), target.cell) };
    effects.spray(worker.handPoint(), to, kind, dt);
  } else if (kind !== 'talk') {
    effects.puff(target.targetPoint, kind, dt, 18, 16);
  }
}

/** Efectos de los problemas sin resolver: más grandes si son urgentes y cuanto más cerca está la consecuencia. */
function emitProblems(dt) {
  for (const object of objects) {
    if (!object.visible || object.solved) continue;
    const task = object.task;
    const rank = PRIORITY_RANK[task?.priority] ?? 2;
    const intensity = (1 - object.progress * 0.8) * (0.4 + rank * 0.15) * (0.7 + (task?.stageRatio ?? 0) * 0.9);
    const at = object.effectPoint;
    switch (object.action.problem) {
      case 'fire': effects.fire(at, intensity, dt); break;
      case 'stink': effects.stink(at, dt); break;
      case 'smoke': effects.smoke(at, dt); break;
      case 'dust': effects.puff(at, 'dust', dt, 8 * intensity, 6); break;
      case 'fountain': effects.fountain(at, intensity, dt); break;
      default: break;
    }
  }
  for (const burst of bursts) effects.spray(burst.from, burst.to, 'fire', dt, 90);
  for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].until < time) bursts.splice(i, 1);
  if (round.status === 'playing' && stress >= STRESS_ALERT) effects.sweat({ ...worker.headPoint(), cell: workerCell() }, dt);
}

/** Al terminar la partida muestra el resultado y, unos segundos después, le avisa a /feria para pasar a las estadísticas. */
function checkFinish() {
  if (finished || round.status !== 'finished' || !latest?.score) return;
  finished = true;
  hud.showFinal(latest.round, latest.score);
  setTimeout(() => {
    window.parent?.postMessage(
      { type: 'feria:finished', scenario: scenarioKey, round: latest.round, score: latest.score },
      location.origin,
    );
  }, CONFIG.FINAL_DELAY_MS);
}

function update(dt) {
  syncObjects(latest ? (performance.now() - receivedAt) / 1000 : 0);
  playEvents();
  driveWorker(dt);
  emitProblems(dt);
  effects.update(dt);
  camera.update(dt);
  worker.update(dt);
  checkFinish();
}

/**
 * Actualiza el diálogo del coach y, si cambió el control de Tino que hay que tocar, se lo avisa a /feria
 * para que lo resalte dentro de Tino.
 */
function updateCoach(dt) {
  const view = coach.update(dt, coachStep(tasks, latest?.activeTimer ?? null, round), round.status);
  hud.renderCoach(view, STEPS);
  const target = JSON.stringify(view.intro ? null : view.dialog.target ?? null);
  if (target === coachTarget) return;
  coachTarget = target;
  window.parent?.postMessage({ type: 'feria:coach', target: JSON.parse(target) }, location.origin);
}

/** Partículas que salieron de una celda, dibujadas en su profundidad (detrás o delante del personaje). */
function drawCellParticles(ctx, idx, camX, camY) {
  const list = particles.get(idx);
  if (list?.length) effects.draw(ctx, camX, camY, list);
}

function drawOverlay(ctx, camX, camY) {
  const loose = particles.get(-1);
  if (loose?.length) effects.draw(ctx, camX, camY, loose);
  for (const object of objects) {
    if (!object.visible || object.solved) continue;
    const at = object.effectPoint;
    const problem = object.action.problem;
    if (problem === 'flies') drawFlies(ctx, at, time, camX, camY);
    if (problem === 'bugs') drawCrawlers(ctx, at, time, camX, camY);
    if ((object.task?.stageRatio ?? 0) > 0.7) {
      drawAlert(ctx, { x: at.x, y: at.y - 14 }, time, camX, camY, '#e53935', 8);
    } else if (problem === 'ring' || problem === 'alert') {
      drawAlert(ctx, { x: at.x, y: at.y - 12 }, time, camX, camY);
    }
  }
}

// --- Game loop ------------------------------------------------------------
// Update a paso fijo y render a la frecuencia del monitor, interpolando con `alpha`.
const STEP = CONFIG.FIXED_DT;
let accumulator = 0;
let last = performance.now();
let time = 0;
let hudTimer = 0;
let particles = new Map();

function frame(now) {
  let frameDt = (now - last) / 1000;
  last = now;
  if (frameDt > CONFIG.MAX_FRAME_DT) frameDt = CONFIG.MAX_FRAME_DT;

  accumulator += frameDt;
  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
    time += STEP;
  }

  const alpha = accumulator / STEP;
  const visible = [worker, ...objects.filter((object) => object.visible), ...decor];
  particles = effects.byCell();
  renderer.render(map, visible, camera, time, alpha, { afterCell: drawCellParticles, overlay: drawOverlay });

  hud.setBubble(behavior.message, behavior.warning, renderer.toPage(worker.headPoint(alpha), camera), renderer.rect);
  hudTimer += frameDt;
  if (hudTimer > 0.25) {
    updateCoach(hudTimer);
    hudTimer = 0;
    hud.renderTasks(tasks, latest?.activeTimer);
    hud.setMeters(round, stress, latest?.score?.points ?? 0);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
