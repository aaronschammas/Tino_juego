import { CONFIG } from './config.js';
import { GameMap } from './map.js';
import { Worker } from './player.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { Effects, drawAlert, drawFlies } from './effects.js';
import { TaskObject, createDecor } from './prop.js';
import { ACTIONS, SCENARIOS, legendFor } from './scenarios.js';
import { decideBehavior, evaluateTasks, PRIORITY_RANK } from './rules.js';
import { TinoClient } from './tino.js';
import { Hud } from './hud.js';

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
    map.block(m.tx, m.ty);
    return new TaskObject(m.tx, m.ty, { ...ACTIONS[key], key }, null);
  });
const decor = map.markers
  .filter((m) => m.marker === 'decor')
  .map((m) => {
    map.block(m.tx, m.ty);
    return createDecor(m.decor, m.tx, m.ty, m.seed);
  });

const worker = new Worker(spawn.tx, spawn.ty);
const entities = [worker, ...objects, ...decor];
const camera = new Camera();
camera.centerOn(map);
const renderer = new Renderer(document.getElementById('game'));
const effects = new Effects();
const hud = new Hud();

// --- Estado de Tino -------------------------------------------------------
let latest = null;
let receivedAt = 0;
let primed = false;
let tasks = [];
let behavior = { mode: 'idle', taskId: null, message: 'Conectando con Tino...' };

const client = new TinoClient(scenarioKey, {
  onState(state) {
    latest = state;
    receivedAt = performance.now();
    hud.setScenario(state.scenario.name, state.scenario.intro);
    hud.setStatus(null);
  },
  onError() {
    hud.setStatus('Sin conexión con Tino. Reintentando...');
  },
});
client.start();

/** Aplica el estado de Tino a los objetos: progreso y si el problema quedó resuelto (con brillitos). */
function syncObjects() {
  const since = latest ? (performance.now() - receivedAt) / 1000 : 0;
  tasks = evaluateTasks(latest, since);
  for (const object of objects) {
    const task = tasks.find((candidate) => candidate.action === object.action.key) ?? null;
    object.task = task;
    object.progress = task?.progress ?? 0;
    const solved = Boolean(task?.solved);
    if (solved !== object.solved) {
      object.setSolved(solved);
      if (solved && primed) effects.sparkle(object.effectPoint);
    }
  }
  if (latest) primed = true;
}

/** Mueve al personaje según lo que decidieron las reglas y dispara los efectos de su trabajo. */
function driveWorker(dt) {
  behavior = latest
    ? decideBehavior(tasks, latest.activeTimer, (action) => ACTIONS[action]?.say ?? '')
    : { mode: 'idle', taskId: null, message: 'Conectando con Tino...' };
  const target = objects.find((object) => object.task?.id === behavior.taskId);

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

function emitWork(target, dt) {
  const kind = target.action.work;
  if (kind === 'foam' || kind === 'water' || kind === 'bubbles') {
    effects.spray(worker.handPoint(), target.targetPoint, kind, dt);
  } else if (kind !== 'talk') {
    effects.puff(target.targetPoint, kind, dt, 18, 16);
  }
}

/** Efectos de los problemas sin resolver: más grandes cuanto más urgentes y menos avanzados. */
function emitProblems(dt) {
  for (const object of objects) {
    if (object.solved) continue;
    const rank = PRIORITY_RANK[object.task?.priority] ?? 2;
    const intensity = (1 - object.progress * 0.8) * (0.4 + rank * 0.15);
    const at = object.effectPoint;
    switch (object.action.problem) {
      case 'fire': effects.fire(at, intensity, dt); break;
      case 'stink': effects.stink(at, dt); break;
      case 'dust': effects.puff(at, 'dust', dt, 8 * intensity, 6); break;
      case 'fountain': effects.fountain(at, intensity, dt); break;
      default: break;
    }
  }
}

function update(dt) {
  syncObjects();
  driveWorker(dt);
  emitProblems(dt);
  effects.update(dt);
  worker.update(dt);
}

function drawOverlay(ctx, camX, camY) {
  effects.draw(ctx, camX, camY);
  for (const object of objects) {
    if (object.solved) continue;
    if (object.action.problem === 'flies') drawFlies(ctx, object.effectPoint, time, camX, camY);
    if (object.action.problem === 'ring') {
      const at = object.effectPoint;
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
  renderer.render(map, entities, camera, time, alpha, drawOverlay);

  hud.setBubble(behavior.message, behavior.warning, renderer.toPage(worker.headPoint(alpha), camera));
  hudTimer += frameDt;
  if (hudTimer > 0.25) {
    hudTimer = 0;
    hud.renderTasks(tasks, latest?.activeTimer);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
