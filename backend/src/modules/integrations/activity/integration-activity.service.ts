/**
 * Resumen de las novedades que llegaron de Trello en un periodo. Lo usan el
 * cartel de la app (web y Tino Mobile) y el resumen diario por WhatsApp; cada
 * canal lo cuenta a su manera, pero los numeros salen de aca.
 *
 * Qué contiene:
 * - `summarize()`: lee `IntegrationActivity` y `TimeEntry` del periodo
 *   `[since, until)` y devuelve:
 *   - `created` y `archived`: tareas unicas (si una tarea aparece varias veces
 *     cuenta una sola vez).
 *   - `statusChanges`: un cambio por tarea, desde el primer estado hasta el
 *     ultimo del periodo; si termino en el mismo estado en que empezo no cuenta.
 *   - `work`: minutos trabajados por persona y por tarea, solo de timers ya
 *     cerrados sobre tareas de proyectos conectados. Ordenado de mayor a menor.
 *   Con `assignedToUserId` se limita a las tareas asignadas a esa persona.
 * - `summarizeForViewer()`: el resumen para el cartel de quien mira. El owner
 *   (y SUPERADMIN) ve toda la organizacion; el resto, solo sus tareas
 *   asignadas. Arranca desde la ultima vez que cerro el cartel, con un maximo de
 *   7 dias hacia atras.
 * - `markSeen()`: guarda que la persona cerro el cartel.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { isSuperAdmin, type PermissionUser } from 'src/common/permissions';

export const ACTIVITY_MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ActivityTaskRef {
  taskId: string;
  title: string;
  projectName: string;
}

export interface ActivityStatusChange extends ActivityTaskRef {
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  actorName: string | null;
}

export interface ActivityWorkTask {
  taskId: string;
  title: string;
  minutes: number;
}

export interface ActivityWorker {
  userId: string;
  name: string;
  minutes: number;
  tasks: ActivityWorkTask[];
}

export interface ActivitySummary {
  since: Date;
  until: Date;
  created: ActivityTaskRef[];
  statusChanges: ActivityStatusChange[];
  archived: ActivityTaskRef[];
  work: ActivityWorker[];
  totalMinutes: number;
  isEmpty: boolean;
}

export interface ActivityScope {
  organizationId: string;
  since: Date;
  until: Date;
  assignedToUserId?: string;
}

@Injectable()
export class IntegrationActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(scope: ActivityScope): Promise<ActivitySummary> {
    const assigned: Prisma.TaskWhereInput = scope.assignedToUserId
      ? { assignedToId: scope.assignedToUserId }
      : {};
    const [activities, entries] = await Promise.all([
      this.prisma.integrationActivity.findMany({
        where: {
          organizationId: scope.organizationId,
          occurredAt: { gte: scope.since, lt: scope.until },
          ...(scope.assignedToUserId ? { task: assigned } : {}),
        },
        orderBy: { occurredAt: 'asc' },
        select: {
          kind: true,
          taskId: true,
          fromStatus: true,
          toStatus: true,
          actorName: true,
          task: {
            select: { title: true, project: { select: { name: true } } },
          },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          organizationId: scope.organizationId,
          endTime: { gte: scope.since, lt: scope.until },
          task: {
            ...assigned,
            project: { integrationConnection: { isNot: null } },
          },
        },
        select: {
          userId: true,
          taskId: true,
          startTime: true,
          endTime: true,
          totalPausedMs: true,
          task: { select: { title: true } },
          user: { select: { name: true, lastname: true } },
        },
      }),
    ]);

    const created = new Map<string, ActivityTaskRef>();
    const archived = new Map<string, ActivityTaskRef>();
    const changes = new Map<string, ActivityStatusChange>();
    for (const activity of activities) {
      const ref: ActivityTaskRef = {
        taskId: activity.taskId,
        title: activity.task.title,
        projectName: activity.task.project.name,
      };
      if (activity.kind === 'TASK_CREATED') created.set(ref.taskId, ref);
      if (activity.kind === 'TASK_ARCHIVED') archived.set(ref.taskId, ref);
      if (activity.kind === 'STATUS_CHANGED' && activity.toStatus) {
        const previous = changes.get(ref.taskId);
        changes.set(ref.taskId, {
          ...ref,
          fromStatus: previous ? previous.fromStatus : activity.fromStatus,
          toStatus: activity.toStatus,
          actorName: activity.actorName ?? previous?.actorName ?? null,
        });
      }
    }
    const statusChanges = [...changes.values()].filter(
      (change) => change.fromStatus !== change.toStatus,
    );

    const workers = new Map<string, ActivityWorker>();
    for (const entry of entries) {
      if (!entry.endTime || !entry.taskId || !entry.task) continue;
      const minutes = Math.round(
        (entry.endTime.getTime() -
          entry.startTime.getTime() -
          (entry.totalPausedMs ?? 0)) /
          60_000,
      );
      if (minutes <= 0) continue;

      const worker = workers.get(entry.userId) ?? {
        userId: entry.userId,
        name: `${entry.user.name} ${entry.user.lastname}`.trim(),
        minutes: 0,
        tasks: [],
      };
      worker.minutes += minutes;
      const task = worker.tasks.find((item) => item.taskId === entry.taskId);
      if (task) task.minutes += minutes;
      else {
        worker.tasks.push({
          taskId: entry.taskId,
          title: entry.task.title,
          minutes,
        });
      }
      workers.set(entry.userId, worker);
    }
    const work = [...workers.values()]
      .map((worker) => ({
        ...worker,
        tasks: [...worker.tasks].sort((a, b) => b.minutes - a.minutes),
      }))
      .sort((a, b) => b.minutes - a.minutes);
    const totalMinutes = work.reduce((sum, worker) => sum + worker.minutes, 0);

    return {
      since: scope.since,
      until: scope.until,
      created: [...created.values()],
      statusChanges,
      archived: [...archived.values()],
      work,
      totalMinutes,
      isEmpty:
        created.size === 0 &&
        statusChanges.length === 0 &&
        archived.size === 0 &&
        work.length === 0,
    };
  }

  async summarizeForViewer(
    user: PermissionUser,
    organizationId: string,
    now = new Date(),
  ): Promise<ActivitySummary> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      select: { role: true, activitySeenAt: true },
    });
    const seeAll = isSuperAdmin(user) || membership?.role === 'ORG_OWNER';
    const oldest = now.getTime() - ACTIVITY_MAX_LOOKBACK_MS;
    const seenAt = membership?.activitySeenAt?.getTime() ?? 0;

    return this.summarize({
      organizationId,
      since: new Date(Math.max(oldest, seenAt)),
      until: now,
      ...(seeAll ? {} : { assignedToUserId: user.id }),
    });
  }

  async markSeen(
    user: PermissionUser,
    organizationId: string,
    now = new Date(),
  ): Promise<{ seenAt: Date }> {
    await this.prisma.organizationMembership.updateMany({
      where: { organizationId, userId: user.id },
      data: { activitySeenAt: now },
    });
    return { seenAt: now };
  }
}
