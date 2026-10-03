import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';

/** Cámara fija: cada escenario es una habitación que entra entera en pantalla. */
export class Camera {
  constructor() {
    this.x = 0; // centro de la vista, en píxeles de mundo proyectado
    this.y = 0;
  }

  /** Centra la vista en el medio del mapa (un poco más arriba, por las paredes del fondo). */
  centerOn(map) {
    const p = worldToScreen(map.width / 2, map.height / 2, 0);
    this.x = p.x;
    this.y = p.y - 8;
  }

  /** Esquina superior izquierda en píxeles enteros: evita que el pixel art "tiemble". */
  get left() { return Math.round(this.x - CONFIG.VIEW_W / 2); }
  get top() { return Math.round(this.y - CONFIG.VIEW_H / 2); }
}
