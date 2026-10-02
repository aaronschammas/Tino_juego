import { CONFIG } from './config.js';

const HALF_W = CONFIG.TILE_W / 2;
const HALF_H = CONFIG.TILE_H / 2;

/**
 * Mundo → pantalla.
 *  x, y: plano del suelo (en tiles). z: altura (en niveles).
 *  Eje X del mundo va hacia abajo-derecha en pantalla, eje Y hacia abajo-izquierda, Z hacia arriba.
 */
export function worldToScreen(x, y, z = 0) {
  return {
    x: (x - y) * HALF_W,
    y: (x + y) * HALF_H - z * CONFIG.TILE_Z,
  };
}

/** Pantalla → mundo, sobre el plano z dado (útil para clicks / picking del mouse). */
export function screenToWorld(sx, sy, z = 0) {
  const a = sx / HALF_W;
  const b = (sy + z * CONFIG.TILE_Z) / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
