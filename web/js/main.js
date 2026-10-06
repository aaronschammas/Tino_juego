import { CONFIG } from './config.js';
import { GameMap } from './map.js';
import { Worker } from './player.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { Effects, drawAlert } from './effects.js';
import { TaskObject, createDecor } from './prop.js';
import { ACTIONS, MAP_ROWS, SLOTS, TASKS, legend } from './scenario.js';
import { clockLabel, OfficeSim, qualityFrom } from './sim.js';
import { TinoApp } from './tino.js';
import { Hud } from './hud.js';
import { MinigameHost } from './minigames/index.js';

// --- Oficina --------------------------------------------------------------
const map = new GameMap(MAP_ROWS, legend());
const spawn = map.marker('spawn');
const objects = map.markers
  .filter((m) => m.marker === 'slot')
  .map((m) => {
    const key = SLOTS[m.slot];
    map.block(m.tx, m.ty);
    return new TaskObject(m.tx, m.ty, { ...ACTIONS[key], key }, null, map.index(m.tx, m.ty));
  });
const decor = map.markers
  .filter((m) => m.marker === 'decor')
  .map((m) => {
    map.block(m.tx, m.ty);
    return createDecor(m.decor, m.tx, m.ty);
  });

const worker = new Worker(spawn.tx, spawn.ty);
const camera = new Camera();
camera.centerOn(map);
const renderer = new Renderer(document.getElementById('game'));
const effects = new Effects();
const hud = new Hud();
const sim = new OfficeSim(TASKS);
const minigames = new MinigameHost();
const tino = new TinoApp(sim, {
  onMistake(urgentId) {
    hud.showToast(`¡Ojo! «${sim.task(urgentId).title}» era más urgente`, 'bad');
  },
  onNotice(text) {
    hud.showToast(text, 'warn');
  },
  onChange: () => hud.setPoints(sim.points()),
});
const officeClock = document.getElementById('office-clock');

let behavior = sim.behavior();

/** Redibuja Tino, los puntos y la hora de la oficina. */
function refresh() {
  tino.render();
  hud.setPoints(sim.points());
  const clock = `🕘 ${clockLabel(sim.elapsed)}`;
  if (officeClock.textContent !== clock) officeClock.textContent = clock;
}

/** Índice de la celda donde está parado el personaje (sus partículas se dibujan en esa profundidad). */
function workerCell() {
  const { cx, cy } = worker.drawCell();
  return map.index(Math.min(map.width - 1, Math.max(0, cx)), Math.min(map.height - 1, Math.max(0, cy)));
}

/** Cada objeto muestra el problema mientras su tarea llegó y no se resolvió. */
function syncObjects() {
  for (const object of objects) {
    const task = sim.task(object.action.key);
    object.task = task;
    const solved = !task.appeared || task.solved;
    if (solved !== object.solved) object.setSolved(solved);
  }
}

/** Avisos de lo que pasó en la partida. */
function playEvents() {
  for (const event of sim.drainEvents()) {
    const task = event.taskId ? sim.task(event.taskId) : null;
    const object = objects.find((candidate) => candidate.action.key === event.taskId);
    if (event.type === 'new') {
      hud.showToast(`📩 Nueva tarea: ${task.title}`, 'warn');
      if (object) effects.puff(object.effectPoint, 'sparks', 1, 30, 20);
    } else if (event.type === 'overdue') {
      hud.showToast(`⏰ Se venció: ${task.title}`, 'bad');
      camera.shake(0.4, 2);
    } else if (event.type === 'solved') {
      hud.showToast('¡Hecho! Ahora completala en Tino', 'good');
      if (object) effects.sparkle(object.effectPoint);
    } else if (event.type === 'expired') {
      hud.showToast('⏰ ¡Tiempo cumplido!', 'warn');
    } else if (event.type === 'done') {
      hud.showToast(event.late ? 'Completada, pero vencida' : '¡Completada a tiempo!', event.late ? 'warn' : 'good');
    } else if (event.type === 'finished') {
      minigames.hide();
      setTimeout(() => hud.showFinal(sim.score(), CONFIG.TINO_URL), CONFIG.FINAL_DELAY_MS);
    }
    refresh();
  }
}

