import { Priority, TaskStatus } from '@prisma/client';
import { NormalizedItem, NormalizedSnapshot } from '../integration.types';
import {
  applyStatusMapping,
  findUnmappedGroups,
  StatusMapping,
  suggestStatusMapping,
} from './status-mapping';

describe('status-mapping', () => {
  const item = (overrides: Partial<NormalizedItem>): NormalizedItem => ({
    externalId: 'card',
    title: 'Card',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    groupExternalId: 'list-qa',
    groupName: 'QA',
    isCompleted: false,
    subItems: [],
    statusWarning: 'La lista "QA" se importara como TODO',
    ...overrides,
  });
  const snapshot: NormalizedSnapshot = {
    container: { externalId: 'board', name: 'Board', description: '' },
    groups: [
      { externalId: 'list-doing', name: 'En progreso' },
      { externalId: 'list-qa', name: 'QA' },
      { externalId: 'list-empty', name: 'Hecho' },
    ],
    items: [
      item({
        externalId: 'c1',
        groupExternalId: 'list-doing',
        groupName: 'En progreso',
        status: TaskStatus.IN_PROGRESS,
        statusWarning: undefined,
      }),
      item({ externalId: 'c2' }),
      item({ externalId: 'c3', isCompleted: true, status: TaskStatus.DONE }),
    ],
  };

  it('suggests a status per group with its task count', () => {
    expect(suggestStatusMapping(snapshot)).toEqual([
      {
        externalGroupId: 'list-doing',
        name: 'En progreso',
        suggestedStatus: TaskStatus.IN_PROGRESS,
        itemCount: 1,
      },
      {
        externalGroupId: 'list-qa',
        name: 'QA',
        suggestedStatus: null,
        itemCount: 2,
      },
      {
        externalGroupId: 'list-empty',
        name: 'Hecho',
        suggestedStatus: TaskStatus.DONE,
        itemCount: 0,
      },
    ]);
  });

  it('lists the groups without a chosen status', () => {
    const mapping: StatusMapping = new Map([
      ['list-doing', TaskStatus.IN_PROGRESS],
    ]);

    expect(
      findUnmappedGroups(snapshot.groups, mapping).map((g) => g.externalId),
    ).toEqual(['list-qa', 'list-empty']);
  });

  it('applies the chosen status, keeps completed items DONE and clears warnings', () => {
    const mapping: StatusMapping = new Map([
      ['list-doing', TaskStatus.TODO],
      ['list-qa', TaskStatus.BLOCKED],
    ]);

    const mapped = applyStatusMapping(snapshot, mapping);

    expect(mapped.items.map((i) => [i.externalId, i.status])).toEqual([
      ['c1', TaskStatus.TODO],
      ['c2', TaskStatus.BLOCKED],
      ['c3', TaskStatus.DONE],
    ]);
    expect(mapped.items[1].statusWarning).toBeUndefined();
  });

  it('keeps the original status and warning for groups left unmapped', () => {
    const mapped = applyStatusMapping(snapshot, new Map());

    expect(mapped.items[1].status).toBe(TaskStatus.TODO);
    expect(mapped.items[1].statusWarning).toBe(
      'La lista "QA" se importara como TODO',
    );
  });

  it('does not mutate the original snapshot', () => {
    applyStatusMapping(snapshot, new Map([['list-qa', TaskStatus.DONE]]));

    expect(snapshot.items[1].status).toBe(TaskStatus.TODO);
  });
});
