// Escenarios del juego. Las claves y las acciones coinciden con backend/src/modules/demo/demo-scenarios.ts.
//
// Mapa: fila = eje Y del mundo, columna = eje X. Las paredes van atrás (fila 0 y columna 0) para no tapar nada.
//   W pared · F cerca · . piso · , piso alternativo · : camino · @ lugar de espera del personaje
//   1..9 objeto de la acción N de `slots` · T árbol · s sillón

/**
 * Qué hace cada acción de Tino en el juego:
 *   kind      arte del objeto (art.js)
 *   problem   efecto mientras no se resuelve: fire | ring | alert | flies | stink | dust | smoke | bugs | fountain | null
 *   work      efecto mientras el personaje trabaja: foam | water | bubbles | dust | trash | grass | sparks | talk
 *   fxHeight  altura (px) del efecto del problema sobre la base del objeto
 *   say       lo que dice el personaje mientras trabaja
 *   furniture se ve siempre (mueble); si no, el objeto aparece recién cuando existe su tarea (consecuencia)
 */
export const ACTIONS = {
  servidor: { kind: 'servidor', problem: 'fire', work: 'foam', fxHeight: 24, say: '¡Matafuegos en acción!', furniture: true },
  impresora: { kind: 'impresora', problem: 'fire', work: 'foam', fxHeight: 12, say: 'Apagando la impresora', furniture: true },
  archivo: { kind: 'archivo', problem: 'fire', work: 'foam', fxHeight: 18, say: '¡Salvemos los papeles!', furniture: true },
  escombros: { kind: 'escombros', problem: 'smoke', work: 'dust', fxHeight: 6, say: 'Juntando escombros' },
  toner: { kind: 'toner', problem: null, work: 'dust', fxHeight: 2, say: 'Limpiando el tóner' },
  telefono: { kind: 'telefono', problem: 'ring', work: 'talk', fxHeight: 16, say: '¡Sí, señor! Ya lo resolvemos.', furniture: true },
  mail: { kind: 'mail', problem: 'alert', work: 'talk', fxHeight: 16, say: 'Respondiendo el reclamo', furniture: true },
  planta: { kind: 'planta', problem: null, work: 'water', fxHeight: 12, say: 'Agüita para la planta', furniture: true },

  sarten: { kind: 'sarten', problem: 'fire', work: 'foam', fxHeight: 17, say: '¡Tapa y matafuegos!', furniture: true },
  cortinas: { kind: 'cortinas', problem: 'fire', work: 'foam', fxHeight: 18, say: '¡Agua a las cortinas!', furniture: true },
  hollin: { kind: 'hollin', problem: 'smoke', work: 'bubbles', fxHeight: 3, say: 'Fregando el hollín' },
  basura: { kind: 'basura', problem: 'flies', work: 'trash', fxHeight: 14, say: 'Afuera la basura', furniture: true },
  cucarachas: { kind: 'cucarachas', problem: 'bugs', work: 'foam', fxHeight: 2, say: '¡Fuera, bichos!' },
  platos: { kind: 'platos', problem: 'stink', work: 'bubbles', fxHeight: 14, say: 'Platos relucientes', furniture: true },
  polvo: { kind: 'polvo', problem: 'dust', work: 'dust', fxHeight: 3, say: 'Escoba a fondo', furniture: true },
  cama: { kind: 'cama', problem: null, work: 'dust', fxHeight: 8, say: 'Haciendo la cama', furniture: true },

  canilla: { kind: 'canilla', problem: 'fountain', work: 'sparks', fxHeight: 16, say: 'Cerrando la canilla', furniture: true },
  inundacion: { kind: 'inundacion', problem: null, work: 'water', fxHeight: 2, say: 'Sacando agua con el balde' },
  cano: { kind: 'cano', problem: 'fountain', work: 'sparks', fxHeight: 12, say: 'Arreglando el caño', furniture: true },
  parrilla: { kind: 'parrilla', problem: 'fire', work: 'water', fxHeight: 12, say: 'Apagando las brasas', furniture: true },
  pastizal: { kind: 'pastizal', problem: 'fire', work: 'water', fxHeight: 8, say: '¡Agua al pasto!' },
  huerta: { kind: 'huerta', problem: null, work: 'water', fxHeight: 6, say: 'Regando la huerta', furniture: true },
  semillas: { kind: 'semillas', problem: null, work: 'grass', fxHeight: 6, say: 'Plantando de nuevo' },
  pasto: { kind: 'pasto', problem: null, work: 'grass', fxHeight: 6, say: 'Cortando el pasto', furniture: true },
  cerca: { kind: 'cerca', problem: null, work: 'sparks', fxHeight: 10, say: 'Martillo y clavos', furniture: true },
};

export const SCENARIOS = {
  oficina: {
    floor: 'carpet',
    altFloor: 'wood',
    slots: ['servidor', 'impresora', 'archivo', 'escombros', 'toner', 'telefono', 'mail', 'planta'],
    rows: [
      'WWWWWWWWW',
      'W1.3..6..',
      'W4.......',
      'W........',
      'W2...@..7',
      'W5.......',
      'W........',
      'W8.......',
      'W........',
    ],
  },
  casa: {
    floor: 'wood',
    altFloor: 'tiles',
    slots: ['sarten', 'cortinas', 'hollin', 'basura', 'cucarachas', 'platos', 'polvo', 'cama'],
    rows: [
      'WWWWWWWWW',
      'W1,2,6...',
      'W3,,,....',
      'W........',
      'W4...@..s',
      'W5.......',
      'W...7....',
      'W......8.',
      'W........',
    ],
  },
  jardin: {
    floor: 'grass',
    altFloor: 'dirt',
    slots: ['canilla', 'inundacion', 'cano', 'parrilla', 'pastizal', 'huerta', 'semillas', 'pasto', 'cerca'],
    rows: [
      'FFFFFFFFF',
      'F1.3...9T',
      'F2..:....',
      'F...:..4.',
      'F6..@...5',
      'F7..:....',
      'F...:..8.',
      'FT..:....',
      'F...:....',
    ],
  },
};

/** Leyenda del mapa para un escenario: material y altura de cada carácter, y qué marca deja. */
export function legendFor(scenario) {
  const floor = { material: scenario.floor, height: 0 };
  const legend = {
    W: { material: 'wall', height: 2, solid: true },
    F: { material: 'fence', height: 1, solid: true },
    '.': floor,
    ',': { material: scenario.altFloor, height: 0 },
    ':': { material: 'dirt', height: 0 },
    '@': { ...floor, marker: 'spawn' },
    T: { ...floor, marker: 'decor', decor: 'arbol' },
    s: { ...floor, marker: 'decor', decor: 'sofa' },
  };
  for (let slot = 0; slot < 9; slot++) legend[String(slot + 1)] = { ...floor, marker: 'slot', slot };
  return legend;
}
