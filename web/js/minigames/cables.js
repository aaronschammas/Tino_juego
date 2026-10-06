// Minijuego "Conectar cables": se arrastra cada cable de la izquierda a su color de la derecha.
import { el, flash, shuffle } from './util.js';

export const WIRES = [
  { id: 'rojo', hex: '#e53935' },
  { id: 'azul', hex: '#1e88e5' },
  { id: 'amarillo', hex: '#fdd835' },
  { id: 'rosa', hex: '#d81b60' },
];

const SVG = 'http://www.w3.org/2000/svg';

/** Arma el tablero y avisa a `api` cada error y cuando quedan los cuatro conectados. */
function mount(body, api, rng = Math.random) {
  const doc = body.ownerDocument;
  const board = el(doc, 'div', 'mg-cables');
  const svg = doc.createElementNS(SVG, 'svg');
  svg.classList.add('mg-wires');
  const left = el(doc, 'div', 'mg-col');
  const right = el(doc, 'div', 'mg-col right');
  const terminal = (wire, side) => {
    const node = el(doc, 'span', `mg-term ${side}`);
    node.dataset.color = wire.id;
    node.style.setProperty('--wire', wire.hex);
    return node;
  };
  WIRES.forEach((wire) => left.append(terminal(wire, 'left')));
  shuffle(WIRES, rng).forEach((wire) => right.append(terminal(wire, 'right')));
  board.append(svg, left, right);
  body.append(el(doc, 'p', 'mg-hint', 'Arrastrá cada cable hasta su color'), board);

  const connected = new Set();
  let drag = null;

  const center = (node) => {
    const box = board.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const x = node.classList.contains('left') ? rect.right : rect.left;
    return { x: x - box.left, y: rect.top + rect.height / 2 - box.top };
  };
  const line = (hex) => {
    const node = doc.createElementNS(SVG, 'line');
    node.setAttribute('stroke', hex);
    node.setAttribute('stroke-width', '12');
    node.setAttribute('stroke-linecap', 'round');
    svg.append(node);
    return node;
  };
  const place = (node, from, to) => {
    node.setAttribute('x1', from.x);
    node.setAttribute('y1', from.y);
    node.setAttribute('x2', to.x);
    node.setAttribute('y2', to.y);
  };
  const redraw = () => {
    svg.querySelectorAll('line.fixed').forEach((node) => {
      const color = node.dataset.color;
      place(node, center(left.querySelector(`[data-color="${color}"]`)), center(right.querySelector(`[data-color="${color}"]`)));
    });
  };
  const local = (event) => {
    const box = board.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  board.addEventListener('pointerdown', (event) => {
    const start = event.target.closest?.('.mg-term.left');
    if (!start || connected.has(start.dataset.color)) return;
    event.preventDefault();
    board.setPointerCapture?.(event.pointerId);
    const hex = WIRES.find((wire) => wire.id === start.dataset.color).hex;
    drag = { start, from: center(start), node: line(hex) };
    place(drag.node, drag.from, local(event));
  });
  board.addEventListener('pointermove', (event) => {
    if (drag) place(drag.node, drag.from, local(event));
  });
  const release = (event) => {
    if (!drag) return;
    const hit = doc.elementFromPoint(event.clientX, event.clientY)?.closest?.('.mg-term.right');
    const color = drag.start.dataset.color;
    if (hit && hit.dataset.color === color) {
      connected.add(color);
      drag.node.classList.add('fixed');
      drag.node.dataset.color = color;
      drag.start.classList.add('done');
      hit.classList.add('done');
      redraw();
    } else {
      drag.node.remove();
      if (hit) {
        api.mistake();
        flash(hit, 'wrong');
      }
    }
    drag = null;
    if (connected.size === WIRES.length) api.done();
  };
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', () => {
    drag?.node.remove();
    drag = null;
  });

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  observer?.observe(board);
  return () => observer?.disconnect();
}

export default { title: 'Conectá los cables del rack', mount };
