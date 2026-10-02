import { worldToScreen } from './iso.js';

/** Objeto estático del mundo (árboles, rocas, cofres...). */
export class Prop {
  constructor(x, y, z, sprite, anchor, shadow = null) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.sprite = sprite;
    this.anchor = anchor;
    this.shadow = shadow;
  }

  /** Celda en la que se dibuja: justo después del tile que la contiene. */
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
    ctx.drawImage(this.sprite, sx - this.anchor.x, sy - this.anchor.y);
  }
}
