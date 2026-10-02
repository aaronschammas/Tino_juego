/**
 * Tests del flujo de conexion con Trello. El adaptador, el motor, las conexiones
 * y el control de acceso estan simulados: `importSnapshot` ejecuta
 * `onProjectReady` con una transaccion falsa para comprobar que la conexion se
 * guarda dentro de la misma transaccion que la importacion.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { IntegrationAccessService } from '../../access/integration-access.service';
import { IntegrationConnectionsService } from '../../connections/integration-connections.service';
import {
  ConnectionTargetMode,
  TrelloConnectDto,
} from '../../dto/trello-connection.dto';
import { IntegrationsConfig } from '../../integrations.config';
import { NormalizedSnapshot } from '../../integration.types';
import {
  ImportSnapshotInput,
  ImportSnapshotResult,
  IntegrationSyncService,
} from '../../sync/integration-sync.service';
import { TrelloAdapter } from './trello.adapter';
import { TRELLO_SOURCES } from './trello.types';
import { TrelloConnectionService } from './trello-connection.service';
import { TrelloLiveSyncService } from './trello-live-sync.service';

describe('TrelloConnectionService', () => {
  const owner = { id: 'owner-1', role: 'USER', organizationId: 'org-1' };
  const fakeTx = { tag: 'tx' };
  const snapshot: NormalizedSnapshot = {
    container: {
      externalId: 'board-1',
      name: 'Board',
      description: '',
      url: 'https://trello.example/b',
    },
    groups: [
      { externalId: 'l-doing', name: 'En progreso' },
      { externalId: 'l-qa', name: 'QA' },
    ],
    items: [
      {
        externalId: 'c1',
        title: 'Card 1',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        groupExternalId: 'l-doing',
        groupName: 'En progreso',
        isCompleted: false,
        subItems: [],
      },
      {
        externalId: 'c2',
        title: 'Card 2',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        groupExternalId: 'l-qa',
        groupName: 'QA',
        isCompleted: false,
        subItems: [],
        statusWarning: 'La lista "QA" se importara como TODO',
      },
    ],
  };
  const baseDto = (
    overrides: Partial<TrelloConnectDto> = {},
  ): TrelloConnectDto => ({
    token: 'user-token',
    boardId: 'board-1',
    mode: ConnectionTargetMode.NEW_PROJECT,
    statusMapping: [
      { externalGroupId: 'l-doing', status: TaskStatus.IN_PROGRESS },
      { externalGroupId: 'l-qa', status: TaskStatus.BLOCKED },
    ],
    ...overrides,
  });

  let trello: {
    provider: 'TRELLO';
    sources: typeof TRELLO_SOURCES;
    fetchSnapshot: jest.Mock;
    listContainers: jest.Mock;
  };
  let sync: {
    findExisting: jest.Mock;
    findTargetProject: jest.Mock;
    importSnapshot: jest.Mock<
      Promise<ImportSnapshotResult>,
      [ImportSnapshotInput]
    >;
  };
  let connections: {
    findConflicts: jest.Mock;
    createInTx: jest.Mock;
    findForProject: jest.Mock;
    disconnect: jest.Mock;
    updateStatusMappings: jest.Mock;
  };
  let liveSync: { register: jest.Mock; unregister: jest.Mock };
  let access: { assertCanManage: jest.Mock };
  let planPolicy: { assertCanCreateProject: jest.Mock };
  let service: TrelloConnectionService;

  beforeEach(() => {
    trello = {
      provider: 'TRELLO',
      sources: TRELLO_SOURCES,
      fetchSnapshot: jest.fn().mockResolvedValue(snapshot),
      listContainers: jest
        .fn()
        .mockResolvedValue([
          { externalId: 'board-1', name: 'Board', description: '', url: 'u' },
        ]),
    };
    sync = {
      findExisting: jest.fn().mockResolvedValue({
        containerProject: null,
        duplicateItemIds: new Set(),
        duplicateSubItemIds: new Set(),
      }),
      findTargetProject: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: 'Target',
        organizationId: 'org-1',
      }),
      importSnapshot: jest.fn(async (input: ImportSnapshotInput) => {
        await input.onProjectReady?.(fakeTx as never, 'project-new');
        return {
          project: { id: 'project-new', name: 'Board' },
          createdProject: true,
          createdTasks: 2,
          createdSubtasks: 0,
          createdComments: 0,
          skippedTasks: 0,
          skippedSubtasks: 0,
        };
      }),
    };
    connections = {
      findConflicts: jest.fn().mockResolvedValue({
        containerProject: null,
        projectAlreadyConnected: false,
      }),
      createInTx: jest.fn().mockResolvedValue(undefined),
      findForProject: jest.fn().mockResolvedValue(null),
      disconnect: jest.fn().mockResolvedValue({ disconnected: true }),
      updateStatusMappings: jest
        .fn()
        .mockResolvedValue({ updated: 1, tasksUpdated: 0 }),
    };
    access = { assertCanManage: jest.fn().mockResolvedValue(undefined) };
    liveSync = {
      register: jest.fn().mockResolvedValue({ active: true, reason: null }),
      unregister: jest.fn().mockResolvedValue(undefined),
    };
    planPolicy = {
      assertCanCreateProject: jest.fn().mockResolvedValue(undefined),
    };
    service = new TrelloConnectionService(
      trello as unknown as TrelloAdapter,
      sync as unknown as IntegrationSyncService,
      connections as unknown as IntegrationConnectionsService,
      access as unknown as IntegrationAccessService,
      planPolicy as unknown as PlanPolicyService,
      new IntegrationsConfig({
        INTEGRATIONS_ENABLED: 'true',
        TRELLO_API_KEY: 'app-key',
        INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      }),
      liveSync as unknown as TrelloLiveSyncService,
    );
  });

  describe('buildAuthorizeUrl', () => {
    it('builds a read-only Trello authorization that returns to the callback', async () => {
      const { url } = await service.buildAuthorizeUrl(
        owner,
        'org-1',
        'https://qa.tino.test/projects?x=1',
      );
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe(
        'https://trello.com/1/authorize',
      );
      expect(Object.fromEntries(parsed.searchParams)).toEqual({
        expiration: 'never',
        name: 'Tino',
        scope: 'read',
        response_type: 'token',
        callback_method: 'fragment',
        key: 'app-key',
        return_url: 'https://qa.tino.test/integrations/trello/callback',
      });
    });

    it('checks access first', async () => {
      access.assertCanManage.mockRejectedValue(new ForbiddenException());

      await expect(
        service.buildAuthorizeUrl(owner, 'org-1', 'https://qa.tino.test'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listBoards', () => {
    it('uses the backend api key with the user token', async () => {
      await expect(
        service.listBoards(owner, 'org-1', 'user-token'),
      ).resolves.toEqual([
        { id: 'board-1', name: 'Board', description: '', url: 'u' },
      ]);
      expect(trello.listContainers).toHaveBeenCalledWith({
        apiKey: 'app-key',
        token: 'user-token',
      });
    });
  });

  describe('preview', () => {
    it('returns the suggested mapping and applies it to the tasks', async () => {
      const preview = await service.preview(baseDto(), owner, 'org-1');

      expect(preview.statusMapping).toEqual([
        {
          externalGroupId: 'l-doing',
          name: 'En progreso',
          suggestedStatus: TaskStatus.IN_PROGRESS,
          itemCount: 1,
        },
        {
          externalGroupId: 'l-qa',
          name: 'QA',
          suggestedStatus: null,
          itemCount: 1,
        },
      ]);
      expect(preview.importDisabled).toBe(false);
      expect(preview.blockedReason).toBeNull();
      expect(preview.warnings).toEqual([
        'La lista "QA" se importara como TODO',
      ]);
    });

    it('blocks a board already connected to another project', async () => {
      connections.findConflicts.mockResolvedValue({
        containerProject: { id: 'p-2', name: 'Otro' },
        projectAlreadyConnected: false,
      });

      const preview = await service.preview(baseDto(), owner, 'org-1');

      expect(preview.importDisabled).toBe(true);
      expect(preview.blockedReason).toBe(
        'Este tablero ya esta conectado al proyecto "Otro"',
      );
    });

    it('lets a previously imported board connect to its existing project', async () => {
      sync.findExisting.mockResolvedValue({
        containerProject: { id: 'project-1', name: 'Target' },
        duplicateItemIds: new Set(['c1']),
        duplicateSubItemIds: new Set(),
      });

      const preview = await service.preview(
        baseDto({
          mode: ConnectionTargetMode.EXISTING_PROJECT,
          projectId: 'project-1',
        }),
        owner,
        'org-1',
      );

      expect(preview.importDisabled).toBe(false);
      expect(preview.totals.duplicateTasks).toBe(1);
      expect(connections.findConflicts).toHaveBeenCalledWith(
        'org-1',
        'TRELLO',
        'board-1',
        'project-1',
      );
    });

    it('asks to use the existing project when the board was already imported', async () => {
      sync.findExisting.mockResolvedValue({
        containerProject: { id: 'project-1', name: 'Target' },
        duplicateItemIds: new Set(),
        duplicateSubItemIds: new Set(),
      });

      const preview = await service.preview(baseDto(), owner, 'org-1');

      expect(preview.blockedReason).toContain('ya fue importado como "Target"');
    });

    it('requires a project for EXISTING_PROJECT', async () => {
      await expect(
        service.preview(
          baseDto({ mode: ConnectionTargetMode.EXISTING_PROJECT }),
          owner,
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(trello.fetchSnapshot).not.toHaveBeenCalled();
    });

    it('rejects an unknown target project', async () => {
      sync.findTargetProject.mockResolvedValue(null);

      await expect(
        service.preview(
          baseDto({
            mode: ConnectionTargetMode.EXISTING_PROJECT,
            projectId: 'project-x',
          }),
          owner,
          'org-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('connect', () => {
    it('imports with the chosen mapping and stores the connection in the same transaction', async () => {
      const response = await service.connect(baseDto(), owner, 'org-1');

      const [[input]] = sync.importSnapshot.mock.calls;
      expect(input.snapshot.items.map((item) => item.status)).toEqual([
        TaskStatus.IN_PROGRESS,
        TaskStatus.BLOCKED,
      ]);
      expect(input.targetProjectId).toBeUndefined();
      expect(connections.createInTx).toHaveBeenCalledWith(fakeTx, {
        organizationId: 'org-1',
        projectId: 'project-new',
        provider: 'TRELLO',
        container: snapshot.container,
        accessToken: 'user-token',
        connectedByUserId: 'owner-1',
        groups: snapshot.groups,
        mapping: new Map([
          ['l-doing', TaskStatus.IN_PROGRESS],
          ['l-qa', TaskStatus.BLOCKED],
        ]),
      });
      expect(planPolicy.assertCanCreateProject).toHaveBeenCalledWith(
        'org-1',
        owner,
      );
      expect(response.result.createdTasks).toBe(2);
      expect(response.warnings).toEqual([]);
      expect(trello.fetchSnapshot).toHaveBeenCalledWith(
        'board-1',
        { apiKey: 'app-key', token: 'user-token' },
        { includeComments: true },
      );
    });

    it('activates the automatic update after importing', async () => {
      const stored = {
        id: 'conn-new',
        provider: 'TRELLO',
        externalContainerId: 'board-1',
        externalContainerName: 'Board',
        accessTokenEnc: 'v1:x',
        webhookId: null,
      };
      connections.findForProject.mockResolvedValue(stored);
      liveSync.register.mockResolvedValue({
        active: false,
        reason: 'WEBHOOK_URL_MISSING',
      });

      const response = await service.connect(baseDto(), owner, 'org-1');

      expect(connections.findForProject).toHaveBeenCalledWith(
        'org-1',
        'project-new',
      );
      expect(liveSync.register).toHaveBeenCalledWith(stored);
      expect(response.liveSync).toEqual({
        active: false,
        reason: 'WEBHOOK_URL_MISSING',
      });
    });

    it('rejects when a list has no status', async () => {
      await expect(
        service.connect(
          baseDto({
            statusMapping: [
              { externalGroupId: 'l-doing', status: TaskStatus.TODO },
              { externalGroupId: 'unknown-list', status: TaskStatus.DONE },
            ],
          }),
          owner,
          'org-1',
        ),
      ).rejects.toThrow(
        new BadRequestException('Falta definir el estado de: QA'),
      );
      expect(sync.importSnapshot).not.toHaveBeenCalled();
    });

    it('rejects a blocked connection before importing', async () => {
      connections.findConflicts.mockResolvedValue({
        containerProject: null,
        projectAlreadyConnected: true,
      });

      await expect(
        service.connect(
          baseDto({
            mode: ConnectionTargetMode.EXISTING_PROJECT,
            projectId: 'project-1',
          }),
          owner,
          'org-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(sync.importSnapshot).not.toHaveBeenCalled();
    });

    it('does not check the project limit when connecting an existing project', async () => {
      await service.connect(
        baseDto({
          mode: ConnectionTargetMode.EXISTING_PROJECT,
          projectId: 'project-1',
        }),
        owner,
        'org-1',
      );

      expect(planPolicy.assertCanCreateProject).not.toHaveBeenCalled();
      expect(sync.importSnapshot.mock.calls[0][0].targetProjectId).toBe(
        'project-1',
      );
    });

    it('stops when access is denied', async () => {
      access.assertCanManage.mockRejectedValue(new ForbiddenException());

      await expect(service.connect(baseDto(), owner, 'org-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(trello.fetchSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('live sync and management', () => {
    const stored = {
      id: 'conn-1',
      provider: 'TRELLO',
      externalContainerId: 'board-1',
      externalContainerName: 'Board',
      accessTokenEnc: 'v1:x',
      webhookId: 'wh-1',
    };

    it('retries the automatic update of a connected project', async () => {
      connections.findForProject.mockResolvedValue(stored);

      await expect(
        service.enableLiveSync(owner, 'org-1', 'project-1'),
      ).resolves.toEqual({ active: true, reason: null });
      expect(liveSync.register).toHaveBeenCalledWith(stored);
    });

    it('fails to retry when the project is not connected', async () => {
      await expect(
        service.enableLiveSync(owner, 'org-1', 'project-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('removes the Trello webhook before deleting the connection', async () => {
      connections.findForProject.mockResolvedValue(stored);

      await expect(
        service.disconnect(owner, 'org-1', 'project-1'),
      ).resolves.toEqual({ disconnected: true });
      expect(liveSync.unregister).toHaveBeenCalledWith(stored);
      expect(liveSync.unregister.mock.invocationCallOrder[0]).toBeLessThan(
        connections.disconnect.mock.invocationCallOrder[0],
      );
    });

    it('checks access before disconnecting', async () => {
      access.assertCanManage.mockRejectedValue(new ForbiddenException());

      await expect(
        service.disconnect(owner, 'org-1', 'project-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(connections.disconnect).not.toHaveBeenCalled();
    });

    it('forwards status mapping changes with the Trello card source', async () => {
      const entries = [{ externalGroupId: 'l-qa', status: TaskStatus.BLOCKED }];

      await service.updateStatusMappings(owner, 'org-1', 'project-1', entries);

      expect(connections.updateStatusMappings).toHaveBeenCalledWith(
        'org-1',
        'project-1',
        entries,
        'TRELLO_CARD',
      );
    });
  });
});
