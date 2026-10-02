/**
 * Tests del cliente HTTP de Trello con `fetch` simulado: que arme la URL, el
 * metodo y los parametros correctos, y que oculte los errores de Trello.
 */
import { BadRequestException } from '@nestjs/common';
import { TrelloClient } from './trello.client';

describe('TrelloClient', () => {
  const credentials = { apiKey: 'key', token: 'tok' };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let client: TrelloClient;

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls[
      fetchMock.mock.calls.length - 1
    ] as [URL, { method: string }];
    return {
      url,
      method: init.method,
      params: Object.fromEntries(url.searchParams),
    };
  };

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'x' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new TrelloClient();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('fetches a single card with its checklists', async () => {
    await client.getCard('card-1', credentials);

    const { url, method, params } = lastCall();
    expect(url.pathname).toBe('/1/cards/card-1');
    expect(method).toBe('GET');
    expect(params).toEqual(
      expect.objectContaining({ key: 'key', token: 'tok', checklists: 'all' }),
    );
    expect(params.fields).toContain('idList');
  });

  it('fetches the board comments', async () => {
    await client.getBoardComments('board-1', credentials);

    const { url, params } = lastCall();
    expect(url.pathname).toBe('/1/boards/board-1/actions');
    expect(params).toEqual(
      expect.objectContaining({ filter: 'commentCard', limit: '1000' }),
    );
  });

  it('creates a webhook with POST', async () => {
    await expect(
      client.createWebhook(credentials, {
        callbackURL: 'https://api.tino.test/hook/c1',
        idModel: 'board-1',
        description: 'Tino',
      }),
    ).resolves.toEqual({ id: 'x' });

    const { url, method, params } = lastCall();
    expect(url.pathname).toBe('/1/webhooks');
    expect(method).toBe('POST');
    expect(params).toEqual(
      expect.objectContaining({
        callbackURL: 'https://api.tino.test/hook/c1',
        idModel: 'board-1',
        description: 'Tino',
      }),
    );
  });

  it('deletes a webhook with DELETE', async () => {
    await client.deleteWebhook('wh-1', credentials);

    const { url, method } = lastCall();
    expect(url.pathname).toBe('/1/webhooks/wh-1');
    expect(method).toBe('DELETE');
  });

  it('hides Trello errors behind a generic message', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    await expect(client.getCard('card-1', credentials)).rejects.toThrow(
      new BadRequestException('No se pudo conectar con Trello'),
    );
  });
});
