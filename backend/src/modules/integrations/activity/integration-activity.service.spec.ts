/**
 * Tests del resumen de novedades de Trello. Prisma esta simulado: se verifica
 * como se agrupan las novedades (una por tarea, cambios de estado colapsados),
 * como se suman los minutos trabajados y a quien se le muestra que.
 */
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  ACTIVITY_MAX_LOOKBACK_MS,
  IntegrationActivityService,
} from './integration-activity.service';

describe('IntegrationActivityService', () => {
  const since = new Date('2026-09-28T00:00:00.000Z');
  const until = new Date('2026-09-29T00:00:00.000Z');
  const task = (title: string, project = 'Web') => ({
    title,
    project: { name: project },
  });
  const entry = (
    userId: string,
    taskId: string,
    minutes: number,
    pausedMinutes = 0,
  ) => {
    const startTime = new Date('2026-09-28T10:00:00.000Z');
    return {
      userId,
      taskId,
      startTime,
      endTime: new Date(
        startTime.getTime() + (minutes + pausedMinutes) * 60_000,
      ),
      totalPausedMs: pausedMinutes * 60_000,
      task: { title: `Tarea ${taskId}` },
      user:
        userId === 'u-ana'
          ? { name: 'Ana', lastname: 'Lopez' }
          : { name: 'Luis', lastname: 'Diaz' },
    };
  };
  let prisma: {
    integrationActivity: { findMany: jest.Mock };
    timeEntry: { findMany: jest.Mock };
    organizationMembership: { findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let service: IntegrationActivityService;

  interface FindArgs {
    where: Record<string, unknown>;
  }
  const whereOf = (mock: jest.Mock) =>
    (mock.mock.calls[0] as [FindArgs])[0].where;

  beforeEach(() => {
    prisma = {
      integrationActivity: { findMany: jest.fn().mockResolvedValue([]) },
      timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new IntegrationActivityService(
      prisma as unknown as PrismaService,
    );
  });

  it('returns an empty summary when nothing happened', async () => {
    await expect(
      service.summarize({ organizationId: 'org-1', since, until }),
    ).resolves.toEqual({
      since,
      until,
      created: [],
      statusChanges: [],
      archived: [],
      work: [],
      totalMinutes: 0,
      isEmpty: true,
    });
    expect(whereOf(prisma.integrationActivity.findMany)).toEqual({
      organizationId: 'org-1',
      occurredAt: { gte: since, lt: until },
    });
    expect(whereOf(prisma.timeEntry.findMany)).toEqual({
      organizationId: 'org-1',
      endTime: { gte: since, lt: until },
      task: { project: { integrationConnection: { isNot: null } } },
    });
  });

  it('counts each task once and collapses its status changes', async () => {
    prisma.integrationActivity.findMany.mockResolvedValue([
      {
        kind: 'TASK_CREATED',
        taskId: 't1',
        fromStatus: null,
        toStatus: TaskStatus.TODO,
        actorName: 'Ana',
        task: task('Login'),
      },
      {
        kind: 'STATUS_CHANGED',
        taskId: 't1',
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.IN_PROGRESS,
        actorName: 'Ana',
        task: task('Login'),
      },
      {
        kind: 'STATUS_CHANGED',
        taskId: 't1',
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.DONE,
        actorName: 'Luis',
        task: task('Login'),
      },
      {
        kind: 'STATUS_CHANGED',
        taskId: 't2',
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.BLOCKED,
        actorName: null,
        task: task('Pagos'),
      },
      {
        kind: 'STATUS_CHANGED',
        taskId: 't2',
        fromStatus: TaskStatus.BLOCKED,
        toStatus: TaskStatus.TODO,
        actorName: null,
        task: task('Pagos'),
      },
      {
        kind: 'TASK_ARCHIVED',
        taskId: 't3',
        fromStatus: null,
        toStatus: null,
        actorName: 'Ana',
        task: task('Viejo', 'App'),
      },
      {
        kind: 'TASK_ARCHIVED',
        taskId: 't3',
        fromStatus: null,
        toStatus: null,
        actorName: 'Ana',
        task: task('Viejo', 'App'),
      },
    ]);

    const summary = await service.summarize({
      organizationId: 'org-1',
      since,
      until,
    });

    expect(summary.created).toEqual([
      { taskId: 't1', title: 'Login', projectName: 'Web' },
    ]);
    expect(summary.statusChanges).toEqual([
      {
        taskId: 't1',
        title: 'Login',
        projectName: 'Web',
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.DONE,
        actorName: 'Luis',
      },
    ]);
    expect(summary.archived).toEqual([
      { taskId: 't3', title: 'Viejo', projectName: 'App' },
    ]);
    expect(summary.isEmpty).toBe(false);
  });

  it('adds up worked minutes per person and task, without paused time', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      entry('u-luis', 't1', 30),
      entry('u-ana', 't1', 60, 15),
      entry('u-ana', 't2', 45),
      entry('u-ana', 't1', 20),
      entry('u-luis', 't3', 0),
      { ...entry('u-luis', 't4', 10), endTime: null },
    ]);

    const summary = await service.summarize({
      organizationId: 'org-1',
      since,
      until,
    });

    expect(summary.work).toEqual([
      {
        userId: 'u-ana',
        name: 'Ana Lopez',
        minutes: 125,
        tasks: [
          { taskId: 't1', title: 'Tarea t1', minutes: 80 },
          { taskId: 't2', title: 'Tarea t2', minutes: 45 },
        ],
      },
      {
        userId: 'u-luis',
        name: 'Luis Diaz',
        minutes: 30,
        tasks: [{ taskId: 't1', title: 'Tarea t1', minutes: 30 }],
      },
    ]);
    expect(summary.totalMinutes).toBe(155);
    expect(summary.isEmpty).toBe(false);
  });

  it('limits everything to the assigned tasks of a person', async () => {
    await service.summarize({
      organizationId: 'org-1',
      since,
      until,
      assignedToUserId: 'u-1',
    });

    expect(whereOf(prisma.integrationActivity.findMany)).toMatchObject({
      task: { assignedToId: 'u-1' },
    });
    expect(whereOf(prisma.timeEntry.findMany)).toMatchObject({
      task: {
        assignedToId: 'u-1',
        project: { integrationConnection: { isNot: null } },
      },
    });
  });

  describe('summarizeForViewer()', () => {
    const now = new Date('2026-09-29T12:00:00.000Z');

    it('shows the whole organization to the owner since the last dismiss', async () => {
      const seenAt = new Date('2026-09-29T08:00:00.000Z');
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
        activitySeenAt: seenAt,
      });

      const summary = await service.summarizeForViewer(
        { id: 'owner-1' },
        'org-1',
        now,
      );

      expect(summary.since).toEqual(seenAt);
      expect(whereOf(prisma.integrationActivity.findMany)).toEqual({
        organizationId: 'org-1',
        occurredAt: { gte: seenAt, lt: now },
      });
    });

    it('shows only assigned tasks to members, at most one week back', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
        activitySeenAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const summary = await service.summarizeForViewer(
        { id: 'member-1' },
        'org-1',
        now,
      );

      expect(summary.since).toEqual(
        new Date(now.getTime() - ACTIVITY_MAX_LOOKBACK_MS),
      );
      expect(whereOf(prisma.integrationActivity.findMany)).toMatchObject({
        task: { assignedToId: 'member-1' },
      });
    });

    it('treats SUPERADMIN like an owner', async () => {
      await service.summarizeForViewer(
        { id: 'admin-1', role: 'SUPERADMIN' },
        'org-1',
        now,
      );

      expect(whereOf(prisma.integrationActivity.findMany)).not.toHaveProperty(
        'task',
      );
    });
  });

  it('stores when the person closed the banner', async () => {
    const now = new Date('2026-09-29T12:00:00.000Z');

    await expect(
      service.markSeen({ id: 'member-1' }, 'org-1', now),
    ).resolves.toEqual({ seenAt: now });
    expect(prisma.organizationMembership.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'member-1' },
      data: { activitySeenAt: now },
    });
  });
});
