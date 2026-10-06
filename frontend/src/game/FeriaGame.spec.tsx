import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeriaGame, {
  formatSeconds,
  NEXT_PROMPT_SECONDS,
  nextScenario,
  pickScenario,
  refreshTino,
  scoreKpis,
  STATS_SECONDS,
} from './FeriaGame';

const SCORE = { fires: 4, firesOut: 3, choices: 4, goodChoices: 3, efficiency: 75, seconds: 95, points: 275 };

const SCENARIOS = [
  { key: 'oficina', name: 'La oficina en llamas', intro: '' },
  { key: 'casa', name: 'La casa patas arriba', intro: '' },
];

function mockApi() {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (url === '/api/demo/scenarios') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: SCENARIOS }) });
    }
    if (url === '/api/demo/reset') {
      const { scenario } = JSON.parse(String(init?.body));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { scenario, projectId: `p-${scenario}` } }) });
    }
    if (url === '/api/demo/finish') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { score: SCORE } }) });
    }
    if (url === '/api/demo/reset-all') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { removed: 1 } }) });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('pickScenario', () => {
  it('uses the scenario in the URL when it exists', () => {
    expect(pickScenario(SCENARIOS, 'casa', 0)).toBe('casa');
  });

  it('rotates through scenarios otherwise', () => {
    expect(pickScenario(SCENARIOS, null, 0)).toBe('oficina');
    expect(pickScenario(SCENARIOS, 'marte', 3)).toBe('casa');
  });
});

describe('end screen helpers', () => {
  it('picks the next scenario in the rotation', () => {
    expect(nextScenario(SCENARIOS, 'oficina')?.key).toBe('casa');
    expect(nextScenario(SCENARIOS, 'casa')?.key).toBe('oficina');
    expect(nextScenario([], 'casa')).toBeNull();
  });

  it('formats the game KPIs', () => {
    expect(formatSeconds(95)).toBe('1:35');
    expect(scoreKpis(SCORE).map((kpi) => kpi.value)).toEqual(['Tino Web', '3 de 4', '75%', '1:35', '275']);
    expect(scoreKpis({ ...SCORE, efficiency: null })[2].value).toBe('—');
  });
});

