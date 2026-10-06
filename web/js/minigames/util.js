// Utilidades compartidas por los minijuegos.

/** Copia mezclada de una lista (Fisher-Yates). */
export function shuffle(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Crea un elemento con clase y texto opcionales. */
export function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Reinicia una animación CSS de una clase (para sacudir o titilar varias veces seguidas). */
export function flash(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}
