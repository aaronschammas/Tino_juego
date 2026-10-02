import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Priority, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner, PermissionUser } from 'src/common/permissions';
import {
  DashboardAssignedFilter,
  DashboardDateField,
  DashboardFiltersDto,
} from './dto/dashboard-filters.dto';
import {
  buildHourlyHeatmap,
  calculateActiveMsWithinRange,
  normalizeDashboardFilters,
  NormalizedDashboardFilters,
  percentage,
  roundHours,
} from './analytics-dashboard.utils';
import {
  MobileSummaryDto,
  MobileSummaryPeriod,
  MobileSummaryScope,
} from './dto/mobile-summary.dto';

interface DashboardScope {
  organizationId: string;
  projectIds: string[];
  userIds?: string[];
  canViewOrganization: boolean;
  canFilterUsers: boolean;
}

export type DashboardUser = PermissionUser & {
  activeOrganization?: { createdAt?: Date | string | null } | null;
};

interface SummaryRow {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  tasksWithoutTime: number;
  leafEstimatedHours: number;
  subTaskEstimatedHours: number;
  activeMs: number;
  activeUsers: number;
}

interface ProjectRow {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  estimatedHours: number;
  activeMs: number;
  activeUsers: number;
}

interface TaskCountRow {
  dimension: 'status' | 'priority' | 'critical';
  value: string | null;
  count: number;
}

