import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../../integrations.config';
import { encryptSecret } from '../../security/token-cipher';
import { TrelloClient } from './trello.client';
import { TrelloLiveSyncService } from './trello-live-sync.service';

describe('TrelloLiveSyncService', () => {
  const key = randomBytes(32);
  const env = {
    TRELLO_API_KEY: 'app-key',
    TRELLO_API_SECRET: 'app-secret',
    INTEGRATIONS_ENCRYPTION_KEY: key.toString('base64'),
    INTEGRATIONS_WEBHOOK_BASE_URL: 'https://api.tino.test',
  };
  const connection = {
    id: 'conn-1',
    externalContainerId: 'board-1',
    externalContainerName: 'Roadmap',
    accessTokenEnc: encryptSecret('user-token', key),
    webhookId: null as string | null,
  };
  let prisma: { integrationConnection: { update: jest.Mock } };
  let trello: { createWebhook: jest.Mock; deleteWebhook: jest.Mock };
  let warnSpy: jest.SpyInstance;

  const build = (overrides: NodeJS.ProcessEnv = {}) =>
    new TrelloLiveSyncService(
      prisma as unknown as PrismaService,
      trello as unknown as TrelloClient,
      new IntegrationsConfig({ ...env, ...overrides }),
    );

  beforeEach(() => {
    prisma = {
      integrationConnection: { update: jest.fn().mockResolvedValue({}) },
    };
    trello = {
      createWebhook: jest.fn().mockResolvedValue({ id: 'wh-1' }),
      deleteWebhook: jest.fn().mockResolvedValue(undefined),
    };
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => warnSpy.mockRestore());

  describe('register', () => {
    it('creates the webhook on the board and stores its id', async () => {
      await expect(build().register(connection)).resolves.toEqual({
        active: true,
        reason: null,
      });

      expect(trello.createWebhook).toHaveBeenCalledWith(
        { apiKey: 'app-key', token: 'user-token' },
        {
          callbackURL:
            'https://api.tino.test/integrations/trello/webhook/conn-1',
          idModel: 'board-1',
          description: 'Tino - Roadmap',
        },
      );
      expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { webhookId: 'wh-1', lastSyncError: null },
      });
    });

    it('does nothing when the webhook already exists', async () => {
      await expect(
        build().register({ ...connection, webhookId: 'wh-old' }),
      ).resolves.toEqual({ active: true, reason: null });
      expect(trello.createWebhook).not.toHaveBeenCalled();
    });

    it('explains the missing configuration without calling Trello', async () => {
      await expect(
        build({ INTEGRATIONS_WEBHOOK_BASE_URL: '' }).register(connection),
      ).resolves.toEqual({ active: false, reason: 'WEBHOOK_URL_MISSING' });
      await expect(
        build({ TRELLO_API_SECRET: '' }).register(connection),
      ).resolves.toEqual({ active: false, reason: 'WEBHOOK_SECRET_MISSING' });
      expect(trello.createWebhook).not.toHaveBeenCalled();
    });

    it('keeps the connection and records the error when Trello rejects it', async () => {
      trello.createWebhook.mockRejectedValue(new Error('HEAD failed'));

      await expect(build().register(connection)).resolves.toEqual({
        active: false,
        reason: 'REGISTRATION_FAILED',
      });
      expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { lastSyncError: 'WEBHOOK_REGISTRATION_FAILED' },
      });
    });
  });

  describe('unregister', () => {
    it('deletes the webhook in Trello', async () => {
      await build().unregister({ ...connection, webhookId: 'wh-1' });

      expect(trello.deleteWebhook).toHaveBeenCalledWith('wh-1', {
        apiKey: 'app-key',
        token: 'user-token',
      });
    });

    it('skips connections without webhook', async () => {
      await build().unregister(connection);

      expect(trello.deleteWebhook).not.toHaveBeenCalled();
    });

    it('does not fail when Trello cannot delete it', async () => {
      trello.deleteWebhook.mockRejectedValue(new Error('404'));

      await expect(
        build().unregister({ ...connection, webhookId: 'wh-1' }),
      ).resolves.toBeUndefined();
    });
  });
});
