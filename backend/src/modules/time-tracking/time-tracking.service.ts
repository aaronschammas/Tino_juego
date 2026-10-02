import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectMembersService } from '../projects/project-members.service';
import { canTrackTime, PermissionUser } from 'src/common/permissions';
import { LinkTimeEntryDto } from './dto/linkTimeEntryDto';
import { TimeSummaryDto } from './dto/time-summary.dto';
import { calculateActiveMsWithinRange, isValidTimezone } from '../analytics/analytics-dashboard.utils';

const IDLE_THRESHOLD_MINUTES = 120;

@Injectable()
export class TimeTrackingService {
  private readonly activeTargetMinutes = new Map<string, number>();
  private readonly recentlyExpiredTimers = new Map<string, { entry: any; expiredAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectMembers: ProjectMembersService,
  ) {}

  private timerScopeKey(user: PermissionUser) {
    return `${user.id}:${user.organizationId ?? 'no-org'}`;
  }

  private resolveParentStatus(statuses: TaskStatus[]): TaskStatus | null {
    if (statuses.length === 0) return null;
    if (statuses.every((status) => status === TaskStatus.DONE)) return TaskStatus.DONE;
    if (statuses.some((status) => status === TaskStatus.BLOCKED)) return TaskStatus.BLOCKED;
    if (statuses.some((status) => status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE)) {
      return TaskStatus.IN_PROGRESS;
    }
    return TaskStatus.TODO;
  }

  private async syncParentStatusFromSubTasks(
    tx: Prisma.TransactionClient,
    parentTaskId: string,
    projectId: string,
    organizationId: string,
  ) {
    const subTasks = await tx.task.findMany({
      where: {
        parentTaskId,
        projectId,
        organizationId,
        archivedAt: null,
      },
      select: { status: true },
    });

    const parentStatus = this.resolveParentStatus(subTasks.map((subTask) => subTask.status));
    if (!parentStatus) return;

    await tx.task.updateMany({
      where: {
        id: parentTaskId,
        projectId,
        organizationId,
      },
      data: { status: parentStatus },
    });
  }

  private async markTimerTaskInProgress(
    tx: Prisma.TransactionClient,
    task: {
      id: string;
      parentTaskId: string | null;
      parentTask?: {
        id: string;
        projectId: string;
        organizationId: string;
      } | null;
    },
    projectId: string,
    organizationId: string,
  ) {
    if (task.parentTaskId) {
      if (
        !task.parentTask ||
        task.parentTask.id !== task.parentTaskId ||
        task.parentTask.projectId !== projectId ||
        task.parentTask.organizationId !== organizationId
      ) {
        throw new NotFoundException('Task not found in this project');
      }
    }

    await tx.task.updateMany({
      where: {
        id: task.id,
        projectId,
        organizationId,
      },
      data: { status: TaskStatus.IN_PROGRESS },
    });

    if (task.parentTaskId) {
      await this.syncParentStatusFromSubTasks(tx, task.parentTaskId, projectId, organizationId);
    }
  }

