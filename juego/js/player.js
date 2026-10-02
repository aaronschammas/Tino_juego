import { CONFIG } from './config.js';
import { worldToScreen } from './iso.js';
import { PLAYER_SPRITES, PLAYER_ANCHOR, SHADOWS } from './sprites.js';

const P = CONFIG.PLAYER;
const lerp = (a, b, t) => a + (b - a) * t;

export class Player {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    // Posición del paso anterior, para interpolar el render entre updates.
    this.prevX = x; this.prevY = y; this.prevZ = z;
    this.vz = 0;
    this.onGround = true;
    this.groundZ = z;
    this.facing = 'down';
    this.moving = false;
    this.animTime = 0;
  }

  update(dt, input, map) {
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;

    // --- Movimiento en el plano X/Y -------------------------------------
    const { x: ix, y: iy } = input.axis();
    this.moving = ix !== 0 || iy !== 0;
    if (this.moving) {
      // La entrada es relativa a la PANTALLA; la rotamos 45° al espacio isométrico del mundo:
      // arriba = (-1,-1), derecha = (+1,-1), abajo = (+1,+1), izquierda = (-1,+1).
      let dx = ix + iy;
      let dy = iy - ix;
      const len = Math.hypot(dx, dy);
      const running = input.isDown('run');
      const speed = P.speed * (running ? P.runMultiplier : 1);
      dx = (dx / len) * speed * dt;
      dy = (dy / len) * speed * dt;
      // Ejes por separado: si choca en uno, sigue deslizando por el otro.
      this.tryMove(dx, 0, map);
      this.tryMove(0, dy, map);

      this.facing = Math.abs(iy) >= Math.abs(ix) ? (iy < 0 ? 'up' : 'down') : (ix > 0 ? 'right' : 'left');
      this.animTime += dt * (running ? P.runMultiplier : 1);
    } else {
      this.animTime = 0;
    }

    // --- Eje Z: salto y gravedad ---------------------------------------
    if (input.wasPressed('jump') && this.onGround) {
      this.vz = P.jumpVelocity;
      this.onGround = false;
    }

    this.groundZ = map.groundAt(this.x, this.y, P.radius);
    if (!this.onGround || this.z > this.groundZ) {
      this.onGround = false;            // también al caminar fuera de un borde
      this.vz -= P.gravity * dt;
      this.z += this.vz * dt;
    }
    if (this.z <= this.groundZ) {         // aterrizaje (o subir un escalón pequeño)
      this.z = this.groundZ;
      this.vz = 0;
      this.onGround = true;
    }
  }

  tryMove(dx, dy, map) {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (map.canOccupy(nx, ny, this.z, P.radius, P.stepUp)) {
      this.x = nx;
      this.y = ny;
    }
  }

  /** Celda de orden de dibujado: la esquina más "adelantada" de la huella. */
  drawCell() {
    return { cx: Math.floor(this.x + P.radius), cy: Math.floor(this.y + P.radius) };
  }

  get sortKey() {
    return this.x + this.y;
  }

  /** Posición interpolada entre el update anterior y el actual (alpha ∈ [0,1)). */
  renderPos(alpha) {
    return {
      x: lerp(this.prevX, this.x, alpha),
      y: lerp(this.prevY, this.y, alpha),
      z: lerp(this.prevZ, this.z, alpha),
    };
  }

  draw(ctx, camX, camY, alpha) {
    const { x, y, z } = this.renderPos(alpha);

    // Sombra en el suelo: se achica cuanto más alto está el personaje.
    const height = z - this.groundZ;
    const shadow = SHADOWS[height > 1 ? 2 : height > 0.4 ? 1 : 0];
    const g = worldToScreen(x, y, this.groundZ);
    ctx.drawImage(shadow, Math.round(g.x) - camX - (shadow.width >> 1), Math.round(g.y) - camY - (shadow.height >> 1));

    const set = PLAYER_SPRITES[this.facing];
    let img = set.idle;
    if (!this.onGround) img = set.air;
    else if (this.moving) img = set.walk[Math.floor(this.animTime * 8) % set.walk.length];

    const p = worldToScreen(x, y, z);
    ctx.drawImage(img, Math.round(p.x) - camX - PLAYER_ANCHOR.x, Math.round(p.y) - camY - PLAYER_ANCHOR.y);
  }
}
