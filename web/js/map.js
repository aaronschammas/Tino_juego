import { getBlockSprites } from './sprites.js';
import { hash2 } from './pixel.js';

const NEIGHBORS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Mapa isométrico armado desde filas de texto y una leyenda (ver scenarios.js). */
export class GameMap {
  constructor(rows, legend) {
    this.height = rows.length;
    this.width = rows[0].length;
    this.tiles = [];
    this.markers = [];

    rows.forEach((row, ty) => {
      if (row.length !== this.width) {
        throw new Error(`Mapa: la fila ${ty} tiene ${row.length} columnas, se esperaban ${this.width}`);
      }
      [...row].forEach((ch, tx) => {
        const def = legend[ch];
        if (!def) throw new Error(`Mapa: carácter desconocido '${ch}' en (${tx}, ${ty})`);
        const seed = Math.floor(hash2(tx, ty, 1234) * 1e6);
        this.tiles.push({
          tx,
          ty,
          material: def.material,
          height: def.height,
          solid: Boolean(def.solid),
          seed,
          sprites: getBlockSprites(def.material, def.height, seed % 4),
        });
        if (def.marker) this.markers.push({ ...def, tx, ty, seed });
      });
    });

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

  marker(kind) {
    return this.markers.find((m) => m.marker === kind);
  }

  /** Marca un tile como ocupado por un objeto (no se puede pisar). */
  block(tx, ty) {
    const tile = this.get(tx, ty);
    if (tile) tile.solid = true;
  }

  /** Libera un tile (un objeto que todavía no apareció). */
  unblock(tx, ty) {
    const tile = this.get(tx, ty);
    if (tile) tile.solid = false;
  }

  isWalkable(tx, ty) {
    const tile = this.get(tx, ty);
    return Boolean(tile && !tile.solid && tile.height <= 0.15);
  }

  /** Tile libre al lado de un objeto para pararse a trabajar; prefiere los de adelante (se ve al personaje). */
  workSpot(tx, ty) {
    for (const [dx, dy] of NEIGHBORS) {
      if (this.isWalkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
    }
    return null;
  }

  /** Camino más corto (BFS, 4 direcciones) entre dos tiles caminables, como lista de tiles sin el inicial. */
  findPath(from, to) {
    const start = this.index(from.tx, from.ty);
    const goal = this.index(to.tx, to.ty);
    if (start === goal) return [];
    const previous = new Map([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      if (current === goal) break;
      const cx = current % this.width;
      const cy = Math.floor(current / this.width);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const next = this.index(nx, ny);
        if (!this.isWalkable(nx, ny) || previous.has(next)) continue;
        previous.set(next, current);
        queue.push(next);
      }
    }
    if (!previous.has(goal)) return null;
    const path = [];
    for (let node = goal; node !== start; node = previous.get(node)) {
      path.unshift({ tx: node % this.width, ty: Math.floor(node / this.width) });
    }
    return path;
  }
}
