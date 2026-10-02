/**
 * Tests del procesamiento de avisos de Trello. La firma se calcula de verdad con
 * el secreto de prueba; el traductor y el motor de cambios estan simulados.
 */
import {
  GoneException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../../integrations.config';
import { encryptSecret } from '../../security/token-cipher';
import { IntegrationChangeService } from '../../sync/integration-change.service';
import { TrelloAdapter } from './trello.adapter';
import { TrelloClient } from './trello.client';
import { TrelloWebhookPayload } from './trello.types';
import { TrelloWebhookTranslator } from './trello-webhook-translator';
import { TrelloWebhookService } from './trello-webhook.service';
import { computeTrelloSignature } from './trello-signature';

describe('TrelloWebhookService', () => {
  const key = randomBytes(32);
  const connectionId = '11111111-1111-4111-8111-111111111111';
  const env = {
    INTEGRATIONS_ENABLED: 'true',
    TRELLO_API_KEY: 'app-key',
    TRELLO_API_SECRET: 'app-secret',
    INTEGRATIONS_ENCRYPTION_KEY: key.toString('base64'),
    INTEGRATIONS_WEBHOOK_BASE_URL: 'https://api.tino.test',
  };
  const callbackUrl = `https://api.tino.test/integrations/trello/webhook/${connectionId}`;
  const payload: TrelloWebhookPayload = {
    action: {
      id: 'act-1',
      type: 'updateCard',
      date: '2026-09-25T12:00:00.000Z',
      memberCreator: { id: 'member-1', fullName: 'Ana Trello' },
      data: { card: { id: 'card-1', name: 'Nuevo' }, old: { name: 'Viejo' } },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = computeTrelloSignature(rawBody, callbackUrl, 'app-secret');
  const change = {
    kind: 'ITEM_UPDATED' as const,
    externalId: 'card-1',
    changes: { title: 'Nuevo' },
  };

  interface EventUpsert {
    where: unknown;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }
  interface ConnectionUpdate {
    where: { id: string };
    data: Record<string, unknown>;
  }
  let prisma: {
    integrationConnection: {
      findFirst: jest.Mock;
      update: jest.Mock<Promise<unknown>, [ConnectionUpdate]>;
    };
    integrationEvent: {
      findUnique: jest.Mock;
      upsert: jest.Mock<Promise<unknown>, [EventUpsert]>;
    };
  };
  let translator: { translate: jest.Mock; actorOf: jest.Mock };
  let changes: { apply: jest.Mock };
  let service: TrelloWebhookService;

  const build = (overrides: NodeJS.ProcessEnv = {}) =>
    new TrelloWebhookService(
      prisma as unknown as PrismaService,
      new IntegrationsConfig({ ...env, ...overrides }),
      translator as unknown as TrelloWebhookTranslator,
      changes as unknown as IntegrationChangeService,
      new TrelloAdapter({} as TrelloClient),
    );

  beforeEach(() => {
    prisma = {
      integrationConnection: {
        findFirst: jest.fn().mockResolvedValue({
          id: connectionId,
          organizationId: 'org-1',
          projectId: 'project-1',
          status: 'ACTIVE',
          accessTokenEnc: encryptSecret('user-token', key),
        }),
        update: jest
          .fn<Promise<unknown>, [ConnectionUpdate]>()
          .mockResolvedValue({}),
      },
      integrationEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest
          .fn<Promise<unknown>, [EventUpsert]>()
          .mockResolvedValue({}),
      },
    };
    translator = {
      translate: jest.fn().mockResolvedValue([change]),
      actorOf: jest
        .fn()
        .mockReturnValue({ id: 'member-1', name: 'Ana Trello' }),
    };
    changes = { apply: jest.fn().mockResolvedValue('APPLIED') };
    service = build();
  });

  it('applies the translated changes and records who made them', async () => {
    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).resolves.toBe('PROCESSED');

    expect(translator.translate).toHaveBeenCalledWith(payload.action, {
      apiKey: 'app-key',
      token: 'user-token',
    });
    expect(changes.apply.mock.calls[0]).toMatchObject([
      {
        connectionId,
        organizationId: 'org-1',
        projectId: 'project-1',
        sources: { item: 'TRELLO_CARD' },
        actorName: 'Ana Trello',
      },
      change,
    ]);
    const [[event]] = prisma.integrationEvent.upsert.mock.calls;
    expect(event.where).toEqual({
      connectionId_externalEventId: {
        connectionId,
        externalEventId: 'act-1',
      },
    });
    expect(event.create).toMatchObject({
      connectionId,
      externalEventId: 'act-1',
      type: 'updateCard',
      itemExternalId: 'card-1',
      actorExternalId: 'member-1',
      actorName: 'Ana Trello',
      status: 'PROCESSED',
      occurredAt: new Date('2026-09-25T12:00:00.000Z'),
    });
    expect(event.update).toMatchObject({ status: 'PROCESSED' });
    const [[connectionUpdate]] = prisma.integrationConnection.update.mock.calls;
    expect(connectionUpdate.where).toEqual({ id: connectionId });
    expect(connectionUpdate.data.lastEventAt).toBeInstanceOf(Date);
    expect(connectionUpdate.data.lastSyncError).toBeNull();
  });

  it('marks the event as ignored when nothing applied', async () => {
    changes.apply.mockResolvedValue('IGNORED');

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).resolves.toBe('IGNORED');
  });

  it('rejects an invalid signature before reading the database', async () => {
    await expect(
      service.handle(connectionId, rawBody, 'bad-signature', payload),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.integrationConnection.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when live sync is not configured', async () => {
    await expect(
      build({ TRELLO_API_SECRET: '' }).handle(
        connectionId,
        rawBody,
        signature,
        payload,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('answers 410 for a deleted connection so Trello removes the webhook', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue(null);

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).rejects.toThrow(GoneException);
  });

  it('does nothing when integrations are turned off', async () => {
    await expect(
      build({ INTEGRATIONS_ENABLED: 'false' }).handle(
        connectionId,
        rawBody,
        'anything',
        payload,
      ),
    ).resolves.toBe('DISABLED');
    expect(prisma.integrationConnection.findFirst).not.toHaveBeenCalled();
  });

  it('skips events already processed', async () => {
    prisma.integrationEvent.findUnique.mockResolvedValue({
      status: 'PROCESSED',
    });

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).resolves.toBe('DUPLICATE');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('retries events that failed before', async () => {
    prisma.integrationEvent.findUnique.mockResolvedValue({ status: 'FAILED' });

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).resolves.toBe('PROCESSED');
  });

  it('ignores events of a paused connection', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue({
      id: connectionId,
      organizationId: 'org-1',
      projectId: 'project-1',
      status: 'PAUSED',
      accessTokenEnc: 'v1:x',
    });

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).resolves.toBe('IGNORED');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('returns NO_ACTION for a payload without action', async () => {
    const empty = Buffer.from('{}');

    await expect(
      service.handle(
        connectionId,
        empty,
        computeTrelloSignature(empty, callbackUrl, 'app-secret'),
        {},
      ),
    ).resolves.toBe('NO_ACTION');
  });

  it('records a failure and answers 500 so Trello retries', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    changes.apply.mockRejectedValue(new TypeError('boom secret detail'));

    await expect(
      service.handle(connectionId, rawBody, signature, payload),
    ).rejects.toThrow(InternalServerErrorException);

    const [[failed]] = prisma.integrationEvent.upsert.mock.calls;
    expect(failed.create).toMatchObject({
      status: 'FAILED',
      error: 'TypeError',
    });
    expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: connectionId },
      data: { lastSyncError: 'updateCard: TypeError' },
    });
    expect(loggerSpy.mock.calls.flat().join(' ')).not.toContain(
      'boom secret detail',
    );
    loggerSpy.mockRestore();
  });
});
