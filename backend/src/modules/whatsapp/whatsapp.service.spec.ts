/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { REPLIES, WhatsAppService } from './whatsapp.service';
import type { WhatsAppInboundMessage } from './whatsapp.types';

const PHONE = '5491155550000';
const USER_ID = 'AR.83920174615529';
const ORGANIZATION = { id: 'org-1', name: 'Empresa', ownerId: 'owner-1' };
const OTHER_ORGANIZATION = { id: 'org-2', name: 'Otra', ownerId: 'owner-1' };

function webhook(...messages: WhatsAppInboundMessage[]) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'channel-1' },
              contacts: [
                { wa_id: PHONE, user_id: USER_ID, profile: { name: 'Ana' } },
              ],
              messages,
            },
          },
        ],
      },
    ],
  };
}

function textMessage(body: string, id = 'wamid.1'): WhatsAppInboundMessage {
  return { id, from: PHONE, type: 'text', text: { body } };
}

function listReply(rowId: string, id = 'wamid.2'): WhatsAppInboundMessage {
  return {
    id,
    from: PHONE,
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: rowId } },
  };
}

describe('WhatsAppService', () => {
  let prisma: any;
  let links: any;
  let client: any;
  let assistant: any;
  let digest: any;
  let service: WhatsAppService;

  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'channel-1';
    prisma = {
      whatsAppProcessedMessage: { create: jest.fn().mockResolvedValue({}) },
      organization: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    digest = {
      buildDigestText: jest.fn().mockResolvedValue('Novedades de Trello'),
    };
    links = {
      findLinkedOrganizations: jest.fn().mockResolvedValue([ORGANIZATION]),
      consumeCode: jest.fn().mockResolvedValue(ORGANIZATION),
      unlink: jest.fn().mockResolvedValue(undefined),
    };
    client = {
      sendText: jest.fn().mockResolvedValue(true),
      sendMenu: jest.fn().mockResolvedValue(true),
    };
    assistant = {
      query: jest.fn(),
      answerIntent: jest.fn().mockResolvedValue({
        intent: 'overdue_tasks',
        confidence: 0.95,
        title: 'Tareas atrasadas',
        summary: 'Encontré 1 tarea vencida.',
        details: [],
      }),
    };
    service = new WhatsAppService(
      prisma as never,
      links as never,
      client as never,
      assistant as never,
      digest as never,
    );
  });

  afterEach(() => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it('records the message time of a linked owner to open the 24 hour window', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);

    await service.handleWebhook(webhook(textMessage('hola')));

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['org-1', 'org-2'] } },
      data: { whatsappLastInboundAt: expect.any(Date) },
    });
  });

  it('does not record the window for a WhatsApp that is not linked', async () => {
    links.findLinkedOrganizations.mockResolvedValue([]);

    await service.handleWebhook(webhook(textMessage('hola')));

    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it('records the window when the owner links the organization', async () => {
    await service.handleWebhook(webhook(textMessage('vincular ABCDEFGHJK')));

    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['org-1'] } },
      data: { whatsappLastInboundAt: expect.any(Date) },
    });
  });

  it('answers "novedades" with the Trello digest of the last 24 hours', async () => {
    await service.handleWebhook(webhook(textMessage('Novedades')));

    const [organizationId, name, since, until] =
      digest.buildDigestText.mock.calls[0];
    expect([organizationId, name]).toEqual(['org-1', 'Empresa']);
    expect(until.getTime() - since.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(assistant.query).not.toHaveBeenCalled();
    expect(client.sendText).toHaveBeenCalledWith(PHONE, 'Novedades de Trello');
  });

  it('sends one digest per linked organization', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);
    digest.buildDigestText
      .mockResolvedValueOnce('Novedades de Empresa')
      .mockResolvedValueOnce(null);

    await service.handleWebhook(webhook(textMessage('resumen de trello')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, 'Novedades de Empresa');
    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.noNews('Otra'));
    expect(client.sendMenu).not.toHaveBeenCalled();
  });

  it('tells the owner when the digest fails', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    digest.buildDigestText.mockRejectedValue(new Error('prisma caída'));

    await service.handleWebhook(webhook(textMessage('novedades')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.failed);
    logError.mockRestore();
  });

  it('answers a menu selection with the assistant of the app', async () => {
    await service.handleWebhook(webhook(listReply('q:org-1:overdue_tasks')));

    expect(assistant.answerIntent).toHaveBeenCalledWith(
      { id: 'owner-1', organizationId: 'org-1' },
      'overdue_tasks',
    );
    expect(client.sendText).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('*Tareas atrasadas*'),
    );
  });

  it('identifies the owner by the Meta user id and never by the phone', async () => {
    await service.handleWebhook(webhook(textMessage('VINCULAR ABCDEFGHJK')));

    expect(links.consumeCode).toHaveBeenCalledWith('abcdefghjk', USER_ID);
    expect(links.findLinkedOrganizations).not.toHaveBeenCalledWith(PHONE);
  });

  it('ignores a message that has no Meta user id', async () => {
    await service.handleWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'channel-1' },
                contacts: [{ wa_id: PHONE }],
                messages: [textMessage('hola')],
              },
            },
          ],
        },
      ],
    });

    expect(client.sendText).not.toHaveBeenCalled();
    expect(client.sendMenu).not.toHaveBeenCalled();
  });

  it('answers the same message only once when Meta retries', async () => {
    prisma.whatsAppProcessedMessage.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

    await service.handleWebhook(webhook(textMessage('hola')));
    await service.handleWebhook(webhook(textMessage('hola')));

    expect(client.sendMenu).toHaveBeenCalledTimes(1);
  });

  it('logs a database failure instead of treating the message as repeated', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.whatsAppProcessedMessage.create.mockRejectedValue(
      new Error('relation "WhatsAppProcessedMessage" does not exist'),
    );

    await service.handleWebhook(webhook(textMessage('hola')));

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('does not exist'),
    );
    logError.mockRestore();
  });

  it('explains how to connect when the WhatsApp is not linked', async () => {
    links.findLinkedOrganizations.mockResolvedValue([]);

    await service.handleWebhook(webhook(textMessage('tareas atrasadas')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.notLinked);
  });

  it('links the organization and shows the menu', async () => {
    await service.handleWebhook(webhook(textMessage('vincular ABCDEFGHJK')));

    expect(client.sendText).toHaveBeenCalledWith(
      PHONE,
      REPLIES.linked('Empresa'),
    );
    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ button: REPLIES.menuButton }),
    );
  });

  it('rejects an invalid or expired code', async () => {
    links.consumeCode.mockResolvedValue(null);

    await service.handleWebhook(webhook(textMessage('VINCULAR ABCDEFGHJK')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.linkInvalid);
  });

  it('refuses a selection for an organization the sender cannot consult', async () => {
    await service.handleWebhook(webhook(listReply('q:org-9:overdue_tasks')));

    expect(assistant.answerIntent).not.toHaveBeenCalled();
    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.notOwner);
  });

  it('answers free text through the intent rules', async () => {
    assistant.query.mockResolvedValue({
      intent: 'active_timers',
      confidence: 0.95,
      title: 'Timers activos',
      summary: 'Hay 2 timers activos ahora.',
      details: [],
    });

    await service.handleWebhook(
      webhook(textMessage('qué timers están activos')),
    );

    expect(assistant.query).toHaveBeenCalledWith(
      { id: 'owner-1', organizationId: 'org-1' },
      { query: 'qué timers están activos' },
    );
    expect(client.sendText).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('*Timers activos*'),
    );
  });

  it('falls back to the menu when it does not understand the text', async () => {
    assistant.query.mockResolvedValue({
      intent: 'unknown',
      confidence: 0.2,
      title: 'Todavía estoy aprendiendo',
      summary: 'No puedo responder eso.',
      details: [],
    });

    await service.handleWebhook(webhook(textMessage('contame un chiste')));

    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ body: REPLIES.notUnderstood }),
    );
  });

  it('shows the menu for a greeting', async () => {
    await service.handleWebhook(webhook(textMessage('Hola')));

    expect(assistant.query).not.toHaveBeenCalled();
    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ body: REPLIES.menuBody('Empresa') }),
    );
  });

  it('asks which organization when the WhatsApp has more than one', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);

    await service.handleWebhook(webhook(textMessage('resumen de hoy')));

    expect(assistant.query).not.toHaveBeenCalled();
    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({
        body: REPLIES.chooseOrganization,
        rows: [
          expect.objectContaining({ id: 'o:org-1' }),
          expect.objectContaining({ id: 'o:org-2' }),
        ],
      }),
    );
  });

  it('opens the query menu after choosing an organization', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);

    await service.handleWebhook(webhook(listReply('o:org-2')));

    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({
        body: REPLIES.menuBody('Otra'),
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 's:switch' }),
        ]),
      }),
    );
  });

  it('answers that it only reads text for audio or stickers', async () => {
    await service.handleWebhook(
      webhook({ id: 'wamid.3', from: PHONE, type: 'audio' }),
    );

    expect(client.sendText).toHaveBeenCalledWith(
      PHONE,
      REPLIES.unsupportedMedia,
    );
  });

  it('unlinks every organization when asked from the chat', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);

    await service.handleWebhook(webhook(textMessage('desconectar')));

    expect(links.unlink).toHaveBeenCalledWith('org-1');
    expect(links.unlink).toHaveBeenCalledWith('org-2');
    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.unlinked);
  });

  it('stops answering after 20 queries in an hour', async () => {
    for (let index = 0; index < 20; index += 1) {
      await service.handleWebhook(
        webhook(textMessage('hola', `wamid.${index}`)),
      );
    }
    client.sendText.mockClear();

    await service.handleWebhook(webhook(textMessage('hola', 'wamid.limit')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.rateLimited);
  });

  it('tells the owner when the assistant fails instead of staying silent', async () => {
    assistant.answerIntent.mockRejectedValue(new Error('prisma caída'));

    await service.handleWebhook(webhook(listReply('q:org-1:overdue_tasks')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.failed);
  });

  it('tells the owner when the assistant fails on free text', async () => {
    assistant.query.mockRejectedValue(new Error('prisma caída'));

    await service.handleWebhook(webhook(textMessage('tareas atrasadas')));

    expect(client.sendText).toHaveBeenCalledWith(PHONE, REPLIES.failed);
  });

  it('shows the menu again when a selection id is not valid', async () => {
    await service.handleWebhook(webhook(listReply('cualquier-cosa')));

    expect(assistant.answerIntent).not.toHaveBeenCalled();
    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ body: REPLIES.menuBody('Empresa') }),
    );
  });

  it('lists the organizations when the owner asks to switch', async () => {
    links.findLinkedOrganizations.mockResolvedValue([
      ORGANIZATION,
      OTHER_ORGANIZATION,
    ]);

    await service.handleWebhook(webhook(listReply('s:switch')));

    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ body: REPLIES.chooseOrganization }),
    );
  });

  it('processes every message of a batch', async () => {
    await service.handleWebhook(
      webhook(
        listReply('q:org-1:overdue_tasks', 'wamid.a'),
        listReply('q:org-1:active_timers', 'wamid.b'),
      ),
    );

    expect(assistant.answerIntent).toHaveBeenCalledTimes(2);
  });

  it('matches each message to its own contact even when contacts are reversed', async () => {
    const body = webhook(textMessage('hola', 'a'), {
      id: 'b',
      from: '549112222',
      text: { body: 'hola' },
    });
    body.entry[0].changes[0].value.contacts = [
      { wa_id: '549112222', user_id: 'AR.other', profile: { name: 'Other' } },
      { wa_id: PHONE, user_id: USER_ID, profile: { name: 'Ana' } },
    ];
    links.findLinkedOrganizations.mockImplementation(async (userId: string) =>
      userId === USER_ID ? [ORGANIZATION] : [OTHER_ORGANIZATION],
    );
    await service.handleWebhook(body);
    expect(links.findLinkedOrganizations.mock.calls).toEqual([
      [USER_ID],
      ['AR.other'],
    ]);
    expect(client.sendMenu).toHaveBeenCalledWith(
      PHONE,
      expect.objectContaining({ body: REPLIES.menuBody('Empresa') }),
    );
    expect(client.sendMenu).toHaveBeenCalledWith(
      '549112222',
      expect.objectContaining({ body: REPLIES.menuBody('Otra') }),
    );
  });

  it('does not borrow the only contact for an unrelated message', async () => {
    await service.handleWebhook(
      webhook({ id: 'other', from: 'unmatched', text: { body: 'hola' } }),
    );
    expect(links.findLinkedOrganizations).not.toHaveBeenCalled();
    expect(prisma.whatsAppProcessedMessage.create).not.toHaveBeenCalled();
  });

  it('accepts direct from_user_id without contacts', async () => {
    const body = webhook({
      id: 'direct',
      from_user_id: USER_ID,
      text: { body: 'hola' },
    });
    body.entry[0].changes[0].value.contacts = [];
    await service.handleWebhook(body);
    expect(links.findLinkedOrganizations).toHaveBeenCalledWith(USER_ID);
    expect(client.sendMenu).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  it('matches a contact by user_id when from is absent', async () => {
    await service.handleWebhook(
      webhook({ id: 'direct', from_user_id: USER_ID, text: { body: 'hola' } }),
    );
    expect(client.sendMenu).toHaveBeenCalledWith(PHONE, expect.any(Object));
  });

  it('rejects conflicting direct and contact identities', async () => {
    await service.handleWebhook(
      webhook({ ...textMessage('hola'), from_user_id: 'AR.conflicting' }),
    );
    expect(links.findLinkedOrganizations).not.toHaveBeenCalled();
  });

  it('rejects ambiguous duplicate contacts', async () => {
    const body = webhook(textMessage('hola'));
    body.entry[0].changes[0].value.contacts.push({
      wa_id: PHONE,
      user_id: 'AR.conflicting',
      profile: { name: 'Other' },
    });
    await service.handleWebhook(body);
    expect(links.findLinkedOrganizations).not.toHaveBeenCalled();
  });

  it('filters changes individually in a mixed-channel batch', async () => {
    const body = webhook(textMessage('hola', 'valid'));
    const wrong = webhook(textMessage('hola', 'wrong')).entry[0].changes[0];
    wrong.value.metadata.phone_number_id = 'wrong-channel';
    body.entry[0].changes.unshift(wrong);
    await service.handleWebhook(body);
    expect(links.findLinkedOrganizations).toHaveBeenCalledTimes(1);
    expect(prisma.whatsAppProcessedMessage.create).toHaveBeenCalledTimes(1);
  });
});
