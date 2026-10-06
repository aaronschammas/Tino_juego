import { worldToScreen } from './iso.js';
import { getDecorArt, getObjectArt } from './art.js';

/** Objeto decorativo de la oficina (escritorio, planta, sillón...). */
export class Prop {
  constructor(x, y, art, shadow = null) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.art = art;
    this.shadow = shadow;
  }

  drawCell() {
    return { cx: Math.floor(this.x), cy: Math.floor(this.y) };
  }

  get sortKey() {
    return this.x + this.y;
  }

  draw(ctx, camX, camY) {
    const p = worldToScreen(this.x, this.y, this.z);
    const sx = Math.round(p.x) - camX;
    const sy = Math.round(p.y) - camY;
    if (this.shadow) ctx.drawImage(this.shadow, sx - (this.shadow.width >> 1), sy - (this.shadow.height >> 1));
    ctx.drawImage(this.art.canvas, sx - this.art.anchor.x, sy - this.art.anchor.y);
  }
}

export function createDecor(kind, tx, ty) {
  return new Prop(tx + 0.5, ty + 0.5, getDecorArt(kind));
}

/**
 * Objeto de una tarea de Tino. Muestra el problema hasta que la tarea se resuelve;
 * `progress` (0 a 1) sale de los segundos de timer trabajados y `cell` es su celda en el mapa
 * (las partículas que salen de él se dibujan en esa profundidad).
 */
export class TaskObject extends Prop {
  constructor(tx, ty, action, task, cell = -1) {
    super(tx + 0.5, ty + 0.5, getObjectArt(action.kind, false));
    this.tx = tx;
    this.ty = ty;
    this.action = action;
    this.task = task;
    this.progress = 0;
    this.solved = false;
    this.visible = true;
    this.cell = cell;
  }

  /** Punto (pantalla del mundo) donde nace el efecto del problema: arriba del objeto. */
  get effectPoint() {
    const p = worldToScreen(this.x, this.y, 0);
    return { x: p.x, y: p.y - this.action.fxHeight, cell: this.cell };
  }

  /** Punto (pantalla del mundo) al que apunta el personaje al trabajar. */
  get targetPoint() {
    const p = worldToScreen(this.x, this.y, 0);
    return { x: p.x, y: p.y - Math.min(10, this.action.fxHeight), cell: this.cell };
  }

  setSolved(solved) {
    this.solved = solved;
    this.art = getObjectArt(this.action.kind, solved);
  }

  draw(ctx, camX, camY, alpha, time) {
    const ringing = !this.solved && this.action.problem === 'ring';
    const jitter = ringing && Math.floor(time * 20) % 2 ? 1 : 0;
    const p = worldToScreen(this.x, this.y, this.z);
    ctx.drawImage(
      this.art.canvas,
      Math.round(p.x) - camX - this.art.anchor.x + jitter,
      Math.round(p.y) - camY - this.art.anchor.y,
    );
  }
}
