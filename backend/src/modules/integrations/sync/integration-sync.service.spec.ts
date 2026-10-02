/**
 * Tests del motor de sincronizacion. Usa fuentes inventadas (FAKE_*) para
 * comprobar que no depende de los valores de Trello, y una "base" en memoria
 * (`tasks`) donde `createMany` guarda filas y `findMany` las filtra por
 * proyecto y fuente.
 */
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ExternalSources, NormalizedSnapshot } from '../integration.types';
import {
  ExistingImportState,
  IntegrationSyncService,
} from './integration-sync.service';

describe('IntegrationSyncService', () => {
  const sources: ExternalSources = {
    container: 'FAKE_CONTAINER',
    item: 'FAKE_ITEM',
    subItem: 'FAKE_SUB_ITEM',
    comment: 'FAKE_COMMENT',
  };
  const snapshot: NormalizedSnapshot = {
    container: { externalId: 'c-1', name: 'Container', description: 'Desc' },
    groups: [{ externalId: 'g-1', name: 'Todo' }],
    items: [
      {
        externalId: 'i-1',
        title: 'Item 1',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        externalUrl: 'https://example.test/i-1',
        groupExternalId: 'g-1',
        groupName: 'Todo',
        isCompleted: false,
        subItems: [
          {
            externalId: 's-1',
            title: 'Sub 1',
            description: 'Sub desc',
            groupName: 'Checklist',
            status: TaskStatus.DONE,
          },
          {
            externalId: 's-2',
            title: 'Sub 2',
            groupName: 'Checklist',
            status: TaskStatus.TODO,
          },
        ],
      },
      {
        externalId: 'i-2',
        title: 'Item 2',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        groupExternalId: 'g-1',
        groupName: 'Todo',
        isCompleted: false,
        subItems: [],
      },
    ],
  };
  const noExisting = (): ExistingImportState => ({
    containerProject: null,
    duplicateItemIds: new Set(),
    duplicateSubItemIds: new Set(),
  });

  interface TaskRowInput {
    projectId: string;
    externalSource: string;
    externalId: string;
    parentTaskId?: string;
    [field: string]: unknown;
  }
  type TaskRow = TaskRowInput & { id: string };
  interface TaskWhere {
    where: { projectId: string; externalSource: string };
  }

  let tasks: TaskRow[];
  let tx: {
    project: {
      create: jest.Mock<
        Promise<{ id: string; name: string }>,
        [{ data: Record<string, unknown> & { name: string } }]
      >;
    };
    projectMember: { create: jest.Mock };
    task: { createMany: jest.Mock; findMany: jest.Mock };
    taskComment: { createMany: jest.Mock };
  };
  let prisma: {
    project: { findFirst: jest.Mock };
    task: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: IntegrationSyncService;

  beforeEach(() => {
    tasks = [];
    tx = {
      project: {
        create: jest.fn(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: 'project-new', name: data.name }),
        ),
      },
      projectMember: { create: jest.fn().mockResolvedValue({}) },
      taskComment: {
        createMany: jest.fn(({ data }: { data: unknown[] }) =>
          Promise.resolve({ count: data.length }),
        ),
      },
      task: {
        createMany: jest.fn(({ data }: { data: TaskRowInput[] }) => {
          data.forEach((row) =>
            tasks.push({ ...row, id: `task-${tasks.length + 1}` }),
          );
          return Promise.resolve({ count: data.length });
        }),
        findMany: jest.fn(({ where }: TaskWhere) =>
          Promise.resolve(
            tasks
              .filter(
                (task) =>
                  task.projectId === where.projectId &&
                  task.externalSource === where.externalSource,
              )
              .map((task) => ({ id: task.id, externalId: task.externalId })),
          ),
        ),
      },
    };
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    service = new IntegrationSyncService(prisma as unknown as PrismaService);
  });

  const findTask = (externalId: string) =>
    tasks.find((task) => task.externalId === externalId);

  const baseInput = () => ({
    provider: 'TRELLO' as const,
    sources,
    snapshot,
    organizationId: 'org-1',
    userId: 'user-1',
    existing: noExisting(),
    failureMessage: 'Fallo la importacion',
  });

  describe('findExisting', () => {
    it('queries by organization and provider sources and returns id sets', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'p-1',
        name: 'Container',
      });
      prisma.task.findMany
        .mockResolvedValueOnce([{ externalId: 'i-1' }, { externalId: null }])
        .mockResolvedValueOnce([{ externalId: 's-2' }]);

      const existing = await service.findExisting('org-1', sources, snapshot);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          externalSource: 'FAKE_CONTAINER',
          externalId: 'c-1',
        },
        select: { id: true, name: true },
      });
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          externalSource: 'FAKE_ITEM',
          externalId: { in: ['i-1', 'i-2'] },
        },
        select: { externalId: true },
      });
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          externalSource: 'FAKE_SUB_ITEM',
          externalId: { in: ['s-1', 's-2'] },
        },
        select: { externalId: true },
      });
      expect(existing.containerProject).toEqual({
        id: 'p-1',
        name: 'Container',
      });
      expect([...existing.duplicateItemIds]).toEqual(['i-1']);
      expect([...existing.duplicateSubItemIds]).toEqual(['s-2']);
    });
  });

  describe('findTargetProject', () => {
    it('only returns active projects of the organization', async () => {
      await service.findTargetProject('org-1', 'p-9');

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'p-9', organizationId: 'org-1', isActive: true },
        select: { id: true, name: true, organizationId: true },
      });
    });
  });

  describe('importSnapshot', () => {
    it('creates the project with its owner, tasks and sub tasks', async () => {
      const result = await service.importSnapshot(baseInput());

      expect(tx.project.create).toHaveBeenCalledTimes(1);
      expect(tx.project.create.mock.calls[0][0]).toMatchObject({
        data: {
          name: 'Container',
          description: 'Desc',
          externalSource: 'FAKE_CONTAINER',
          externalId: 'c-1',
          ownerId: 'user-1',
          organizationId: 'org-1',
        },
        select: { id: true, name: true },
      });
      expect(tx.projectMember.create).toHaveBeenCalledWith({
        data: { projectId: 'project-new', userId: 'user-1', role: 'OWNER' },
      });
      expect(result).toEqual({
        project: { id: 'project-new', name: 'Container' },
        createdProject: true,
        createdTasks: 2,
        createdSubtasks: 2,
        createdComments: 0,
        skippedTasks: 0,
        skippedSubtasks: 0,
      });

      expect(findTask('s-1')).toEqual(
        expect.objectContaining({
          externalSource: 'FAKE_SUB_ITEM',
          parentTaskId: findTask('i-1')?.id,
          description: 'Sub desc',
          status: TaskStatus.DONE,
          priority: Priority.HIGH,
          dueDate: snapshot.items[0].dueDate,
        }),
      );
    });

    it('imports into an existing project without creating a new one', async () => {
      const result = await service.importSnapshot({
        ...baseInput(),
        targetProjectId: 'project-target',
      });

      expect(tx.project.create).not.toHaveBeenCalled();
      expect(result.createdProject).toBe(false);
      expect(result.project).toBeNull();
      expect(tasks.every((task) => task.projectId === 'project-target')).toBe(
        true,
      );
    });

    it('skips duplicates but still attaches new sub tasks to an existing parent', async () => {
      tasks.push({
        id: 'existing-parent',
        projectId: 'project-target',
        externalSource: 'FAKE_ITEM',
        externalId: 'i-1',
      });

      const result = await service.importSnapshot({
        ...baseInput(),
        targetProjectId: 'project-target',
        existing: {
          containerProject: null,
          duplicateItemIds: new Set(['i-1']),
          duplicateSubItemIds: new Set(['s-1']),
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          createdTasks: 1,
          createdSubtasks: 1,
          skippedTasks: 1,
          skippedSubtasks: 1,
        }),
      );
      expect(findTask('s-2')?.parentTaskId).toBe('existing-parent');
    });

    it('stores the external url and group on parent tasks', async () => {
      await service.importSnapshot(baseInput());

      expect(findTask('i-1')?.externalUrl).toBe('https://example.test/i-1');
      expect(findTask('i-1')?.externalGroupId).toBe('g-1');
      expect(findTask('i-1')?.externalSnapshot).toEqual({
        title: 'Item 1',
        description: '',
        dueDate: '2026-10-01T00:00:00.000Z',
        priority: Priority.HIGH,
        groupExternalId: 'g-1',
        isCompleted: false,
      });
      expect(findTask('s-1')?.externalSnapshot).toEqual({
        title: 'Sub 1',
        status: TaskStatus.DONE,
      });
    });

    it('imports comments of imported tasks with their external author', async () => {
      const createdAt = new Date('2026-09-20T10:00:00.000Z');
      const result = await service.importSnapshot({
        ...baseInput(),
        snapshot: {
          ...snapshot,
          comments: [
            {
              externalId: 'a-1',
              itemExternalId: 'i-1',
              text: 'Primer comentario',
              authorName: 'Ana',
              createdAt,
            },
            {
              externalId: 'a-2',
              itemExternalId: 'unknown-card',
              text: 'Sin tarea',
              authorName: null,
            },
          ],
        },
      });

      expect(result.createdComments).toBe(1);
      expect(tx.taskComment.createMany).toHaveBeenCalledWith({
        data: [
          {
            content: 'Primer comentario',
            taskId: findTask('i-1')?.id,
            organizationId: 'org-1',
            externalSource: 'FAKE_COMMENT',
            externalId: 'a-1',
            externalAuthorName: 'Ana',
            createdAt,
          },
        ],
        skipDuplicates: true,
      });
    });

    it('does not touch comments when the snapshot has none', async () => {
      await service.importSnapshot(baseInput());

      expect(tx.taskComment.createMany).not.toHaveBeenCalled();
    });

    it('runs onProjectReady inside the transaction with the created project', async () => {
      const onProjectReady = jest.fn().mockResolvedValue(undefined);

      await service.importSnapshot({ ...baseInput(), onProjectReady });

      expect(onProjectReady).toHaveBeenCalledWith(tx, 'project-new');
      expect(onProjectReady.mock.invocationCallOrder[0]).toBeLessThan(
        tx.task.createMany.mock.invocationCallOrder[0],
      );
    });

    it('runs onProjectReady with the existing target project', async () => {
      const onProjectReady = jest.fn().mockResolvedValue(undefined);

      await service.importSnapshot({
        ...baseInput(),
        targetProjectId: 'project-target',
        onProjectReady,
      });

      expect(onProjectReady).toHaveBeenCalledWith(tx, 'project-target');
    });

    it('rolls back when onProjectReady fails', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const onProjectReady = jest
        .fn()
        .mockRejectedValue(new Error('unique violation'));

      await expect(
        service.importSnapshot({ ...baseInput(), onProjectReady }),
      ).rejects.toEqual(
        new InternalServerErrorException('Fallo la importacion'),
      );
      expect(tx.task.createMany).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('does not call createMany when there is nothing new', async () => {
      await service.importSnapshot({
        ...baseInput(),
        snapshot: { ...snapshot, items: [] },
        targetProjectId: 'project-target',
      });

      expect(tx.task.createMany).not.toHaveBeenCalled();
    });

    it('wraps failures with the provider message and logs no raw error text', async () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      tx.task.createMany.mockRejectedValueOnce(
        Object.assign(new Error('secret raw prisma message'), {
          code: 'P2002',
        }),
      );

      await expect(service.importSnapshot(baseInput())).rejects.toEqual(
        new InternalServerErrorException('Fallo la importacion'),
      );

      const logged = loggerSpy.mock.calls.flat().join(' ');
      expect(logged).toContain('provider=TRELLO');
      expect(logged).toContain('code=P2002');
      expect(logged).not.toContain('secret raw prisma message');
      loggerSpy.mockRestore();
    });
  });
});
