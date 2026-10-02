/**
 * Dashboard SQL parity against a real, disposable Postgres. Runs only when
 * DASHBOARD_SQL_TEST_DATABASE_URL points to a migrated database; it compares
 * the raw-SQL sections with the Prisma filters and with the Prisma + JS
 * aggregation they replaced, across filter combinations and member scopes.
 */
import { Prisma, PrismaClient, Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  AnalyticsDashboardService,
  DashboardUser,
} from 'src/modules/analytics/analytics-dashboard.service';
import {
  calculateActiveMsWithinRange,
  percentage,
  roundHours,
} from 'src/modules/analytics/analytics-dashboard.utils';
import {
  DashboardAssignedFilter,
  DashboardDateField,
  DashboardFiltersDto,
} from 'src/modules/analytics/dto/dashboard-filters.dto';

const databaseUrl = process.env.DASHBOARD_SQL_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const run = `parity-${Date.now()}`;
const id = (name: string) => `${run}-${name}`;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic PRNG so every run seeds the same dataset. */
function createRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describeWithDatabase('AnalyticsDashboardService SQL parity', () => {
  jest.setTimeout(120_000);

  let prisma: PrismaClient;
  let service: AnalyticsDashboardService;
  const orgCreatedAt = new Date('2026-01-01T00:00:00.000Z');
  const users = {
    owner: id('owner'),
    memberA: id('member-a'),
    memberB: id('member-b'),
    idle: id('member-idle'),
    outsider: id('outsider'),
  };
  let databaseName = '';
  const projects = {
    alpha: id('project-alpha'),
    beta: id('project-beta'),
    archived: id('project-archived'),
    foreign: id('project-foreign'),
  };

  const prepareFor = (user: DashboardUser, dto: DashboardFiltersDto) =>
    service['prepare'](user, dto);
  type Prepared = Awaited<ReturnType<typeof prepareFor>>;

  const asUser = (userId: string): DashboardUser => ({
    id: userId,
    organizationId: id('org'),
    role: 'USER',
    activeOrganization: { createdAt: orgCreatedAt },
  });

  /** Seeds two organizations with varied tasks, subtasks and time entries. */
  async function seed() {
    const random = createRandom(42);
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)];
    const dateBetween = (from: string, to: string) =>
      new Date(
        new Date(from).getTime() +
          Math.floor(
            random() * (new Date(to).getTime() - new Date(from).getTime()),
          ),
      );

    await prisma.role.create({ data: { id: id('role'), name: id('role') } });
    await prisma.user.createMany({
      data: Object.entries(users).map(([name, userId]) => ({
        id: userId,
        email: `${userId}@parity.test`,
        name,
        lastname: 'Parity',
        roleId: id('role'),
      })),
    });
    await prisma.organization.createMany({
      data: [
        { id: id('org'), name: id('org'), createdAt: orgCreatedAt },
        { id: id('org-foreign'), name: id('org-foreign') },
      ],
    });
    await prisma.organizationMembership.createMany({
      data: [
        { organizationId: id('org'), userId: users.owner, role: 'ORG_OWNER' },
        {
          organizationId: id('org'),
          userId: users.memberA,
          role: 'ORG_MEMBER',
        },
        {
          organizationId: id('org'),
          userId: users.memberB,
          role: 'ORG_MEMBER',
        },
        { organizationId: id('org'), userId: users.idle, role: 'ORG_MEMBER' },
        {
          organizationId: id('org-foreign'),
          userId: users.outsider,
          role: 'ORG_OWNER',
        },
      ],
    });
    await prisma.project.createMany({
      data: [
        {
          id: projects.alpha,
          name: 'Alpha',
          ownerId: users.owner,
          organizationId: id('org'),
          createdAt: new Date('2026-01-02'),
        },
        {
          id: projects.beta,
          name: 'Beta',
          ownerId: users.owner,
          organizationId: id('org'),
          createdAt: new Date('2026-01-03'),
        },
        {
          id: projects.archived,
          name: 'Archived',
          ownerId: users.owner,
          organizationId: id('org'),
          isActive: false,
        },
        {
          id: projects.foreign,
          name: 'Foreign',
          ownerId: users.outsider,
          organizationId: id('org-foreign'),
        },
      ],
    });
    await prisma.projectMember.createMany({
      data: [
        { projectId: projects.alpha, userId: users.memberA },
        { projectId: projects.beta, userId: users.memberA },
        { projectId: projects.beta, userId: users.memberB },
      ],
    });

    const assignees = [null, users.owner, users.memberA, users.memberB];
    const estimates = [null, 0, 1.5, 3, 8];
    const tasks: Prisma.TaskCreateManyInput[] = [];
    const projectOrg: Record<string, string> = {
      [projects.alpha]: id('org'),
      [projects.beta]: id('org'),
      [projects.archived]: id('org'),
      [projects.foreign]: id('org-foreign'),
    };
    for (let index = 0; index < 90; index++) {
      const projectId = pick(Object.values(projects));
      const rootId = id(`task-${index}`);
      tasks.push({
        id: rootId,
        title: `Task ${index}`,
        projectId,
        organizationId: projectOrg[projectId],
        status: pick(Object.values(TaskStatus)),
        priority: pick(Object.values(Priority)),
        assignedToId: pick(assignees),
        estimatedHours: pick(estimates),
        dueDate:
          random() < 0.25 ? null : dateBetween('2026-01-01', '2027-06-30'),
        createdAt: dateBetween('2026-01-01', '2026-09-01'),
      });
      if (random() < 0.4) {
        const subTaskCount = 1 + Math.floor(random() * 3);
        for (let sub = 0; sub < subTaskCount; sub++) {
          tasks.push({
            id: id(`task-${index}-sub-${sub}`),
            title: `Task ${index}.${sub}`,
            projectId,
            organizationId: projectOrg[projectId],
            parentTaskId: rootId,
            status: pick(Object.values(TaskStatus)),
            priority: pick(Object.values(Priority)),
            assignedToId: pick(assignees),
            estimatedHours: pick(estimates),
            createdAt: dateBetween('2026-01-01', '2026-09-01'),
          });
        }
      }
    }
    await prisma.task.createMany({ data: tasks });

    const durationsMs = [
      0,
      5 * 60_000,
      45 * 60_000,
      2 * 3_600_000,
      9 * 3_600_000,
      30 * 3_600_000,
      -3_600_000,
    ];
    const timedTasks = tasks.filter((_, index) => index % 3 !== 0);
    const entries: Prisma.TimeEntryCreateManyInput[] = [];
    for (let index = 0; index < 400; index++) {
      const task = random() < 0.15 ? null : pick(timedTasks);
      const projectId = task?.projectId ?? pick(Object.values(projects));
      const startTime = dateBetween('2025-12-15', '2026-09-15');
      const durationMs = pick(durationsMs);
      entries.push({
        id: id(`entry-${index}`),
        userId: pick([
          users.owner,
          users.memberA,
          users.memberB,
          users.outsider,
        ]),
        projectId,
        organizationId: projectOrg[projectId],
        taskId: task?.id ?? null,
        startTime,
        endTime: new Date(startTime.getTime() + durationMs),
        totalPausedMs: pick([0, 0, 10 * 60_000, 3 * 3_600_000, -1]),
      });
    }
    entries.push(
      {
        id: id('entry-boundary'),
        userId: users.memberA,
        projectId: projects.alpha,
        organizationId: id('org'),
        taskId: tasks.find((task) => task.projectId === projects.alpha)?.id,
        startTime: new Date('2026-02-28T20:00:00.000Z'),
        endTime: new Date('2026-03-01T10:00:00.000Z'),
        totalPausedMs: 3_600_000,
      },
      {
        id: id('entry-open'),
        userId: users.memberB,
        projectId: projects.beta,
        organizationId: id('org'),
        startTime: new Date(Date.now() - DAY_MS),
        endTime: null,
      },
    );
    await prisma.timeEntry.createMany({ data: entries });
  }

  /** Pre-SQL summary: the Prisma + JS aggregation removed from the service. */
  async function legacySummary({ filters, scope }: Prepared) {
    const taskWhere = service['buildTaskWhere'](filters, scope);
    const now = new Date();
    const [
      statusGroups,
      overdueTasks,
      leaf,
      sub,
      withoutTime,
      unassigned,
      entries,
    ] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: taskWhere,
        _count: { id: true },
      }),
      prisma.task.count({
        where: {
          AND: [
            taskWhere,
            { dueDate: { lt: now }, status: { not: TaskStatus.DONE } },
          ],
        },
      }),
      prisma.task.aggregate({
        where: { AND: [taskWhere, { subTasks: { none: {} } }] },
        _sum: { estimatedHours: true },
      }),
      prisma.task.aggregate({
        where: { parentTask: taskWhere },
        _sum: { estimatedHours: true },
      }),
      prisma.task.count({
        where: {
          AND: [
            taskWhere,
            {
              timeEntries: { none: { endTime: { not: null } } },
              subTasks: {
                every: { timeEntries: { none: { endTime: { not: null } } } },
              },
            },
          ],
        },
      }),
      prisma.task.count({
        where: {
          AND: [
            taskWhere,
            { assignedToId: null, subTasks: { every: { assignedToId: null } } },
          ],
        },
      }),
      prisma.timeEntry.findMany({
        where: service['buildTimeEntryWhere'](filters, scope, taskWhere),
      }),
    ]);
    const count = (status?: TaskStatus) =>
      statusGroups
        .filter((group) => !status || group.status === status)
        .reduce((sum, group) => sum + group._count.id, 0);
    const totalTasks = count();
    const completedTasks = count(TaskStatus.DONE);
    const estimatedHours = Number(
      (
        (leaf._sum.estimatedHours ?? 0) + (sub._sum.estimatedHours ?? 0)
      ).toFixed(2),
    );
    const actualHours = roundHours(
      entries.reduce(
        (sum, entry) =>
          sum + calculateActiveMsWithinRange(entry, filters.from, filters.to),
        0,
      ),
    );
    return {
      totalTasks,
      openTasks: totalTasks - completedTasks,
      completedTasks,
      overdueTasks,
      blockedTasks: count(TaskStatus.BLOCKED),
      completionRate: percentage(completedTasks, totalTasks) ?? 0,
      estimatedHours,
      actualHours,
      effortDeviationHours: Number((actualHours - estimatedHours).toFixed(2)),
      activeUsers: new Set(
        entries
          .filter(
            (entry) =>
              calculateActiveMsWithinRange(entry, filters.from, filters.to) > 0,
          )
          .map((entry) => entry.userId),
      ).size,
      tasksWithoutTime: withoutTime,
      unassignedTasks: unassigned,
    };
  }

  /** Pre-SQL project health: grouped Prisma queries plus JS time totals. */
  async function legacyProjects({ filters, scope }: Prepared) {
    const taskWhere = service['buildTaskWhere'](filters, scope);
    const now = new Date();
    const [
      projectRows,
      statusGroups,
      leafGroups,
      subGroups,
      overdueGroups,
      entries,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          id: { in: scope.projectIds },
          organizationId: scope.organizationId,
          isActive: true,
        },
      }),
      prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: taskWhere,
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ['projectId'],
        where: { AND: [taskWhere, { subTasks: { none: {} } }] },
        _sum: { estimatedHours: true },
      }),
      prisma.task.groupBy({
        by: ['projectId'],
        where: { parentTask: taskWhere },
        _sum: { estimatedHours: true },
      }),
      prisma.task.groupBy({
        by: ['projectId'],
        where: {
          ...taskWhere,
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE },
        },
        _count: { id: true },
      }),
      prisma.timeEntry.findMany({
        where: service['buildTimeEntryWhere'](filters, scope),
      }),
    ]);
    return projectRows
      .map((project) => {
        const groups = statusGroups.filter(
          (group) => group.projectId === project.id,
        );
        const count = (status?: TaskStatus) =>
          groups
            .filter((group) => !status || group.status === status)
            .reduce((sum, group) => sum + group._count.id, 0);
        const estimate = [...leafGroups, ...subGroups]
          .filter((group) => group.projectId === project.id)
          .reduce((sum, group) => sum + (group._sum.estimatedHours ?? 0), 0);
        const projectEntries = entries.filter(
          (entry) => entry.projectId === project.id,
        );
        const activeMs = projectEntries.reduce(
          (sum, entry) =>
            sum + calculateActiveMsWithinRange(entry, filters.from, filters.to),
          0,
        );
        const estimatedHours = Number(estimate.toFixed(2));
        const actualHours = roundHours(activeMs);
        const deviationHours = Number(
          (actualHours - estimatedHours).toFixed(2),
        );
        return {
          projectId: project.id,
          projectName: project.name,
          totalTasks: count(),
          openTasks: count() - count(TaskStatus.DONE),
          completedTasks: count(TaskStatus.DONE),
          overdueTasks:
            overdueGroups.find((group) => group.projectId === project.id)
              ?._count.id ?? 0,
          blockedTasks: count(TaskStatus.BLOCKED),
          estimatedHours,
          actualHours,
          deviationHours,
          deviationPercent: percentage(deviationHours, estimatedHours),
          activeUsers: new Set(
            projectEntries
              .filter(
                (entry) =>
                  calculateActiveMsWithinRange(
                    entry,
                    filters.from,
                    filters.to,
                  ) > 0,
              )
              .map((entry) => entry.userId),
          ).size,
        };
      })
      .sort((a, b) => a.projectId.localeCompare(b.projectId));
  }

  /** Pre-SQL task section counters: status/priority groupBy and the critical count. */
  async function legacyTaskCounts({ filters, scope }: Prepared) {
    const taskWhere = service['buildTaskWhere'](filters, scope);
    const [statusGroups, priorityGroups, total] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: taskWhere,
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where: taskWhere,
        _count: { id: true },
      }),
      prisma.task.count({
        where: {
          AND: [
            taskWhere,
            {
              OR: [
                {
                  dueDate: { lt: new Date() },
                  status: { not: TaskStatus.DONE },
                },
                { status: TaskStatus.BLOCKED },
                { priority: { in: [Priority.HIGH, Priority.CRITICAL] } },
              ],
            },
          ],
        },
      }),
    ]);
    return {
      statuses: Object.fromEntries(
        statusGroups.map((group) => [group.status, group._count.id]),
      ),
      priorities: Object.fromEntries(
        priorityGroups.map((group) => [group.priority, group._count.id]),
      ),
      total,
    };
  }

  beforeAll(async () => {
    const admin = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    const [{ database }] = await admin.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    databaseName = database;
    await admin.$executeRawUnsafe(
      `ALTER DATABASE "${databaseName}" SET timezone TO 'America/Argentina/Buenos_Aires'`,
    );
    await admin.$disconnect();

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await seed();
    service = new AnalyticsDashboardService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({
      where: { id: { in: [id('org'), id('org-foreign')] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.role.deleteMany({ where: { id: id('role') } });
    await prisma.$executeRawUnsafe(
      `ALTER DATABASE "${databaseName}" RESET timezone`,
    );
    await prisma.$disconnect();
  });

  const ranges: DashboardFiltersDto[] = [
    {},
    { from: '2026-03-01', to: '2026-06-30' },
  ];
  const variants: DashboardFiltersDto[] = [
    {},
    { statuses: [TaskStatus.TODO, TaskStatus.BLOCKED] },
    { priorities: [Priority.HIGH, Priority.LOW] },
    { assigned: DashboardAssignedFilter.ASSIGNED },
    { assigned: DashboardAssignedFilter.UNASSIGNED },
    { overdue: true },
    { overdue: false },
    { blocked: true },
    { blocked: false },
    { hasTime: true },
    { hasTime: false },
    { dateField: DashboardDateField.DUE },
    { dateField: DashboardDateField.ACTIVITY },
    { projectIds: [projects.beta] },
    {
      statuses: [TaskStatus.DONE],
      hasTime: true,
      assigned: DashboardAssignedFilter.ASSIGNED,
      dateField: DashboardDateField.DUE,
    },
  ];
  const variantsFor = (userId: string): DashboardFiltersDto[] => {
    if (userId === users.owner)
      return [...variants, { userIds: [users.memberA] }];
    if (userId === users.idle)
      return variants.filter((variant) => !variant.projectIds);
    return variants;
  };
  const cases = [users.owner, users.memberA, users.memberB, users.idle].flatMap(
    (userId) =>
      ranges.flatMap((range) =>
        variantsFor(userId).map(
          (variant) =>
            [
              userId.slice(run.length + 1),
              { ...range, ...variant },
              userId,
            ] as const,
        ),
      ),
  );

  it.each(cases)(
    '%s %j matches the Prisma filter and legacy aggregates',
    async (_name, dto, userId) => {
      const user = asUser(userId);
      const prepared = await prepareFor(user, dto);
      const { filters, scope } = prepared;
      const now = new Date();

      const [{ count }] = await prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`SELECT COUNT(*)::int AS count FROM "Task" t WHERE ${service['buildTaskFilterSql'](filters, scope, now)}`,
      );
      expect(count).toBe(
        await prisma.task.count({
          where: service['buildTaskWhere'](filters, scope),
        }),
      );

      const summary = await service.getSummary(user, dto);
      expect(summary.kpis).toEqual(await legacySummary(prepared));

      const health = await service.getProjects(user, dto);
      expect(
        [...health.projects].sort((a, b) =>
          a.projectId.localeCompare(b.projectId),
        ),
      ).toEqual(await legacyProjects(prepared));

      const taskSection = await service.getTasks(user, dto);
      const legacy = await legacyTaskCounts(prepared);
      expect(
        Object.fromEntries(
          taskSection.statusDistribution.map((row) => [row.status, row.count]),
        ),
      ).toEqual(legacy.statuses);
      expect(
        Object.fromEntries(
          taskSection.priorityDistribution.map((row) => [
            row.priority,
            row.count,
          ]),
        ),
      ).toEqual(legacy.priorities);
      expect(taskSection.criticalTasks.total).toBe(legacy.total);
    },
  );

  it('seeds data where every filter splits the tasks, so parity is not 0 = 0', async () => {
    const owner = asUser(users.owner);
    const kpisFor = async (userId: string, dto: DashboardFiltersDto) =>
      (await service.getSummary(asUser(userId), dto)).kpis;
    const all = await kpisFor(users.owner, {});
    const pairs: Array<[DashboardFiltersDto, DashboardFiltersDto]> = [
      [{ overdue: true }, { overdue: false }],
      [{ blocked: true }, { blocked: false }],
      [{ hasTime: true }, { hasTime: false }],
      [
        { assigned: DashboardAssignedFilter.ASSIGNED },
        { assigned: DashboardAssignedFilter.UNASSIGNED },
      ],
    ];

    for (const [left, right] of pairs) {
      const [kept, dropped] = [
        (await kpisFor(users.owner, left)).totalTasks,
        (await kpisFor(users.owner, right)).totalTasks,
      ];
      expect(kept).toBeGreaterThan(0);
      expect(dropped).toBeGreaterThan(0);
      expect(kept + dropped).toBeLessThanOrEqual(all.totalTasks);
    }
    const clipped = (await service.getSummary(owner, ranges[1])).kpis;
    expect(clipped.actualHours).toBeGreaterThan(0);
    expect(clipped.actualHours).toBeLessThan(all.actualHours);
    expect((await kpisFor(users.memberA, {})).totalTasks).toBeLessThan(
      all.totalTasks,
    );
    expect(await kpisFor(users.idle, {})).toEqual(
      expect.objectContaining({ totalTasks: 0, actualHours: 0 }),
    );
    expect(all.tasksWithoutTime).toBeGreaterThan(0);
    expect(all.unassignedTasks).toBeGreaterThan(0);
  });
});