  // Iniciar reloj
  async startTime(projectId: string, user: PermissionUser, taskId?: string, targetMinutes: number = 30) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;
    const normalizedTargetMinutes = Math.max(
      1,
      Math.trunc(Number.isFinite(targetMinutes) ? targetMinutes : 30),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      // 1️⃣ Verificar que no haya reloj activo (SELECT FOR UPDATE equivalent)
      const activeEntry = await tx.timeEntry.findFirst({
        where: {
          userId: user.id,
          endTime: null,
          organizationId: orgId,
        },
        select: {
          id: true,
          userId: true,
          projectId: true,
          organizationId: true,
          startTime: true,
          endTime: true,
          lastHeartbeat: true,
          pausedAt: true,
          totalPausedMs: true,
          targetMinutes: true,
          createdAt: true,
        },
      });

      if (activeEntry) {
        throw new BadRequestException('You already have an active timer');
      }

      // 2️⃣ Validar que el proyecto existe, está activo y pertenece a la org del usuario
      const project = await tx.project.findFirst({
        where: {
          id: projectId,
          isActive: true,
          organizationId: orgId,
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found or not in your organization');
      }

      let timerTask: {
        id: string;
        parentTaskId: string | null;
        parentTask?: {
          id: string;
          projectId: string;
          organizationId: string;
        } | null;
        _count?: { subTasks?: number };
      } | null = null;

      if (taskId) {
        timerTask = await tx.task.findFirst({
          where: {
            id: taskId,
            projectId,
            organizationId: orgId,
            archivedAt: null,
          },
          select: {
            id: true,
            parentTaskId: true,
            parentTask: {
              select: {
                id: true,
                projectId: true,
                organizationId: true,
              },
            },
            _count: { select: { subTasks: true } },
          },
        });

        if (!timerTask) {
          throw new NotFoundException('Task not found in this project');
        }
        if ((timerTask._count?.subTasks ?? 0) > 0) {
          throw new BadRequestException('Track time on a subtask, not its parent task');
        }
      }

      // Validar membresía
      const hasAccess = await canTrackTime(user, project, this.prisma);
      if (!hasAccess) {
        throw new NotFoundException('You are not a member of this project');
      }

      if (timerTask) {
        await this.markTimerTaskInProgress(tx, timerTask, projectId, orgId);
      }

      // 3️⃣ Crear TimeEntry
      try {
        return await tx.timeEntry.create({
          data: {
            userId: user.id,
            projectId,
            taskId,
            organizationId: orgId,
            startTime: new Date(),
            lastHeartbeat: new Date(),
            targetMinutes: normalizedTargetMinutes,
          },
          include: {
            project: true,
            task: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new BadRequestException('You already have an active timer');
        }
        throw error;
      }
    });

    const scopeKey = this.timerScopeKey(user);
    this.activeTargetMinutes.set(scopeKey, normalizedTargetMinutes);
    this.recentlyExpiredTimers.delete(scopeKey);
    return result;
  }

  // Detener reloj
  async stopTime(user: PermissionUser, customEndTimeString?: string) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      const activeEntry = await tx.timeEntry.findFirst({
        where: {
          userId: user.id,
          endTime: null,
          organizationId: orgId,
        },
        select: {
          id: true,
          userId: true,
          projectId: true,
          organizationId: true,
          startTime: true,
          endTime: true,
          lastHeartbeat: true,
          pausedAt: true,
          totalPausedMs: true,
          targetMinutes: true,
          createdAt: true,
        },
      });

      if (!activeEntry) {
        throw new BadRequestException('No active timer found');
      }

      let finalPausedMs = activeEntry.totalPausedMs;
      const stopDate = customEndTimeString ? new Date(customEndTimeString) : new Date();

      if (activeEntry.pausedAt) {
        finalPausedMs += stopDate.getTime() - activeEntry.pausedAt.getTime();
      }

      // Validar que stopDate sea posterior a startTime
      if (stopDate.getTime() <= activeEntry.startTime.getTime()) {
        throw new BadRequestException('End time must be after start time');
      }

      return tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: stopDate,
          pausedAt: null,
          totalPausedMs: finalPausedMs,
        },
        include: {
          project: true,
          task: true,
        },
      });
    });

    const scopeKey = this.timerScopeKey(user);
    this.activeTargetMinutes.delete(scopeKey);
    this.recentlyExpiredTimers.delete(scopeKey);
    return result;
  }

  // Obtener reloj activo con detección y detención de expiración al vuelo
  async getActiveTime(user: PermissionUser): Promise<{ activeTimer: any | null; recentlyExpired: any | null }> {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    const activeEntry = await this.prisma.timeEntry.findFirst({
      where: {
        userId: user.id,
        endTime: null,
        organizationId: orgId,
      },
      include: {
        project: true,
        task: true,
      },
    });

    let recentlyExpired = null;
    const scopeKey = this.timerScopeKey(user);
    const recent = this.recentlyExpiredTimers.get(scopeKey);
    if (recent) {
      if (Date.now() - recent.expiredAt < 2 * 60 * 1000) {
        recentlyExpired = recent.entry;
      } else {
        this.recentlyExpiredTimers.delete(scopeKey);
      }
    }

    if (!activeEntry) {
      return { activeTimer: null, recentlyExpired };
    }

    const targetMin = activeEntry.targetMinutes ?? this.activeTargetMinutes.get(scopeKey) ?? 30;
    const start = activeEntry.startTime.getTime();
    const pausedMs = activeEntry.totalPausedMs ?? 0;
    const expectedDurationMs = targetMin * 60 * 1000;

    if (!activeEntry.pausedAt && Date.now() - start - pausedMs >= expectedDurationMs) {
      const logicalEndTime = new Date(start + expectedDurationMs + pausedMs);
      
      const stoppedEntry = await this.prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: logicalEndTime,
          pausedAt: null,
        },
        include: {
          project: true,
          task: true,
        },
      });
      
      this.activeTargetMinutes.delete(scopeKey);
      this.recentlyExpiredTimers.set(scopeKey, { entry: stoppedEntry, expiredAt: Date.now() });
      
      return { activeTimer: null, recentlyExpired: stoppedEntry };
    }

    return { activeTimer: activeEntry, recentlyExpired };
  }

  acknowledgeExpired(user: any) {
    this.recentlyExpiredTimers.delete(this.timerScopeKey(user));
  }

  async heartbeat(user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      const activeEntry = await tx.timeEntry.findFirst({
        where: { userId: user.id, endTime: null, organizationId: orgId },
        select: {
          id: true,
          userId: true,
          projectId: true,
          organizationId: true,
          startTime: true,
          endTime: true,
          lastHeartbeat: true,
          pausedAt: true,
          totalPausedMs: true,
          createdAt: true,
        },
      });

      if (!activeEntry) {
        throw new BadRequestException('No active timer found');
      }

      const now = new Date();
      let accumulatedPausedMs = activeEntry.totalPausedMs;

      if (activeEntry.pausedAt) {
        accumulatedPausedMs += now.getTime() - activeEntry.pausedAt.getTime();
      }

      return tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          lastHeartbeat: now,
          pausedAt: null,
          totalPausedMs: accumulatedPausedMs,
        },
        include: { project: true, task: true },
      });
    });
  }

  async pauseTime(user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      const activeEntry = await tx.timeEntry.findFirst({
        where: { userId: user.id, endTime: null, organizationId: orgId },
        include: { project: true, task: true },
      });

      if (!activeEntry) {
        throw new BadRequestException('No active timer found');
      }

      if (activeEntry.pausedAt) {
        return activeEntry;
      }

      return tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: { pausedAt: new Date() },
        include: { project: true, task: true },
      });
    });
  }

  async autoPauseIdleTimers(): Promise<number> {
    const idleThreshold = new Date(
      Date.now() - IDLE_THRESHOLD_MINUTES * 60 * 1000,
    );

    const idleEntries = await this.prisma.timeEntry.findMany({
      where: {
        endTime: null,
        pausedAt: null,
        OR: [
          { lastHeartbeat: null },
          { lastHeartbeat: { lt: idleThreshold } },
        ],
      },
      select: { id: true },
    });

    if (idleEntries.length === 0) return 0;

    const now = new Date();
    await this.prisma.timeEntry.updateMany({
      where: { id: { in: idleEntries.map((e) => e.id) } },
      data: { pausedAt: now },
    });

    return idleEntries.length;
  }

  async autoStopExpiredTimers(): Promise<number> {
    const activeEntries = await this.prisma.timeEntry.findMany({
      where: { endTime: null },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        startTime: true,
        totalPausedMs: true,
        targetMinutes: true,
        pausedAt: true,
      },
    });

    let stoppedCount = 0;
    for (const entry of activeEntries) {
      const scopeKey = `${entry.userId}:${entry.organizationId ?? 'no-org'}`;
      const targetMin = entry.targetMinutes ?? this.activeTargetMinutes.get(scopeKey) ?? 30;
      const start = entry.startTime.getTime();
      const pausedMs = entry.totalPausedMs ?? 0;
      const expectedDurationMs = targetMin * 60 * 1000;

      if (!entry.pausedAt && Date.now() - start - pausedMs >= expectedDurationMs) {
        const logicalEndTime = new Date(start + expectedDurationMs + pausedMs);
        const stoppedEntry = await this.prisma.timeEntry.update({
          where: { id: entry.id },
          data: {
            endTime: logicalEndTime,
            pausedAt: null,
          },
          include: { project: true, task: true },
        });
        this.activeTargetMinutes.delete(scopeKey);
        this.recentlyExpiredTimers.set(scopeKey, { entry: stoppedEntry, expiredAt: Date.now() });
        stoppedCount++;
      }
    }
    return stoppedCount;
  }

  // Resumen de tiempo por proyecto
  async getProjectTime(projectId: string, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    // Validar que es miembro
    const isMember = await this.projectMembers.isMemberOfProject(user, projectId);
    if (!isMember) {
      throw new NotFoundException('You are not a member of this project');
    }

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        userId: user.id,
        organizationId: user.organizationId,
        endTime: { not: null },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        totalPausedMs: true,
      },
    });

    const totalMs = entries.reduce((acc, e) => {
      return acc + (e.endTime!.getTime() - e.startTime.getTime());
    }, 0);

    const totalPausedMs = entries.reduce((acc, e) => acc + e.totalPausedMs, 0);
    const activeMs = totalMs - totalPausedMs;

    return {
      projectId,
      totalMilliseconds: totalMs,
      totalHours: +(totalMs / 1000 / 60 / 60).toFixed(2),
      activeMilliseconds: activeMs,
      activeHours: +(activeMs / 1000 / 60 / 60).toFixed(2),
      pausedMilliseconds: totalPausedMs,
    };
  }

  // Historial simple de las últimas entradas cerradas
  async getHistory(user: PermissionUser, limit = 50) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    const take = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);

    return this.prisma.timeEntry.findMany({
      where: {
        userId: user.id,
        endTime: { not: null },
        organizationId: orgId,
      },
      include: { project: true, task: true },
      orderBy: { startTime: 'desc' },
      take,
    });
  }

  async getSummary(user: PermissionUser, query: TimeSummaryDto, now = new Date()) {
    if (!user.organizationId) throw new BadRequestException('User must belong to an organization');
    if (!isValidTimezone(query.timezone)) throw new BadRequestException('Invalid IANA timezone');
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: query.timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? '';
    const todayKey = `${part('year')}-${part('month')}-${part('day')}`;
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday'));
    const localToday = new Date(`${todayKey}T12:00:00Z`);
    localToday.setUTCDate(localToday.getUTCDate() - Math.max(weekday, 0));
    const weekKey = localToday.toISOString().slice(0, 10);
    const boundary = (key: string) => {
      const [year, month, day] = key.split('-').map(Number);
      const localMidnight = Date.UTC(year, month - 1, day);
      const probe = new Date(localMidnight);
      const zoned = new Intl.DateTimeFormat('en-US', { timeZone: query.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(probe);
      const value = (type: Intl.DateTimeFormatPartTypes) => Number(zoned.find((item) => item.type === type)?.value ?? 0);
      const offset = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')) - probe.getTime();
      return new Date(localMidnight - offset);
    };
    const todayStart = boundary(todayKey);
    const weekStart = boundary(weekKey);
    const where = { userId: user.id, organizationId: user.organizationId, endTime: { not: null as Date | null } };
    const [rangeEntries, items, total] = await this.prisma.$transaction([
      this.prisma.timeEntry.findMany({ where: { ...where, endTime: { gt: weekStart }, startTime: { lt: now } }, select: { startTime: true, endTime: true, totalPausedMs: true } }),
      this.prisma.timeEntry.findMany({ where, select: { id: true, projectId: true, taskId: true, startTime: true, endTime: true, totalPausedMs: true, project: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } }, orderBy: [{ startTime: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.timeEntry.count({ where }),
    ]);
    const sum = (from: Date) => rangeEntries.reduce((totalMs, entry) => totalMs + calculateActiveMsWithinRange(entry, from, now), 0);
    return { todayMilliseconds: Math.round(sum(todayStart)), weekMilliseconds: Math.round(sum(weekStart)), timezone: query.timezone, items, page: query.page, pageSize: query.pageSize, total, totalPages: total ? Math.ceil(total / query.pageSize) : 0 };
  }

  async linkTimeEntry(entryId: string, dto: LinkTimeEntryDto, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const orgId = user.organizationId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener la entrada de tiempo
      const entry = await tx.timeEntry.findFirst({
        where: {
          id: entryId,
          organizationId: orgId,
        },
      });

      if (!entry) {
        throw new NotFoundException('Time entry not found');
      }

      // Validar que esté finalizada
      if (!entry.endTime) {
        throw new BadRequestException('Cannot link/split an active timer');
      }

      // Validar membresía del proyecto
      const isMember = await this.projectMembers.isMemberOfProject(user, entry.projectId);
      if (!isMember) {
        throw new ForbiddenException('You are not a member of this project');
      }

      // Validar que la tarea exista y pertenezca al mismo proyecto
      const task = await tx.task.findFirst({
        where: {
          id: dto.taskId,
          projectId: entry.projectId,
          organizationId: orgId,
        },
        select: {
          id: true,
          _count: { select: { subTasks: true } },
        },
      });

      if (!task) {
        throw new NotFoundException('Task not found in this project');
      }
      if ((task._count?.subTasks ?? 0) > 0) {
        throw new BadRequestException('Link time to a subtask, not its parent task');
      }

      // Calcular tiempo activo total de la entrada: (endTime - startTime) - totalPausedMs
      const totalMs = entry.endTime.getTime() - entry.startTime.getTime();
      const activeMs = totalMs - entry.totalPausedMs;

      // Si se especifica una duración parcial y es menor que la duración activa
      if (dto.durationMs !== undefined && dto.durationMs !== null) {
        if (dto.durationMs >= activeMs) {
          throw new BadRequestException('Split duration cannot leave original timer with zero or negative duration');
        }
        const durationMs = dto.durationMs;
        const newEndTime = new Date(entry.endTime.getTime() - durationMs);

        // Validar que newEndTime sea mayor que startTime
        if (newEndTime.getTime() <= entry.startTime.getTime()) {
          throw new BadRequestException('Split duration cannot leave original timer with zero or negative duration');
        }

        // Actualizar la entrada original restándole la duración
        await tx.timeEntry.update({
          where: { id: entryId },
          data: {
            endTime: newEndTime,
          },
        });

        // Crear una nueva entrada de tiempo vinculada a la tarea
        return tx.timeEntry.create({
          data: {
            userId: entry.userId,
            projectId: entry.projectId,
            taskId: dto.taskId,
            organizationId: orgId,
            startTime: newEndTime,
            endTime: entry.endTime,
            totalPausedMs: 0,
          },
          include: {
            project: true,
            task: true,
          },
        });
      } else {
        // Vincular la entrada completa
        return tx.timeEntry.update({
          where: { id: entryId },
          data: {
            taskId: dto.taskId,
          },
          include: {
            project: true,
            task: true,
          },
        });
      }
    });
  }
}
