import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';

/** Cámara que sigue a un objetivo con suavizado exponencial (independiente de los FPS). */
export class Camera {
  constructor() {
    this.x = 0; // centro de la vista, en píxeles de mundo proyectado
    this.y = 0;
  }

  snapTo(pos) {
    const p = worldToScreen(pos.x, pos.y, pos.z);
    this.x = p.x;
    this.y = p.y - 12;
  }

  follow(pos, dt) {
    const p = worldToScreen(pos.x, pos.y, pos.z);
    const k = 1 - Math.exp(-CONFIG.CAMERA_SMOOTHING * dt);
    this.x += (p.x - this.x) * k;
    this.y += (p.y - 12 - this.y) * k; // apunta un poco por encima de los pies
  }

  /** Esquina superior izquierda en píxeles enteros: evita que el pixel art "tiemble". */
  get left() { return Math.round(this.x - CONFIG.VIEW_W / 2); }
  get top() { return Math.round(this.y - CONFIG.VIEW_H / 2); }
}
