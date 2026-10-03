// Partículas y efectos en coordenadas de pantalla del mundo (antes de restar la cámara).

const FIRE = ['#fff3b0', '#ffcd75', '#ef7d57', '#b13e53'];
const PALETTES = {
  fire: FIRE,
  foam: ['#ffffff', '#e3f2fd', '#cfd8dc'],
  water: ['#73b3f0', '#3b7dd8', '#a8d4ff'],
  bubbles: ['#ffffff', '#b3e5fc', '#e1f5fe'],
  dust: ['#bdbdbd', '#d6d6d6', '#9e9e9e'],
  grass: ['#7cb342', '#9ccc65', '#558b2f'],
  sparks: ['#fff59d', '#ffcd75', '#ffffff'],
  trash: ['#8d6e63', '#2b2b2b', '#c0ca33'],
  stink: ['#9ccc65', '#c5e1a5'],
  sparkle: ['#ffffff', '#fff59d', '#ffcd75', '#a7f070'],
};

/** Sistema de partículas: cada una vive unos instantes, se mueve con velocidad y gravedad y se desvanece. */
export class Effects {
  constructor(rng = Math.random) {
    this.particles = [];
    this.rng = rng;
  }

  spawn(p) {
    if (this.particles.length > 600) return;
    this.particles.push({ size: 1, gravity: 0, wobble: 0, age: 0, ...p });
  }

  /** Cantidad de partículas a emitir en este paso para una tasa por segundo (resto fraccional al azar). */
  count(ratePerSecond, dt) {
    const exact = ratePerSecond * dt;
    return Math.floor(exact) + (this.rng() < exact % 1 ? 1 : 0);
  }

  /** Llamas que suben desde `at`; `intensity` de 0 a 1+ escala la cantidad y el ancho. */
  fire(at, intensity, dt) {
    const r = this.rng;
    for (let i = this.count(60 * intensity, dt); i > 0; i--) {
      this.spawn({
        x: at.x + (r() - 0.5) * (6 + 8 * intensity),
        y: at.y,
        vx: (r() - 0.5) * 6,
        vy: -18 - r() * 22 * (0.6 + intensity),
        life: 0.35 + r() * 0.45,
        palette: FIRE,
        size: r() < 0.3 ? 2 : 1,
      });
    }
    for (let i = this.count(6 * intensity, dt); i > 0; i--) {
      this.spawn({
        x: at.x + (r() - 0.5) * 6,
        y: at.y - 10 * intensity,
        vx: (r() - 0.5) * 4,
        vy: -10 - r() * 6,
        life: 1 + r(),
        palette: ['#5a5a66', '#3c3c46', '#2a2a33'],
        size: 2,
      });
    }
  }

  /** Chorro desde `from` hacia `to` (matafuegos, regadera, manguera...). */
  spray(from, to, kind, dt, rate = 40) {
    const r = this.rng;
    const time = 0.45;
    for (let i = this.count(rate, dt); i > 0; i--) {
      const gravity = kind === 'water' ? 60 : 0;
      this.spawn({
        x: from.x,
        y: from.y,
        vx: (to.x - from.x) / time + (r() - 0.5) * 10,
        vy: (to.y - from.y) / time - (gravity * time) / 2 + (r() - 0.5) * 10,
        gravity,
        life: time * (0.8 + r() * 0.4),
        palette: PALETTES[kind] ?? PALETTES.foam,
      });
    }
  }

  /** Nube que sale en todas direcciones desde `at` (polvo, pasto cortado, chispas, basura). */
  puff(at, kind, dt, rate = 20, speed = 14) {
    const r = this.rng;
    for (let i = this.count(rate, dt); i > 0; i--) {
      const angle = r() * Math.PI * 2;
      this.spawn({
        x: at.x + (r() - 0.5) * 8,
        y: at.y + (r() - 0.5) * 4,
        vx: Math.cos(angle) * speed * r(),
        vy: Math.sin(angle) * speed * 0.5 * r() - 6,
        gravity: kind === 'sparks' || kind === 'grass' || kind === 'trash' ? 40 : -4,
        life: 0.4 + r() * 0.5,
        palette: PALETTES[kind] ?? PALETTES.dust,
        size: kind === 'dust' ? 2 : 1,
      });
    }
  }

  /** Olor a podrido: rayitas verdes que suben ondulando. */
  stink(at, dt) {
    const r = this.rng;
    for (let i = this.count(4, dt); i > 0; i--) {
      this.spawn({ x: at.x + (r() - 0.5) * 10, y: at.y, vx: 0, vy: -10, wobble: 6, life: 1.4, palette: PALETTES.stink });
    }
  }

