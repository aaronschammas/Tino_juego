// Arte de la oficina. Cada objeto de tarea tiene dos estados: con el problema y resuelto.
import { paintSprite } from './pixel.js';

const C = {
  ink: '#1a1c2c',
  metal: '#3a3f4b', metalDark: '#2b2f38', metalLight: '#565c6b', slot: '#1d2027',
  red: '#e53935', green: '#38d36b', yellow: '#ffcd75', white: '#f4f4f4',
  wood: '#8a5a32', woodDark: '#6b4226', woodDeep: '#5e3a1f', woodLight: '#a1887f',
  leaf: '#4caf50', leafLight: '#66bb6a', leafDark: '#2e7d32', flower: '#ff6fa5',
  pot: '#b5651d', potRim: '#cd7f32',
  steel: '#b0bec5', steelDark: '#90a4ae', counter: '#cfd8dc',
  screen: '#6fb3ff', sofa: '#5c6bc0', sofaLight: '#7986cb',
  skin: '#f4c09c', skinAngry: '#e57373', hair: '#9e9e9e', suit: '#37474f', shirt: '#eceff1', tie: '#c62828',
  coffee: '#6d4c41', mug: '#fafafa',
};

/** Rack de la red: LEDs rojos y un cable desenchufado colgando cuando se cayó internet. */
function rack(bad) {
  return paintSprite(16, 28, (px) => {
    px(3, 4, 10, 22, C.metal);
    px(10, 4, 3, 22, C.metalDark);
    px(3, 3, 10, 1, C.metalLight);
    for (let i = 0; i < 5; i++) {
      px(4, 7 + i * 4, 6, 2, C.slot);
      px(5, 7 + i * 4, 1, 1, bad ? C.red : C.green);
      px(7, 7 + i * 4, 1, 1, bad && i % 2 ? C.red : C.green);
    }
    if (bad) {
      px(1, 12, 2, 1, '#3b5dc9');
      px(0, 13, 1, 6, '#3b5dc9');
      px(1, 20, 2, 1, C.yellow);
      px(0, 21, 1, 4, C.yellow);
    } else {
      px(9, 8, 1, 14, '#3b5dc9');
      px(8, 10, 1, 12, C.yellow);
    }
    px(4, 26, 2, 2, C.slot);
    px(10, 26, 2, 2, C.slot);
  });
}

/** Escritorio con monitor; `screenAlert` pone la pantalla en rojo (reclamo sin responder). */
function escritorio(screenAlert = false) {
  return paintSprite(24, 18, (px) => {
    px(15, 0, 7, 5, C.metalDark);
    px(16, 1, 5, 3, screenAlert ? C.red : C.screen);
    if (screenAlert) px(18, 1, 1, 2, C.white);
    px(18, 5, 1, 3, C.metalDark);
    px(2, 8, 20, 3, C.wood);
    px(2, 11, 20, 2, C.woodDark);
    px(3, 13, 2, 5, C.woodDeep);
    px(19, 13, 2, 5, C.woodDeep);
    px(6, 6, 7, 2, C.metal);
  });
}

/** El jefe en su escritorio: colorado y sin café, o contento con su taza. */
function jefe(bad) {
  return paintSprite(24, 28, (px) => {
    const face = bad ? C.skinAngry : C.skin;
    px(8, 0, 8, 3, C.hair);
    px(8, 3, 8, 6, face);
    px(7, 4, 1, 3, C.hair);
    px(16, 4, 1, 3, C.hair);
    px(10, 5, 1, 1, C.ink);
    px(13, 5, 1, 1, C.ink);
    if (bad) {
      px(9, 4, 3, 1, C.ink);
      px(12, 4, 3, 1, C.ink);
      px(10, 7, 4, 1, C.ink);
    } else {
      px(10, 7, 4, 1, C.ink);
      px(9, 6, 1, 1, C.ink);
      px(14, 6, 1, 1, C.ink);
    }
    px(5, 10, 14, 8, C.suit);
    px(10, 10, 4, 6, C.shirt);
    px(11, 10, 2, 6, C.tie);
    px(2, 16, 20, 3, C.wood);
    px(2, 19, 20, 2, C.woodDark);
    px(3, 21, 2, 7, C.woodDeep);
    px(19, 21, 2, 7, C.woodDeep);
    px(15, 14, 5, 2, C.shirt);
    if (!bad) {
      px(4, 12, 4, 4, C.mug);
      px(5, 12, 2, 1, C.coffee);
      px(8, 13, 1, 2, C.mug);
    }
  });
}

