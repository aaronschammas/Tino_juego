import { Priority, TaskStatus } from '@prisma/client';
import { NormalizedSnapshot } from '../../integration.types';
import { ExistingImportState } from '../../sync/integration-sync.service';
import { buildTrelloPreview } from './trello-preview';

describe('buildTrelloPreview', () => {
  const snapshot: NormalizedSnapshot = {
    container: {
      externalId: 'board-1',
      name: 'Board',
      description: 'Desc',
      url: 'https://trello.example/b',
    },
    groups: [
      { externalId: 'l1', name: 'To do' },
      { externalId: 'l2', name: 'QA' },
    ],
    items: [
      {
        externalId: 'c1',
        title: 'Card 1',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        groupExternalId: 'l1',
        groupName: 'To do',
        isCompleted: false,
        subItems: [
          {
            externalId: 's1',
            title: 'A',
            groupName: 'Deploy',
            status: TaskStatus.TODO,
          },
          {
            externalId: 's2',
            title: 'B',
            groupName: 'Deploy',
            status: TaskStatus.DONE,
          },
          {
            externalId: 's3',
            title: 'C',
            groupName: 'QA',
            status: TaskStatus.TODO,
          },
        ],
      },
      {
        externalId: 'c2',
        title: 'Card 2',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        groupExternalId: 'l2',
        groupName: 'QA',
        isCompleted: false,
        subItems: [],
        statusWarning: 'La lista "QA" se importara como TODO',
      },
    ],
  };
  const existing = (
    overrides: Partial<ExistingImportState> = {},
  ): ExistingImportState => ({
    containerProject: null,
    duplicateItemIds: new Set(),
    duplicateSubItemIds: new Set(),
    ...overrides,
  });

  it('counts lists, cards, checklists and subtasks', () => {
    const preview = buildTrelloPreview(
      'NEW_PROJECT',
      snapshot,
      existing(),
      null,
    );

    expect(preview.board).toEqual({
      id: 'board-1',
      name: 'Board',
      description: 'Desc',
      url: 'https://trello.example/b',
    });
    expect(preview.totals).toEqual({
      lists: 2,
      cards: 2,
      checklists: 2,
      subtasks: 3,
      newTasks: 2,
      duplicateTasks: 0,
      newSubtasks: 3,
      duplicateSubtasks: 0,
      warnings: 1,
    });
    expect(preview.warnings).toEqual(['La lista "QA" se importara como TODO']);
    expect(preview.tasks[0]).toEqual(
      expect.objectContaining({
        id: 'c1',
        listName: 'To do',
        dueDate: '2026-10-01T00:00:00.000Z',
        duplicate: false,
      }),
    );
  });

  it('blocks a new project when the board already has a project', () => {
    const preview = buildTrelloPreview(
      'NEW_PROJECT',
      snapshot,
      existing({ containerProject: { id: 'p', name: 'Board' } }),
      null,
    );

    expect(preview.alreadyImported).toBe(true);
    expect(preview.importDisabled).toBe(true);
  });

  it('marks duplicates when importing into an existing project', () => {
    const preview = buildTrelloPreview(
      'EXISTING_PROJECT',
      snapshot,
      existing({
        duplicateItemIds: new Set(['c1']),
        duplicateSubItemIds: new Set(['s1']),
      }),
      { id: 'p', name: 'Target' },
    );

    expect(preview.alreadyImported).toBe(true);
    expect(preview.targetProject).toEqual({ id: 'p', name: 'Target' });
    expect(preview.totals.duplicateTasks).toBe(1);
    expect(preview.totals.duplicateSubtasks).toBe(1);
    expect(preview.tasks[0].duplicate).toBe(true);
    expect(preview.tasks[0].subtasks[0].duplicate).toBe(true);
  });
});
