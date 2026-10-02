// Utilidades para generar pixel art por código (sin archivos de imagen).

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(rgb, f) {
  return rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
}

/** Hash determinista → [0, 1). Mismo (x, y, seed) = mismo valor: el "ruido" no parpadea. */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Buffer RGBA para pintar píxel a píxel y volcarlo a un canvas de una sola vez. */
export class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x, y, rgb, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = a;
  }

  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  /** Contorno de 1 px alrededor de todo lo opaco (vecindad 4). */
  outline(rgb) {
    const edge = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y)) continue;
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) {
          edge.push(x, y);
        }
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.set(edge[i], edge[i + 1], rgb);
    return this;
  }

  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    c.getContext('2d').putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return c;
  }
}

/** Sprite a partir de filas de texto: cada carácter es un color de la paleta ('.' = transparente). */
export function spriteFromStrings(rows, palette) {
  const w = rows[0].length;
  rows.forEach((row, i) => {
    if (row.length !== w) throw new Error(`Sprite: la fila ${i} mide ${row.length}, se esperaba ${w}: "${row}"`);
  });
  const buf = new PixelBuffer(w, rows.length);
  const rgb = Object.fromEntries(
    Object.entries(palette).map(([k, hex]) => [k, hex ? hexToRgb(hex) : null]),
  );
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!(ch in rgb)) throw new Error(`Sprite: color '${ch}' no está en la paleta`);
      if (rgb[ch]) buf.set(x, y, rgb[ch]);
    });
  });
  return buf.toCanvas();
}

export function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.scale(-1, 1);
  ctx.drawImage(src, -src.width, 0);
  return c;
}
