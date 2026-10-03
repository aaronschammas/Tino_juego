// Configuración global del juego. Todo lo "tuneable" vive acá.
export const CONFIG = {
  // Resolución interna (en píxeles de arte). El canvas se escala en enteros sobre esto.
  VIEW_W: 320,
  VIEW_H: 200,

  // Proyección isométrica 2:1. Un tile mide 32x16 px en pantalla y cada nivel de altura sube 8 px.
  TILE_W: 32,
  TILE_H: 16,
  TILE_Z: 8,
  // Altura de la "base" del diorama: los bloques se dibujan desde aquí hasta su altura.
  WORLD_BASE_Z: -1,

  // Game loop de paso fijo.
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.25,

  PLAYER: {
    speed: 2.6,   // tiles por segundo
    radius: 0.22, // radio de la huella, en tiles
  },

  // Cada cuánto el juego le pregunta a Tino qué está pasando.
  POLL_MS: 1000,
  TICK_URL: '/api/demo/tick',

  BG: '#1a1c2c',
};
