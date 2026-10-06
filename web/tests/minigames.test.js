import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPTIONS, orderText, randomOrder, wrongFields } from '../js/minigames/cafe.js';
import { classifySwipe, SWIPE_MS } from '../js/minigames/tarjeta.js';
import { COUNT, press } from '../js/minigames/pc.js';
import { WIRES } from '../js/minigames/cables.js';
import { shuffle } from '../js/minigames/util.js';

/** Generador repetible para los sorteos. */
function seeded(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('café: el pedido sale de las opciones y se detecta qué grupo está mal', () => {
  const order = randomOrder(seeded([0.3, 0.9, 0.6]));
  assert.deepEqual(order, { tipo: 'Cortado', azucar: 'Edulcorante', taza: 'Grande' });
  for (const { key, choices } of OPTIONS) assert.ok(choices.includes(order[key]));
  assert.deepEqual(wrongFields(order, { ...order }), []);
  assert.deepEqual(wrongFields(order, { ...order, tipo: 'Expreso', taza: 'Chica' }), ['tipo', 'taza']);
  assert.deepEqual(wrongFields(order, { tipo: 'Cortado' }), ['azucar', 'taza']);
  assert.equal(orderText(order), 'Cortado · Edulcorante · Taza grande');
});

test('tarjeta: ni muy rápido ni muy lento', () => {
  assert.equal(classifySwipe(SWIPE_MS.min - 1), 'fast');
  assert.equal(classifySwipe(700), 'ok');
  assert.equal(classifySwipe(SWIPE_MS.max + 1), 'slow');
});

test('PC: del 1 al 10 en orden; un error vuelve a empezar', () => {
  let next = 1;
  for (let n = 1; n < COUNT; n++) {
    const result = press(next, n);
    assert.equal(result.ok, true);
    assert.equal(result.complete, false);
    next = result.next;
  }
  assert.deepEqual(press(next, COUNT), { next: COUNT + 1, ok: true, complete: true });
  assert.deepEqual(press(4, 7), { next: 1, ok: false, complete: false });
});

test('cables: cuatro colores distintos y la mezcla no pierde ninguno', () => {
  assert.equal(new Set(WIRES.map((wire) => wire.id)).size, 4);
  const mixed = shuffle(WIRES, seeded([0.1, 0.8, 0.4]));
  assert.deepEqual([...mixed].sort((a, b) => a.id.localeCompare(b.id)), [...WIRES].sort((a, b) => a.id.localeCompare(b.id)));
  assert.notDeepEqual(mixed, WIRES);
});