/** Abre el minijuego de la tarea; cerrarlo con ✕ pausa el timer (se retoma desde el temporizador de Tino). */
function openMinigame(task) {
  minigames.open(task.minigame, task.id, {
    onDone(result) {
      sim.solve(task.id, qualityFrom(result));
      refresh();
    },
    onClose() {
      sim.pauseTimer();
      refresh();
    },
  });
}

/** Mueve al personaje: con un timer activo camina al objeto y, al llegar, se abre el minijuego. */
function driveWorker(dt) {
  behavior = sim.behavior((id) => ACTIONS[id]?.say ?? '');
  const target = objects.find((object) => object.action.key === behavior.taskId);
  const keep = minigames.current && (sim.timer?.taskId === minigames.current.taskId || sim.expired?.taskId === minigames.current.taskId);
  if (minigames.isOpen && !keep) minigames.hide();

  if (target && (behavior.mode === 'work' || behavior.mode === 'wait')) {
    const spot = map.workSpot(target.tx, target.ty);
    worker.goTo(map, spot);
    const atSpot = worker.arrived && spot && worker.isOn(spot);
    worker.mode = atSpot && behavior.mode === 'work' ? 'work' : 'idle';
    if (!atSpot) return;
    worker.lookAt(target.tx, target.ty);
    if (behavior.mode !== 'work') return;
    emitWork(target, dt);
    if (!minigames.isOpen) openMinigame(target.task);
    return;
  }

  worker.goTo(map, spawn);
  worker.mode = behavior.mode === 'celebrate' ? 'celebrate' : 'idle';
  if (worker.arrived && worker.mode === 'idle') worker.facing = 'down';
}

/** Chispas o vapor del trabajo sobre el objeto. */
function emitWork(target, dt) {
  const kind = target.action.work;
  if (kind === 'sparks') effects.puff(target.targetPoint, 'sparks', dt, 14, 14);
  if (kind === 'steam') effects.steam(target.targetPoint, dt, 3);
}

/** Efectos de los problemas sin resolver. */
function emitProblems(dt) {
  for (const object of objects) {
    if (object.solved) continue;
    const at = object.effectPoint;
    if (object.action.problem === 'sparks') effects.puff(at, 'sparks', dt, 8, 16);
    if (object.action.problem === 'steam') effects.steam(at, dt);
  }
}

function update(dt) {
  sim.tick(dt);
  syncObjects();
  playEvents();
  driveWorker(dt);
  emitProblems(dt);
  effects.update(dt);
  camera.update(dt);
  worker.update(dt);
}

/** Partículas que salieron de una celda, dibujadas en su profundidad (detrás o delante del personaje). */
function drawCellParticles(ctx, idx, camX, camY) {
  const list = particles.get(idx);
  if (list?.length) effects.draw(ctx, camX, camY, list);
}

/** Encima de todo: partículas sueltas y el "!" de cada problema (rojo si ya venció). */
function drawOverlay(ctx, camX, camY) {
  const loose = particles.get(-1);
  if (loose?.length) effects.draw(ctx, camX, camY, loose);
  for (const object of objects) {
    if (object.solved) continue;
    const at = object.effectPoint;
    if (object.task.overdue) drawAlert(ctx, { x: at.x, y: at.y - 14 }, time, camX, camY, '#e53935', 8);
    else if (object.action.problem === 'ring' || object.action.problem === 'alert') drawAlert(ctx, { x: at.x, y: at.y - 12 }, time, camX, camY);
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
  particles = effects.byCell();
  renderer.render(map, [worker, ...objects, ...decor], camera, time, alpha, { afterCell: drawCellParticles, overlay: drawOverlay });

  hud.setBubble(behavior.message, behavior.warning, renderer.toPage(worker.headPoint(alpha), camera), renderer.rect);
  hudTimer += frameDt;
  if (hudTimer > 0.2) {
    hudTimer = 0;
    refresh();
  }
  requestAnimationFrame(frame);
}

syncObjects();
refresh();
requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
