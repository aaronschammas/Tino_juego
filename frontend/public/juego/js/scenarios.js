// Escenarios del juego. Las claves y las acciones coinciden con backend/src/modules/demo/demo-scenarios.ts.
//
// Mapa: fila = eje Y del mundo, columna = eje X. Las paredes van atrás (fila 0 y columna 0) para no tapar nada.
//   W pared · F cerca · . piso · , piso alternativo · : camino · @ lugar de espera del personaje
//   1..4 objeto de la acción N de `slots` · T árbol · m escritorio · s sillón

/**
 * Qué hace cada acción de Tino en el juego:
 *   kind     arte del objeto (art.js)
 *   problem  efecto mientras no se resuelve: fire | ring | flies | stink | dust | fountain | null
 *   work     efecto mientras el personaje trabaja: foam | water | bubbles | dust | trash | grass | sparks | talk
 *   fxHeight altura (px) del efecto del problema sobre la base del objeto
 *   say      lo que dice el personaje mientras trabaja
 */
export const ACTIONS = {
  servidor: { kind: 'servidor', problem: 'fire', work: 'foam', fxHeight: 24, say: '¡Matafuegos en acción!' },
  telefono: { kind: 'telefono', problem: 'ring', work: 'talk', fxHeight: 16, say: '¡Sí, señor! Ya lo resolvemos.' },
  planta: { kind: 'planta', problem: null, work: 'water', fxHeight: 12, say: 'Agüita para la planta' },
  sarten: { kind: 'sarten', problem: 'fire', work: 'foam', fxHeight: 17, say: '¡Tapa y matafuegos!' },
  basura: { kind: 'basura', problem: 'flies', work: 'trash', fxHeight: 14, say: 'Afuera la basura' },
  platos: { kind: 'platos', problem: 'stink', work: 'bubbles', fxHeight: 14, say: 'Platos relucientes' },
  polvo: { kind: 'polvo', problem: 'dust', work: 'dust', fxHeight: 3, say: 'Escoba a fondo' },
  canilla: { kind: 'canilla', problem: 'fountain', work: 'sparks', fxHeight: 16, say: 'Cerrando la canilla' },
  huerta: { kind: 'huerta', problem: null, work: 'water', fxHeight: 6, say: 'Regando la huerta' },
  pasto: { kind: 'pasto', problem: null, work: 'grass', fxHeight: 6, say: 'Cortando el pasto' },
  cerca: { kind: 'cerca', problem: null, work: 'sparks', fxHeight: 10, say: 'Martillo y clavos' },
};

export const SCENARIOS = {
  oficina: {
    floor: 'carpet',
    altFloor: 'wood',
    slots: ['servidor', 'telefono', 'planta'],
    rows: [
      'WWWWWWWW',
      'W1...2..',
      'W.......',
      'W......m',
      'W...@...',
      'W.......',
      'W3......',
      'W.......',
    ],
  },
  casa: {
    floor: 'wood',
    altFloor: 'tiles',
    slots: ['sarten', 'basura', 'platos', 'polvo'],
    rows: [
      'WWWWWWWW',
      'W1,3,...',
      'W,,,,...',
      'W.......',
      'W...@..s',
      'W.......',
      'W2..4...',
      'W.......',
    ],
  },
  jardin: {
    floor: 'grass',
    altFloor: 'dirt',
    slots: ['canilla', 'huerta', 'pasto', 'cerca'],
    rows: [
      'FFFFFFFF',
      'F.1..4.T',
      'F..:....',
      'F2.:...T',
      'F..:@...',
      'F..:..3.',
      'FT.:....',
      'F..:....',
    ],
  },
};

/** Leyenda del mapa para un escenario: material y altura de cada carácter, y qué marca deja. */
export function legendFor(scenario) {
  const floor = { material: scenario.floor, height: 0 };
  return {
    W: { material: 'wall', height: 2, solid: true },
    F: { material: 'fence', height: 1, solid: true },
    '.': floor,
    ',': { material: scenario.altFloor, height: 0 },
    ':': { material: 'dirt', height: 0 },
    '@': { ...floor, marker: 'spawn' },
    1: { ...floor, marker: 'slot', slot: 0 },
    2: { ...floor, marker: 'slot', slot: 1 },
    3: { ...floor, marker: 'slot', slot: 2 },
    4: { ...floor, marker: 'slot', slot: 3 },
    T: { ...floor, marker: 'decor', decor: 'arbol' },
    m: { ...floor, marker: 'decor', decor: 'escritorio' },
    s: { ...floor, marker: 'decor', decor: 'sofa' },
  };
}
