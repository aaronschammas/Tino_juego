import { Priority, TaskStatus } from '@prisma/client';
import { NormalizedItem } from '../integration.types';
import {
  diffItemSnapshot,
  diffSubItemSnapshot,
  ItemSnapshot,
  mergeItemSnapshot,
  mergeSubItemSnapshot,
  parseItemSnapshot,
  parseSubItemSnapshot,
  toItemSnapshot,
} from './item-snapshot';

describe('item-snapshot', () => {
  const base: ItemSnapshot = {
    title: 'Tarjeta',
    description: 'Detalle',
    dueDate: '2026-10-01T00:00:00.000Z',
    priority: Priority.MEDIUM,
    groupExternalId: 'l-todo',
    isCompleted: false,
  };

  it('builds the snapshot from the provider raw values', () => {
    const item: NormalizedItem = {
      externalId: 'c1',
      title: 'Tarjeta',
      description: 'Detalle\n\nLista Trello original: Por hacer',
      sourceDescription: 'Detalle',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      dueDate: new Date('2026-10-01T00:00:00.000Z'),
      groupExternalId: 'l-todo',
      groupName: 'Por hacer',
      isCompleted: false,
      subItems: [],
    };

    expect(toItemSnapshot(item)).toEqual(base);
    expect(
      toItemSnapshot({
        ...item,
        sourceDescription: undefined,
        dueDate: undefined,
      }),
    ).toEqual({ ...base, description: '', dueDate: null });
  });

  it('returns no changes when nothing changed in the provider', () => {
    expect(diffItemSnapshot(base, { ...base })).toEqual({});
  });

  it('returns only the fields that changed', () => {
    expect(
      diffItemSnapshot(base, {
        ...base,
        title: 'Nueva',
        description: '',
        dueDate: null,
        groupExternalId: 'l-done',
        isCompleted: true,
        priority: Priority.HIGH,
      }),
    ).toEqual({
      title: 'Nueva',
      description: null,
      dueDate: null,
      groupExternalId: 'l-done',
      isCompleted: true,
      priority: Priority.HIGH,
    });
    expect(
      diffItemSnapshot(base, { ...base, dueDate: '2026-11-01T00:00:00.000Z' }),
    ).toEqual({ dueDate: new Date('2026-11-01T00:00:00.000Z') });
  });

  it('merges webhook changes into the stored snapshot', () => {
    expect(
      mergeItemSnapshot(base, {
        title: 'Nueva',
        description: null,
        dueDate: null,
        isCompleted: true,
      }),
    ).toEqual({
      ...base,
      title: 'Nueva',
      description: '',
      dueDate: null,
      isCompleted: true,
    });
    expect(mergeItemSnapshot(null, { title: 'x' })).toBeNull();
  });

  it('diffs and merges sub item snapshots', () => {
    const sub = { title: 'Paso', status: TaskStatus.TODO };

    expect(
      diffSubItemSnapshot(sub, { ...sub, status: TaskStatus.DONE }),
    ).toEqual({
      status: TaskStatus.DONE,
    });
    expect(diffSubItemSnapshot(sub, sub)).toEqual({});
    expect(mergeSubItemSnapshot(sub, { title: 'Otro' })).toEqual({
      title: 'Otro',
      status: TaskStatus.TODO,
    });
    expect(mergeSubItemSnapshot(null, { title: 'Otro' })).toBeNull();
  });

  it('parses stored snapshots and rejects invalid ones', () => {
    expect(parseItemSnapshot({ ...base })).toEqual(base);
    expect(parseItemSnapshot(null)).toBeNull();
    expect(parseItemSnapshot({ ...base, priority: 'URGENT' })).toBeNull();
    expect(parseItemSnapshot({ ...base, isCompleted: 'no' })).toBeNull();
    expect(parseItemSnapshot(['x'])).toBeNull();
    expect(parseSubItemSnapshot({ title: 'Paso', status: 'DONE' })).toEqual({
      title: 'Paso',
      status: TaskStatus.DONE,
    });
    expect(parseSubItemSnapshot({ title: 'Paso', status: 'LATER' })).toBeNull();
  });
});
