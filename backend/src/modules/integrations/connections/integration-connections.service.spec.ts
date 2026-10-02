import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../integrations.config';
import { decryptSecret } from '../security/token-cipher';
import {
  CreateConnectionInput,
  IntegrationConnectionsService,
} from './integration-connections.service';

describe('IntegrationConnectionsService', () => {
  const key = randomBytes(32);
  const env = { INTEGRATIONS_ENCRYPTION_KEY: key.toString('base64') };
  const member = { id: 'user-1', role: 'USER', organizationId: 'org-1' };
  let prisma: {
    integrationConnection: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
    integrationStatusMapping: { update: jest.Mock };
    task: { updateMany: jest.Mock };
    $transaction: jest.Mock;
    project: { findFirst: jest.Mock };
    projectMember: { findUnique: jest.Mock };
    organizationMembership: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let service: IntegrationConnectionsService;

  beforeEach(() => {
    prisma = {
      integrationConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      integrationStatusMapping: {
        update: jest.fn((args: unknown) => ({ op: 'mapping', args })),
      },
      task: {
        updateMany: jest.fn((args: unknown) => ({ op: 'tasks', args })),
      },
      $transaction: jest.fn((operations: Array<{ op: string }>) =>
        Promise.resolve(
          operations.map((operation) =>
            operation.op === 'tasks' ? { count: 3 } : {},
          ),
        ),
      ),
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          organizationId: 'org-1',
          isActive: true,
        }),
      },
      projectMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_MEMBER' }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'owner-1', name: 'Ana', lastname: 'Paz' }),
      },
    };
    service = new IntegrationConnectionsService(
      prisma as unknown as PrismaService,
      new IntegrationsConfig(env),
    );
  });

  describe('findConflicts', () => {
    it('reports the project that already has the board', async () => {
      prisma.integrationConnection.findUnique
        .mockResolvedValueOnce({ project: { id: 'p-9', name: 'Otro' } })
        .mockResolvedValueOnce({ id: 'conn-2' });

      await expect(
        service.findConflicts('org-1', 'TRELLO', 'board-1', 'project-1'),
      ).resolves.toEqual({
        containerProject: { id: 'p-9', name: 'Otro' },
        projectAlreadyConnected: true,
      });
      expect(prisma.integrationConnection.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_provider_externalContainerId: {
            organizationId: 'org-1',
            provider: 'TRELLO',
            externalContainerId: 'board-1',
          },
        },
        select: { project: { select: { id: true, name: true } } },
      });
    });

    it('skips the project check for a new project', async () => {
      await expect(
        service.findConflicts('org-1', 'TRELLO', 'board-1'),
      ).resolves.toEqual({
        containerProject: null,
        projectAlreadyConnected: false,
      });
      expect(prisma.integrationConnection.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('createInTx', () => {
    const input: CreateConnectionInput = {
      organizationId: 'org-1',
      projectId: 'project-1',
      provider: 'TRELLO',
      container: {
        externalId: 'board-1',
        name: 'Board',
        description: '',
        url: 'https://trello.example/b',
      },
      accessToken: 'plain-token',
      connectedByUserId: 'owner-1',
      groups: [
        { externalId: 'l1', name: 'To do' },
        { externalId: 'l2', name: 'QA' },
      ],
      mapping: new Map([
        ['l1', TaskStatus.TODO],
        ['l2', TaskStatus.BLOCKED],
      ]),
    };

    it('stores the encrypted token and one mapping per list', async () => {
      const create = jest.fn().mockResolvedValue({});
      const tx = {
        integrationConnection: { create },
      } as unknown as Prisma.TransactionClient;

      await service.createInTx(tx, input);

      const [[{ data }]] = create.mock.calls as [
        [{ data: Record<string, unknown> & { accessTokenEnc: string } }],
      ];
      expect(data).toMatchObject({
        organizationId: 'org-1',
        projectId: 'project-1',
        provider: 'TRELLO',
        externalContainerId: 'board-1',
        externalContainerName: 'Board',
        externalContainerUrl: 'https://trello.example/b',
        connectedByUserId: 'owner-1',
        statusMappings: {
          create: [
            {
              externalGroupId: 'l1',
              externalGroupName: 'To do',
              status: 'TODO',
            },
            {
              externalGroupId: 'l2',
              externalGroupName: 'QA',
              status: 'BLOCKED',
            },
          ],
        },
      });
      expect(data.accessTokenEnc).not.toContain('plain-token');
      expect(decryptSecret(data.accessTokenEnc, key)).toBe('plain-token');
    });

    it('refuses to store a token without an encryption key', async () => {
      const withoutKey = new IntegrationConnectionsService(
        prisma as unknown as PrismaService,
        new IntegrationsConfig({}),
      );
      const create = jest.fn();

      await expect(
        withoutKey.createInTx(
          {
            integrationConnection: { create },
          } as unknown as Prisma.TransactionClient,
          input,
        ),
      ).rejects.toThrow(InternalServerErrorException);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('findByProject', () => {
    it('returns a summary without the token', async () => {
      prisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn-1',
        provider: 'TRELLO',
        status: 'ACTIVE',
        externalContainerId: 'board-1',
        externalContainerName: 'Board',
        externalContainerUrl: 'https://trello.example/b',
        accessTokenEnc: 'v1:secret',
        connectedByUserId: 'owner-1',
        createdAt: new Date('2026-09-24T10:00:00.000Z'),
        lastSyncedAt: new Date('2026-09-24T10:00:00.000Z'),
        webhookId: 'wh-1',
        lastEventAt: new Date('2026-09-25T09:00:00.000Z'),
        lastSyncError: null,
        statusMappings: [
          { externalGroupId: 'l1', externalGroupName: 'To do', status: 'TODO' },
        ],
      });

      const summary = await service.findByProject(member, 'org-1', 'project-1');

      expect(summary).toEqual({
        id: 'conn-1',
        provider: 'TRELLO',
        status: 'ACTIVE',
        container: {
          id: 'board-1',
          name: 'Board',
          url: 'https://trello.example/b',
        },
        connectedAt: new Date('2026-09-24T10:00:00.000Z'),
        connectedBy: { id: 'owner-1', name: 'Ana Paz' },
        lastSyncedAt: new Date('2026-09-24T10:00:00.000Z'),
        liveSync: {
          active: true,
          lastEventAt: new Date('2026-09-25T09:00:00.000Z'),
          lastSyncError: null,
        },
        statusMappings: [
          { externalGroupId: 'l1', name: 'To do', status: 'TODO' },
        ],
      });
      expect(JSON.stringify(summary)).not.toContain('secret');
    });

    it('returns null when the project is not connected', async () => {
      await expect(
        service.findByProject(member, 'org-1', 'project-1'),
      ).resolves.toBeNull();
    });

    it('hides projects of other organizations', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findByProject(member, 'org-1', 'project-x'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.integrationConnection.findUnique).not.toHaveBeenCalled();
    });

    it('hides projects the user cannot access', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findByProject(member, 'org-1', 'project-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findForProject', () => {
    it('looks up the connection inside the organization', async () => {
      await service.findForProject('org-1', 'project-1');

      expect(prisma.integrationConnection.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', projectId: 'project-1' },
        }),
      );
    });
  });

  describe('updateStatusMappings', () => {
    beforeEach(() => {
      prisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        statusMappings: [
          { externalGroupId: 'l-todo', status: TaskStatus.TODO },
          { externalGroupId: 'l-new', status: null },
          { externalGroupId: 'l-same', status: TaskStatus.DONE },
        ],
      });
    });

    it('applies a newly defined list to its tasks and only updates the mapping of an existing one', async () => {
      await expect(
        service.updateStatusMappings(
          'org-1',
          'project-1',
          [
            { externalGroupId: 'l-new', status: TaskStatus.BLOCKED },
            { externalGroupId: 'l-todo', status: TaskStatus.IN_PROGRESS },
            { externalGroupId: 'l-same', status: TaskStatus.DONE },
          ],
          'TRELLO_CARD',
        ),
      ).resolves.toEqual({ updated: 2, tasksUpdated: 3 });

      expect(prisma.task.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          projectId: 'project-1',
          externalSource: 'TRELLO_CARD',
          externalGroupId: 'l-new',
          parentTaskId: null,
          archivedAt: null,
        },
        data: { status: TaskStatus.BLOCKED },
      });
      expect(prisma.integrationStatusMapping.update).toHaveBeenCalledTimes(2);
      expect(prisma.integrationStatusMapping.update).toHaveBeenCalledWith({
        where: {
          connectionId_externalGroupId: {
            connectionId: 'conn-1',
            externalGroupId: 'l-todo',
          },
        },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('rejects lists that are not part of the connection', async () => {
      await expect(
        service.updateStatusMappings(
          'org-1',
          'project-1',
          [{ externalGroupId: 'l-other', status: TaskStatus.DONE }],
          'TRELLO_CARD',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('fails when the project is not connected', async () => {
      prisma.integrationConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatusMappings('org-1', 'project-1', [], 'TRELLO_CARD'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('disconnect', () => {
    it('deletes only within the organization', async () => {
      await expect(service.disconnect('org-1', 'project-1')).resolves.toEqual({
        disconnected: true,
      });
      expect(prisma.integrationConnection.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      });
    });

    it('reports when there was nothing to disconnect', async () => {
      prisma.integrationConnection.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.disconnect('org-1', 'project-1')).resolves.toEqual({
        disconnected: false,
      });
    });
  });
});
