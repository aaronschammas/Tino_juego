/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Logger } from '@nestjs/common';
import { WhatsAppClientService } from './whatsapp-client.service';
import { WHATSAPP_TEXT_LIMIT } from './whatsapp-formatter';

const PHONE = '5491155550000';
const ENV = {
  WHATSAPP_PHONE_NUMBER_ID: '1247537371786640',
  WHATSAPP_ACCESS_TOKEN: 'token-de-prueba',
  WHATSAPP_APP_SECRET: 'secret',
  WHATSAPP_VERIFY_TOKEN: 'verify',
  WHATSAPP_GRAPH_API_VERSION: 'v25.0',
};

describe('WhatsAppClientService', () => {
  let fetchMock: jest.SpyInstance;
  let logError: jest.SpyInstance;
  let client: WhatsAppClientService;

  beforeEach(() => {
    Object.assign(process.env, ENV);
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    client = new WhatsAppClientService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of Object.keys(ENV)) delete process.env[key];
  });

  function sentRequest() {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, init, body: JSON.parse(init.body as string) };
  }

  it('sends text to the configured phone number with the bearer token', async () => {
    await expect(client.sendText(PHONE, 'Hola')).resolves.toBe(true);

    const { url, init, body } = sentRequest();
    expect(url).toBe(
      'https://graph.facebook.com/v25.0/1247537371786640/messages',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer token-de-prueba',
      'Content-Type': 'application/json',
    });
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: PHONE,
      type: 'text',
      text: { preview_url: false, body: 'Hola' },
    });
  });

  it('sends a Meta template with its body variables in order', async () => {
    await expect(
      client.sendTemplate(PHONE, 'tino_resumen_trello', 'es_AR', [
        'Empresa',
        '3 tareas nuevas',
      ]),
    ).resolves.toBe(true);

    expect(sentRequest().body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: PHONE,
      type: 'template',
      template: {
        name: 'tino_resumen_trello',
        language: { code: 'es_AR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Empresa' },
              { type: 'text', text: '3 tareas nuevas' },
            ],
          },
        ],
      },
    });
  });

  it('sends the menu as an interactive list', async () => {
    const rows = [
      { id: 'q:org-1:overdue_tasks', title: 'Tareas atrasadas' },
      { id: 'q:org-1:active_timers', title: 'Quién trabaja ahora' },
    ];

    await client.sendMenu(PHONE, {
      body: '¿Qué querés saber?',
      button: 'Ver consultas',
      rows,
    });

    const { body } = sentRequest();
    expect(body.type).toBe('interactive');
    expect(body.interactive).toEqual({
      type: 'list',
      body: { text: '¿Qué querés saber?' },
      action: {
        button: 'Ver consultas',
        sections: [{ title: 'Consultas', rows }],
      },
    });
  });

  it('adds a header to the menu only when one is given', async () => {
    await client.sendMenu(PHONE, {
      header: 'Tino',
      body: 'Elegí',
      button: 'Ver consultas',
      rows: [],
    });

    expect(sentRequest().body.interactive.header).toEqual({
      type: 'text',
      text: 'Tino',
    });
  });

  it('never sends a body longer than WhatsApp accepts', async () => {
    await client.sendText(PHONE, 'palabra '.repeat(1000));

    expect(sentRequest().body.text.body.length).toBeLessThanOrEqual(
      WHATSAPP_TEXT_LIMIT,
    );
  });

  it('does not call Meta when WhatsApp is not configured', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(client.sendText(PHONE, 'Hola')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false and logs the Meta error without the recipient', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"code":131030}}', { status: 400 }),
    );

    await expect(client.sendText(PHONE, 'Hola')).resolves.toBe(false);

    const message = logError.mock.calls[0][0] as string;
    expect(message).toContain('400');
    expect(message).toContain('131030');
    expect(message).not.toContain(PHONE);
  });

  it('returns false instead of throwing when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      client.sendMenu(PHONE, {
        body: 'Elegí',
        button: 'Ver consultas',
        rows: [],
      }),
    ).resolves.toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('ECONNRESET'),
    );
  });
});
