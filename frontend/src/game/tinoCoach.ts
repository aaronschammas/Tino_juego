export interface CoachTarget {
  kind: 'start' | 'done' | 'stop';
  title: string;
}

export interface CoachElement {
  element: HTMLElement;
  hint: string;
}

const CONTROLS: Record<CoachTarget['kind'], { selector: string; hint: string }> = {
  start: { selector: '[aria-label="Iniciar timer"], [aria-label="Registrar tiempo"]', hint: 'Tocá el reloj ⏱' },
  stop: { selector: '[aria-label="Detener timer"], [aria-label="Detener tiempo"]', hint: 'Detené este timer' },
  done: { selector: 'summary', hint: 'Tocá acá para cambiar el estado' },
};
const HOVER_HINT = 'Pasá el mouse por la tarjeta: ';
const START_CONFIRM = 'Iniciar cronómetro';
const DONE_OPTIONS = ['Marcar como completada', 'Mover a Completadas'];
const MAX_DEPTH = 6;
const RING_ID = 'feria-coach-ring';
const LABEL_ID = 'feria-coach-label';
const STYLE_ID = 'feria-coach-style';
const PADDING = 4;

const COACH_CSS = `
#${RING_ID}, #${LABEL_ID} { position: fixed; z-index: 2147483647; pointer-events: none; }
#${RING_ID} { border: 4px solid #f97316; border-radius: 12px; box-shadow: 0 0 0 4px rgba(249,115,22,.35);
  animation: feria-coach-pulse 1s ease-in-out infinite; }
#${LABEL_ID} { padding: 4px 8px; border-radius: 8px; background: #f97316; color: #fff; font: 700 12px/1.3 system-ui, sans-serif;
  white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
@keyframes feria-coach-pulse { 50% { box-shadow: 0 0 0 10px rgba(249,115,22,0); } }
`;

/** De varios candidatos, el primero que ocupa lugar en pantalla (o el primero, si no hay medidas). */
function preferShown(candidates: HTMLElement[]): HTMLElement | null {
  return candidates.find((element) => element.getBoundingClientRect().width > 0) ?? candidates[0] ?? null;
}

/** Si Tino lo esconde hasta pasar el mouse (los botones de las tarjetas tienen opacidad 0 sin hover). */
export function hiddenUntilHover(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (view && view.getComputedStyle(node).opacity === '0') return true;
  }
  return false;
}

/** Control (`selector`) de la tarjeta o fila de Tino cuyo título es `title`, subiendo desde el título. */
export function findTaskControl(doc: Document, title: string, selector: string): HTMLElement | null {
  const labels = Array.from(doc.querySelectorAll('h3, p')).filter((node) => node.textContent?.trim() === title);
  const controls: HTMLElement[] = [];
  for (const label of labels) {
    let node = label.parentElement;
    for (let depth = 0; node && depth < MAX_DEPTH; depth += 1, node = node.parentElement) {
      const control = node.querySelector<HTMLElement>(selector);
      if (control) {
        controls.push(control);
        break;
      }
    }
  }
  return preferShown(controls);
}

/** Botón con alguno de esos textos exactos. */
function findButton(root: ParentNode, texts: string[]): HTMLElement | null {
  return preferShown(
    Array.from(root.querySelectorAll<HTMLElement>('button')).filter((button) => texts.includes(button.textContent?.trim() ?? '')),
  );
}

/**
 * Qué tocar en Tino para el paso del coach: el reloj de la tarea (o «Iniciar cronómetro» si ya se abrió el
 * modal de duración), el botón de estado (o la opción de completada si el menú ya está abierto) o el de detener.
 */
export function findCoachElement(doc: Document, target: CoachTarget): CoachElement | null {
  if (target.kind === 'start') {
    const confirm = findButton(doc, [START_CONFIRM]);
    if (confirm) return { element: confirm, hint: `Tocá «${START_CONFIRM}»` };
  }
  const control = findTaskControl(doc, target.title, CONTROLS[target.kind].selector);
  if (!control) return null;
  if (target.kind === 'done') {
    const details = control.closest('details');
    const option = details?.open ? findButton(details, DONE_OPTIONS) : null;
    if (option) return { element: option, hint: 'Elegí esta opción' };
  }
  const hint = CONTROLS[target.kind].hint;
  return { element: control, hint: hiddenUntilHover(control) ? `${HOVER_HINT}${hint.toLowerCase()}` : hint };
}

export type ElementFinder = (doc: Document) => CoachElement | null;

/**
 * Resalta dentro de un iframe (Tino o su Dashboard) el elemento que devuelve `finder`: un aro naranja que late y
 * una etiqueta. Se dibuja aparte (no se tocan las clases de Tino, que React reescribe) y se reubica en cada `tick`.
 */
export class FrameHighlighter {
  private finder: ElementFinder | null = null;
  private scrolledTo: Element | null = null;

  constructor(private readonly frame: () => HTMLIFrameElement | null) {}

  setFinder(finder: ElementFinder | null) {
    this.finder = finder;
    this.scrolledTo = null;
  }

  tick() {
    const doc = this.frame()?.contentDocument;
    if (!doc?.body) return;
    const { ring, label } = this.ensureOverlay(doc);
    const found = this.finder ? this.finder(doc) : null;
    ring.hidden = !found;
    label.hidden = !found;
    if (!found) return;

    if (found.element !== this.scrolledTo) {
      this.scrolledTo = found.element;
      found.element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }

    const rect = found.element.getBoundingClientRect();
    Object.assign(ring.style, {
      left: `${rect.left - PADDING}px`,
      top: `${rect.top - PADDING}px`,
      width: `${rect.width + PADDING * 2}px`,
      height: `${rect.height + PADDING * 2}px`,
    });
    if (label.textContent !== found.hint) label.textContent = found.hint;
    const above = rect.top - label.offsetHeight - PADDING * 3;
    const width = doc.documentElement.clientWidth;
    Object.assign(label.style, {
      left: `${Math.max(4, Math.min(rect.left, width - label.offsetWidth - 4))}px`,
      top: `${above >= 0 ? above : rect.bottom + PADDING * 3}px`,
    });
  }

  /** Crea (una vez por documento: Tino puede recargarse) el estilo, el aro y la etiqueta. */
  private ensureOverlay(doc: Document) {
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = COACH_CSS;
      doc.head.append(style);
    }
    const make = (id: string) => {
      const existing = doc.getElementById(id);
      if (existing) return existing;
      const node = doc.createElement('div');
      node.id = id;
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      doc.body.append(node);
      return node;
    };
    return { ring: make(RING_ID), label: make(LABEL_ID) };
  }
}

/** Resaltador del coach del juego dentro de Tino: traduce el paso pedido (iniciar, completar, detener) al control. */
export class TinoHighlighter extends FrameHighlighter {
  setTarget(target: CoachTarget | null) {
    this.setFinder(target ? (doc) => findCoachElement(doc, target) : null);
  }
}