describe('FeriaGame', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('resets a scenario and shows its Tino project next to the game', async () => {
    const fetchMock = mockApi();
    render(<FeriaGame />);

    const tino = await screen.findByTitle('Tino');
    expect(tino).toHaveAttribute('src', '/projects/p-oficina');
    expect(screen.getByTitle('Juego')).toHaveAttribute('src', '/juego/index.html?escenario=oficina');
    expect(fetchMock).toHaveBeenCalledWith('/api/demo/reset', expect.objectContaining({ method: 'POST' }));
    expect(window.localStorage.getItem('feria:rotation')).toBe('1');
  });

  it('switches scenario from the header', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<FeriaGame />);
    await screen.findByTitle('Tino');

    await user.click(screen.getByRole('button', { name: 'La casa patas arriba' }));

    await waitFor(() => expect(screen.getByTitle('Juego')).toHaveAttribute('src', '/juego/index.html?escenario=casa'));
    expect(screen.getByTitle('Tino')).toHaveAttribute('src', '/projects/p-casa');
  });

  it('refreshes Tino when the game says something changed', async () => {
    mockApi();
    render(<FeriaGame />);
    const tino = (await screen.findByTitle('Tino')) as HTMLIFrameElement;
    const heard: string[] = [];
    for (const name of ['task:updated', 'time:updated', 'focus']) {
      tino.contentWindow!.addEventListener(name, () => heard.push(name));
    }

    fireEvent(window, new MessageEvent('message', { data: { type: 'feria:tino-changed' }, origin: window.location.origin }));
    fireEvent(window, new MessageEvent('message', { data: { type: 'feria:tino-changed' }, origin: 'https://otro.sitio' }));

    expect(heard).toEqual(['task:updated', 'time:updated', 'focus']);
  });

  it('refreshTino ignores a missing frame', () => {
    expect(() => refreshTino(null)).not.toThrow();
  });

  it('explains when Tino is not reachable', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    render(<FeriaGame />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con Tino');
  });

  it('shows the real dashboard with the game KPIs when the round ends, then offers the next scenario', async () => {
    const fetchMock = mockApi();
    const onIdle = jest.fn();
    render(<FeriaGame onIdle={onIdle} />);
    await screen.findByTitle('Tino');
    jest.useFakeTimers();

    act(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          data: { type: 'feria:finished', scenario: 'oficina', score: SCORE },
          origin: window.location.origin,
        }),
      );
    });

    expect(screen.getByTitle('Dashboard')).toHaveAttribute('src', '/dashboard?projectId=p-oficina');
    expect(screen.getByRole('heading', { name: '¡Gracias por jugar!' })).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado de la partida')).toHaveTextContent('Feria · La oficina en llamas');
    expect(screen.getByLabelText('Resultado de la partida')).toHaveTextContent('75%');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('feria:last-game-project')).toBe('p-oficina');

    act(() => jest.advanceTimersByTime(STATS_SECONDS * 1000));
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Jugás el siguiente?');
    expect(screen.getByRole('button', { name: 'Sí, jugar La casa patas arriba' })).toBeInTheDocument();

    for (let i = 0; i < NEXT_PROMPT_SECONDS; i++) act(() => jest.advanceTimersByTime(1000));
    jest.useRealTimers();
    await waitFor(() => expect(onIdle).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/demo/reset-all', expect.objectContaining({ method: 'POST' }));
    expect(window.localStorage.getItem('feria:last-game-project')).toBeNull();
  });

  it('"Seguir mirando" lets the visitor explore without asking again', async () => {
    mockApi();
    const onIdle = jest.fn();
    render(<FeriaGame onIdle={onIdle} />);
    await screen.findByTitle('Tino');
    jest.useFakeTimers();
    act(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          data: { type: 'feria:finished', scenario: 'oficina', score: SCORE },
          origin: window.location.origin,
        }),
      );
    });
    act(() => jest.advanceTimersByTime(STATS_SECONDS * 1000));
    fireEvent.click(screen.getByRole('button', { name: 'Seguir mirando' }));

    act(() => jest.advanceTimersByTime((STATS_SECONDS + NEXT_PROMPT_SECONDS) * 3 * 1000));
    expect(screen.queryByRole('dialog', { name: '¿Jugás el siguiente?' })).toBeNull();
    expect(onIdle).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('"Finalizar partida" ends the round now and shows its results', async () => {
    const fetchMock = mockApi();
    render(<FeriaGame onIdle={jest.fn()} />);
    await screen.findByTitle('Tino');

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar partida' }));

    expect(await screen.findByTitle('Dashboard')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/demo/finish', expect.objectContaining({ body: JSON.stringify({ scenario: 'oficina' }) }));
    expect(screen.getByLabelText('Resultado de la partida')).toHaveTextContent('75%');
    expect(screen.queryByRole('button', { name: 'Finalizar partida' })).toBeNull();
  });

  it('"Seguir mirando" starts a guided tour of the Dashboard metrics', async () => {
    mockApi();
    render(<FeriaGame onIdle={jest.fn()} />);
    await screen.findByTitle('Tino');
    jest.useFakeTimers();
    act(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          data: { type: 'feria:finished', scenario: 'oficina', score: SCORE },
          origin: window.location.origin,
        }),
      );
    });
    act(() => jest.advanceTimersByTime(STATS_SECONDS * 1000));
    fireEvent.click(screen.getByRole('button', { name: 'Seguir mirando' }));
    jest.useRealTimers();

    const tour = screen.getByRole('dialog', { name: 'Recorrido del Dashboard' });
    expect(tour).toHaveTextContent('Recorrido 1 de');
    expect(tour).toHaveTextContent('Los filtros');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(tour).toHaveTextContent('Total de tareas');
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(tour).toHaveTextContent('Los filtros');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar recorrido' }));
    expect(screen.queryByRole('dialog', { name: 'Recorrido del Dashboard' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido del Dashboard' }));
    expect(screen.getByRole('dialog', { name: 'Recorrido del Dashboard' })).toBeInTheDocument();
  });

  it('"Volver al inicio" erases the games and goes home', async () => {
    const fetchMock = mockApi();
    const onIdle = jest.fn();
    render(<FeriaGame onIdle={onIdle} />);
    await screen.findByTitle('Tino');
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(onIdle).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/demo/reset-all', expect.objectContaining({ method: 'POST' }));
  });

  it('highlights inside Tino what the game coach asks to touch', async () => {
    mockApi();
    render(<FeriaGame onIdle={jest.fn()} />);
    const tino = (await screen.findByTitle('Tino')) as HTMLIFrameElement;
    const doc = tino.contentDocument!;
    doc.open();
    doc.write('<!doctype html><html><head></head><body></body></html>');
    doc.close();
    (doc.defaultView as unknown as typeof window).Element.prototype.scrollIntoView = jest.fn();
    doc.body.innerHTML = '<div><div><div><p>Fuego en el servidor</p></div></div><button aria-label="Iniciar timer">⏱</button></div>';

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: 'feria:coach', target: { kind: 'start', title: 'Fuego en el servidor' } },
        origin: window.location.origin,
      }),
    );

    await waitFor(() => expect(doc.getElementById('feria-coach-ring')?.hidden).toBe(false));
    expect(doc.getElementById('feria-coach-label')).toHaveTextContent('Tocá el reloj');
  });

  it('ignores a finished message from another origin', async () => {
    mockApi();
    render(<FeriaGame onIdle={jest.fn()} />);
    await screen.findByTitle('Tino');
    fireEvent(
      window,
      new MessageEvent('message', { data: { type: 'feria:finished', score: SCORE }, origin: 'https://otro.sitio' }),
    );
    expect(screen.queryByTitle('Dashboard')).toBeNull();
  });
});
