import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';

const { VIEW_W, VIEW_H, TILE_W } = CONFIG;

/**
 * Escala (en píxeles físicos) para un espacio que admite hasta `fitX`×`fitY`: entera si llena casi todo
 * (cada píxel de arte queda N×N exacto), si no la que llena el espacio aunque no sea entera (el juego no
 * queda chiquito en medio monitor).
 */
export function pickScale(fitX, fitY, minFill = CONFIG.MIN_INTEGER_FILL) {
  const fit = Math.min(fitX, fitY);
  const whole = Math.floor(fit);
  return whole >= 1 && whole >= fit * minFill ? whole : fit;
}

export class Renderer {
  constructor(canvas, container = canvas.parentElement) {
    this.canvas = canvas;
    this.container = container;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false; // nunca interpolar píxeles al dibujar sprites
    this.scale = 1;
    this.rect = canvas.getBoundingClientRect();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(container);
  }

  /**
   * Escala para llenar el contenedor, en píxeles FÍSICOS (tiene en cuenta devicePixelRatio, p. ej. 125% en
   * Windows). Ver `pickScale`. Guarda dónde quedó el canvas en la página (para no medirlo en cada frame).
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const box = this.container.getBoundingClientRect();
    this.scale = pickScale((box.width * dpr) / VIEW_W, (box.height * dpr) / VIEW_H) / dpr;
    this.canvas.style.width = `${VIEW_W * this.scale}px`;
    this.canvas.style.height = `${VIEW_H * this.scale}px`;
    this.rect = this.canvas.getBoundingClientRect();
  }

  /** Convierte un punto de pantalla del mundo a coordenadas CSS de la página (para globos HTML). */
  toPage(point, camera) {
    return {
      x: this.rect.left + (point.x - camera.left) * this.scale,
      y: this.rect.top + (point.y - camera.top) * this.scale,
    };
  }

  /**
   * Dibuja el mapa y las entidades de atrás hacia adelante. `afterCell(ctx, idx, camX, camY)` dibuja lo que va
   * en la profundidad de cada celda (partículas) y `overlay` lo que va siempre encima.
   */
  render(map, entities, camera, time, alpha, { afterCell, overlay } = {}) {
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
      if (list) {
        if (list.length > 1) list.sort((a, b) => a.sortKey - b.sortKey);
        for (const e of list) e.draw(ctx, camX, camY, alpha, time);
      }
      if (afterCell) afterCell(ctx, idx, camX, camY);
    }

    if (overlay) overlay(ctx, camX, camY);
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
