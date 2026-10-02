/**
 * Tests de la revision diaria de Trello. El adaptador, la comparacion y el
 * webhook estan simulados; se prueba el recorrido de conexiones, que un error no
 * frene al resto y que quede registrado en la conexion.
 */
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationAccessService } from '../../access/integration-access.service';
import { IntegrationConnectionsService } from '../../connections/integration-connections.service';
import { IntegrationsConfig } from '../../integrations.config';
import { IntegrationReconcileService } from '../../sync/integration-reconcile.service';
import { TrelloAdapter } from './trello.adapter';
import { TRELLO_SOURCES } from './trello.types';
import { TrelloLiveSyncService } from './trello-live-sync.service';
import {
  MAX_CONNECTIONS_PER_RUN,
  TrelloReconcileService,
} from './trello-reconcile.service';

describe('TrelloReconcileService', () => {
  const env = {
    INTEGRATIONS_ENABLED: 'true',
    TRELLO_API_KEY: 'app-key',
    INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  };
  const connection = (id: string) => ({
    id,
    organizationId: 'org-1',
    projectId: `project-${id}`,
    externalContainerId: `board-${id}`,
    externalContainerName: 'Board',
    accessTokenEnc: 'v1:enc',
    webhookId: 'wh-1',
  });
  const stats = {
    groupsAdded: 0,
    created: 1,
    updated: 2,
    restored: 0,
    archived: 0,
    subtasksChanged: 0,
    commentsAdded: 0,
    commentsUpdated: 0,
    baselined: 0,
  };
  const snapshot = {
    container: { externalId: 'board-a', name: 'Board', description: '' },
    groups: [],
    items: [],
  };

  let prisma: {
    integrationConnection: { findMany: jest.Mock; update: jest.Mock };
  };
  let adapter: { sources: typeof TRELLO_SOURCES; fetchSnapshot: jest.Mock };
  let reconcile: { reconcileSnapshot: jest.Mock };
  let liveSync: { register: jest.Mock; credentialsFor: jest.Mock };
  let connections: { findForProject: jest.Mock };
  let access: { assertCanManage: jest.Mock };
  let errorSpy: jest.SpyInstance;

  const build = (overrides: NodeJS.ProcessEnv = {}) =>
    new TrelloReconcileService(
      prisma as unknown as PrismaService,
      new IntegrationsConfig({ ...env, ...overrides }),
      adapter as unknown as TrelloAdapter,
      reconcile as unknown as IntegrationReconcileService,
      liveSync as unknown as TrelloLiveSyncService,
      connections as unknown as IntegrationConnectionsService,
      access as unknown as IntegrationAccessService,
    );

  beforeEach(() => {
    prisma = {
      integrationConnection: {
        findMany: jest
          .fn()
          .mockResolvedValue([connection('a'), connection('b')]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    adapter = {
      sources: TRELLO_SOURCES,
      fetchSnapshot: jest.fn().mockResolvedValue(snapshot),
    };
    reconcile = { reconcileSnapshot: jest.fn().mockResolvedValue(stats) };
    liveSync = {
      register: jest.fn().mockResolvedValue({ active: true, reason: null }),
      credentialsFor: jest
        .fn()
        .mockReturnValue({ apiKey: 'app-key', token: 'user-token' }),
    };
    connections = { findForProject: jest.fn().mockResolvedValue(null) };
    access = { assertCanManage: jest.fn().mockResolvedValue(undefined) };
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => errorSpy.mockRestore());

  describe('reconcileConnection', () => {
    it('downloads the whole board, compares it and records the sync', async () => {
      await expect(
        build().reconcileConnection(connection('a')),
      ).resolves.toEqual({ ...stats, liveSyncActive: true });

      expect(adapter.fetchSnapshot).toHaveBeenCalledWith(
        'board-a',
        { apiKey: 'app-key', token: 'user-token' },
        { includeComments: true },
      );
      expect(reconcile.reconcileSnapshot).toHaveBeenCalledWith(
        {
          connectionId: 'a',
          organizationId: 'org-1',
          projectId: 'project-a',
          sources: TRELLO_SOURCES,
        },
        snapshot,
      );
      expect(liveSync.register).toHaveBeenCalledWith(connection('a'));
      const [[update]] = prisma.integrationConnection.update.mock.calls as [
        [{ where: { id: string }; data: Record<string, unknown> }],
      ];
      expect(update.where).toEqual({ id: 'a' });
      expect(update.data.lastSyncedAt).toBeInstanceOf(Date);
      expect(update.data.lastSyncError).toBeNull();
    });

    it('keeps the previous error when the webhook is still inactive', async () => {
      liveSync.register.mockResolvedValue({
        active: false,
        reason: 'WEBHOOK_URL_MISSING',
      });

      await expect(
        build().reconcileConnection(connection('a')),
      ).resolves.toEqual(expect.objectContaining({ liveSyncActive: false }));

      const [[update]] = prisma.integrationConnection.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(update.data).not.toHaveProperty('lastSyncError');
    });

    it('records the failure on the connection and rethrows', async () => {
      adapter.fetchSnapshot.mockRejectedValue(new TypeError('network'));

      await expect(
        build().reconcileConnection(connection('a')),
      ).rejects.toThrow(TypeError);
      expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { lastSyncError: 'RECONCILE_FAILED: TypeError' },
      });
    });
  });

  describe('reconcileAll', () => {
    it('does nothing when integrations are turned off', async () => {
      await expect(
        build({ INTEGRATIONS_ENABLED: 'false' }).reconcileAll(),
      ).resolves.toEqual({
        status: 'DISABLED',
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });
      expect(prisma.integrationConnection.findMany).not.toHaveBeenCalled();
    });

    it('reviews active Trello connections, oldest first and with a limit', async () => {
      const summary = await build().reconcileAll();

      expect(prisma.integrationConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: 'TRELLO', status: 'ACTIVE' },
          orderBy: { lastSyncedAt: 'asc' },
          take: MAX_CONNECTIONS_PER_RUN,
        }),
      );
      expect(summary).toEqual({
        status: 'OK',
        processed: 2,
        succeeded: 2,
        failed: 0,
        results: [
          {
            connectionId: 'a',
            projectId: 'project-a',
            ok: true,
            stats: { ...stats, liveSyncActive: true },
          },
          {
            connectionId: 'b',
            projectId: 'project-b',
            ok: true,
            stats: { ...stats, liveSyncActive: true },
          },
        ],
      });
    });

    it('keeps going when one connection fails', async () => {
      adapter.fetchSnapshot
        .mockRejectedValueOnce(new Error('revoked'))
        .mockResolvedValueOnce(snapshot);

      const summary = await build().reconcileAll();

      expect(summary.processed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.succeeded).toBe(1);
      expect(summary.results[0]).toEqual({
        connectionId: 'a',
        projectId: 'project-a',
        ok: false,
        error: 'Error',
      });
    });
  });

  describe('reconcileProject', () => {
    it('checks access and reviews the project connection', async () => {
      connections.findForProject.mockResolvedValue({
        ...connection('a'),
        provider: 'TRELLO',
      });
      const owner = { id: 'owner-1', role: 'USER' };

      await expect(
        build().reconcileProject(owner, 'org-1', 'project-a'),
      ).resolves.toEqual({ ...stats, liveSyncActive: true });
      expect(access.assertCanManage).toHaveBeenCalledWith(owner, 'org-1');
      expect(connections.findForProject).toHaveBeenCalledWith(
        'org-1',
        'project-a',
      );
    });

    it('fails when the project is not connected', async () => {
      await expect(
        build().reconcileProject({ id: 'u' }, 'org-1', 'project-x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('stops when the user cannot manage integrations', async () => {
      access.assertCanManage.mockRejectedValue(new ForbiddenException());

      await expect(
        build().reconcileProject({ id: 'u' }, 'org-1', 'project-a'),
      ).rejects.toThrow(ForbiddenException);
      expect(adapter.fetchSnapshot).not.toHaveBeenCalled();
    });
  });
});
