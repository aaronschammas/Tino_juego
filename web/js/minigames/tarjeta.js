// Minijuego "Pasar la tarjeta": se desliza la tarjeta por el lector a la velocidad justa.
import { el, flash } from './util.js';

export const SWIPE_MS = { min: 300, max: 1400 };
const END = 0.92;

/** Resultado de una pasada según cuánto tardó (ms) en llegar al final: fast | slow | ok. */
export function classifySwipe(ms) {
  if (ms < SWIPE_MS.min) return 'fast';
  if (ms > SWIPE_MS.max) return 'slow';
  return 'ok';
}

const MESSAGES = {
  idle: 'Deslizá la tarjeta →',
  fast: 'Muy rápido. Probá de nuevo.',
  slow: 'Muy lento. Probá de nuevo.',
  short: 'Deslizá hasta el final.',
  ok: 'Aceptada. ¡Pase!',
};

/** Arma el lector; la tarjeta se arrastra en horizontal y vuelve al inicio si la pasada no sirvió. */
function mount(body, api) {
  const doc = body.ownerDocument;
  const display = el(doc, 'div', 'mg-display', MESSAGES.idle);
  const track = el(doc, 'div', 'mg-track');
  const card = el(doc, 'div', 'mg-card');
  card.append(el(doc, 'span', 'mg-card-chip'), el(doc, 'span', 'mg-card-name', 'TINO · Staff'));
  track.append(card);
  body.append(display, track);

  let drag = null;
  let solved = false;
  const max = () => track.clientWidth - card.offsetWidth;
  const move = (x) => {
    card.style.transform = `translateX(${x}px)`;
  };
  const show = (key) => {
    display.textContent = MESSAGES[key];
    display.className = `mg-display ${key === 'ok' ? 'good' : key === 'idle' ? '' : 'bad'}`;
  };

  card.addEventListener('pointerdown', (event) => {
    if (solved) return;
    event.preventDefault();
    card.setPointerCapture?.(event.pointerId);
    card.classList.remove('back');
    drag = { startX: event.clientX, startAt: performance.now(), reachedAt: null };
    show('idle');
  });
  card.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(max(), event.clientX - drag.startX));
    move(x);
    if (!drag.reachedAt && x >= max() * END) drag.reachedAt = performance.now();
  });
  const release = () => {
    if (!drag) return;
    const result = drag.reachedAt ? classifySwipe(drag.reachedAt - drag.startAt) : 'short';
    drag = null;
    show(result);
    if (result === 'ok') {
      solved = true;
      move(max());
      api.done();
      return;
    }
    api.mistake();
    flash(display, 'shake');
    card.classList.add('back');
    move(0);
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
  return () => {};
}

export default { title: 'Pasá la tarjeta para abrir', mount };
