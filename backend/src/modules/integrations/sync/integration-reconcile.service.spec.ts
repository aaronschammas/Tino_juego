/**
 * Tests de la revision de respaldo. El motor de cambios esta simulado y registra
 * cada cambio pedido; Prisma devuelve lo que "ya existe" en Tino. Lo central es
 * que se aplique solo lo que cambio en el proveedor respecto del ultimo estado
 * visto, nunca lo editado en Tino.
 */
import { Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NormalizedItem, NormalizedSnapshot } from '../integration.types';
import { ChangeContext, ExternalChange } from './external-change';
import { IntegrationChangeService } from './integration-change.service';
import { IntegrationReconcileService } from './integration-reconcile.service';
import { ItemSnapshot } from './item-snapshot';

describe('IntegrationReconcileService', () => {
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
  const item = (overrides: Partial<NormalizedItem> = {}): NormalizedItem => ({
    externalId: 'card-1',
    title: 'Tarjeta',
    sourceDescription: 'Detalle',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    groupExternalId: 'l-todo',
    groupName: 'Por hacer',
    isCompleted: false,
    subItems: [],
    ...overrides,
  });
  const seen: ItemSnapshot = {
    title: 'Tarjeta',
    description: 'Detalle',
    dueDate: null,
    priority: Priority.MEDIUM,
    groupExternalId: 'l-todo',
    isCompleted: false,
  };
  const snapshotOf = (
    items: NormalizedItem[],
    extra: Partial<NormalizedSnapshot> = {},
  ): NormalizedSnapshot => ({
    container: { externalId: 'board-1', name: 'Board', description: '' },
    groups: [{ externalId: 'l-todo', name: 'Por hacer' }],
    items,
    ...extra,
  });
  const parentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'task-1',
    externalId: 'card-1',
    externalSource: 'FAKE_ITEM',
    parentTaskId: null,
    archivedAt: null,
    externalSnapshot: seen,
    ...overrides,
  });

  let prisma: {
    integrationStatusMapping: { findMany: jest.Mock };
    task: { findMany: jest.Mock };
    taskComment: { findMany: jest.Mock };
  };
  let changes: { apply: jest.Mock; recordSnapshot: jest.Mock };
  let service: IntegrationReconcileService;

  const applied = () =>
    (changes.apply.mock.calls as [ChangeContext, ExternalChange][]).map(
      ([, change]) => change,
    );
  const appliedOfKind = (kind: ExternalChange['kind']) =>
    applied().filter((change) => change.kind === kind);

  beforeEach(() => {
    prisma = {
      integrationStatusMapping: {
        findMany: jest.fn().mockResolvedValue([{ externalGroupId: 'l-todo' }]),
      },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      taskComment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    changes = {
      apply: jest.fn().mockResolvedValue('APPLIED'),
      recordSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    service = new IntegrationReconcileService(
      prisma as unknown as PrismaService,
      changes as unknown as IntegrationChangeService,
    );
  });

  it('creates the cards that are missing in Tino', async () => {
    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([item()]),
    );

    expect(appliedOfKind('ITEM_CREATED')).toEqual([
      { kind: 'ITEM_CREATED', item: item() },
    ]);
    expect(stats.created).toBe(1);
  });

  it('does not touch a task whose provider values did not change, even if it was edited in Tino', async () => {
    prisma.task.findMany.mockResolvedValue([parentRow()]);

    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([item()]),
    );

    expect(appliedOfKind('ITEM_UPDATED')).toEqual([]);
    expect(stats.updated).toBe(0);
  });

  it('applies only the fields that changed in the provider', async () => {
    prisma.task.findMany.mockResolvedValue([parentRow()]);

    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([item({ groupExternalId: 'l-done', title: 'Tarjeta' })]),
    );

    expect(appliedOfKind('ITEM_UPDATED')).toEqual([
      {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { groupExternalId: 'l-done' },
      },
    ]);
    expect(stats.updated).toBe(1);
  });

  it('only records a baseline for tasks imported before snapshots existed', async () => {
    prisma.task.findMany.mockResolvedValue([
      parentRow({ externalSnapshot: null }),
    ]);

    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([item({ title: 'Distinto' })]),
    );

    expect(changes.recordSnapshot).toHaveBeenCalledWith('task-1', {
      ...seen,
      title: 'Distinto',
    });
    expect(appliedOfKind('ITEM_UPDATED')).toEqual([]);
    expect(stats.baselined).toBe(1);
  });

  it('restores archived cards that are back and archives the missing ones', async () => {
    prisma.task.findMany.mockResolvedValue([
      parentRow({ archivedAt: new Date() }),
      parentRow({ id: 'task-2', externalId: 'card-2' }),
      parentRow({ id: 'task-3', externalId: 'card-3', archivedAt: new Date() }),
    ]);

    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([item()]),
    );

    expect(appliedOfKind('ITEM_ARCHIVED')).toEqual([
      { kind: 'ITEM_ARCHIVED', externalId: 'card-1', archived: false },
      { kind: 'ITEM_ARCHIVED', externalId: 'card-2', archived: true },
    ]);
    expect(stats).toEqual(
      expect.objectContaining({ restored: 1, archived: 1 }),
    );
  });

  it('registers every list and counts the new ones', async () => {
    const stats = await service.reconcileSnapshot(
      context,
      snapshotOf([], {
        groups: [
          { externalId: 'l-todo', name: 'Por hacer' },
          { externalId: 'l-qa', name: 'QA' },
        ],
      }),
    );

    expect(appliedOfKind('GROUP_UPSERTED')).toHaveLength(2);
    expect(stats.groupsAdded).toBe(1);
  });

  describe('sub tasks', () => {
    const subRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'st-1',
      externalId: 'ci-1',
      externalSource: 'FAKE_SUB_ITEM',
      parentTaskId: 'task-1',
      archivedAt: null,
      externalSnapshot: { title: 'Paso', status: TaskStatus.TODO },
      ...overrides,
    });
    const withSub = (status: TaskStatus, title = 'Paso') =>
      item({
        subItems: [
          { externalId: 'ci-1', title, groupName: 'Checklist', status },
        ],
      });

    it('syncs the set when items were added or removed', async () => {
      prisma.task.findMany.mockResolvedValue([parentRow()]);

      await service.reconcileSnapshot(
        context,
        snapshotOf([withSub(TaskStatus.TODO)]),
      );

      expect(appliedOfKind('SUBITEMS_SYNCED')).toHaveLength(1);
    });

    it('applies checklist state changes seen only in the provider', async () => {
      prisma.task.findMany.mockResolvedValue([parentRow(), subRow()]);

      const stats = await service.reconcileSnapshot(
        context,
        snapshotOf([withSub(TaskStatus.DONE)]),
      );

      expect(appliedOfKind('SUBITEMS_SYNCED')).toEqual([]);
      expect(appliedOfKind('SUBITEM_UPDATED')).toEqual([
        {
          kind: 'SUBITEM_UPDATED',
          externalId: 'ci-1',
          changes: { status: TaskStatus.DONE },
        },
      ]);
      expect(stats.subtasksChanged).toBe(1);
    });

    it('records a baseline for old sub tasks', async () => {
      prisma.task.findMany.mockResolvedValue([
        parentRow(),
        subRow({ externalSnapshot: null }),
      ]);

      await service.reconcileSnapshot(
        context,
        snapshotOf([withSub(TaskStatus.DONE)]),
      );

      expect(changes.recordSnapshot).toHaveBeenCalledWith('st-1', {
        title: 'Paso',
        status: TaskStatus.DONE,
      });
      expect(appliedOfKind('SUBITEM_UPDATED')).toEqual([]);
    });
  });

  describe('comments', () => {
    const comments = [
      {
        externalId: 'a-new',
        itemExternalId: 'card-1',
        text: 'Nuevo',
        authorName: 'Ana',
      },
      {
        externalId: 'a-edited',
        itemExternalId: 'card-1',
        text: 'Editado',
        authorName: 'Ana',
      },
      {
        externalId: 'a-same',
        itemExternalId: 'card-1',
        text: 'Igual',
        authorName: 'Ana',
      },
      {
        externalId: 'a-deleted',
        itemExternalId: 'card-1',
        text: 'Sigue en Trello',
        authorName: 'Ana',
      },
    ];

    it('adds missing comments, updates edited ones and skips the rest', async () => {
      prisma.task.findMany.mockResolvedValue([parentRow()]);
      prisma.taskComment.findMany.mockResolvedValue([
        { externalId: 'a-edited', content: 'Original', deletedAt: null },
        { externalId: 'a-same', content: 'Igual', deletedAt: null },
        { externalId: 'a-deleted', content: '', deletedAt: new Date() },
      ]);

      const stats = await service.reconcileSnapshot(
        context,
        snapshotOf([item()], { comments }),
      );

      expect(
        appliedOfKind('COMMENT_UPSERTED').map(
          (change) => (change as { externalId: string }).externalId,
        ),
      ).toEqual(['a-new', 'a-edited']);
      expect(stats).toEqual(
        expect.objectContaining({ commentsAdded: 1, commentsUpdated: 1 }),
      );
    });

    it('skips the comments query when the provider has none', async () => {
      await service.reconcileSnapshot(context, snapshotOf([]));

      expect(prisma.taskComment.findMany).not.toHaveBeenCalled();
    });
  });
});