/** Puerta de la sala de reuniones con lector de tarjeta: cerrada con luz roja o abierta con luz verde. */
function puerta(bad) {
  return paintSprite(18, 32, (px) => {
    px(1, 0, 12, 32, C.woodDeep);
    if (bad) {
      px(2, 1, 10, 31, C.wood);
      px(3, 3, 8, 10, C.woodLight);
      px(3, 16, 8, 12, C.woodLight);
      px(10, 16, 1, 3, C.yellow);
    } else {
      px(2, 1, 10, 31, '#2a2a33');
      px(2, 1, 3, 31, C.wood);
    }
    px(14, 12, 4, 7, C.metal);
    px(15, 13, 2, 2, bad ? C.red : C.green);
    px(15, 16, 2, 1, C.slot);
  });
}

/** Planta en maceta. */
function planta() {
  return paintSprite(12, 18, (px) => {
    px(5, 4, 2, 8, C.leafDark);
    px(2, 5, 3, 2, C.leaf);
    px(7, 3, 3, 2, C.leaf);
    px(2, 8, 3, 2, C.leafLight);
    px(7, 7, 3, 2, C.leafLight);
    px(5, 1, 2, 2, C.flower);
    px(2, 11, 8, 2, C.potRim);
    px(3, 13, 6, 4, C.pot);
  });
}

/** Impresora. */
function impresora() {
  return paintSprite(18, 16, (px) => {
    px(1, 6, 16, 8, C.counter);
    px(12, 6, 5, 8, C.steel);
    px(3, 3, 12, 3, '#eceff1');
    px(5, 1, 8, 2, '#ffffff');
    px(3, 9, 12, 1, C.metalDark);
    px(13, 7, 2, 1, C.green);
    px(2, 14, 2, 2, C.slot);
    px(14, 14, 2, 2, C.slot);
  });
}

/** Archivero metálico. */
function archivo() {
  return paintSprite(14, 22, (px) => {
    px(1, 3, 12, 18, '#bcaaa4');
    px(9, 3, 4, 18, '#a1887f');
    for (let i = 0; i < 3; i++) {
      px(2, 5 + i * 6, 10, 1, '#8d6e63');
      px(6, 7 + i * 6, 2, 1, '#5d4037');
    }
  });
}

/** Mesada con la cafetera. */
function cafetera() {
  return paintSprite(18, 22, (px) => {
    px(1, 10, 16, 11, C.counter);
    px(12, 10, 5, 11, C.steelDark);
    px(0, 9, 18, 2, C.steel);
    px(4, 1, 8, 8, C.metal);
    px(9, 1, 3, 8, C.metalDark);
    px(5, 2, 3, 2, C.red);
    px(6, 6, 3, 3, C.mug);
    px(6, 6, 3, 1, C.coffee);
  });
}

/** Sillón de la sala de espera. */
function sofa() {
  return paintSprite(24, 14, (px) => {
    px(0, 4, 24, 8, C.sofa);
    px(2, 2, 20, 4, C.sofaLight);
    px(0, 2, 3, 10, C.sofa);
    px(21, 2, 3, 10, C.sofa);
    px(2, 12, 2, 2, C.woodDeep);
    px(20, 12, 2, 2, C.woodDeep);
  });
}

const OBJECTS = {
  rack,
  jefe,
  puerta,
  mail: (bad) => escritorio(bad),
};

const DECOR = {
  escritorio: () => escritorio(false),
  planta,
  impresora,
  archivo,
  cafetera,
  sofa,
};

const cache = new Map();

/** Sprite con su ancla (píxel que se apoya en el centro del tile), cacheado. */
function cached(key, make) {
  if (!cache.has(key)) {
    const canvas = make();
    cache.set(key, { canvas, anchor: { x: Math.floor(canvas.width / 2), y: canvas.height - 4 } });
  }
  return cache.get(key);
}

/** Sprite de un objeto de tarea en un estado. */
export function getObjectArt(kind, solved) {
  return cached(`${kind}|${solved}`, () => OBJECTS[kind](!solved));
}

/** Sprite de un objeto decorativo. */
export function getDecorArt(kind) {
  return cached(`decor|${kind}`, () => DECOR[kind]());
}

export const OBJECT_KINDS = Object.keys(OBJECTS);
export const DECOR_KINDS = Object.keys(DECOR);
