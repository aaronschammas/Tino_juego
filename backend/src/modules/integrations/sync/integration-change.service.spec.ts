/**
 * Tests del motor que aplica cambios externos. Prisma esta simulado; lo central
 * es la regla de convivencia: cada cambio escribe solo los campos que trae.
 * Tambien cubre las novedades (`IntegrationActivity`) que alimentan el cartel de
 * la app y el resumen diario por WhatsApp.
 */
import { Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NormalizedItem } from '../integration.types';
import { ChangeContext } from './external-change';
import { IntegrationChangeService } from './integration-change.service';

describe('IntegrationChangeService', () => {
  const context: ChangeContext = {
    connectionId: 'conn-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    sources: {
      container: 'FAKE_CONTAINER',
      item: 'FAKE_ITEM',
      subItem: 'FAKE_SUB_ITEM',
      comment: 'FAKE_COMMENT',
    },
  };
  const existingTask = {
    id: 'task-1',
    status: TaskStatus.TODO,
    archivedAt: null,
    externalGroupId: 'g-todo',
    priority: Priority.HIGH,
    dueDate: null,
  };
  let prisma: {
    task: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    taskComment: { upsert: jest.Mock; updateMany: jest.Mock };
    integrationStatusMapping: { findUnique: jest.Mock; upsert: jest.Mock };
    integrationActivity: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: IntegrationChangeService;

  interface WriteArgs {
    where?: unknown;
    data: Record<string, unknown>;
    create?: Record<string, unknown>;
    select?: unknown;
  }
  const argsOf = (mock: jest.Mock): WriteArgs[] =>
    (mock.mock.calls as [WriteArgs][]).map(([args]) => args);

  const updateData = () =>
    (prisma.task.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
      .data;

  beforeEach(() => {
    prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(existingTask),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'task-new' }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      taskComment: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      integrationStatusMapping: {
        findUnique: jest.fn().mockResolvedValue({ status: TaskStatus.BLOCKED }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      integrationActivity: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
    };
    service = new IntegrationChangeService(prisma as unknown as PrismaService);
  });

  describe('ITEM_UPDATED', () => {
    it('writes only the fields that changed', async () => {
      await expect(
        service.apply(context, {
          kind: 'ITEM_UPDATED',
          externalId: 'card-1',
          changes: { title: 'Nuevo titulo' },
        }),
      ).resolves.toBe('APPLIED');

      expect(updateData()).toEqual({ title: 'Nuevo titulo' });
      expect(prisma.integrationStatusMapping.findUnique).not.toHaveBeenCalled();
    });

    it('merges the changed fields into the stored snapshot', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...existingTask,
        externalSnapshot: {
          title: 'Viejo',
          description: 'Desc',
          dueDate: null,
          priority: Priority.HIGH,
          groupExternalId: 'g-todo',
          isCompleted: false,
        },
      });

      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { title: 'Nuevo', description: null },
      });

      expect(updateData()).toEqual({
        title: 'Nuevo',
        description: null,
        externalSnapshot: {
          title: 'Nuevo',
          description: '',
          dueDate: null,
          priority: Priority.HIGH,
          groupExternalId: 'g-todo',
          isCompleted: false,
        },
      });
    });

    it('stores the snapshot even when no visible field changes', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...existingTask,
        externalSnapshot: {
          title: 'T',
          description: '',
          dueDate: null,
          priority: Priority.HIGH,
          groupExternalId: 'g-todo',
          isCompleted: true,
        },
      });
      prisma.integrationStatusMapping.findUnique.mockResolvedValue({
        status: null,
      });

      await expect(
        service.apply(context, {
          kind: 'ITEM_UPDATED',
          externalId: 'card-1',
          changes: { isCompleted: false },
        }),
      ).resolves.toBe('IGNORED');
      expect(updateData()).toEqual({
        externalSnapshot: expect.objectContaining({
          isCompleted: false,
        }) as unknown,
      });
    });

    it('records a snapshot without touching other fields', async () => {
      await service.recordSnapshot('task-1', {
        title: 'T',
        status: TaskStatus.TODO,
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { externalSnapshot: { title: 'T', status: TaskStatus.TODO } },
      });
    });

    it('moving to another list applies that list status and keeps the title', async () => {
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { groupExternalId: 'g-blocked' },
      });

      expect(updateData()).toEqual({
        externalGroupId: 'g-blocked',
        status: TaskStatus.BLOCKED,
      });
      expect(prisma.integrationStatusMapping.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            connectionId_externalGroupId: {
              connectionId: 'conn-1',
              externalGroupId: 'g-blocked',
            },
          },
        }),
      );
    });

    it('keeps the status when the new list has no status defined yet', async () => {
      prisma.integrationStatusMapping.findUnique.mockResolvedValue({
        status: null,
      });

      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { groupExternalId: 'g-new' },
      });

      expect(updateData()).toEqual({ externalGroupId: 'g-new' });
    });

    it('marking as completed sets DONE and unmarking returns to the current list status', async () => {
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { isCompleted: true },
      });
      expect(updateData()).toEqual({ status: TaskStatus.DONE });

      prisma.task.update.mockClear();
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { isCompleted: false },
      });
      expect(updateData()).toEqual({ status: TaskStatus.BLOCKED });
      expect(prisma.integrationStatusMapping.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            connectionId_externalGroupId: {
              connectionId: 'conn-1',
              externalGroupId: 'g-todo',
            },
          },
        }),
      );
    });

    it('can clear the due date and description', async () => {
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { dueDate: null, description: null },
      });

      expect(updateData()).toEqual({ dueDate: null, description: null });
    });

    it('ignores cards that are not in the connected project', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.apply(context, {
          kind: 'ITEM_UPDATED',
          externalId: 'card-x',
          changes: { title: 'x' },
        }),
      ).resolves.toBe('IGNORED');
      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            projectId: 'project-1',
            externalSource: 'FAKE_ITEM',
            externalId: 'card-x',
            parentTaskId: null,
          },
        }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('ITEM_CREATED', () => {
    const item: NormalizedItem = {
      externalId: 'card-2',
      title: 'Nueva',
      status: TaskStatus.TODO,
      priority: Priority.LOW,
      groupExternalId: 'g-blocked',
      groupName: 'Bloqueado',
      isCompleted: false,
      externalUrl: 'https://trello.example/c/2',
      sourceDescription: 'Texto original',
      subItems: [
        {
          externalId: 's-1',
          title: 'Paso',
          groupName: 'Checklist',
          status: TaskStatus.DONE,
        },
      ],
    };

    it('creates the task with the list status and its sub tasks', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.apply(context, { kind: 'ITEM_CREATED', item }),
      ).resolves.toBe('APPLIED');

      expect(argsOf(prisma.task.create)[0].data.externalSnapshot).toEqual({
        title: 'Nueva',
        description: 'Texto original',
        dueDate: null,
        priority: Priority.LOW,
        groupExternalId: 'g-blocked',
        isCompleted: false,
      });
      expect(argsOf(prisma.task.create)[0]).toMatchObject({
        data: {
          title: 'Nueva',
          status: TaskStatus.BLOCKED,
          externalSource: 'FAKE_ITEM',
          externalId: 'card-2',
          externalGroupId: 'g-blocked',
          externalUrl: 'https://trello.example/c/2',
          projectId: 'project-1',
        },
        select: { id: true },
      });
      expect(prisma.task.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            externalSource: 'FAKE_SUB_ITEM',
            externalId: 's-1',
            parentTaskId: 'task-new',
            status: TaskStatus.DONE,
            priority: Priority.LOW,
          }),
        ],
        skipDuplicates: true,
      });
    });

    it('registers an unknown list and uses its guessed status', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.integrationStatusMapping.findUnique.mockResolvedValue(null);

      await service.apply(context, { kind: 'ITEM_CREATED', item });

      expect(
        argsOf(prisma.integrationStatusMapping.upsert)[0].create,
      ).toMatchObject({
        externalGroupId: 'g-blocked',
        externalGroupName: 'Bloqueado',
        status: TaskStatus.BLOCKED,
      });
      expect(argsOf(prisma.task.create)[0].data.status).toBe(
        TaskStatus.BLOCKED,
      );
    });

    it('only restores a card that already exists (moved back to the board)', async () => {
      await service.apply(context, { kind: 'ITEM_CREATED', item });

      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ id: 'task-1' }, { parentTaskId: 'task-1' }] },
        data: { archivedAt: null },
      });
    });
  });

  describe('ITEM_ARCHIVED', () => {
    it('archives the task and its sub tasks instead of deleting them', async () => {
      await service.apply(context, {
        kind: 'ITEM_ARCHIVED',
        externalId: 'card-1',
        archived: true,
      });

      const [[call]] = prisma.task.updateMany.mock.calls as [
        [{ where: unknown; data: { archivedAt: Date | null } }],
      ];
      expect(call.where).toEqual({
        OR: [{ id: 'task-1' }, { parentTaskId: 'task-1' }],
      });
      expect(call.data.archivedAt).toBeInstanceOf(Date);
    });

    it('restores an unarchived card', async () => {
      await service.apply(context, {
        kind: 'ITEM_ARCHIVED',
        externalId: 'card-1',
        archived: false,
      });

      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { archivedAt: null } }),
      );
    });
  });

  describe('SUBITEMS_SYNCED', () => {
    it('creates new items, archives removed ones and restores returning ones', async () => {
      prisma.task.findMany.mockResolvedValue([
        { id: 'st-keep', externalId: 's-keep', archivedAt: null },
        { id: 'st-gone', externalId: 's-gone', archivedAt: null },
        { id: 'st-back', externalId: 's-back', archivedAt: new Date() },
      ]);

      await service.apply(context, {
        kind: 'SUBITEMS_SYNCED',
        itemExternalId: 'card-1',
        subItems: ['s-keep', 's-back', 's-new'].map((externalId) => ({
          externalId,
          title: externalId,
          groupName: 'Checklist',
          status: TaskStatus.TODO,
        })),
      });

      expect(prisma.task.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            externalId: 's-new',
            parentTaskId: 'task-1',
          }),
        ],
        skipDuplicates: true,
      });
      const archived = argsOf(prisma.task.updateMany).find(
        (args) =>
          JSON.stringify(args.where) ===
          JSON.stringify({ id: { in: ['st-gone'] } }),
      );
      expect(archived?.data.archivedAt).toBeInstanceOf(Date);
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['st-back'] } },
        data: { archivedAt: null },
      });
    });
  });

  describe('SUBITEM_UPDATED', () => {
    it('updates the state of a checklist item and its snapshot', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 'st-1',
        externalSnapshot: { title: 'Paso', status: TaskStatus.TODO },
      });

      await expect(
        service.apply(context, {
          kind: 'SUBITEM_UPDATED',
          externalId: 's-1',
          changes: { status: TaskStatus.DONE },
        }),
      ).resolves.toBe('APPLIED');

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          projectId: 'project-1',
          externalSource: 'FAKE_SUB_ITEM',
          externalId: 's-1',
        },
        select: { id: true, externalSnapshot: true },
      });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: {
          status: TaskStatus.DONE,
          externalSnapshot: { title: 'Paso', status: TaskStatus.DONE },
        },
      });
    });

    it('keeps updating sub tasks imported before snapshots existed', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 'st-old',
        externalSnapshot: null,
      });

      await service.apply(context, {
        kind: 'SUBITEM_UPDATED',
        externalId: 's-old',
        changes: { title: 'Nuevo' },
      });

      expect(updateData()).toEqual({ title: 'Nuevo' });
    });

    it('ignores unknown checklist items', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.apply(context, {
          kind: 'SUBITEM_UPDATED',
          externalId: 's-x',
          changes: { title: 'x' },
        }),
      ).resolves.toBe('IGNORED');
    });
  });

  describe('comments', () => {
    it('upserts a comment with the external author name', async () => {
      const createdAt = new Date('2026-09-25T10:00:00.000Z');

      await service.apply(context, {
        kind: 'COMMENT_UPSERTED',
        externalId: 'action-1',
        itemExternalId: 'card-1',
        text: 'Hola',
        authorName: 'Ana Trello',
        createdAt,
      });

      expect(prisma.taskComment.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_externalSource_externalId: {
            organizationId: 'org-1',
            externalSource: 'FAKE_COMMENT',
            externalId: 'action-1',
          },
        },
        create: {
          content: 'Hola',
          taskId: 'task-1',
          organizationId: 'org-1',
          externalSource: 'FAKE_COMMENT',
          externalId: 'action-1',
          externalAuthorName: 'Ana Trello',
          createdAt,
        },
        update: { content: 'Hola' },
      });
    });

    it('soft deletes a comment', async () => {
      await service.apply(context, {
        kind: 'COMMENT_DELETED',
        externalId: 'action-1',
      });

      const [deleted] = argsOf(prisma.taskComment.updateMany);
      expect(deleted.where).toEqual({
        organizationId: 'org-1',
        externalSource: 'FAKE_COMMENT',
        externalId: 'action-1',
        deletedAt: null,
      });
      expect(deleted.data.deletedAt).toBeInstanceOf(Date);
      expect(deleted.data.content).toBe('');
    });
  });

  describe('activity (novedades)', () => {
    const activityData = () =>
      argsOf(prisma.integrationActivity.create)[0].data;
    const item: NormalizedItem = {
      externalId: 'card-3',
      title: 'Tarea nueva',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      groupExternalId: 'g-blocked',
      groupName: 'Bloqueado',
      isCompleted: false,
      subItems: [],
    };

    it('records a created task with its status and who created it', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await service.apply(
        { ...context, actorName: 'Ana' },
        {
          kind: 'ITEM_CREATED',
          item,
        },
      );

      expect(activityData()).toEqual({
        organizationId: 'org-1',
        projectId: 'project-1',
        taskId: 'task-new',
        kind: 'TASK_CREATED',
        fromStatus: null,
        toStatus: TaskStatus.BLOCKED,
        actorName: 'Ana',
      });
    });

    it('does not record anything when an existing card is only restored', async () => {
      await service.apply(context, { kind: 'ITEM_CREATED', item });

      expect(prisma.integrationActivity.create).not.toHaveBeenCalled();
    });

    it('records a status change with the previous and the new status', async () => {
      await service.apply(
        { ...context, actorName: 'Luis' },
        {
          kind: 'ITEM_UPDATED',
          externalId: 'card-1',
          changes: { groupExternalId: 'g-blocked' },
        },
      );

      expect(activityData()).toMatchObject({
        taskId: 'task-1',
        kind: 'STATUS_CHANGED',
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.BLOCKED,
        actorName: 'Luis',
      });
    });

    it('stores a null actor when the change comes from the daily review', async () => {
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { isCompleted: true },
      });

      expect(activityData()).toMatchObject({
        kind: 'STATUS_CHANGED',
        toStatus: TaskStatus.DONE,
        actorName: null,
      });
    });

    it('does not record a status change when the status stays the same', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.BLOCKED,
      });

      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { groupExternalId: 'g-blocked-2' },
      });

      expect(prisma.integrationActivity.create).not.toHaveBeenCalled();
    });

    it('does not record field edits that are not a status change', async () => {
      await service.apply(context, {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { title: 'Otro titulo' },
      });

      expect(prisma.integrationActivity.create).not.toHaveBeenCalled();
    });

    it('records an archived task only once and never a restore', async () => {
      await service.apply(context, {
        kind: 'ITEM_ARCHIVED',
        externalId: 'card-1',
        archived: true,
      });
      expect(activityData()).toMatchObject({
        taskId: 'task-1',
        kind: 'TASK_ARCHIVED',
      });

      prisma.integrationActivity.create.mockClear();
      prisma.task.findFirst.mockResolvedValue({
        ...existingTask,
        archivedAt: new Date(),
      });
      await service.apply(context, {
        kind: 'ITEM_ARCHIVED',
        externalId: 'card-1',
        archived: true,
      });
      await service.apply(context, {
        kind: 'ITEM_ARCHIVED',
        externalId: 'card-1',
        archived: false,
      });
      expect(prisma.integrationActivity.create).not.toHaveBeenCalled();
    });
  });

  describe('GROUP_UPSERTED', () => {
    it('creates new lists with a guessed status and only renames existing ones', async () => {
      await service.apply(context, {
        kind: 'GROUP_UPSERTED',
        externalId: 'g-qa',
        name: 'QA',
      });

      expect(prisma.integrationStatusMapping.upsert).toHaveBeenCalledWith({
        where: {
          connectionId_externalGroupId: {
            connectionId: 'conn-1',
            externalGroupId: 'g-qa',
          },
        },
        create: {
          connectionId: 'conn-1',
          externalGroupId: 'g-qa',
          externalGroupName: 'QA',
          status: null,
        },
        update: { externalGroupName: 'QA' },
      });
    });
  });
});
