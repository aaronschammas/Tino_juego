import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeriaGame, { pickScenario } from './FeriaGame';

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

  it('explains when Tino is not reachable', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    render(<FeriaGame />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con Tino');
  });
});
