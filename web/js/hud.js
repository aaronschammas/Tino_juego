// Interfaz HTML sobre el canvas: puntos, globo del personaje y avisos.

/**
 * Dónde dibujar el globo (centro x, base y) para que quede sobre la cabeza pero sin salirse de la escena,
 * y cuánto correr la colita para que siga apuntando al personaje.
 */
export function placeBubble(point, size, bounds, margin = 4) {
  const half = size.width / 2;
  const x = Math.min(Math.max(point.x, bounds.left + half + margin), bounds.right - half - margin);
  const y = Math.max(point.y, bounds.top + size.height + margin);
  const tail = Math.min(Math.max(point.x - x + half, 10), size.width - 10);
  return { x, y, tail };
}

export class Hud {
  constructor(doc = document) {
    this.doc = doc;
    this.points = doc.getElementById('points');
    this.bubble = doc.getElementById('bubble');
    this.bubbleText = doc.getElementById('bubble-text');
    this.bubbleWarning = doc.getElementById('bubble-warning');
    this.toast = doc.getElementById('toast');
    this.bubbleSize = { width: 0, height: 0 };
    this.toastTimer = null;
  }

  setPoints(points) {
    const text = `${points} pts`;
    if (this.points.textContent !== text) this.points.textContent = text;
  }

  /** Cartel corto con lo que acaba de pasar (tarea nueva, vencida, resuelta). */
  showToast(text, kind = 'warn') {
    this.toast.textContent = text;
    this.toast.className = `toast-${kind}`;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.hidden = true;
    }, 2600);
  }

  /** Globo sobre la cabeza del personaje (coordenadas de página), siempre dentro de `bounds` (la escena). */
  setBubble(text, warning, point, bounds) {
    this.bubble.hidden = !text;
    if (!text) return;
    const warn = warning ?? '';
    if (this.bubbleText.textContent !== text || this.bubbleWarning.textContent !== warn) {
      this.bubbleText.textContent = text;
      this.bubbleWarning.textContent = warn;
      this.bubbleWarning.hidden = !warning;
      this.bubbleSize = { width: this.bubble.offsetWidth, height: this.bubble.offsetHeight };
    }
    const spot = placeBubble(point, this.bubbleSize, bounds);
    this.bubble.style.setProperty('--tail', `${Math.round(spot.tail)}px`);
    this.bubble.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px) translate(-50%, -100%)`;
  }
}
