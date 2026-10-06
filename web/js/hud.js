// Interfaz HTML sobre el canvas: puntos, globo del personaje, avisos y estadísticas finales.
import { clockLabel, minutesToHMS, PRIORITY_LABEL } from './sim.js';

const FINAL_TITLE = {
  cleared: '¡Oficina en orden!',
  timeout: '¡Se terminó el día!',
};
const OUTCOME_LABEL = { 'on-time': 'A tiempo', late: 'Vencida', pending: 'Sin terminar' };
const BEST_KEY = 'tino-oficina:best';

/** Filas de los números de la pantalla final. */
export function finalLines(score) {
  return [
    ['Completadas a tiempo', `${score.onTime} de ${score.total}`],
    ['Completadas vencidas', String(score.late)],
    ['Sin terminar', String(score.pending)],
    ['Dentro de lo estimado', `${score.withinEstimate} de ${score.total}`],
    ['Priorización', score.efficiency === null ? '—' : `${score.efficiency}%`],
    ['Tiempo real / estimado', `${minutesToHMS(score.actual)} / ${minutesToHMS(score.estimate)}`],
    ['Terminaste a las', clockLabel(score.minutes)],
  ];
}

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

/** Lee y actualiza el mejor puntaje de este celular (si el navegador no deja guardar, no pasa nada). */
function rememberBest(points) {
  try {
    const best = Number(localStorage.getItem(BEST_KEY)) || 0;
    if (points > best) localStorage.setItem(BEST_KEY, String(points));
    return { best: Math.max(best, points), record: points > best && best > 0 };
  } catch {
    return { best: points, record: false };
  }
}

export class Hud {
  constructor(doc = document) {
    this.doc = doc;
    this.points = doc.getElementById('points');
    this.bubble = doc.getElementById('bubble');
    this.bubbleText = doc.getElementById('bubble-text');
    this.bubbleWarning = doc.getElementById('bubble-warning');
    this.toast = doc.getElementById('toast');
    this.final = doc.getElementById('final');
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

  /** Estadísticas al estilo Tino: números, tiempo de cada tarea y puntos, con "Jugar otra vez". */
  showFinal(score, tinoUrl) {
    const doc = this.doc;
    const make = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const { best, record } = rememberBest(score.points);

    const kpis = make('dl', 'final-kpis');
    for (const [label, value] of finalLines(score)) kpis.append(make('dt', null, label), make('dd', null, value));

    const longest = Math.max(1, ...score.tasks.map((task) => Math.max(task.actual, task.estimate)));
    const bars = make('ul', 'final-bars');
    for (const task of score.tasks) {
      const li = make('li', `outcome-${task.outcome}${task.actual > task.estimate ? ' over' : ''}`);
      const head = make('div', 'final-bar-head');
      head.append(make('span', null, task.title), make('span', 'final-bar-tag', OUTCOME_LABEL[task.outcome]));
      const bar = make('span', 'final-bar');
      const fill = make('span', 'final-bar-fill');
      fill.style.width = `${Math.max(3, Math.round((task.actual / longest) * 100))}%`;
      fill.title = PRIORITY_LABEL[task.priority];
      const mark = make('span', 'final-bar-est');
      mark.style.left = `${Math.round((task.estimate / longest) * 100)}%`;
      bar.append(fill, mark);
      li.append(head, bar, make('small', 'final-bar-times', `Real: ${minutesToHMS(task.actual)} / Est: ${minutesToHMS(task.estimate)}`));
      bars.append(li);
    }

    const points = make('p', 'final-points');
    points.append(make('strong', null, `${score.points} pts`), make('small', null, record ? '¡Nuevo récord!' : `Mejor: ${best} pts`));

    const actions = make('div', 'final-actions');
    const again = make('button', 'final-again', 'Jugar otra vez');
    again.type = 'button';
    again.addEventListener('click', () => location.reload());
    actions.append(again);
    if (tinoUrl) {
      const link = make('a', 'final-link', 'Conocé Tino');
      link.href = tinoUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      actions.append(link);
    }

    const card = make('div', 'final-card');
    card.append(make('h2', null, FINAL_TITLE[score.reason] ?? FINAL_TITLE.timeout), points, kpis, make('h3', null, 'Tiempo real vs. estimado'), bars, actions);
    this.final.replaceChildren(card);
    this.final.hidden = false;
  }
}
