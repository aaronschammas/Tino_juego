// Generación procedural de todos los sprites. Se crean una vez y se cachean.
import { CONFIG } from './config.js';
import { PixelBuffer, hexToRgb, shade, hash2, spriteFromStrings, flipH } from './pixel.js';

const rgb = (hex) => hexToRgb(hex);

// ---------------------------------------------------------------------------
// Bloques del terreno
// ---------------------------------------------------------------------------

/** top: [oscuro, base, claro] de la cara superior · side: [cara izquierda, cara derecha]. */
export const MATERIALS = {
  grass:   { top: ['#4a7f34', '#5fa042', '#7ec850'].map(rgb), side: ['#7a4a26', '#5e3a1f'].map(rgb), band: rgb('#4f8c38') },
  flowers: { top: ['#4a7f34', '#5fa042', '#7ec850'].map(rgb), side: ['#7a4a26', '#5e3a1f'].map(rgb), band: rgb('#4f8c38'),
             speckles: ['#f4f4f4', '#ffcd75', '#ef7d57'].map(rgb) },
  dirt:    { top: ['#a57d44', '#c49a5a', '#d8b878'].map(rgb), side: ['#7a4a26', '#5e3a1f'].map(rgb) },
  stone:   { top: ['#7a8090', '#9da3b0', '#c2c7d1'].map(rgb), side: ['#6b7080', '#4d5160'].map(rgb) },
  water:   { top: ['#2c5fa8', '#3b7dd8', '#73b3f0'].map(rgb), side: ['#24508f', '#1c3f72'].map(rgb), frames: 4 },
  carpet:  { top: ['#3d5a80', '#4a6c97', '#5a7fae'].map(rgb), side: ['#33415c', '#28344a'].map(rgb) },
  wood:    { top: ['#9c6b3c', '#b07d4a', '#c8955f'].map(rgb), side: ['#7a4a26', '#5e3a1f'].map(rgb) },
  tiles:   { top: ['#b8c4cc', '#dfe6ea', '#f4f7f8'].map(rgb), side: ['#8a969e', '#6f7a82'].map(rgb) },
  wall:    { top: ['#c9b79c', '#e0d2b8', '#efe6d4'].map(rgb), side: ['#d8c8aa', '#b8a688'].map(rgb) },
  fence:   { top: ['#7a4a26', '#8d5a32', '#a06a3c'].map(rgb), side: ['#6b4226', '#55331d'].map(rgb) },
};

const TW = CONFIG.TILE_W;          // 32
const TH = CONFIG.TILE_H;          // 16
const HALF = TW / 2;               // 16

/** Fila inferior de la cara superior (rombo) para la columna x. Debajo empiezan las caras laterales. */
function diamondBottom(x) {
  return x < HALF ? HALF / 2 + (x >> 1) : TH - ((x - (HALF - 2)) >> 1);
}

/**
 * Bloque isométrico: rombo superior de 32x16 + caras laterales de `sidePx` de alto.
 * El vértice superior del rombo queda en (16, 0) del canvas.
 */
