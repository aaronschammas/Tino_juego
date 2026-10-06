// La oficina: las tareas de Tino, cómo se ve cada una en el juego y el mapa.
//
// Mapa: fila = eje Y del mundo, columna = eje X. Las paredes van atrás (fila 0 y columna 0) para no tapar nada.
//   W pared · . alfombra · , madera · @ lugar de espera del personaje · 1..9 objeto de la tarea N de `SLOTS`
//   e escritorio · a archivo · c cafetera · p planta · i impresora · s sillón

/**
 * Tareas de la partida (las de Tino):
 *   minigame  qué minijuego abre al llegar el personaje
 *   appearAt  segundo de la partida en que llega la tarea (0 = desde el principio)
 *   dueIn     segundos que tiene para completarse desde que llega; después queda vencida
 */
export const TASKS = [
  {
    id: 'red',
    title: 'Se cayó internet',
    description: 'Nadie puede trabajar: hay que reconectar los cables del rack.',
    priority: 'CRITICAL',
    minigame: 'cables',
    appearAt: 0,
    dueIn: 45,
  },
  {
    id: 'mail',
    title: 'Responder el reclamo por mail',
    description: 'Un cliente mandó un reclamo. Desbloqueá la PC y contestalo.',
    priority: 'HIGH',
    minigame: 'pc',
    appearAt: 0,
    dueIn: 75,
  },
  {
    id: 'jefe',
    title: 'Llevarle un café al jefe',
    description: 'El jefe pidió un café. Preparalo justo como lo pidió.',
    priority: 'MEDIUM',
    minigame: 'cafe',
    appearAt: 0,
    dueIn: 100,
  },
  {
    id: 'puerta',
    title: 'Recibir al cliente',
    description: 'Llegó un cliente a la reunión. Abrile la puerta con tu tarjeta.',
    priority: 'HIGH',
    minigame: 'tarjeta',
    appearAt: 20,
    dueIn: 40,
  },
];

/**
 * Cómo se ve cada tarea en el juego:
 *   kind      arte del objeto (art.js)
 *   problem   efecto mientras no se resuelve: sparks | steam | ring | alert | null
 *   work      efecto mientras el personaje trabaja: sparks | steam | talk
 *   fxHeight  altura (px) del efecto del problema sobre la base del objeto
 *   say       lo que dice el personaje mientras trabaja
 */
export const ACTIONS = {
  red: { kind: 'rack', problem: 'sparks', work: 'sparks', fxHeight: 24, say: 'Cable rojo con rojo...' },
  mail: { kind: 'mail', problem: 'alert', work: 'talk', fxHeight: 16, say: '¿Cuál era la clave?' },
  jefe: { kind: 'jefe', problem: 'steam', work: 'steam', fxHeight: 22, say: '¡Ya va su café, jefe!' },
  puerta: { kind: 'puerta', problem: 'ring', work: 'talk', fxHeight: 26, say: '¡Bienvenido! Pase.' },
};

export const SLOTS = ['red', 'jefe', 'mail', 'puerta'];

export const MAP_ROWS = [
  'WWWWWWWWW',
  'W1.a..c.p',
  'W........',
  'W..e..e..',
  'W4...@...',
  'W........',
  'W..e..2..',
  'W3,,.....',
  'Wi,,....s',
];

const DECOR = { e: 'escritorio', a: 'archivo', c: 'cafetera', p: 'planta', i: 'impresora', s: 'sofa' };

/** Leyenda del mapa: material y altura de cada carácter, y qué marca deja. */
export function legend() {
  const floor = { material: 'carpet', height: 0 };
  const result = {
    W: { material: 'wall', height: 2, solid: true },
    '.': floor,
    ',': { material: 'wood', height: 0 },
    '@': { ...floor, marker: 'spawn' },
  };
  for (const [ch, decor] of Object.entries(DECOR)) result[ch] = { ...floor, marker: 'decor', decor };
  SLOTS.forEach((_, slot) => {
    result[String(slot + 1)] = { ...floor, marker: 'slot', slot };
  });
  return result;
}
