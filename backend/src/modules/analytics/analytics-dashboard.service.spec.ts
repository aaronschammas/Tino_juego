/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ForbiddenException } from '@nestjs/common';
import { Prisma, Priority, TaskStatus } from '@prisma/client';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import {
  DashboardAssignedFilter,
  DashboardDateField,
} from './dto/dashboard-filters.dto';

describe('AnalyticsDashboardService', () => {
  let service: AnalyticsDashboardService;
  let prisma: any;

  const admin = { id: 'admin-1', organizationId: 'org-1', role: 'ADMIN' };
  const member = { id: 'user-1', organizationId: 'org-1', role: 'USER' };
  const range = { from: '2026-06-01', to: '2026-06-30' };
  const summaryRow = (overrides: Record<string, number> = {}) => ({
    totalTasks: 0,
    completedTasks: 0,
    blockedTasks: 0,
    overdueTasks: 0,
    unassignedTasks: 0,
    tasksWithoutTime: 0,
    leafEstimatedHours: 0,
    subTaskEstimatedHours: 0,
    activeMs: 0,
    activeUsers: 0,
    ...overrides,
  });
  const rawQuery = (call = 0) =>
    prisma.$queryRaw.mock.calls[call][0] as Prisma.Sql;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([summaryRow()]),
      organizationMembership: { findUnique: jest.fn() },
      project: { findMany: jest.fn().mockResolvedValue([{ id: 'project-1' }]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      task: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AnalyticsDashboardService(prisma);
  });

  describe('scope and permissions', () => {
    it('allows an ORG_OWNER to see the organization scope', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await service.getSummary(
        { ...member, role: 'USER' },
        range,
      );

      expect(result.scope).toEqual({
        organizationId: 'org-1',
        projectIds: ['project-1'],
        userIds: [],
      });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ members: expect.anything() }),
        }),
      );
    });

    it('resolves the scope once for repeated calls by the same user', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      await service.getSummary(member, range);
      await service.getSummary(member, range);

      expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    });

    it('shares one in-flight scope lookup across concurrent section requests', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      await Promise.all([
        service.getSummary(member, range),
        service.getTasks(member, range),
        service.getHeatmap(member, range),
      ]);

      expect(prisma.organizationMembership.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    });

    it('evicts a failed scope lookup so the next request retries it', async () => {
      prisma.organizationMembership.findUnique
        .mockRejectedValueOnce(new Error('connection reset'))
        .mockResolvedValue({ role: 'ORG_OWNER' });

      await expect(service.getSummary(member, range)).rejects.toThrow(
        'connection reset',
      );
      await expect(service.getSummary(member, range)).resolves.toBeDefined();

      expect(prisma.organizationMembership.findUnique).toHaveBeenCalledTimes(2);
    });

    it('does not share a cached scope between different users', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      prisma.project.findMany.mockResolvedValueOnce([{ id: 'project-1' }]);
      const first = await service.getSummary(member, range);

      prisma.project.findMany.mockResolvedValueOnce([{ id: 'project-2' }]);
      const second = await service.getSummary(admin, range);

      expect(first.scope.projectIds).toEqual(['project-1']);
      expect(second.scope.projectIds).toEqual(['project-2']);
      expect(prisma.project.findMany).toHaveBeenCalledTimes(2);
    });

    it('restricts an ORG_MEMBER to accessible projects and their own user id', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      const result = await service.getSummary(member, range);

      expect(result.scope.userIds).toEqual(['user-1']);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            members: { some: { userId: 'user-1' } },
          }),
        }),
      );
    });

    it('rejects another user requested by an ORG_MEMBER', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      await expect(
        service.getUsers(member, { ...range, userIds: ['other-user'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a project outside the accessible organization scope', async () => {
      await expect(
        service.getSummary(admin, {
          ...range,
          projectIds: ['cross-org-project'],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects an organization admin user filter that is not in the organization', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      prisma.user.findMany.mockResolvedValue([]);
      await expect(
        service.getUsers(admin, { ...range, userIds: ['cross-org-user'] }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['cross-org-user'] },
          isActive: true,
          organizationMemberships: { some: { organizationId: 'org-1' } },
        },
        select: { id: true },
      });
    });

    it('applies the complete organization filter set to task queries', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      await service.getTime(admin, {
        ...range,
        projectIds: ['project-1'],
        userIds: ['user-1'],
        statuses: [TaskStatus.BLOCKED],
        priorities: [Priority.HIGH],
        assigned: DashboardAssignedFilter.ASSIGNED,
        overdue: false,
        blocked: false,
        hasTime: false,
        dateField: DashboardDateField.DUE,
      });

      const where = prisma.task.findMany.mock.calls[0][0].where;
      expect(where.projectId).toEqual({ in: ['project-1'] });
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { assignedToId: { in: ['user-1'] } },
              { subTasks: { some: { assignedToId: { in: ['user-1'] } } } },
            ],
          },
          { status: { in: [TaskStatus.BLOCKED] } },
          { priority: { in: [Priority.HIGH] } },
          {
            OR: [
              { assignedToId: { not: null } },
              { subTasks: { some: { assignedToId: { not: null } } } },
            ],
          },
          { status: { not: TaskStatus.BLOCKED } },
          {
            timeEntries: { none: { endTime: { not: null } } },
            subTasks: {
              every: { timeEntries: { none: { endTime: { not: null } } } },
            },
          },
          {
            dueDate: {
              gte: new Date('2026-06-01T03:00:00.000Z'),
              lt: new Date('2026-07-01T03:00:00.000Z'),
            },
          },
        ]),
      );
      expect(where.AND).toContainEqual({
        NOT: {
          dueDate: { lt: expect.any(Date) },
          status: { not: TaskStatus.DONE },
        },
      });
    });

    it('translates the same filter set into the SQL task filter', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      await service.getSummary(admin, {
        ...range,
        projectIds: ['project-1'],
        userIds: ['user-1'],
        statuses: [TaskStatus.BLOCKED],
        priorities: [Priority.HIGH],
        assigned: DashboardAssignedFilter.ASSIGNED,
        overdue: false,
        blocked: false,
        hasTime: false,
        dateField: DashboardDateField.DUE,
      });

      const { sql, values } = rawQuery();
      expect(sql).toContain('t."assignedToId" = ANY(?::text[])');
      expect(sql).toContain('t.status = ANY(?::"TaskStatus"[])');
      expect(sql).toContain('t.priority = ANY(?::"Priority"[])');
      expect(sql).toContain('(t."assignedToId" IS NOT NULL OR EXISTS');
      expect(sql).toContain('NOT (t."dueDate" < ');
      expect(sql).toContain("t.status <> 'BLOCKED'");
      expect(sql).toMatch(
        /NOT \(\s+EXISTS \(SELECT 1 FROM "TimeEntry" root_te/,
      );
      expect(sql).toContain('t."dueDate" >= ');
      expect(sql).not.toContain('t."createdAt" >= ');
      expect(values).toEqual(
        expect.arrayContaining([
          'org-1',
          ['project-1'],
          ['user-1'],
          [TaskStatus.BLOCKED],
          [Priority.HIGH],
          '2026-06-01T03:00:00.000Z',
          '2026-07-01T03:00:00.000Z',
        ]),
      );
    });

    it.each([
      [
        { assigned: DashboardAssignedFilter.UNASSIGNED },
        /t\."assignedToId" IS NULL AND NOT EXISTS/,
      ],
      [{ overdue: true }, / AND \(t\."dueDate" < /],
      [{ blocked: true }, /t\.status = 'BLOCKED'/],
      [
        { hasTime: true },
        / AND \(\s+EXISTS \(SELECT 1 FROM "TimeEntry" root_te/,
      ],
      [{}, /t\."createdAt" >= /],
    ])('adds %j to the SQL task filter', async (filter, fragment) => {
      await service.getTasks(admin, { ...range, ...filter });

      expect(rawQuery().sql).toMatch(fragment);
    });

    it('limits SQL task and time filters to the member own user id', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      await service.getSummary(member, range);

      const { sql, values } = rawQuery();
      expect(sql).toContain('te."userId" = ANY(?::text[])');
      expect(values).toContainEqual(['user-1']);
    });
  });

  describe('default range', () => {
    it('starts at the active organization creation date when no from is given', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      const createdAt = new Date('2026-05-01T00:00:00.000Z');

      const result = await service.getSummary(
        { ...admin, activeOrganization: { createdAt } },
        {},
      );

      expect(result.range.from).toBe(createdAt.toISOString());
    });

    it('accepts the organization creation date as a serialized string', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await service.getSummary(
        {
          ...admin,
          activeOrganization: { createdAt: '2026-05-01T00:00:00.000Z' },
        },
        {},
      );

      expect(result.range.from).toBe('2026-05-01T00:00:00.000Z');
    });

    it('falls back to the epoch when the organization creation date is missing', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await service.getSummary(admin, {});

      expect(result.range.from).toBe(new Date(0).toISOString());
    });

    it('ignores an organization creation date that is not before the range end', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await service.getSummary(
        { ...admin, activeOrganization: { createdAt: new Date('2030-01-01') } },
        { to: '2026-06-30' },
      );

      expect(result.range.from).toBe(new Date(0).toISOString());
    });

    it('keeps an explicit from over the organization creation date', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await service.getSummary(
        {
          ...admin,
          activeOrganization: { createdAt: new Date('2026-05-01') },
        },
        range,
      );

      expect(result.range.from).toBe(
        new Date('2026-06-01T03:00:00.000Z').toISOString(),
      );
    });
  });

  it('builds summary KPIs from a single aggregate query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      summaryRow({
        totalTasks: 10,
        completedTasks: 4,
        blockedTasks: 1,
        overdueTasks: 2,
        unassignedTasks: 2,
        tasksWithoutTime: 3,
        leafEstimatedHours: 12,
        activeMs: 90 * 60_000,
        activeUsers: 1,
      }),
    ]);

    const result = await service.getSummary(admin, range);

    expect(result.kpis).toEqual({
      totalTasks: 10,
      openTasks: 6,
      completedTasks: 4,
      overdueTasks: 2,
      blockedTasks: 1,
      completionRate: 40,
      estimatedHours: 12,
      actualHours: 1.5,
      effortDeviationHours: -10.5,
      activeUsers: 1,
      tasksWithoutTime: 3,
      unassignedTasks: 2,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.task.groupBy).not.toHaveBeenCalled();
    expect(prisma.timeEntry.findMany).not.toHaveBeenCalled();
    const { sql, values } = rawQuery();
    expect(sql).toContain('te."endTime" IS NOT NULL');
    expect(sql).toContain('te."endTime" > ');
    expect(sql).toContain('te."startTime" < ');
    expect(sql).toContain('GREATEST(te."totalPausedMs", 0)');
    expect(values).toEqual(
      expect.arrayContaining([
        'org-1',
        '2026-06-01T03:00:00.000Z',
        '2026-07-01T03:00:00.000Z',
        new Date('2026-06-01T03:00:00.000Z').getTime(),
        new Date('2026-07-01T03:00:00.000Z').getTime(),
      ]),
    );
  });

  it('returns task distributions and a cursor-paginated critical table', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { dimension: 'status', value: TaskStatus.DONE, count: 2 },
      { dimension: 'status', value: TaskStatus.BLOCKED, count: 1 },
      { dimension: 'priority', value: Priority.CRITICAL, count: 1 },
      { dimension: 'priority', value: Priority.LOW, count: 2 },
      { dimension: 'critical', value: null, count: 1 },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Blocked task',
        projectId: 'project-1',
        status: TaskStatus.BLOCKED,
        priority: Priority.HIGH,
        estimatedHours: 1,
        dueDate: new Date('2026-06-10T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        project: { name: 'Project' },
        assignedTo: { id: 'user-1', name: 'Ada', lastname: 'Lovelace' },
        subTasks: [],
      },
      { id: 'task-next' },
    ]);
    prisma.timeEntry.findMany.mockResolvedValue([
      {
        taskId: 'task-1',
        startTime: new Date('2026-06-10T12:00:00Z'),
        endTime: new Date('2026-06-10T14:00:00Z'),
        totalPausedMs: 0,
      },
    ]);

    const result = await service.getTasks(admin, { ...range, limit: 1 });

    expect(result.statusDistribution).toEqual([
      { status: TaskStatus.BLOCKED, count: 1 },
      { status: TaskStatus.DONE, count: 2 },
    ]);
    expect(result.priorityDistribution).toEqual([
      { priority: Priority.LOW, count: 2 },
      { priority: Priority.CRITICAL, count: 1 },
    ]);
    expect(result.criticalTasks.items[0]).toEqual(
      expect.objectContaining({
        actualHours: 2,
        deviationHours: 1,
        projectName: 'Project',
      }),
    );
    expect(result.criticalTasks.nextCursor).toBe('task-1');
    expect(result.criticalTasks.total).toBe(1);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });

  it('does not recount summary KPIs while building the task section', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);

    const result: any = await service.getTasks(admin, range);

    expect(result.counts).toBeUndefined();
    expect(result.criticalTasks.total).toBe(0);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.task.count).not.toHaveBeenCalled();
    expect(rawQuery().sql).not.toContain('"assignedToId" IS NULL');
  });

  it('returns time totals and handles zero estimated hours without division by zero', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Task',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        estimatedHours: 0,
        project: { name: 'Project' },
        subTasks: [],
      },
    ]);
    prisma.timeEntry.findMany.mockResolvedValue([
      {
        taskId: 'task-1',
        startTime: new Date('2026-06-10T12:00:00Z'),
        endTime: new Date('2026-06-10T13:00:00Z'),
        totalPausedMs: 0,
      },
    ]);

    const result = await service.getTime(admin, range);

    expect(result.totals).toEqual({
      estimatedHours: 0,
      actualHours: 1,
      deviationHours: 1,
      deviationPercent: null,
    });
    expect(result.topTasksByTime).toHaveLength(1);
    expect(result.timeByStatus).toEqual([
      { status: TaskStatus.IN_PROGRESS, estimatedHours: 0, actualHours: 1 },
    ]);
  });

  it('returns project health aggregates without cross-organization selectors', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Project',
        totalTasks: 3,
        completedTasks: 2,
        blockedTasks: 1,
        overdueTasks: 2,
        estimatedHours: 6,
        activeMs: 8 * 60 * 60_000,
        activeUsers: 1,
      },
    ]);

    const result = await service.getProjects(admin, range);

    expect(result.projects).toEqual([
      {
        projectId: 'project-1',
        projectName: 'Project',
        totalTasks: 3,
        openTasks: 1,
        completedTasks: 2,
        overdueTasks: 2,
        blockedTasks: 1,
        estimatedHours: 6,
        actualHours: 8,
        deviationHours: 2,
        deviationPercent: 33.3,
        activeUsers: 1,
      },
    ]);
    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    const { sql, values } = rawQuery();
    expect(sql).toContain('p."organizationId" = ?');
    expect(sql).toContain('p."isActive" = true');
    expect(values).toEqual(expect.arrayContaining(['org-1', ['project-1']]));
  });

  it('returns user aggregates without exposing email', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Ada', lastname: 'Lovelace' },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        assignedToId: 'user-1',
        status: TaskStatus.DONE,
        estimatedHours: 1,
        subTasks: [],
      },
      {
        id: 'task-2',
        assignedToId: 'user-1',
        status: TaskStatus.DONE,
        estimatedHours: 2,
        subTasks: [],
      },
    ]);
    prisma.timeEntry.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        startTime: new Date('2026-06-10T12:00:00Z'),
        endTime: new Date('2026-06-10T14:00:00Z'),
        totalPausedMs: 0,
      },
      {
        userId: 'user-1',
        startTime: new Date('2026-06-11T12:00:00Z'),
        endTime: new Date('2026-06-11T13:00:00Z'),
        totalPausedMs: 0,
      },
    ]);

    const result = await service.getUsers(admin, range);

    expect(result.users).toEqual([
      {
        userId: 'user-1',
        name: 'Ada Lovelace',
        assignedTasks: 2,
        completedTasks: 2,
        estimatedHours: 3,
        actualHours: 3,
        activeDays: 2,
        lastActivityAt: '2026-06-11T13:00:00.000Z',
      },
    ]);
    expect(result.users[0]).not.toHaveProperty('email');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          organizationMemberships: { some: { organizationId: 'org-1' } },
        }),
      }),
    );
  });

  it('returns an aggregated heatmap and no raw time entries', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      {
        id: 'entry-1',
        userId: 'user-1',
        projectId: 'project-1',
        startTime: new Date('2026-06-22T12:00:00Z'),
        endTime: new Date('2026-06-22T13:00:00Z'),
        totalPausedMs: 0,
      },
    ]);

    const result = await service.getHeatmap(admin, range);

    expect(result.groupBy).toBe('hourOfWeek');
    expect(result.totals).toEqual({
      minutes: 60,
      entries: 1,
      users: 1,
      projects: 1,
    });
    expect(result.cells[0]).toEqual(
      expect.objectContaining({ dayOfWeek: 1, hour: 9, minutes: 60 }),
    );
    expect(result).not.toHaveProperty('entries');
  });
});