function makeBlock(mat, sidePx, seed, frame, raised) {
  const buf = new PixelBuffer(TW, TH + sidePx);
  const [dark, base, light] = mat.top;

  // Cara superior
  for (let r = 0; r < TH; r++) {
    const hw = r < TH / 2 ? 2 * (r + 1) : 2 * (TH - r);
    const x0 = HALF - hw;
    const x1 = HALF + hw - 1;
    for (let x = x0; x <= x1; x++) {
      const n = hash2(x + frame * 7, r + frame * 3, seed);
      let c = base;
      if (n < 0.12) c = dark;
      else if (n > 0.9) c = light;
      if (mat.speckles && n > 0.955) c = mat.speckles[Math.floor(hash2(x, r, seed + 99) * mat.speckles.length)];
      // Bordes marcados solo en bloques elevados; el suelo plano queda continuo, sin grilla.
      if (raised && r < TH / 2 && x <= x0 + 1) c = light;   // borde superior-izquierdo iluminado
      if (raised && r >= TH / 2 && x >= x1 - 1) c = dark;   // borde inferior-derecho en sombra
      buf.set(x, r, c);
    }
  }

  // Caras laterales
  for (let x = 0; x < TW; x++) {
    const left = x < HALF;
    const top = diamondBottom(x) + 1;
    const bandLen = mat.band ? 2 + (hash2(x, 0, seed) > 0.6 ? 1 : 0) : 0;
    for (let k = 0; k < sidePx; k++) {
      let c = left ? mat.side[0] : mat.side[1];
      if (k < bandLen) c = left ? mat.band : shade(mat.band, 0.8);
      const n = hash2(x, top + k, seed + 7);
      if (n < 0.15) c = shade(c, 0.85);
      else if (n > 0.92) c = shade(c, 1.12);
      if (x === HALF - 1) c = shade(c, 1.1);           // arista frontal
      if (k === sidePx - 1) c = shade(c, 0.7);         // borde inferior
      buf.set(x, top + k, c);
    }
  }
  return buf.toCanvas();
}

const blockCache = new Map();

/** Frames del bloque (1 normalmente, varios para el agua animada). Cacheado por material/altura/variante. */
export function getBlockSprites(material, height, variant) {
  const sidePx = Math.max(1, Math.round((height - CONFIG.WORLD_BASE_Z) * CONFIG.TILE_Z));
  const key = `${material}|${sidePx}|${variant}`;
  if (!blockCache.has(key)) {
    const mat = MATERIALS[material];
    if (!mat) throw new Error(`Material desconocido: ${material}`);
    const frames = [];
    for (let f = 0; f < (mat.frames ?? 1); f++) frames.push(makeBlock(mat, sidePx, variant * 31 + 1, f, height > 0));
    blockCache.set(key, frames);
  }
  return blockCache.get(key);
}

// ---------------------------------------------------------------------------
// Árbol (copa = unión de círculos sombreados con luz desde arriba-izquierda)
// ---------------------------------------------------------------------------

export const TREE_ANCHOR = { x: 13, y: 34 }; // píxel del sprite que se apoya en el suelo

function makeTree(seed) {
  const buf = new PixelBuffer(26, 36);
  const bark = [rgb('#8a5a32'), rgb('#6b4226')];
  for (let y = 22; y <= 33; y++) {
    for (let x = 11; x <= 14; x++) {
      const c = x < 13 ? bark[0] : bark[1];
      buf.set(x, y, hash2(x, y, seed) < 0.2 ? shade(c, 0.8) : c);
    }
  }

  const leaf = { dark: rgb('#2f6b3a'), base: rgb('#4a9a44'), light: rgb('#7ec850') };
  const jitter = (hash2(seed, 0, 5) - 0.5) * 2;
  const blobs = [
    { cx: 13, cy: 12, r: 9 },
    { cx: 7.5 + jitter, cy: 17, r: 6 },
    { cx: 18.5 - jitter, cy: 17, r: 6 },
    { cx: 13, cy: 19, r: 6 },
  ];
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 26; x++) {
      // El último círculo que contiene el píxel es el que "está adelante".
      let hit = null;
      for (const b of blobs) if ((x - b.cx) ** 2 + (y - b.cy) ** 2 <= b.r * b.r) hit = b;
      if (!hit) continue;
      const v = ((x - hit.cx) * -0.55 + (y - hit.cy) * -0.83) / hit.r + (hash2(x, y, seed) - 0.5) * 0.3;
      let c = v > 0.45 ? leaf.light : v < -0.35 ? leaf.dark : leaf.base;
      if (hash2(x, y, seed + 3) > 0.97) c = leaf.light;
      buf.set(x, y, c);
    }
  }
  return buf.outline(rgb('#1d3324')).toCanvas();
}

const treeCache = new Map();
export function getTreeSprite(variant) {
  if (!treeCache.has(variant)) treeCache.set(variant, makeTree(variant + 11));
  return treeCache.get(variant);
}

