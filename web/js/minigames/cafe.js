// Minijuego "Café para el jefe": se arma el café exactamente como lo pidió.
import { el, flash } from './util.js';

export const OPTIONS = [
  { key: 'tipo', label: 'Café', choices: ['Expreso', 'Cortado', 'Con leche', 'Capuchino'] },
  { key: 'azucar', label: 'Azúcar', choices: ['Sin azúcar', 'Con azúcar', 'Edulcorante'] },
  { key: 'taza', label: 'Taza', choices: ['Chica', 'Grande'] },
];

/** Pedido al azar del jefe: una opción de cada grupo. */
export function randomOrder(rng = Math.random) {
  return Object.fromEntries(OPTIONS.map(({ key, choices }) => [key, choices[Math.floor(rng() * choices.length)]]));
}

/** Grupos en los que lo elegido no coincide con el pedido (vacío = está perfecto). */
export function wrongFields(order, choice) {
  return OPTIONS.map(({ key }) => key).filter((key) => order[key] !== choice[key]);
}

/** Texto del pedido: "Cortado · Con azúcar · Taza grande". */
export function orderText(order) {
  return `${order.tipo} · ${order.azucar} · Taza ${order.taza.toLowerCase()}`;
}

/** Arma el pedido y los botones; si se sirve mal, el jefe se queja y se marcan los grupos equivocados. */
function mount(body, api, rng = Math.random) {
  const doc = body.ownerDocument;
  const order = randomOrder(rng);
  const choice = {};

  const ticket = el(doc, 'div', 'mg-ticket');
  ticket.append(el(doc, 'small', null, 'El jefe pidió:'), el(doc, 'strong', null, orderText(order)));
  const say = el(doc, 'p', 'mg-say', '');
  const serve = el(doc, 'button', 'mg-serve', 'Servir ☕');
  serve.type = 'button';
  serve.disabled = true;

  const groups = OPTIONS.map(({ key, label, choices }) => {
    const group = el(doc, 'div', 'mg-group');
    group.append(el(doc, 'span', 'mg-group-label', label));
    const row = el(doc, 'div', 'mg-choices');
    choices.forEach((value) => {
      const button = el(doc, 'button', 'mg-choice', value);
      button.type = 'button';
      button.addEventListener('click', () => {
        choice[key] = value;
        row.querySelectorAll('.mg-choice').forEach((node) => node.classList.toggle('picked', node === button));
        group.classList.remove('wrong');
        serve.disabled = OPTIONS.some((option) => !choice[option.key]);
      });
      row.append(button);
    });
    group.append(row);
    return { key, group, row };
  });

  serve.addEventListener('click', () => {
    const wrong = wrongFields(order, choice);
    if (!wrong.length) {
      say.textContent = '«¡Justo como me gusta!»';
      say.className = 'mg-say good';
      serve.disabled = true;
      api.done();
      return;
    }
    api.mistake();
    say.textContent = '«¡Esto no es lo que pedí!»';
    say.className = 'mg-say bad';
    for (const { key, group, row } of groups) {
      if (!wrong.includes(key)) continue;
      delete choice[key];
      row.querySelectorAll('.mg-choice').forEach((node) => node.classList.remove('picked'));
      flash(group, 'wrong');
    }
    serve.disabled = true;
  });

  body.append(ticket, ...groups.map(({ group }) => group), serve, say);
  return () => {};
}

export default { title: 'Prepará el café del jefe', mount };
