// La oficina: las tareas de Tino, cómo se ve cada una en el juego y el mapa.
//
// Mapa: fila = eje Y del mundo, columna = eje X. Las paredes van atrás (fila 0 y columna 0) para no tapar nada.
//   W pared · . alfombra · , madera · @ lugar de espera del personaje · 1..9 objeto de la tarea N de `SLOTS`
//   e escritorio · a archivo · c cafetera · p planta · i impresora · s sillón

/**
 * Tareas del proyecto de Tino (en minutos de oficina: 1 s real = 1 min, el día arranca 09:00):
 *   minigame  qué minijuego abre al llegar el personaje (solo tareas simples y subtareas)
 *   estimate  estimación de Tino; es lo que propone el cronómetro
 *   appearAt  minuto en que llega la tarea (0 = desde el principio)
 *   dueIn     minutos que tiene para completarse desde que llega; después queda vencida
 *   subtasks  una tarea padre no tiene cronómetro: se trabaja en cada subtarea
 */
export const TASKS = [
  {
    id: 'sistema',
    title: 'Se cayó el sistema',
    description: 'Nadie puede trabajar. Hay que reconectar la red y reiniciar el servidor.',
    priority: 'CRITICAL',
    subtasks: [
      {
        id: 'red',
        title: 'Reconectar los cables del rack',
        description: 'Los cables quedaron sueltos.',
        priority: 'CRITICAL',
        minigame: 'cables',
        estimate: 15,
        dueIn: 40,
      },
      {
        id: 'servidor',
        title: 'Reiniciar el servidor',
        description: 'La PC del servidor pide la clave.',
        priority: 'CRITICAL',
        minigame: 'pc',
        estimate: 15,
        dueIn: 60,
      },
    ],
  },
  {
    id: 'jefe',
    title: 'Llevarle un café al jefe',
    description: 'El jefe pidió un café. Preparalo justo como lo pidió.',
    priority: 'MEDIUM',
    minigame: 'cafe',
    estimate: 12,
    dueIn: 110,
  },
  {
    id: 'puerta',
    title: 'Recibir al cliente',
    description: 'Llegó un cliente a la reunión. Abrile la puerta con tu tarjeta.',
    priority: 'HIGH',
    minigame: 'tarjeta',
    estimate: 8,
    appearAt: 20,
    dueIn: 45,
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
  servidor: { kind: 'mail', problem: 'alert', work: 'talk', fxHeight: 16, say: '¿Cuál era la clave?' },
  jefe: { kind: 'jefe', problem: 'steam', work: 'steam', fxHeight: 22, say: '¡Ya va su café, jefe!' },
  puerta: { kind: 'puerta', problem: 'ring', work: 'talk', fxHeight: 26, say: '¡Bienvenido! Pase.' },
};

export const SLOTS = ['red', 'jefe', 'servidor', 'puerta'];

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
