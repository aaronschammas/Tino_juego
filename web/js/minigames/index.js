// Ventana de los minijuegos: se abre sobre todo el juego, como las tareas de Among Us.
import cables from './cables.js';
import cafe from './cafe.js';
import tarjeta from './tarjeta.js';
import pc from './pc.js';

export const MINIGAMES = { cables, cafe, tarjeta, pc };
const DONE_DELAY_MS = 700;

/** Abre un minijuego por vez y avisa cuando se resolvió (con segundos y errores) o cuando se cerró sin terminar. */
export class MinigameHost {
  constructor(doc = document) {
    this.root = doc.getElementById('minigame');
    this.title = doc.getElementById('minigame-title');
    this.body = doc.getElementById('minigame-body');
    this.closeButton = doc.getElementById('minigame-close');
    this.cleanup = null;
    this.current = null;
    this.closeButton.addEventListener('click', () => this.cancel());
  }

  get isOpen() {
    return Boolean(this.current);
  }

  open(kind, taskId, { onDone, onClose }) {
    if (this.current) return;
    const game = MINIGAMES[kind];
    const startedAt = performance.now();
    let mistakes = 0;
    let finished = false;
    this.current = { taskId, onClose };
    this.title.textContent = game.title;
    this.body.replaceChildren();
    this.root.classList.remove('solved');
    this.root.hidden = false;
    this.cleanup = game.mount(this.body, {
      mistake: () => {
        mistakes += 1;
      },
      done: () => {
        if (finished) return;
        finished = true;
        this.root.classList.add('solved');
        const result = { seconds: (performance.now() - startedAt) / 1000, mistakes };
        setTimeout(() => {
          this.hide();
          onDone(result);
        }, DONE_DELAY_MS);
      },
    });
  }

  /** Cerrar con la X: el minijuego queda sin resolver y se pausa el timer. */
  cancel() {
    const current = this.current;
    if (!current || this.root.classList.contains('solved')) return;
    this.hide();
    current.onClose();
  }

  hide() {
    this.cleanup?.();
    this.cleanup = null;
    this.current = null;
    this.root.hidden = true;
    this.body.replaceChildren();
  }
}
