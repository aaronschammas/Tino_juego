import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';

const { VIEW_W, VIEW_H, TILE_W } = CONFIG;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false; // nunca interpolar píxeles al dibujar sprites
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Escala entera en píxeles FÍSICOS (tiene en cuenta devicePixelRatio, p. ej. 125% en Windows),
   * así cada píxel de arte ocupa exactamente N×N píxeles de pantalla.
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.floor(Math.min((innerWidth * dpr) / VIEW_W, (innerHeight * dpr) / VIEW_H)));
    this.canvas.style.width = `${(VIEW_W * scale) / dpr}px`;
    this.canvas.style.height = `${(VIEW_H * scale) / dpr}px`;
  }

  render(map, entities, camera, time, alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.BG;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const camX = camera.left;
    const camY = camera.top;

    // Agrupamos entidades por la celda tras la cual deben dibujarse.
    const buckets = new Map();
    for (const e of entities) {
      const { cx, cy } = e.drawCell();
      const idx = map.index(
        Math.min(map.width - 1, Math.max(0, cx)),
        Math.min(map.height - 1, Math.max(0, cy)),
      );
      if (!buckets.has(idx)) buckets.set(idx, []);
      buckets.get(idx).push(e);
    }

    // Painter's algorithm: tile → entidades de esa celda, de atrás hacia adelante.
    for (const idx of map.drawOrder) {
      this.drawTile(map.tiles[idx], camX, camY, time);
      const list = buckets.get(idx);
      if (!list) continue;
      if (list.length > 1) list.sort((a, b) => a.sortKey - b.sortKey);
      for (const e of list) e.draw(ctx, camX, camY, alpha, time);
    }
  }

  drawTile(tile, camX, camY, time) {
    const frames = tile.sprites;
    const img = frames.length > 1 ? frames[Math.floor(time * 4 + tile.seed) % frames.length] : frames[0];
    const p = worldToScreen(tile.tx, tile.ty, tile.height);
    const x = Math.round(p.x) - TILE_W / 2 - camX;
    const y = Math.round(p.y) - camY;
    // Culling: no dibujar lo que queda fuera de la vista.
    if (x >= VIEW_W || y >= VIEW_H || x + img.width <= 0 || y + img.height <= 0) return;
    this.ctx.drawImage(img, x, y);
  }
}
