// Minijuego "Desbloquear la PC": se tocan los números del 1 al 10 en orden.
import { el, flash, shuffle } from './util.js';

export const COUNT = 10;

/**
 * Toca el número `n` con `next` como el que tocaba: si acierta avanza, si no vuelve a empezar.
 * @returns {{ next: number, ok: boolean, complete: boolean }}
 */
export function press(next, n) {
  if (n !== next) return { next: 1, ok: false, complete: false };
  return { next: next + 1, ok: true, complete: next === COUNT };
}

/** Arma el teclado mezclado; al completar la secuencia la pantalla muestra el mail enviado. */
function mount(body, api, rng = Math.random) {
  const doc = body.ownerDocument;
  const screen = el(doc, 'div', 'mg-screen', '🔒 Tocá del 1 al 10 en orden');
  const pad = el(doc, 'div', 'mg-pad');
  let next = 1;

  const buttons = shuffle(Array.from({ length: COUNT }, (_, i) => i + 1), rng).map((n) => {
    const button = el(doc, 'button', 'mg-key', String(n));
    button.type = 'button';
    button.addEventListener('click', () => {
      if (next > COUNT) return;
      const result = press(next, n);
      next = result.next;
      if (!result.ok) {
        api.mistake();
        buttons.forEach((node) => node.classList.remove('lit'));
        flash(pad, 'shake');
        screen.textContent = '❌ Clave incorrecta. De nuevo desde el 1';
        screen.className = 'mg-screen bad';
        return;
      }
      button.classList.add('lit');
      screen.textContent = result.complete ? '✉️ Reclamo respondido' : `🔒 ${'•'.repeat(n)}`;
      screen.className = `mg-screen${result.complete ? ' good' : ''}`;
      if (result.complete) {
        next = COUNT + 1;
        api.done();
      }
    });
    return button;
  });
  pad.append(...buttons);
  body.append(screen, pad);
  return () => {};
}

export default { title: 'Desbloqueá la PC', mount };
