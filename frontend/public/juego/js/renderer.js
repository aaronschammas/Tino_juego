import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';

const { VIEW_W, VIEW_H, TILE_W } = CONFIG;

export class Renderer {
  constructor(canvas, container = canvas.parentElement) {
    this.canvas = canvas;
    this.container = container;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false; // nunca interpolar píxeles al dibujar sprites
    this.scale = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Escala entera en píxeles FÍSICOS (tiene en cuenta devicePixelRatio, p. ej. 125% en Windows),
   * así cada píxel de arte ocupa exactamente N×N píxeles de pantalla. Se ajusta al contenedor.
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const box = this.container.getBoundingClientRect();
    const scale = Math.max(1, Math.floor(Math.min((box.width * dpr) / VIEW_W, (box.height * dpr) / VIEW_H)));
    this.scale = scale / dpr;
    this.canvas.style.width = `${VIEW_W * this.scale}px`;
    this.canvas.style.height = `${VIEW_H * this.scale}px`;
  }

  /** Convierte un punto de pantalla del mundo a coordenadas CSS de la página (para globos HTML). */
  toPage(point, camera) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (point.x - camera.left) * this.scale,
      y: rect.top + (point.y - camera.top) * this.scale,
    };
  }

  render(map, entities, camera, time, alpha, drawOverlay) {
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

    if (drawOverlay) drawOverlay(ctx, camX, camY);
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
