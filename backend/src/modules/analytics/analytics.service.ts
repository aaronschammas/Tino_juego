import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectMembersService } from '../projects/project-members.service';
import { TaskStatus, Priority } from '@prisma/client';
import { isOrgOwner, PermissionUser } from 'src/common/permissions';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectMembers: ProjectMembersService,
  ) {}

  private getPeriodStart(period?: 'week' | 'month' | 'total'): Date | null {
    if (!period || period === 'total') return null;

    const now = new Date();
    if (period === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return start;
    }

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start;
  }

  private calculateActiveMs(
    entry: { startTime: Date; endTime: Date | null; totalPausedMs: number | null },
  ) {
    if (!entry.endTime) return 0;
    return Math.max(
      0,
      entry.endTime.getTime() -
        entry.startTime.getTime() -
        Math.max(0, entry.totalPausedMs ?? 0),
    );
  }

  // =========================
  // BI DATA 
  // =========================
  async getBIData(user: PermissionUser, projectId?: string, startDateStr?: string, endDateStr?: string) {
    if (!user?.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const isOwner = await isOrgOwner(user, user.organizationId, this.prisma);

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const whereTask: any = {
      organizationId: user.organizationId,
      parentTaskId: null,
      ...(projectId ? { projectId } : {}),
      ...(isOwner ? {} : { project: { members: { some: { userId: user.id } } } }),
    };

    if (startDate || endDate) {
      whereTask.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const tasks = await this.prisma.task.findMany({
      where: whereTask,
      include: {
        timeEntries: true,
        subTasks: {
          include: {
            timeEntries: true,
          },
        },
      },
    });

    return tasks.map(task => {
      const allEntries = [
        ...task.timeEntries,
        ...task.subTasks.flatMap((subTask) => subTask.timeEntries),
      ];
      const totalMs = allEntries.reduce(
        (acc, e) => acc + this.calculateActiveMs(e),
        0
      );
      const estimatedHours = task.subTasks.length > 0
        ? task.subTasks.reduce((sum, subTask) => sum + (subTask.estimatedHours ?? 0), 0)
        : (task.estimatedHours ?? 0);
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
        assignedToId: task.assignedToId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        estimatedHours,
        actualHours: totalMs / 1000 / 60 / 60,
        timeEntries: allEntries.map(e => ({
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      };
    });
  }

  // =========================
  // OVERVIEW (USER / ADMIN)
  // =========================
  async getOverview(user: PermissionUser, period?: 'week' | 'month' | 'total') {
    // Validar que el usuario tiene organizationId (multi-tenant)
    if (!user?.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const isOwner = await isOrgOwner(user, user.organizationId, this.prisma);
    const periodStart = this.getPeriodStart(period);

    const whereTask = isOwner
      ? { parentTaskId: null, project: { isActive: true, organizationId: user.organizationId } }
      : { parentTaskId: null, project: { isActive: true, organizationId: user.organizationId, members: { some: { userId: user.id } } } };

    const statusCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: whereTask,
      _count: {
        id: true,
      },
    });

    const statusMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<TaskStatus, number>);

    const totalTasks = statusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const completedTasks = statusMap[TaskStatus.DONE] ?? 0;
    const tasksInProgress = statusMap[TaskStatus.IN_PROGRESS] ?? 0;
    const blockedTasks = statusMap[TaskStatus.BLOCKED] ?? 0;

    const overdueTasks = await this.prisma.task.count({
      where: {
        ...whereTask,
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        organizationId: user.organizationId,
        ...(isOwner ? {} : { userId: user.id }),
        endTime: { not: null },
        ...(periodStart ? { startTime: { gte: periodStart } } : {}),
      },
    });

    const totalMs = timeEntries.reduce(
      (acc, e) => acc + this.calculateActiveMs(e),
      0,
    );
    const totalSecondsWorked = Math.floor(totalMs / 1000);

    return {
      totalTasks,
      completedTasks,
      completionRate: totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0,
      tasksInProgress,
      blockedTasks,
      overdueTasks,
      totalSecondsWorked,
      totalHoursWorked: +(totalMs / 1000 / 60 / 60).toFixed(2),
    };
  }

  // =========================
  // ANALYTICS POR PROYECTO
  // =========================
  async getProjectAnalytics(
    projectId: string,
    user: PermissionUser,
    period?: 'week' | 'month' | 'total',
  ) {
    // Validar que el usuario tiene organizationId (multi-tenant)
    if (!user?.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    // Validar que es miembro (ADMIN puede ver todos en su org)
    const isOwner = await isOrgOwner(user, orgId, this.prisma);

    if (!isOwner) {
      const hasAccess = await this.projectMembers.hasProjectAccess(user, projectId);
      if (!hasAccess) {
        throw new ForbiddenException('You are not a member of this project');
      }
    }

    const periodStart = this.getPeriodStart(period);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: orgId, // Validar que el proyecto pertenece a esta org
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const statusCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId, organizationId: orgId, parentTaskId: null },
      _count: {
        id: true,
      },
    });

    const statusMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<TaskStatus, number>);

    const totalTasks = statusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const completedTasks = statusMap[TaskStatus.DONE] ?? 0;
    const tasksInProgress = statusMap[TaskStatus.IN_PROGRESS] ?? 0;
    const blockedTasks = statusMap[TaskStatus.BLOCKED] ?? 0;

    const overdueTasks = await this.prisma.task.count({
      where: {
        projectId,
        organizationId: orgId,
        parentTaskId: null,
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        organizationId: orgId,
        endTime: { not: null },
        ...(periodStart ? { startTime: { gte: periodStart } } : {}),
      },
    });

    const totalMs = timeEntries.reduce(
      (acc, e) => acc + this.calculateActiveMs(e),
      0,
    );
    
    const totalSecondsWorked = Math.floor(totalMs / 1000);

    // Breakdown por miembros del proyecto sin N+1 queries
    const projectMembers = await this.prisma.projectMember.findMany({
      where: { projectId, project: { organizationId: orgId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // 1. Obtener todas las entradas de tiempo del proyecto para este período
    const allMemberTimeEntries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        organizationId: orgId,
        endTime: { not: null },
        ...(periodStart ? { startTime: { gte: periodStart } } : {}),
      },
    });

    // 2. Agrupar las entradas de tiempo en memoria por usuario
    const timeByMember = allMemberTimeEntries.reduce((acc, entry) => {
      const ms = this.calculateActiveMs(entry);
      acc[entry.userId] = (acc[entry.userId] || 0) + ms;
      return acc;
    }, {} as Record<string, number>);

    const completedRootTasks = await this.prisma.task.findMany({
      where: {
        projectId,
        organizationId: orgId,
        parentTaskId: null,
        status: TaskStatus.DONE,
      },
      select: {
        id: true,
        assignedToId: true,
        subTasks: { select: { assignedToId: true } },
      },
    });

    const completedTasksMap = (completedRootTasks ?? []).reduce((acc, task) => {
      const assigneeIds = new Set<string>();
      if (task.assignedToId) assigneeIds.add(task.assignedToId);
      for (const subTask of task.subTasks ?? []) {
        if (subTask.assignedToId) assigneeIds.add(subTask.assignedToId);
      }
      for (const assigneeId of assigneeIds) {
        acc[assigneeId] = (acc[assigneeId] ?? 0) + 1;
      }

      return acc;
    }, {} as Record<string, number>);

    // 4. Mapear los miembros con la información precargada sin ejecutar consultas adicionales
    const members = projectMembers.map((member) => {
      const memberMs = timeByMember[member.userId] ?? 0;
      const memberTasksCompleted = completedTasksMap[member.userId] ?? 0;
      return {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        totalHours: +(memberMs / 1000 / 60 / 60).toFixed(2),
        tasksCompleted: memberTasksCompleted,
      };
    });

    return {
      projectId,
      totalTasks,
      completedTasks,
      completionRate: totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0,
      tasksInProgress,
      blockedTasks,
      overdueTasks,
      totalSecondsWorked,
      totalHoursWorked: +(totalMs / 1000 / 60 / 60).toFixed(2),
      avgTaskHours: completedTasks
        ? +((totalMs / completedTasks) / 1000 / 60 / 60).toFixed(2)
        : 0,
      members,
    };
  }

  // =========================
  // ANALYTICS POR USUARIO (ADMIN)
  // =========================
  async getUserAnalytics(userId: string, user: PermissionUser) {
    // Validar que el admin tiene organizationId (multi-tenant)
    if (!user?.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    // Validar que el usuario analizado pertenece a la misma org del admin
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationMemberships: {
          where: { organizationId: orgId },
          select: { id: true },
        },
      },
    });

    if (!targetUser || targetUser.organizationMemberships.length === 0) {
      throw new ForbiddenException('Cannot view analytics for users outside your organization');
    }

    const statusCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        parentTaskId: null,
        OR: [
          { assignedToId: userId },
          { subTasks: { some: { assignedToId: userId } } },
        ],
      },
      _count: {
        id: true,
      },
    });

    const statusMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<TaskStatus, number>);

    const totalTasks = statusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const completedTasks = statusMap[TaskStatus.DONE] ?? 0;

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        organizationId: orgId,
        endTime: { not: null },
      },
    });

    const totalMs = timeEntries.reduce(
      (acc, e) => acc + this.calculateActiveMs(e),
      0,
    );

    const totalSecondsWorked = Math.floor(totalMs / 1000);
    
    return {
      userId,
      totalTasks,
      completedTasks,
      completionRate: totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0,
      totalSecondsWorked,
      totalHoursWorked: +(totalMs / 1000 / 60 / 60).toFixed(2),
      avgHoursPerTask: completedTasks
        ? +((totalMs / completedTasks) / 1000 / 60 / 60).toFixed(2)
        : 0,
    };
  }
}
