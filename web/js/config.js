// Configuración global del juego. Todo lo "tuneable" vive acá.
export const CONFIG = {
  // Resolución interna (en píxeles de arte). El canvas se escala sobre esto.
  VIEW_W: 320,
  VIEW_H: 200,

  // Proyección isométrica 2:1. Un tile mide 32x16 px en pantalla y cada nivel de altura sube 8 px.
  TILE_W: 32,
  TILE_H: 16,
  TILE_Z: 8,
  // Altura de la "base" del diorama: los bloques se dibujan desde aquí hasta su altura.
  WORLD_BASE_Z: -1,

  // Escala entera solo si llena al menos esta fracción del espacio; si no, se escala a lo que entre.
  MIN_INTEGER_FILL: 0.9,

  // Game loop de paso fijo.
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.25,

  PLAYER: {
    speed: 2.8,   // tiles por segundo
    radius: 0.22, // radio de la huella, en tiles
  },

  // Cuánto se ve la oficina terminada antes de pasar a las estadísticas.
  FINAL_DELAY_MS: 1800,
  // Link del botón "Conocé Tino" de la pantalla final (vacío = no se muestra).
  TINO_URL: '',

  BG: '#1a1c2c',
};
