import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner, PermissionUser } from 'src/common/permissions';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import {
  calculateActiveMsWithinRange,
  normalizeDashboardFilters,
  NormalizedDashboardFilters,
  percentage,
  roundHours,
} from './analytics-dashboard.utils';
import { fileDate, MAX_EXPORT_ROWS, statusLabels } from './report/report-theme';
import { renderReportExcel } from './report/report-excel';
import { renderReportPdf } from './report/report-pdf';
import {
  ReportDocument,
  ReportScope,
  ReportTask,
  ReportTaskRow,
  ReportUserMetric,
} from './report/report-types';

export type {
  ReportDocument,
  ReportTaskRow,
  ReportUserMetric,
} from './report/report-types';

@Injectable()
export class AnalyticsReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveScope(
    user: PermissionUser,
    filters: NormalizedDashboardFilters,
  ): Promise<ReportScope> {
    if (!user.organizationId)
      throw new BadRequestException('User must belong to an organization');
    const organizationId = user.organizationId;
    const canViewOrganization = await isOrgOwner(
      user,
      organizationId,
      this.prisma,
    );
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
    const accessible = projects.map(({ id }) => id);
    const requestedProjects = [...new Set(filters.projectIds ?? [])];
    if (requestedProjects.some((id) => !accessible.includes(id)))
      throw new ForbiddenException(
        'A requested project is outside your analytics scope',
      );
    const requestedUsers = [...new Set(filters.userIds ?? [])];
    if (!canViewOrganization && requestedUsers.some((id) => id !== user.id))
      throw new ForbiddenException(
        'Organization members can only request their own analytics',
      );
    if (canViewOrganization && requestedUsers.length) {
      const valid = await this.prisma.user.findMany({
        where: {
          id: { in: requestedUsers },
          isActive: true,
          organizationMemberships: { some: { organizationId } },
        },
        select: { id: true },
      });
      if (valid.length !== requestedUsers.length)
        throw new ForbiddenException(
          'A requested user is outside your organization',
        );
    }
    return {
      organizationId,
      projectIds: requestedProjects.length ? requestedProjects : accessible,
      userIds: requestedUsers.length
        ? requestedUsers
        : canViewOrganization
          ? undefined
          : [user.id],
      canViewOrganization,
    };
  }

  private activeHours(
    entries: Array<{
      startTime: Date;
      endTime: Date | null;
      totalPausedMs: number | null;
    }>,
    filters: NormalizedDashboardFilters,
  ) {
    return roundHours(
      entries.reduce(
        (sum, entry) =>
          sum + calculateActiveMsWithinRange(entry, filters.from, filters.to),
        0,
      ),
    );
  }

  private person(
    assigned: { id: string; name: string; lastname: string } | null,
  ) {
    return assigned
      ? {
          id: assigned.id,
          name: `${assigned.name} ${assigned.lastname}`.trim() || 'Sin nombre',
        }
      : null;
  }

  private unitRow(
    unit: ReportTask | ReportTask['subTasks'][number],
    parent: ReportTask | null,
    filters: NormalizedDashboardFilters,
  ): ReportTaskRow | null {
    const person = this.person(unit.assignedTo);
    const actualHours = this.activeHours(unit.timeEntries, filters);
    const createdInRange =
      unit.createdAt >= filters.from && unit.createdAt < filters.to;
    const hasOwnWork = Boolean(person || unit.estimatedHours || actualHours);
    if (!hasOwnWork || (!createdInRange && actualHours <= 0)) return null;
    if (filters.statuses?.length && !filters.statuses.includes(unit.status))
      return null;
    return {
      id: unit.id,
      title: unit.title,
      parentTitle: parent?.title ?? null,
      projectName: parent?.project.name ?? (unit as ReportTask).project.name,
      userId: person?.id ?? null,
      assignedTo: person?.name ?? 'Sin asignar',
      status: unit.status,
      estimatedHours: unit.estimatedHours ?? 0,
      actualHours,
      deviationHours: Number(
        (actualHours - (unit.estimatedHours ?? 0)).toFixed(2),
      ),
      createdAt: unit.createdAt,
      dueDate: unit.dueDate,
    };
  }

  async buildReport(
    user: PermissionUser,
    dto: DashboardFiltersDto,
  ): Promise<ReportDocument> {
    const filters = normalizeDashboardFilters(dto);
    const scope = await this.resolveScope(user, filters);
    const organization = await this.prisma.organization.findUnique({
      where: { id: scope.organizationId },
      select: { id: true, name: true },
    });
    if (!organization) throw new BadRequestException('Organization not found');
    const overlap: Prisma.TimeEntryWhereInput = {
      endTime: { not: null, gt: filters.from },
      startTime: { lt: filters.to },
    };
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId: scope.organizationId,
        projectId: { in: scope.projectIds },
        parentTaskId: null,
      },
      orderBy: [
        { project: { name: 'asc' } },
        { status: 'asc' },
        { title: 'asc' },
      ],
      include: {
        project: { select: { name: true } },
        assignedTo: { select: { id: true, name: true, lastname: true } },
        timeEntries: {
          where: overlap,
          select: { startTime: true, endTime: true, totalPausedMs: true },
        },
        subTasks: {
          include: {
            assignedTo: { select: { id: true, name: true, lastname: true } },
            timeEntries: {
              where: overlap,
              select: { startTime: true, endTime: true, totalPausedMs: true },
            },
          },
        },
      },
    });
    const rows: ReportTaskRow[] = [];
    for (const task of tasks as ReportTask[]) {
      for (const subTask of task.subTasks) {
        const row = this.unitRow(subTask, task, filters);
        if (row) rows.push(row);
      }
      const parent = this.unitRow(task, null, filters);
      if (parent && (task.timeEntries.length > 0 || task.subTasks.length === 0))
        rows.push(parent);
    }
    const scopedRows = scope.userIds
      ? rows.filter((row) => row.userId && scope.userIds!.includes(row.userId))
      : rows;
    if (scopedRows.length > MAX_EXPORT_ROWS)
      throw new BadRequestException(
        `El informe supera el límite de ${MAX_EXPORT_ROWS} filas. Aplicá filtros más específicos.`,
      );
    const users = new Map<string, ReportUserMetric>();
    for (const row of scopedRows) {
      if (!row.userId) continue;
      const metric = users.get(row.userId) ?? {
        userId: row.userId,
        name: row.assignedTo,
        totalTasks: 0,
        completedTasks: 0,
        incompleteTasks: 0,
        estimatedHours: 0,
        actualHours: 0,
        deviationHours: 0,
      };
      metric.totalTasks++;
      metric.completedTasks += row.status === TaskStatus.DONE ? 1 : 0;
      metric.incompleteTasks += row.status === TaskStatus.DONE ? 0 : 1;
      metric.estimatedHours += row.estimatedHours;
      metric.actualHours += row.actualHours;
      metric.deviationHours = metric.actualHours - metric.estimatedHours;
      users.set(row.userId, metric);
    }
    for (const metric of users.values())
      for (const key of [
        'estimatedHours',
        'actualHours',
        'deviationHours',
      ] as const)
        metric[key] = Number(metric[key].toFixed(2));
    const completed = scopedRows.filter(
      (row) => row.status === TaskStatus.DONE,
    ).length;
    const estimated = Number(
      scopedRows.reduce((sum, row) => sum + row.estimatedHours, 0).toFixed(2),
    );
    const actual = Number(
      scopedRows.reduce((sum, row) => sum + row.actualHours, 0).toFixed(2),
    );
    const projectNames = [
      ...new Set((tasks as ReportTask[]).map((task) => task.project.name)),
    ];
    return {
      organization,
      generatedAt: new Date().toISOString(),
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      timezone: filters.timezone,
      filters: {
        project: filters.projectIds?.length
          ? projectNames.join(', ') || 'Proyecto seleccionado'
          : 'Todos los proyectos',
        user: filters.userIds?.length
          ? [...users.values()].map((item) => item.name).join(', ') ||
            'Usuario seleccionado'
          : 'Todos los usuarios',
        status: filters.statuses?.length
          ? filters.statuses.map((status) => statusLabels[status]).join(', ')
          : 'Todos',
      },
      summary: {
        totalTasks: scopedRows.length,
        completedTasks: completed,
        incompleteTasks: scopedRows.length - completed,
        overdueTasks: scopedRows.filter(
          (row) =>
            row.status !== TaskStatus.DONE &&
            row.dueDate &&
            row.dueDate < filters.to,
        ).length,
        completionRate: percentage(completed, scopedRows.length) ?? 0,
        totalEstimatedHours: estimated,
        totalActualHours: actual,
        deviationHours: Number((actual - estimated).toFixed(2)),
      },
      statusDistribution: Object.values(TaskStatus).map((status) => ({
        status,
        label: statusLabels[status],
        count: scopedRows.filter((row) => row.status === status).length,
      })),
      users: [...users.values()].sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'es') ||
          a.userId.localeCompare(b.userId),
      ),
      tasks: scopedRows,
    };
  }

  async getPreview(user: PermissionUser, dto: DashboardFiltersDto) {
    const report = await this.buildReport(user, dto);
    const { tasks, ...preview } = report;
    return {
      ...preview,
      topTasksByTime: [...tasks]
        .sort((a, b) => b.actualHours - a.actualHours)
        .slice(0, 10),
      incompleteTasks: tasks
        .filter((row) => row.status !== TaskStatus.DONE)
        .slice(0, 20),
    };
  }

  async createExcel(user: PermissionUser, dto: DashboardFiltersDto) {
    const report = await this.buildReport(user, dto);
    return { report, buffer: await renderReportExcel(report) };
  }

  async createPdf(user: PermissionUser, dto: DashboardFiltersDto) {
    const report = await this.buildReport(user, dto);
    const individual = Boolean(dto.userIds?.length === 1);
    return { report, buffer: await renderReportPdf(report, individual) };
  }

  async sendExcel(
    user: PermissionUser,
    dto: DashboardFiltersDto,
    res: Response,
  ) {
    const { report, buffer } = await this.createExcel(user, dto);
    const date = fileDate(report.generatedAt);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="informe-tino-${date}.xlsx"`,
    );
    res.send(buffer);
  }
  async sendPdf(user: PermissionUser, dto: DashboardFiltersDto, res: Response) {
    const { report, buffer } = await this.createPdf(user, dto);
    const date = fileDate(report.generatedAt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="informe-tino-${date}.pdf"`,
    );
    res.send(buffer);
  }
}