// ---------------------------------------------------------------------------
// Sombras (elipses semitransparentes)
// ---------------------------------------------------------------------------

function makeShadow(w, h) {
  const buf = new PixelBuffer(w, h);
  const rx = w / 2, ry = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry;
      if (dx * dx + dy * dy <= 1) buf.set(x, y, [0, 0, 0], 90);
    }
  }
  return buf.toCanvas();
}

/** Índice 0 = en el suelo … 2 = muy alto (más chica). */
export const SHADOWS = [makeShadow(12, 5), makeShadow(10, 4), makeShadow(8, 3)];
export const TREE_SHADOW = makeShadow(18, 7);

// ---------------------------------------------------------------------------
// Personaje (12x18). Cabeza + torso + piernas se combinan para armar los frames.
// ---------------------------------------------------------------------------

const PLAYER_PALETTE = {
  '.': null,
  o: '#1a1c2c', // contorno
  h: '#6b3e26', // pelo
  s: '#f4c09c', // piel
  e: '#1a1c2c', // ojos
  m: '#b55d5d', // boca
  c: '#3b5dc9', // remera
  C: '#29366f', // remera sombra
  l: '#5d3a1a', // cinturón
  p: '#333c57', // pantalón
  b: '#7a4a26', // botas
};

const HEAD = {
  front: [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.ohssssssho.',
    '.osesssseso.',
    '.osssmmssso.',
    '..osssssso..',
  ],
  back: [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.oshhhhhhso.',
    '..ohhhhhho..',
  ],
  side: [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.ohhhhsssso.',
    '.ohhhssseso.',
    '.ohhssssssso',
    '..ohssssmo..',
  ],
};

const TORSO = {
  front: [
    '.occcccccco.',
    'osccccccccso',
    'osCccccccCso',
    '.oCccccccCo.',
    '.ollllllllo.',
  ],
  side: [
    '..occcccco..',
    '..occCCcco..',
    '..occCCcco..',
    '..occsscco..',
    '..ollllllo..',
  ],
};

const LEGS = {
  frontIdle: ['.oppppppppo.', '.oppo..oppo.', '.oppo..oppo.', '.obbo..obbo.', '.oooo..oooo.'],
  frontA:    ['.oppppppppo.', '.oppo..oppo.', '.obbo..oppo.', '.oooo..obbo.', '.......oooo.'],
  frontB:    ['.oppppppppo.', '.oppo..oppo.', '.oppo..obbo.', '.obbo..oooo.', '.oooo.......'],
  sideIdle:  ['..oppppppo..', '...oppppo...', '...oppppo...', '...obbbbbo..', '...ooooooo..'],
  sideStep:  ['..oppppppo..', '..opo..opo..', '.opo....opo.', '.obo....obbo', '.ooo....oooo'],
};

const build = (head, torso, legs) => spriteFromStrings([...head, ...torso, ...legs], PLAYER_PALETTE);

function makeDirection(head, torso, idleLegs, walkLegs) {
  const idle = build(head, torso, idleLegs);
  const walk = walkLegs.map((l) => (l === idleLegs ? idle : build(head, torso, l)));
  return { idle, walk, air: walk[0] };
}

const front = makeDirection(HEAD.front, TORSO.front, LEGS.frontIdle, [LEGS.frontA, LEGS.frontIdle, LEGS.frontB, LEGS.frontIdle]);
const back = makeDirection(HEAD.back, TORSO.front, LEGS.frontIdle, [LEGS.frontA, LEGS.frontIdle, LEGS.frontB, LEGS.frontIdle]);
const right = makeDirection(HEAD.side, TORSO.side, LEGS.sideIdle, [LEGS.sideStep, LEGS.sideIdle]);
const left = { idle: flipH(right.idle), walk: right.walk.map(flipH), air: null };
left.air = left.walk[0];

/** Píxel del sprite que coincide con la posición del personaje (centro de los pies). */
export const PLAYER_ANCHOR = { x: 6, y: 17 };
export const PLAYER_SPRITES = { down: front, up: back, right, left };
