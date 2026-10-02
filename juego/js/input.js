import { CONFIG } from './config.js';

/**
 * Teclado. Distingue "mantenido" (down) de "recién presionado" (pressed).
 * Los "pressed" se limpian después de cada paso de update, así un salto
 * nunca se pierde aunque un frame de render no ejecute ningún update.
 */
export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.gameCodes = new Set(Object.values(CONFIG.KEYS).flat());

    target.addEventListener('keydown', (e) => {
      if (this.gameCodes.has(e.code)) e.preventDefault(); // sin scroll con flechas/espacio
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Si la ventana pierde el foco, soltamos todo para que el personaje no quede caminando.
    window.addEventListener('blur', () => { this.down.clear(); this.pressed.clear(); });
  }

  isDown(action) {
    return CONFIG.KEYS[action].some((code) => this.down.has(code));
  }

  wasPressed(action) {
    return CONFIG.KEYS[action].some((code) => this.pressed.has(code));
  }

  /** Dirección en espacio de PANTALLA: x derecha = +1, y abajo = +1. */
  axis() {
    return {
      x: (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0),
      y: (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0),
    };
  }

  endStep() {
    this.pressed.clear();
  }
}
