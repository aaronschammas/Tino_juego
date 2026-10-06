import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';
import { PLAYER_SPRITES, PLAYER_ANCHOR, SHADOWS } from './sprites.js';

const lerp = (a, b, t) => a + (b - a) * t;

/** Dirección del sprite según un desplazamiento en el mundo (se mira en pantalla). */
export function facingFor(dx, dy) {
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  if (Math.abs(sx) >= Math.abs(sy) * 2) return sx > 0 ? 'right' : 'left';
  return sy > 0 ? 'down' : 'up';
}

/** El personaje: camina solo hasta el objeto de la tarea con timer activo y trabaja ahí. */
export class Worker {
  constructor(tx, ty) {
    this.x = tx + 0.5;
    this.y = ty + 0.5;
    this.z = 0;
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = 0;
    this.facing = 'down';
    this.path = [];
    this.destination = { tx, ty };
    this.mode = 'idle';
    this.animTime = 0;
  }

  get tile() {
    return { tx: Math.floor(this.x), ty: Math.floor(this.y) };
  }

  get arrived() {
    return this.path.length === 0;
  }

  /** Arma el camino hacia un tile (si ya iba ahí, no hace nada). */
  goTo(map, tile) {
    if (!tile) return;
    if (tile.tx === this.destination.tx && tile.ty === this.destination.ty && (this.path.length || this.isOn(tile))) return;
    const path = map.findPath(this.tile, tile);
    if (path === null) return;
    this.destination = tile;
    this.path = path;
  }

  /** Si apareció un objeto en el camino, lo rehace hacia el mismo destino (o se frena si ya no se llega). */
  replan(map) {
    if (!this.path.some((step) => !map.isWalkable(step.tx, step.ty))) return;
    this.path = map.findPath(this.tile, this.destination) ?? [];
  }

  isOn(tile) {
    return Math.abs(this.x - (tile.tx + 0.5)) < 0.05 && Math.abs(this.y - (tile.ty + 0.5)) < 0.05;
  }

  lookAt(tx, ty) {
    this.facing = facingFor(tx + 0.5 - this.x, ty + 0.5 - this.y);
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = this.z;
    this.animTime += dt;

    if (this.path.length) {
      const next = this.path[0];
      const dx = next.tx + 0.5 - this.x;
      const dy = next.ty + 0.5 - this.y;
      const distance = Math.hypot(dx, dy);
      const step = CONFIG.PLAYER.speed * dt;
      if (distance <= step) {
        this.x = next.tx + 0.5;
        this.y = next.ty + 0.5;
        this.path.shift();
      } else {
        this.x += (dx / distance) * step;
        this.y += (dy / distance) * step;
      }
      this.facing = facingFor(dx, dy);
    }

    this.z = this.mode === 'celebrate' && !this.path.length ? Math.abs(Math.sin(this.animTime * 7)) * 0.5 : 0;
  }

  drawCell() {
    return {
      cx: Math.floor(this.x + CONFIG.PLAYER.radius),
      cy: Math.floor(this.y + CONFIG.PLAYER.radius),
    };
  }

  get sortKey() {
    return this.x + this.y;
  }

  renderPos(alpha) {
    return {
      x: lerp(this.prevX, this.x, alpha),
      y: lerp(this.prevY, this.y, alpha),
      z: lerp(this.prevZ, this.z, alpha),
    };
  }

  /** Punto (pantalla del mundo) de donde sale la herramienta: a la altura de las manos, hacia donde mira. */
  handPoint() {
    const p = worldToScreen(this.x, this.y, this.z);
    const side = { right: 5, left: -5, down: 2, up: -2 }[this.facing];
    return { x: p.x + side, y: p.y - 9 };
  }

  /** Punto (pantalla del mundo) arriba de la cabeza, para el globo de diálogo. */
  headPoint(alpha = 1) {
    const { x, y, z } = this.renderPos(alpha);
    const p = worldToScreen(x, y, z);
    return { x: p.x, y: p.y - PLAYER_ANCHOR.y - 2 };
  }

  draw(ctx, camX, camY, alpha) {
    const { x, y, z } = this.renderPos(alpha);

    const shadow = SHADOWS[z > 0.3 ? 1 : 0];
    const g = worldToScreen(x, y, 0);
    ctx.drawImage(shadow, Math.round(g.x) - camX - (shadow.width >> 1), Math.round(g.y) - camY - (shadow.height >> 1));

    const set = PLAYER_SPRITES[this.facing];
    let img = set.idle;
    let bob = 0;
    if (this.path.length) img = set.walk[Math.floor(this.animTime * 8) % set.walk.length];
    else if (this.mode === 'work') {
      img = set.walk[Math.floor(this.animTime * 6) % set.walk.length];
      bob = Math.floor(this.animTime * 6) % 2;
    } else if (this.mode === 'celebrate') img = set.air;

    const p = worldToScreen(x, y, z);
    ctx.drawImage(img, Math.round(p.x) - camX - PLAYER_ANCHOR.x, Math.round(p.y) - camY - PLAYER_ANCHOR.y + bob);
  }
}