  /** Agua que salta hacia arriba y cae (canilla rota). */
  fountain(at, intensity, dt) {
    const r = this.rng;
    for (let i = this.count(45 * intensity, dt); i > 0; i--) {
      this.spawn({
        x: at.x,
        y: at.y,
        vx: (r() - 0.5) * 30,
        vy: -30 - r() * 20,
        gravity: 90,
        life: 0.7,
        palette: PALETTES.water,
      });
    }
  }

  /** Humo gris que sube despacio (escombros, hollín). */
  smoke(at, dt) {
    const r = this.rng;
    for (let i = this.count(5, dt); i > 0; i--) {
      this.spawn({
        x: at.x + (r() - 0.5) * 10,
        y: at.y,
        vx: (r() - 0.5) * 4,
        vy: -8 - r() * 6,
        wobble: 3,
        life: 1.2 + r(),
        palette: ['#9e9e9e', '#757575', '#5a5a66'],
        size: 2,
      });
    }
  }

  /** Explosión: bola de fuego, escombros que caen y humo. */
  explosion(at) {
    const r = this.rng;
    for (let i = 0; i < 90; i++) {
      const angle = r() * Math.PI * 2;
      const speed = 30 + r() * 60;
      this.spawn({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - 20,
        gravity: 50,
        life: 0.5 + r() * 0.6,
        palette: FIRE,
        size: r() < 0.5 ? 2 : 1,
      });
    }
    for (let i = 0; i < 30; i++) {
      const angle = r() * Math.PI * 2;
      this.spawn({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * 40 * r(),
        vy: -30 - r() * 40,
        gravity: 120,
        life: 1 + r() * 0.5,
        palette: ['#5d4037', '#3c3c46', '#8d8d96'],
        size: 2,
      });
    }
    for (let i = 0; i < 20; i++) {
      this.spawn({
        x: at.x + (r() - 0.5) * 16,
        y: at.y - r() * 8,
        vx: (r() - 0.5) * 8,
        vy: -10 - r() * 10,
        life: 1.5 + r(),
        palette: ['#5a5a66', '#3c3c46', '#2a2a33'],
        size: 3,
      });
    }
  }

  /** Explosión de brillitos al resolver un problema. */
  sparkle(at) {
    const r = this.rng;
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const speed = 20 + r() * 25;
      this.spawn({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - 10,
        gravity: 30,
        life: 0.8 + r() * 0.4,
        palette: PALETTES.sparkle,
        size: r() < 0.4 ? 2 : 1,
      });
    }
  }

  update(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += (p.vx + (p.wobble ? Math.sin(p.age * 8) * p.wobble : 0)) * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  draw(ctx, camX, camY) {
    for (const p of this.particles) {
      const t = p.age / p.life;
      ctx.fillStyle = p.palette[Math.min(p.palette.length - 1, Math.floor(t * p.palette.length))];
      ctx.fillRect(Math.round(p.x) - camX, Math.round(p.y) - camY, p.size, p.size);
    }
  }
}

/** Moscas dando vueltas sobre `at` (dibujo directo, sin partículas). */
export function drawFlies(ctx, at, time, camX, camY, count = 4) {
  ctx.fillStyle = '#1a1c2c';
  for (let i = 0; i < count; i++) {
    const x = at.x + Math.cos(time * (3 + i) + i * 2) * (6 + i);
    const y = at.y - 6 + Math.sin(time * (4 + i * 0.7) + i) * 3;
    ctx.fillRect(Math.round(x) - camX, Math.round(y) - camY, 1, 1);
  }
}

/** Cucarachas caminando en el piso alrededor de `at`. */
export function drawCrawlers(ctx, at, time, camX, camY, count = 5) {
  ctx.fillStyle = '#3e2723';
  for (let i = 0; i < count; i++) {
    const angle = time * (0.8 + i * 0.3) + i * 1.7;
    const x = at.x + Math.cos(angle) * (8 + (i % 3) * 3);
    const y = at.y + Math.sin(angle) * (3 + (i % 2) * 2);
    ctx.fillRect(Math.round(x) - camX, Math.round(y) - camY, 2, 1);
  }
}

/** Signo "!" que titila sobre un objeto (teléfono sonando, alarma); en rojo cuando algo está por empeorar. */
export function drawAlert(ctx, at, time, camX, camY, color = '#ffcd75', speed = 4) {
  if (Math.floor(time * speed) % 2) return;
  const x = Math.round(at.x) - camX;
  const y = Math.round(at.y) - camY;
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(x - 2, y - 1, 5, 9);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y, 3, 5);
  ctx.fillRect(x - 1, y + 6, 3, 1);
}