function organizationCreatedAt(user: DashboardUser): Date | null {
  const createdAt = user.activeOrganization?.createdAt;
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Converts a Date into a UTC timestamp comparable with Prisma TIMESTAMP(3) columns, independent of the session timezone. */
function sqlTimestamp(date: Date): Prisma.Sql {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** SQL twin of calculateActiveMsWithinRange for a TimeEntry aliased as "te". */
function activeMsWithinRangeSql(from: Date, to: Date): Prisma.Sql {
  const startMs = Prisma.sql`(EXTRACT(EPOCH FROM te."startTime") * 1000)::float8`;
  const endMs = Prisma.sql`(EXTRACT(EPOCH FROM te."endTime") * 1000)::float8`;
  const overlapStart = Prisma.sql`GREATEST(${startMs}, ${from.getTime()}::float8)`;
  const overlapEnd = Prisma.sql`LEAST(${endMs}, ${to.getTime()}::float8)`;
  return Prisma.sql`CASE
    WHEN te."endTime" IS NULL OR te."endTime" <= te."startTime" OR ${overlapEnd} <= ${overlapStart} THEN 0::float8
    ELSE (${overlapEnd} - ${overlapStart}) / (${endMs} - ${startMs})
      * GREATEST(${endMs} - ${startMs} - GREATEST(te."totalPausedMs", 0), 0)
  END`;
}

@Injectable()
export class AnalyticsDashboardService {
  private static readonly SCOPE_CACHE_TTL_MS = 5_000;
  private readonly scopeCache = new Map<
    string,
    { expiresAt: number; scope: Promise<DashboardScope> }
  >();

  constructor(private readonly prisma: PrismaService) {}

  private scopeCacheKey(
    user: PermissionUser,
    filters: NormalizedDashboardFilters,
  ) {
    return [
      user.id,
      user.organizationId ?? '',
      [...(filters.projectIds ?? [])].sort().join(','),
      [...(filters.userIds ?? [])].sort().join(','),
    ].join('|');
  }

  /**
   * Resolves the caller's analytics scope. The pending promise is cached so the
   * dashboard's concurrent section requests share one permission lookup;
   * failures are evicted so they are never served from cache.
   */
  private resolveScope(
    user: PermissionUser,
    filters: NormalizedDashboardFilters,
  ): Promise<DashboardScope> {
    const key = this.scopeCacheKey(user, filters);
    const now = Date.now();

    for (const [cachedKey, entry] of this.scopeCache) {
      if (entry.expiresAt <= now) {
        this.scopeCache.delete(cachedKey);
      }
    }

    const cached = this.scopeCache.get(key);
    if (cached) {
      return cached.scope;
    }

    const scope = this.computeScope(user, filters);
    this.scopeCache.set(key, {
      expiresAt: now + AnalyticsDashboardService.SCOPE_CACHE_TTL_MS,
      scope,
    });
    scope.catch(() => {
      if (this.scopeCache.get(key)?.scope === scope) {
        this.scopeCache.delete(key);
      }
    });

    return scope;
  }

  private async computeScope(
    user: PermissionUser,
    filters: NormalizedDashboardFilters,
  ): Promise<DashboardScope> {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const organizationId = user.organizationId;
    const canViewOrganization = await isOrgOwner(
      user,
      organizationId,
      this.prisma,
    );
    const accessibleProjects = await this.prisma.project.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(canViewOrganization
          ? {}
          : { members: { some: { userId: user.id } } }),
      },
      select: { id: true },
    });
    const accessibleProjectIds = accessibleProjects.map(
      (project) => project.id,
    );
    const requestedProjectIds = [...new Set(filters.projectIds ?? [])];

    if (requestedProjectIds.some((id) => !accessibleProjectIds.includes(id))) {
      throw new ForbiddenException(
        'A requested project is outside your analytics scope',
      );
    }

    const requestedUserIds = [...new Set(filters.userIds ?? [])];
    if (!canViewOrganization && requestedUserIds.some((id) => id !== user.id)) {
      throw new ForbiddenException(
        'Organization members can only request their own analytics',
      );
    }

    if (canViewOrganization && requestedUserIds.length > 0) {
      const validUsers = await this.prisma.user.findMany({
        where: {
          id: { in: requestedUserIds },
          isActive: true,
          organizationMemberships: { some: { organizationId } },
        },
        select: { id: true },
      });
      if (validUsers.length !== requestedUserIds.length) {
        throw new ForbiddenException(
          'A requested user is outside your organization',
        );
      }
    }

    return {
      organizationId,
      projectIds:
        requestedProjectIds.length > 0
          ? requestedProjectIds
          : accessibleProjectIds,
      userIds:
        requestedUserIds.length > 0
          ? requestedUserIds
          : canViewOrganization
            ? undefined
            : [user.id],
      canViewOrganization,
      canFilterUsers: canViewOrganization,
    };
  }

  private async prepare(
    user: DashboardUser,
    dto: DashboardFiltersDto,
    heatmap = false,
  ) {
    const filters = normalizeDashboardFilters(dto, {
      heatmap,
      defaultFrom: organizationCreatedAt(user),
    });
    const scope = await this.resolveScope(user, filters);
    return { filters, scope };
  }

  private buildTaskWhere(
    filters: NormalizedDashboardFilters,
    scope: DashboardScope,
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      organizationId: scope.organizationId,
      projectId: { in: scope.projectIds },
      parentTaskId: null,
    };
    const conditions: Prisma.TaskWhereInput[] = [];

    if (scope.userIds) {
      conditions.push({
        OR: [
          { assignedToId: { in: scope.userIds } },
          { subTasks: { some: { assignedToId: { in: scope.userIds } } } },
        ],
      });
    }
    if (filters.statuses?.length)
      conditions.push({ status: { in: filters.statuses } });
    if (filters.priorities?.length)
      conditions.push({ priority: { in: filters.priorities } });
    if (filters.assigned === DashboardAssignedFilter.ASSIGNED)
      conditions.push({
        OR: [
          { assignedToId: { not: null } },
          { subTasks: { some: { assignedToId: { not: null } } } },
        ],
      });
    if (filters.assigned === DashboardAssignedFilter.UNASSIGNED)
      conditions.push({
        assignedToId: null,
        subTasks: { every: { assignedToId: null } },
      });

    if (filters.overdue === true) {
      conditions.push({
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      });
    } else if (filters.overdue === false) {
      conditions.push({
        NOT: { dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE } },
      });
    }

    if (filters.blocked === true)
      conditions.push({ status: TaskStatus.BLOCKED });
    if (filters.blocked === false)
      conditions.push({ status: { not: TaskStatus.BLOCKED } });
    if (filters.hasTime !== undefined) {
      conditions.push(
        filters.hasTime
          ? {
              OR: [
                { timeEntries: { some: { endTime: { not: null } } } },
                {
                  subTasks: {
                    some: { timeEntries: { some: { endTime: { not: null } } } },
                  },
                },
              ],
            }
          : {
              timeEntries: { none: { endTime: { not: null } } },
              subTasks: {
                every: { timeEntries: { none: { endTime: { not: null } } } },
              },
            },
      );
    }

    const range = { gte: filters.from, lt: filters.to };
    if (filters.dateField === DashboardDateField.CREATED)
      conditions.push({ createdAt: range });
    if (filters.dateField === DashboardDateField.DUE)
      conditions.push({ dueDate: range });
    // Activity ranges are applied to TimeEntry, not to a mutable Task timestamp.

    if (conditions.length > 0) where.AND = conditions;

    return where;
  }

  /**
   * SQL twin of buildTaskWhere for root tasks aliased as "t". Both must keep the
   * same semantics, including Prisma's NULL handling; the dashboard SQL parity
   * e2e test compares them filter by filter.
   */
  private buildTaskFilterSql(
    filters: NormalizedDashboardFilters,
    scope: DashboardScope,
    now: Date,
  ): Prisma.Sql {
    const hasSubTask = (condition: Prisma.Sql) =>
      Prisma.sql`EXISTS (SELECT 1 FROM "Task" sub WHERE sub."parentTaskId" = t.id AND ${condition})`;
    const hasClosedTime = Prisma.sql`(
      EXISTS (SELECT 1 FROM "TimeEntry" root_te WHERE root_te."taskId" = t.id AND root_te."endTime" IS NOT NULL)
      OR ${hasSubTask(Prisma.sql`EXISTS (SELECT 1 FROM "TimeEntry" sub_te WHERE sub_te."taskId" = sub.id AND sub_te."endTime" IS NOT NULL)`)}
    )`;
    const isOverdue = Prisma.sql`(t."dueDate" < ${sqlTimestamp(now)} AND t.status <> 'DONE')`;
    const hasAssignedSubTask = hasSubTask(
      Prisma.sql`sub."assignedToId" IS NOT NULL`,
    );
    const conditions: Prisma.Sql[] = [
      Prisma.sql`t."organizationId" = ${scope.organizationId}`,
      Prisma.sql`t."projectId" = ANY(${scope.projectIds}::text[])`,
      Prisma.sql`t."parentTaskId" IS NULL`,
    ];

    if (scope.userIds)
      conditions.push(
        Prisma.sql`(t."assignedToId" = ANY(${scope.userIds}::text[]) OR ${hasSubTask(Prisma.sql`sub."assignedToId" = ANY(${scope.userIds}::text[])`)})`,
      );
    if (filters.statuses?.length)
      conditions.push(
        Prisma.sql`t.status = ANY(${filters.statuses}::"TaskStatus"[])`,
      );
    if (filters.priorities?.length)
      conditions.push(
        Prisma.sql`t.priority = ANY(${filters.priorities}::"Priority"[])`,
      );
    if (filters.assigned === DashboardAssignedFilter.ASSIGNED)
      conditions.push(
        Prisma.sql`(t."assignedToId" IS NOT NULL OR ${hasAssignedSubTask})`,
      );
    if (filters.assigned === DashboardAssignedFilter.UNASSIGNED)
      conditions.push(
        Prisma.sql`(t."assignedToId" IS NULL AND NOT ${hasAssignedSubTask})`,
      );
    if (filters.overdue === true) conditions.push(isOverdue);
    else if (filters.overdue === false)
      conditions.push(Prisma.sql`NOT ${isOverdue}`);
    if (filters.blocked === true)
      conditions.push(Prisma.sql`t.status = 'BLOCKED'`);
    if (filters.blocked === false)
      conditions.push(Prisma.sql`t.status <> 'BLOCKED'`);
    if (filters.hasTime !== undefined)
      conditions.push(
        filters.hasTime ? hasClosedTime : Prisma.sql`NOT ${hasClosedTime}`,
      );

    const from = sqlTimestamp(filters.from);
    const to = sqlTimestamp(filters.to);
    if (filters.dateField === DashboardDateField.CREATED)
      conditions.push(
        Prisma.sql`t."createdAt" >= ${from} AND t."createdAt" < ${to}`,
      );
    if (filters.dateField === DashboardDateField.DUE)
      conditions.push(
        Prisma.sql`t."dueDate" >= ${from} AND t."dueDate" < ${to}`,
      );

    return Prisma.join(conditions, ' AND ');
  }

  /** SQL twin of buildTimeEntryWhere (without task filter) for entries aliased as "te". */
  private buildTimeEntryFilterSql(
    filters: NormalizedDashboardFilters,
    scope: DashboardScope,
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`te."organizationId" = ${scope.organizationId}`,
      Prisma.sql`te."projectId" = ANY(${scope.projectIds}::text[])`,
      Prisma.sql`te."endTime" IS NOT NULL`,
      Prisma.sql`te."endTime" > ${sqlTimestamp(filters.from)}`,
      Prisma.sql`te."startTime" < ${sqlTimestamp(filters.to)}`,
    ];
    if (scope.userIds)
      conditions.push(Prisma.sql`te."userId" = ANY(${scope.userIds}::text[])`);
    return Prisma.join(conditions, ' AND ');
  }

  private buildTimeEntryWhere(
    filters: NormalizedDashboardFilters,
    scope: DashboardScope,
    taskWhere?: Prisma.TaskWhereInput,
  ): Prisma.TimeEntryWhereInput {
    return {
      organizationId: scope.organizationId,
      projectId: { in: scope.projectIds },
      ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
      endTime: { not: null, gt: filters.from },
      startTime: { lt: filters.to },
      ...(taskWhere
        ? {
            task: {
              OR: [taskWhere, { parentTask: taskWhere }],
            },
          }
        : {}),
    };
  }

  private responseContext(
    filters: NormalizedDashboardFilters,
    scope: DashboardScope,
  ) {
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      timezone: filters.timezone,
      scope: {
        organizationId: scope.organizationId,
        projectIds: scope.projectIds,
        userIds: scope.userIds ?? [],
      },
    };
  }

  private sumActiveMs(
    entries: Array<{
      startTime: Date;
      endTime: Date | null;
      totalPausedMs: number | null;
    }>,
    filters: NormalizedDashboardFilters,
  ) {
    return entries.reduce(
      (total, entry) =>
        total + calculateActiveMsWithinRange(entry, filters.from, filters.to),
      0,
    );
  }

  private mobileRange(dto: MobileSummaryDto) {
    const now = new Date();
    const timezone = dto.timezone || 'America/Argentina/Buenos_Aires';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const localDate = new Date(
      Date.UTC(value('year'), value('month') - 1, value('day')),
    );
    if (dto.period === MobileSummaryPeriod.WEEK) {
      const mondayOffset = (localDate.getUTCDay() + 6) % 7;
      localDate.setUTCDate(localDate.getUTCDate() - mondayOffset);
    } else {
      localDate.setUTCDate(1);
    }
    const from = localDate.toISOString().slice(0, 10);
    return normalizeDashboardFilters({
      from,
      to: now.toISOString(),
      timezone,
    });
  }

  async getMobileSummary(user: DashboardUser, dto: MobileSummaryDto) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const organizationId = user.organizationId;
    const filters = this.mobileRange(dto);
    const canViewOrganization = await isOrgOwner(
      user,
      organizationId,
      this.prisma,
    );
    if (dto.scope === MobileSummaryScope.ORGANIZATION && !canViewOrganization) {
      throw new ForbiddenException(
        'Organization members cannot request organization aggregates',
      );
    }
    const wantsOrganization = dto.scope === MobileSummaryScope.ORGANIZATION;
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(canViewOrganization
          ? {}
          : { members: { some: { userId: user.id } } }),
      },
      select: { id: true },
    });
    const projectIds = projects.map((project) => project.id);
    const baseTaskWhere: Prisma.TaskWhereInput = {
      organizationId,
      projectId: { in: projectIds },
      parentTaskId: null,
    };
    const ownTaskWhere: Prisma.TaskWhereInput = {
      AND: [
        baseTaskWhere,
        {
          OR: [
            { assignedToId: user.id },
            { subTasks: { some: { assignedToId: user.id } } },
          ],
        },
      ],
    };
    const confirmedTimeWhere: Prisma.TimeEntryWhereInput = {
      organizationId,
      projectId: { in: projectIds },
      endTime: { not: null, gt: filters.from },
      startTime: { lt: filters.to },
    };
    const now = new Date();
    const [
      ownStatuses,
      ownOverdue,
      ownEntries,
      teamStatuses,
      teamOverdue,
      unassigned,
      teamEntries,
      users,
    ] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: ownTaskWhere,
        _count: { id: true },
      }),
      this.prisma.task.count({
        where: {
          AND: [
            ownTaskWhere,
            { dueDate: { lt: now }, status: { not: TaskStatus.DONE } },
          ],
        },
      }),
      this.prisma.timeEntry.findMany({
        where: { ...confirmedTimeWhere, userId: user.id },
        select: { startTime: true, endTime: true, totalPausedMs: true },
      }),
      wantsOrganization
        ? this.prisma.task.groupBy({
            by: ['status'],
            where: baseTaskWhere,
            _count: { id: true },
          })
        : Promise.resolve([]),
      wantsOrganization
        ? this.prisma.task.count({
            where: {
              AND: [
                baseTaskWhere,
                { dueDate: { lt: now }, status: { not: TaskStatus.DONE } },
              ],
            },
          })
        : Promise.resolve(0),
      wantsOrganization
        ? this.prisma.task.count({
            where: {
              AND: [
                baseTaskWhere,
                {
                  assignedToId: null,
                  subTasks: { every: { assignedToId: null } },
                },
              ],
            },
          })
        : Promise.resolve(0),
      wantsOrganization
        ? this.prisma.timeEntry.findMany({
            where: confirmedTimeWhere,
            select: {
              userId: true,
              startTime: true,
              endTime: true,
              totalPausedMs: true,
            },
          })
        : Promise.resolve([]),
      wantsOrganization
        ? this.prisma.user.findMany({
            where: {
              isActive: true,
              organizationMemberships: { some: { organizationId } },
            },
            select: { id: true, name: true, lastname: true },
          })
        : Promise.resolve([]),
    ]);

    const distribution = (rows: typeof ownStatuses) =>
      Object.fromEntries(rows.map((row) => [row.status, row._count.id]));
    const own = distribution(ownStatuses);
    const ownHours = roundHours(this.sumActiveMs(ownEntries, filters));
    const response = {
      period: dto.period,
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      timezone: filters.timezone,
      privacy: 'self-only',
      completedInPeriod: null,
      completedMetricReason: 'Task.completedAt is not available.',
      own: {
        pendingTasks: own[TaskStatus.TODO] ?? 0,
        inProgressTasks: own[TaskStatus.IN_PROGRESS] ?? 0,
        blockedTasks: own[TaskStatus.BLOCKED] ?? 0,
        overdueTasks: ownOverdue,
        confirmedHours: ownHours,
        activeProjects: projectIds.length,
      },
    };
    if (dto.scope !== MobileSummaryScope.ORGANIZATION) return response;

    const team = distribution(teamStatuses);
    const hoursByUser = new Map<string, number>();
    for (const entry of teamEntries) {
      hoursByUser.set(
        entry.userId,
        (hoursByUser.get(entry.userId) ?? 0) +
          calculateActiveMsWithinRange(entry, filters.from, filters.to),
      );
    }
    return {
      ...response,
      privacy: 'organization-aggregate',
      organization: {
        confirmedHours: roundHours(this.sumActiveMs(teamEntries, filters)),
        overdueTasks: teamOverdue,
        unassignedTasks: unassigned,
        activeProjects: projectIds.length,
        statusDistribution: Object.values(TaskStatus).map((status) => ({
          status,
          count: team[status] ?? 0,
        })),
        hoursByUser: users.map((target) => ({
          userId: target.id,
          name: `${target.name} ${target.lastname}`.trim(),
          confirmedHours: roundHours(hoursByUser.get(target.id) ?? 0),
        })),
      },
    };
  }

  private taskEstimate(task: {
    estimatedHours: number | null;
    subTasks?: Array<{ estimatedHours: number | null }>;
  }) {
    if (task.subTasks?.length) {
      return task.subTasks.reduce(
        (sum, subTask) => sum + (subTask.estimatedHours ?? 0),
        0,
      );
    }

    return task.estimatedHours ?? 0;
  }

  private sumTaskEstimates(
    tasks: Array<{
      estimatedHours: number | null;
      subTasks?: Array<{ estimatedHours: number | null }>;
    }>,
  ) {
    return Number(
      tasks.reduce((sum, task) => sum + this.taskEstimate(task), 0).toFixed(2),
    );
  }

  /**
   * Summary KPIs in one round trip: the task filter is evaluated once (CTE
   * "filtered") and every count, estimate and pause-adjusted time total is
   * derived from it inside Postgres.
   */
  async getSummary(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto);
    const now = new Date();

    const [row] = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT t.id, t.status, t."dueDate", t."estimatedHours", t."assignedToId"
        FROM "Task" t
        WHERE ${this.buildTaskFilterSql(filters, scope, now)}
      ),
      children AS (
        SELECT c.id, c."parentTaskId", c."estimatedHours", c."assignedToId"
        FROM "Task" c
        JOIN filtered f ON c."parentTaskId" = f.id
      ),
      task_ids AS (
        SELECT id, id AS root_id FROM filtered
        UNION ALL
        SELECT id, "parentTaskId" AS root_id FROM children
      ),
      timed_roots AS (
        SELECT DISTINCT ids.root_id
        FROM task_ids ids
        JOIN "TimeEntry" te ON te."taskId" = ids.id
        WHERE te."endTime" IS NOT NULL
      ),
      entries AS (
        SELECT te."userId", ${activeMsWithinRangeSql(filters.from, filters.to)} AS active_ms
        FROM task_ids ids
        JOIN "TimeEntry" te ON te."taskId" = ids.id
        WHERE ${this.buildTimeEntryFilterSql(filters, scope)}
      )
      SELECT
        COUNT(*)::int AS "totalTasks",
        COUNT(*) FILTER (WHERE f.status = 'DONE')::int AS "completedTasks",
        COUNT(*) FILTER (WHERE f.status = 'BLOCKED')::int AS "blockedTasks",
        COUNT(*) FILTER (
          WHERE f."dueDate" < ${sqlTimestamp(now)} AND f.status <> 'DONE'
        )::int AS "overdueTasks",
        COUNT(*) FILTER (
          WHERE f."assignedToId" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM children c
              WHERE c."parentTaskId" = f.id AND c."assignedToId" IS NOT NULL
            )
        )::int AS "unassignedTasks",
        COUNT(*) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM timed_roots tr WHERE tr.root_id = f.id)
        )::int AS "tasksWithoutTime",
        COALESCE(SUM(f."estimatedHours") FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM children c WHERE c."parentTaskId" = f.id)
        ), 0)::float8 AS "leafEstimatedHours",
        (SELECT COALESCE(SUM(c."estimatedHours"), 0) FROM children c)::float8 AS "subTaskEstimatedHours",
        (SELECT COALESCE(SUM(e.active_ms), 0) FROM entries e)::float8 AS "activeMs",
        (SELECT COUNT(DISTINCT e."userId") FROM entries e WHERE e.active_ms > 0)::int AS "activeUsers"
      FROM filtered f
    `);

    const { totalTasks, completedTasks } = row;
    const estimatedHours = Number(
      (row.leafEstimatedHours + row.subTaskEstimatedHours).toFixed(2),
    );
    const actualHours = roundHours(row.activeMs);

    return {
      ...this.responseContext(filters, scope),
      metricSemantics: {
        tasks:
          'Current task state within the selected task date range; completedAt is not available.',
        time: 'Closed time entries intersecting the selected half-open range.',
      },
      kpis: {
        totalTasks,
        openTasks: totalTasks - completedTasks,
        completedTasks,
        overdueTasks: row.overdueTasks,
        blockedTasks: row.blockedTasks,
        completionRate: percentage(completedTasks, totalTasks) ?? 0,
        estimatedHours,
        actualHours,
        effortDeviationHours: Number((actualHours - estimatedHours).toFixed(2)),
        activeUsers: row.activeUsers,
        tasksWithoutTime: row.tasksWithoutTime,
        unassignedTasks: row.unassignedTasks,
      },
    };
  }

  /**
   * Task section: status/priority distributions and the critical total come from
   * one grouped query; the paginated critical table keeps Prisma's cursor paging.
   */
  async getTasks(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto);
    const taskWhere = this.buildTaskWhere(filters, scope);
    const now = new Date();
    const criticalWhere: Prisma.TaskWhereInput = {
      AND: [
        taskWhere,
        {
          OR: [
            { dueDate: { lt: now }, status: { not: TaskStatus.DONE } },
            { status: TaskStatus.BLOCKED },
            { priority: { in: [Priority.HIGH, Priority.CRITICAL] } },
          ],
        },
      ],
    };

    const [countRows, page] = await Promise.all([
      this.prisma.$queryRaw<TaskCountRow[]>(Prisma.sql`
        WITH filtered AS (
          SELECT t.status, t.priority, t."dueDate"
          FROM "Task" t
          WHERE ${this.buildTaskFilterSql(filters, scope, now)}
        )
        SELECT 'status' AS dimension, f.status::text AS value, COUNT(*)::int AS count
        FROM filtered f
        GROUP BY f.status
        UNION ALL
        SELECT 'priority', f.priority::text, COUNT(*)::int
        FROM filtered f
        GROUP BY f.priority
        UNION ALL
        SELECT 'critical', NULL, COUNT(*)::int
        FROM filtered f
        WHERE (f."dueDate" < ${sqlTimestamp(now)} AND f.status <> 'DONE')
          OR f.status = 'BLOCKED'
          OR f.priority IN ('HIGH', 'CRITICAL')
      `),
      this.prisma.task.findMany({
        where: criticalWhere,
        take: filters.limit + 1,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { status: 'desc' },
          { priority: 'desc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        select: {
          id: true,
          title: true,
          projectId: true,
          status: true,
          priority: true,
          estimatedHours: true,
          dueDate: true,
          createdAt: true,
          subTasks: {
            select: {
              id: true,
              estimatedHours: true,
            },
          },
          project: { select: { name: true } },
          assignedTo: { select: { id: true, name: true, lastname: true } },
        },
      }),
    ]);

    const hasNextPage = page.length > filters.limit;
    const pageItems = hasNextPage ? page.slice(0, filters.limit) : page;
    const subTaskParentById = new Map<string, string>();
    for (const task of pageItems) {
      for (const subTask of task.subTasks) {
        subTaskParentById.set(subTask.id, task.id);
      }
    }
    const timedTaskIds = [
      ...pageItems.map((task) => task.id),
      ...[...subTaskParentById.keys()],
    ];
    const entryRows = timedTaskIds.length
      ? await this.prisma.timeEntry.findMany({
          where: {
            ...this.buildTimeEntryWhere(filters, scope),
            taskId: { in: timedTaskIds },
          },
          select: {
            taskId: true,
            startTime: true,
            endTime: true,
            totalPausedMs: true,
          },
        })
      : [];
    const actualByTask = new Map<string, number>();
    for (const entry of entryRows) {
      if (!entry.taskId) continue;
      const rootTaskId = subTaskParentById.get(entry.taskId) ?? entry.taskId;
      actualByTask.set(
        rootTaskId,
        (actualByTask.get(rootTaskId) ?? 0) +
          calculateActiveMsWithinRange(entry, filters.from, filters.to),
      );
    }

    const statusOrder = Object.values(TaskStatus);
    const priorityOrder = Object.values(Priority);
    const rowsOf = (dimension: TaskCountRow['dimension']) =>
      countRows.filter((row) => row.dimension === dimension);
    const total = rowsOf('critical')[0]?.count ?? 0;

    return {
      ...this.responseContext(filters, scope),
      statusDistribution: rowsOf('status')
        .map((row) => ({ status: row.value as TaskStatus, count: row.count }))
        .sort(
          (a, b) =>
            statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
        ),
      priorityDistribution: rowsOf('priority')
        .map((row) => ({ priority: row.value as Priority, count: row.count }))
        .sort(
          (a, b) =>
            priorityOrder.indexOf(a.priority) -
            priorityOrder.indexOf(b.priority),
        ),
      criticalTasks: {
        items: pageItems.map((task) => {
          const estimatedHours = this.taskEstimate(task);
          const actualHours = roundHours(actualByTask.get(task.id) ?? 0);
          return {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            projectName: task.project.name,
            status: task.status,
            priority: task.priority,
            assignedTo: task.assignedTo
              ? {
                  id: task.assignedTo.id,
                  name: `${task.assignedTo.name} ${task.assignedTo.lastname}`.trim(),
                }
              : null,
            estimatedHours,
            actualHours,
            deviationHours: Number((actualHours - estimatedHours).toFixed(2)),
            dueDate: task.dueDate,
            createdAt: task.createdAt,
          };
        }),
        nextCursor: hasNextPage ? (pageItems.at(-1)?.id ?? null) : null,
        total,
      },
    };
  }

  async getTime(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto);
    const taskWhere = this.buildTaskWhere(filters, scope);
    const [rootTasks, entries] = await Promise.all([
      this.prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          estimatedHours: true,
          subTasks: {
            select: {
              id: true,
              estimatedHours: true,
            },
          },
          project: { select: { name: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: this.buildTimeEntryWhere(filters, scope, taskWhere),
        select: {
          taskId: true,
          startTime: true,
          endTime: true,
          totalPausedMs: true,
        },
      }),
    ]);

    const rootTaskById = new Map(rootTasks.map((task) => [task.id, task]));
    const subTaskParentById = new Map<string, string>();
    for (const task of rootTasks) {
      for (const subTask of task.subTasks) {
        subTaskParentById.set(subTask.id, task.id);
      }
    }
    const actualByTask = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.taskId) continue;
      const rootTaskId = subTaskParentById.get(entry.taskId) ?? entry.taskId;
      actualByTask.set(
        rootTaskId,
        (actualByTask.get(rootTaskId) ?? 0) +
          calculateActiveMsWithinRange(entry, filters.from, filters.to),
      );
    }

    const taskMetrics = [...actualByTask.keys()]
      .map((taskId) => rootTaskById.get(taskId))
      .filter((task): task is NonNullable<typeof task> => task !== undefined)
      .map((task) => {
        const estimatedHours = this.taskEstimate(task);
        const actualHours = roundHours(actualByTask.get(task.id) ?? 0);
        return {
          taskId: task.id,
          title: task.title,
          projectName: task.project.name,
          status: task.status,
          priority: task.priority,
          estimatedHours,
          actualHours,
          deviationHours: Number((actualHours - estimatedHours).toFixed(2)),
        };
      });
    const estimatedHours = this.sumTaskEstimates(rootTasks);
    const actualHours = Number(
      taskMetrics.reduce((sum, task) => sum + task.actualHours, 0).toFixed(2),
    );
    const deviationHours = Number((actualHours - estimatedHours).toFixed(2));

    const aggregateBy = (field: 'status' | 'priority') => {
      const grouped = new Map<
        string,
        { estimatedHours: number; actualHours: number }
      >();
      for (const task of rootTasks) {
        const key = task[field];
        if (!key) continue;
        const current = grouped.get(key) ?? {
          estimatedHours: 0,
          actualHours: 0,
        };
        current.estimatedHours += this.taskEstimate(task);
        grouped.set(key, current);
      }
      for (const task of taskMetrics) {
        const key = task[field];
        const current = grouped.get(key);
        if (!current) {
          grouped.set(key, {
            estimatedHours: 0,
            actualHours: task.actualHours,
          });
          continue;
        }
        current.actualHours += task.actualHours;
        grouped.set(key, {
          estimatedHours: current.estimatedHours,
          actualHours: current.actualHours,
        });
      }
      return [...grouped.entries()].map(([key, values]) => ({
        [field]: key,
        estimatedHours: Number(values.estimatedHours.toFixed(2)),
        actualHours: Number(values.actualHours.toFixed(2)),
      }));
    };

    return {
      ...this.responseContext(filters, scope),
      totals: {
        estimatedHours,
        actualHours,
        deviationHours,
        deviationPercent: percentage(deviationHours, estimatedHours),
      },
      topTasksByTime: [...taskMetrics]
        .sort((a, b) => b.actualHours - a.actualHours)
        .slice(0, 10),
      topTasksByDeviation: [...taskMetrics]
        .sort((a, b) => b.deviationHours - a.deviationHours)
        .slice(0, 10),
      timeByStatus: aggregateBy('status'),
      timeByPriority: aggregateBy('priority'),
    };
  }

  /**
   * Project health in one round trip: task counts and estimates come from the
   * filtered task set, while hours use every time entry of the project in range
   * (the task filter does not apply to project hours).
   */
  async getProjects(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto);
    const now = new Date();

    const rows = await this.prisma.$queryRaw<ProjectRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT t.id, t."projectId", t.status, t."dueDate", t."estimatedHours"
        FROM "Task" t
        WHERE ${this.buildTaskFilterSql(filters, scope, now)}
      ),
      task_stats AS (
        SELECT
          f."projectId",
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE f.status = 'DONE')::int AS completed,
          COUNT(*) FILTER (WHERE f.status = 'BLOCKED')::int AS blocked,
          COUNT(*) FILTER (
            WHERE f."dueDate" < ${sqlTimestamp(now)} AND f.status <> 'DONE'
          )::int AS overdue,
          COALESCE(SUM(f."estimatedHours") FILTER (
            WHERE NOT EXISTS (SELECT 1 FROM "Task" c WHERE c."parentTaskId" = f.id)
          ), 0)::float8 AS leaf_estimate
        FROM filtered f
        GROUP BY f."projectId"
      ),
      child_stats AS (
        SELECT c."projectId", COALESCE(SUM(c."estimatedHours"), 0)::float8 AS child_estimate
        FROM "Task" c
        JOIN filtered f ON c."parentTaskId" = f.id
        GROUP BY c."projectId"
      ),
      time_stats AS (
        SELECT
          e."projectId",
          SUM(e.active_ms)::float8 AS active_ms,
          COUNT(DISTINCT e."userId") FILTER (WHERE e.active_ms > 0)::int AS active_users
        FROM (
          SELECT te."projectId", te."userId", ${activeMsWithinRangeSql(filters.from, filters.to)} AS active_ms
          FROM "TimeEntry" te
          WHERE ${this.buildTimeEntryFilterSql(filters, scope)}
        ) e
        GROUP BY e."projectId"
      )
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        COALESCE(ts.total, 0) AS "totalTasks",
        COALESCE(ts.completed, 0) AS "completedTasks",
        COALESCE(ts.blocked, 0) AS "blockedTasks",
        COALESCE(ts.overdue, 0) AS "overdueTasks",
        COALESCE(ts.leaf_estimate, 0) + COALESCE(cs.child_estimate, 0) AS "estimatedHours",
        COALESCE(tm.active_ms, 0) AS "activeMs",
        COALESCE(tm.active_users, 0) AS "activeUsers"
      FROM "Project" p
      LEFT JOIN task_stats ts ON ts."projectId" = p.id
      LEFT JOIN child_stats cs ON cs."projectId" = p.id
      LEFT JOIN time_stats tm ON tm."projectId" = p.id
      WHERE p.id = ANY(${scope.projectIds}::text[])
        AND p."organizationId" = ${scope.organizationId}
        AND p."isActive" = true
      ORDER BY p."createdAt", p.id
    `);

    return {
      ...this.responseContext(filters, scope),
      projects: rows.map((row) => {
        const estimatedHours = Number(row.estimatedHours.toFixed(2));
        const actualHours = roundHours(row.activeMs);
        const deviationHours = Number(
          (actualHours - estimatedHours).toFixed(2),
        );
        return {
          projectId: row.projectId,
          projectName: row.projectName,
          totalTasks: row.totalTasks,
          openTasks: row.totalTasks - row.completedTasks,
          completedTasks: row.completedTasks,
          overdueTasks: row.overdueTasks,
          blockedTasks: row.blockedTasks,
          estimatedHours,
          actualHours,
          deviationHours,
          deviationPercent: percentage(deviationHours, estimatedHours),
          activeUsers: row.activeUsers,
        };
      }),
    };
  }

  async getUsers(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto);
    const taskWhere = this.buildTaskWhere(filters, scope);
    const [users, rootTasks, entries] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          isActive: true,
          organizationMemberships: {
            some: { organizationId: scope.organizationId },
          },
          ...(scope.userIds ? { id: { in: scope.userIds } } : {}),
        },
        select: { id: true, name: true, lastname: true },
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          assignedToId: true,
          status: true,
          estimatedHours: true,
          subTasks: {
            select: {
              assignedToId: true,
              estimatedHours: true,
            },
          },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: this.buildTimeEntryWhere(filters, scope),
        select: {
          userId: true,
          startTime: true,
          endTime: true,
          totalPausedMs: true,
        },
      }),
    ]);

    const timeByUser = new Map<string, number>();
    const daysByUser = new Map<string, Set<string>>();
    const lastActivityByUser = new Map<string, Date>();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: filters.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    for (const entry of entries) {
      const activeMs = calculateActiveMsWithinRange(
        entry,
        filters.from,
        filters.to,
      );
      if (!entry.endTime || activeMs <= 0) continue;
      timeByUser.set(
        entry.userId,
        (timeByUser.get(entry.userId) ?? 0) + activeMs,
      );
      const days = daysByUser.get(entry.userId) ?? new Set<string>();
      const activityStart = new Date(
        Math.max(entry.startTime.getTime(), filters.from.getTime()),
      );
      days.add(dateFormatter.format(activityStart));
      daysByUser.set(entry.userId, days);
      const previous = lastActivityByUser.get(entry.userId);
      const activityEnd = new Date(
        Math.min(entry.endTime.getTime(), filters.to.getTime()),
      );
      if (!previous || activityEnd > previous)
        lastActivityByUser.set(entry.userId, activityEnd);
    }

    return {
      ...this.responseContext(filters, scope),
      privacy: scope.canViewOrganization
        ? 'organization-aggregate'
        : 'self-only',
      users: users.map((target) => {
        const assignedTasks = rootTasks.filter(
          (task) =>
            task.assignedToId === target.id ||
            task.subTasks.some((subTask) => subTask.assignedToId === target.id),
        );
        const estimatedHours = assignedTasks.reduce((sum, task) => {
          if (task.subTasks.length > 0) {
            return (
              sum +
              task.subTasks
                .filter((subTask) => subTask.assignedToId === target.id)
                .reduce(
                  (subSum, subTask) => subSum + (subTask.estimatedHours ?? 0),
                  0,
                )
            );
          }

          return task.assignedToId === target.id
            ? sum + (task.estimatedHours ?? 0)
            : sum;
        }, 0);
        return {
          userId: target.id,
          name: `${target.name} ${target.lastname}`.trim(),
          assignedTasks: assignedTasks.length,
          completedTasks: assignedTasks.filter(
            (task) => task.status === TaskStatus.DONE,
          ).length,
          estimatedHours: Number(estimatedHours.toFixed(2)),
          actualHours: roundHours(timeByUser.get(target.id) ?? 0),
          activeDays: daysByUser.get(target.id)?.size ?? 0,
          lastActivityAt:
            lastActivityByUser.get(target.id)?.toISOString() ?? null,
        };
      }),
    };
  }

  async getHeatmap(user: DashboardUser, dto: DashboardFiltersDto) {
    const { filters, scope } = await this.prepare(user, dto, true);
    const entries = await this.prisma.timeEntry.findMany({
      where: this.buildTimeEntryWhere(filters, scope),
      select: {
        id: true,
        userId: true,
        projectId: true,
        startTime: true,
        endTime: true,
        totalPausedMs: true,
      },
    });
    const heatmap = buildHourlyHeatmap(entries, filters);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      timezone: filters.timezone,
      groupBy: filters.groupBy,
      ...heatmap,
    };
  }
}
