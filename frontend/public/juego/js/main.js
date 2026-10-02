import { CONFIG } from './config.js';
import { Input } from './input.js';
import { GameMap, LEVEL_1 } from './map.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';

// --- Inicialización -------------------------------------------------------
const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

const input = new Input();
const map = new GameMap(LEVEL_1);
const player = new Player(map.spawn.x, map.spawn.y, map.spawn.z);
const entities = [player, ...map.props];
const camera = new Camera();
const renderer = new Renderer(canvas);
camera.snapTo(player);

// --- Lógica (paso fijo) y dibujo -------------------------------------------
function update(dt) {
  player.update(dt, input, map);
}

function render(alpha, frameDt, time) {
  const pos = player.renderPos(alpha);
  camera.follow(pos, frameDt);
  renderer.render(map, entities, camera, time, alpha);
}

// --- HUD de depuración ----------------------------------------------------
let fpsFrames = 0;
let fpsTimer = 0;
function updateHud(frameDt) {
  fpsFrames++;
  fpsTimer += frameDt;
  if (fpsTimer < 0.25) return;
  const fps = Math.round(fpsFrames / fpsTimer);
  fpsFrames = 0;
  fpsTimer = 0;
  hud.textContent =
    `FPS ${fps}\n` +
    `X ${player.x.toFixed(2)}  Y ${player.y.toFixed(2)}  Z ${player.z.toFixed(2)}`;
}

// --- Game loop ------------------------------------------------------------
// Update a paso fijo (física determinista, igual a 60 Hz que a 144 Hz) y render
// a la frecuencia del monitor, interpolando con `alpha` para que se vea fluido.
const STEP = CONFIG.FIXED_DT;
let accumulator = 0;
let last = performance.now();
let time = 0;

function frame(now) {
  let frameDt = (now - last) / 1000;
  last = now;
  if (frameDt > CONFIG.MAX_FRAME_DT) frameDt = CONFIG.MAX_FRAME_DT;

  accumulator += frameDt;
  while (accumulator >= STEP) {
    update(STEP);
    input.endStep(); // las teclas "recién presionadas" se consumen en el primer update
    accumulator -= STEP;
    time += STEP;
  }

  render(accumulator / STEP, frameDt, time);
  updateHud(frameDt);
  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  requestAnimationFrame(frame);
});
