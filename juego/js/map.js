import { getBlockSprites, getTreeSprite, TREE_ANCHOR, TREE_SHADOW } from './sprites.js';
import { Prop } from './prop.js';
import { hash2 } from './pixel.js';

/**
 * Leyenda del mapa: cada carácter define material, altura (en niveles) y si bloquea el paso.
 * Las alturas 1, 2 y 3 son bloques elevados: se sube saltando (Espacio).
 */
export const LEGEND = {
  '.': { material: 'grass', height: 0 },
  ',': { material: 'flowers', height: 0 },
  ':': { material: 'dirt', height: 0 },
  '~': { material: 'water', height: -0.25, solid: true },
  '1': { material: 'grass', height: 1 },
  '2': { material: 'grass', height: 2 },
  '3': { material: 'stone', height: 3 },
  'T': { material: 'grass', height: 0, solid: true, prop: 'tree' },
  '@': { material: 'grass', height: 0, spawn: true },
};

// Fila = eje Y del mundo, columna = eje X del mundo.
export const LEVEL_1 = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~~...,....T....,..~~',
  '~..11.......::...T.~',
  '~.122..T....::.....~',
  '~.123.......::..,..~',
  '~..1....,...::.....~',
  '~...@...::::::::...~',
  '~..T....:..~~..:.T.~',
  '~.,.....:.~~~~.:...~',
  '~.......:..~~..:...~',
  '~...11..::::::::...~',
  '~..1221.....:...,..~',
  '~..1221..T..:..T...~',
  '~...11......:......~',
  '~~..,....T..:....~~~',
  '~~~~~~~~~~~~~~~~~~~~',
];

export class GameMap {
  constructor(rows, legend = LEGEND) {
    this.height = rows.length;
    this.width = rows[0].length;
    this.tiles = [];
    this.props = [];
    this.spawn = null;

    rows.forEach((row, ty) => {
      if (row.length !== this.width) {
        throw new Error(`Mapa: la fila ${ty} tiene ${row.length} columnas, se esperaban ${this.width}`);
      }
      [...row].forEach((ch, tx) => {
        const def = legend[ch];
        if (!def) throw new Error(`Mapa: carácter desconocido '${ch}' en (${tx}, ${ty})`);
        const seed = Math.floor(hash2(tx, ty, 1234) * 1e6);
        this.tiles.push({
          tx, ty,
          material: def.material,
          height: def.height,
          solid: !!def.solid,
          seed,
          sprites: getBlockSprites(def.material, def.height, seed % 4),
        });
        if (def.prop === 'tree') {
          this.props.push(new Prop(tx + 0.5, ty + 0.5, def.height, getTreeSprite(seed % 3), TREE_ANCHOR, TREE_SHADOW));
        }
        if (def.spawn) this.spawn = { x: tx + 0.5, y: ty + 0.5, z: def.height };
      });
    });

    if (!this.spawn) throw new Error("Mapa: falta el punto de inicio '@'");

    // Orden de dibujado isométrico (painter's algorithm): por diagonales x+y, de atrás hacia adelante.
    this.drawOrder = [];
    for (let s = 0; s <= this.width + this.height - 2; s++) {
      for (let tx = Math.max(0, s - this.height + 1); tx <= Math.min(this.width - 1, s); tx++) {
        this.drawOrder.push(this.index(tx, s - tx));
      }
    }
  }

  index(tx, ty) {
    return ty * this.width + tx;
  }

  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return null;
    return this.tiles[this.index(tx, ty)];
  }

  /** Esquinas de la huella cuadrada (radio r) de una entidad en (x, y). */
  *footprint(x, y, r) {
    for (const cx of [x - r, x + r]) {
      for (const cy of [y - r, y + r]) yield this.get(Math.floor(cx), Math.floor(cy));
    }
  }

  /** ¿Puede una entidad a altura z ocupar (x, y)? Bloquean los tiles sólidos y los más altos que z + stepUp. */
  canOccupy(x, y, z, r, stepUp) {
    for (const tile of this.footprint(x, y, r)) {
      if (!tile || tile.solid || tile.height > z + stepUp) return false;
    }
    return true;
  }

  /** Altura del suelo bajo la huella: el tile más alto que pisa (permite pararse en bordes). */
  groundAt(x, y, r) {
    let ground = -Infinity;
    for (const tile of this.footprint(x, y, r)) {
      if (tile && !tile.solid) ground = Math.max(ground, tile.height);
    }
    return ground === -Infinity ? 0 : ground;
  }
}
