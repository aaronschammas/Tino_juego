// Configuración global del juego. Todo lo "tuneable" vive acá.
export const CONFIG = {
  // Resolución interna (en píxeles de arte). El canvas se escala en enteros sobre esto.
  VIEW_W: 320,
  VIEW_H: 180,

  // Proyección isométrica 2:1. Un tile mide 32x16 px en pantalla y cada nivel de altura sube 8 px.
  TILE_W: 32,
  TILE_H: 16,
  TILE_Z: 8,
  // Altura de la "base" del diorama: los bloques se dibujan desde aquí hasta su altura.
  WORLD_BASE_Z: -1,

  // Game loop de paso fijo.
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.25, // evita la "espiral de la muerte" tras un lag o pestaña oculta

  PLAYER: {
    speed: 3.2,          // tiles por segundo
    runMultiplier: 1.6,
    radius: 0.22,        // radio de la huella de colisión, en tiles
    jumpVelocity: 8.6,   // niveles por segundo (alcanza ~1.3 niveles de altura)
    gravity: 28,         // niveles por segundo²
    stepUp: 0.15,        // desnivel que se sube sin saltar
  },

  CAMERA_SMOOTHING: 8, // mayor = sigue más rápido

  KEYS: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    run: ['ShiftLeft', 'ShiftRight'],
  },

  BG: '#1a1c2c',
};
