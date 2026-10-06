import { findCoachElement, hiddenUntilHover, TinoHighlighter } from './tinoCoach';

/** Tarjeta de Tino con subtareas y una tarea suelta, como las arma TaskItem. */
function renderTino(extra = '') {
  document.body.innerHTML = `
    <article>
      <h3>Apagar el incendio</h3>
      <div class="sub">
        <div><div><p>Fuego en el servidor</p></div></div>
        <button aria-label="Iniciar timer">⏱</button>
        <details id="sub-status"><summary aria-label="Cambiar estado">☑</summary>
          <button>Mover a Completadas</button><button>Mover a Bloqueadas</button>
        </details>
      </div>
      <div class="sub">
        <div><div><p>Fuego en la impresora</p></div></div>
        <button aria-label="Detener timer">⏱</button>
      </div>
    </article>
    <article>
      <div><div><h3>Regar la planta</h3></div></div>
      <div class="actions"><button aria-label="Registrar tiempo">⏱️</button><details><summary>→</summary></details></div>
    </article>
    ${extra}`;
}

describe('findCoachElement', () => {
  beforeEach(() => renderTino());

  it('finds the clock of a subtask and of a plain task', () => {
    expect(findCoachElement(document, { kind: 'start', title: 'Fuego en el servidor' })?.element).toHaveAttribute(
      'aria-label',
      'Iniciar timer',
    );
    expect(findCoachElement(document, { kind: 'start', title: 'Regar la planta' })?.element).toHaveAttribute(
      'aria-label',
      'Registrar tiempo',
    );
  });

  it('points at «Iniciar cronómetro» once the duration modal is open', () => {
    renderTino('<div role="dialog"><button>Cancelar</button><button>Iniciar cronómetro</button></div>');
    const found = findCoachElement(document, { kind: 'start', title: 'Fuego en el servidor' });
    expect(found?.element).toHaveTextContent('Iniciar cronómetro');
    expect(found?.hint).toContain('Iniciar cronómetro');
  });

  it('points at the status button, then at the completed option when the menu is open', () => {
    expect(findCoachElement(document, { kind: 'done', title: 'Fuego en el servidor' })?.element.tagName).toBe('SUMMARY');
    (document.getElementById('sub-status') as HTMLDetailsElement).open = true;
    const found = findCoachElement(document, { kind: 'done', title: 'Fuego en el servidor' });
    expect(found?.element).toHaveTextContent('Mover a Completadas');
    expect(found?.hint).toBe('Elegí esta opción');
  });

  it('finds the stop button of the running task and nothing for unknown titles', () => {
    expect(findCoachElement(document, { kind: 'stop', title: 'Fuego en la impresora' })?.element).toHaveAttribute(
      'aria-label',
      'Detener timer',
    );
    expect(findCoachElement(document, { kind: 'start', title: 'No existe' })).toBeNull();
  });

  it('tells to hover the card when Tino hides its buttons until hover', () => {
    const actions = document.querySelector<HTMLElement>('.actions')!;
    expect(hiddenUntilHover(actions.querySelector('button')!)).toBe(false);
    actions.style.opacity = '0';
    expect(findCoachElement(document, { kind: 'start', title: 'Regar la planta' })?.hint).toContain('Pasá el mouse');
  });
});

describe('TinoHighlighter', () => {
  beforeEach(() => {
    renderTino();
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('draws the ring and label over the target, scrolling to it once', () => {
    const highlighter = new TinoHighlighter(() => ({ contentDocument: document }) as unknown as HTMLIFrameElement);
    highlighter.setTarget({ kind: 'start', title: 'Fuego en el servidor' });
    highlighter.tick();
    highlighter.tick();

    expect(document.getElementById('feria-coach-ring')!.hidden).toBe(false);
    expect(document.getElementById('feria-coach-label')).toHaveTextContent('Tocá el reloj');
    expect(document.getElementById('feria-coach-style')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    highlighter.setTarget(null);
    highlighter.tick();
    expect(document.getElementById('feria-coach-ring')!.hidden).toBe(true);
  });

  it('does nothing without a Tino document', () => {
    expect(() => new TinoHighlighter(() => null).tick()).not.toThrow();
  });
});
