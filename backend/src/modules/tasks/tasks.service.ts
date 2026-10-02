import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { CreateTaskDto } from "./dto/createTaskDto";
import { UpdateTaskDto } from "./dto/updateTaskDto";
import { PrismaService } from "src/database/prisma.service";
import { ProjectMembersService } from "../projects/project-members.service";
import {
  canAssignTask,
  canCreateTask,
  canEditTaskDetailed,
  canManageProject,
  hasProjectAccess,
  isProjectMember,
  PermissionUser,
} from 'src/common/permissions';
import { ListTasksDto } from './dto/list-tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private projectMembers: ProjectMembersService,
  ) {}

  /**
   * Transiciones de estado permitidas.
   * Se permiten todas las transiciones manuales en ambas direcciones
   * para que el usuario pueda mover tareas y subtareas libremente.
   */
  private readonly allowedStatusTransitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.TODO]:        [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
    [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.BLOCKED, TaskStatus.TODO],
    [TaskStatus.BLOCKED]:     [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.TODO],
    [TaskStatus.DONE]:        [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  };

  private readonly taskWithRelationsInclude = {
    project: { select: { id: true, name: true } },
    subTasks: {
      where: { archivedAt: null },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            name: true,
            lastname: true,
          },
        },
        timeEntries: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            totalPausedMs: true,
            taskId: true,
            userId: true,
          },
        },
      },
    },
    assignedTo: {
      select: {
        id: true,
        email: true,
        name: true,
        lastname: true,
      },
    },
    timeEntries: {
      select: {
        id: true,
        startTime: true,
        endTime: true,
        totalPausedMs: true,
        taskId: true,
        userId: true,
      },
    },
  } as const;

  private calculateActualHours(
    timeEntries: Array<{ startTime: Date; endTime: Date | null; totalPausedMs: number }> = [],
  ) {
    const totalMs = timeEntries.reduce((acc, entry) => {
      if (!entry.endTime) return acc;
      return acc + (entry.endTime.getTime() - entry.startTime.getTime()) - entry.totalPausedMs;
    }, 0);

    return totalMs / 1000 / 60 / 60;
  }

  private enrichTaskWithMetrics(task: any) {
    const subTasks = (task.subTasks || []).map((subTask: any) => ({
      ...subTask,
      actualHours: this.calculateActualHours(subTask.timeEntries || []),
    }));
    const hasSubTasks = subTasks.length > 0;
    const directActualHours = this.calculateActualHours(task.timeEntries || []);
    const subTaskActualHours = subTasks.reduce(
      (sum: number, subTask: any) => sum + (subTask.actualHours || 0),
      0,
    );
    const subTaskEstimatedHours = subTasks.reduce(
      (sum: number, subTask: any) => sum + (subTask.estimatedHours || 0),
      0,
    );
    const derivedResponsibles = hasSubTasks
      ? subTasks
          .map((subTask: any) => subTask.assignedTo)
          .filter(Boolean)
          .filter(
            (assignee: any, index: number, assignees: any[]) =>
              assignees.findIndex((item) => item.id === assignee.id) === index,
          )
      : [];

    return {
      ...task,
      estimatedHours: hasSubTasks ? subTaskEstimatedHours : task.estimatedHours,
      actualHours:    hasSubTasks ? subTaskActualHours    : directActualHours,
      responsibles:   derivedResponsibles,
      subTasks,
    };
  }

  private assertValidStatusTransition(currentStatus: TaskStatus, nextStatus: TaskStatus) {
    if (currentStatus === nextStatus) return;

    const allowed = this.allowedStatusTransitions[currentStatus];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition task status from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  /**
   * Recalcula el estado del padre tras un cambio en una subtarea.
   *
   * Prioridad: todas DONE, alguna BLOCKED, avance parcial, todas TODO.
   */
  private resolveParentStatus(statuses: TaskStatus[]) {
    if (statuses.length === 0) return null;
    if (statuses.every((status) => status === TaskStatus.DONE)) return TaskStatus.DONE;
    if (statuses.some((status) => status === TaskStatus.BLOCKED)) return TaskStatus.BLOCKED;
    if (statuses.some((status) => status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE)) {
      return TaskStatus.IN_PROGRESS;
    }
    return TaskStatus.TODO;
  }

  private async syncParentStatus(tx: any, parentTaskId: string, projectId: string, organizationId: string) {
    const subTasks = await tx.task.findMany({
      where: { parentTaskId, projectId, organizationId, archivedAt: null },
      select: { status: true },
    });

    const statuses: TaskStatus[] = subTasks.map(
      (st: { status: TaskStatus }) => st.status,
    );
    const newStatus = this.resolveParentStatus(statuses);

    if (newStatus !== null) {
      await tx.task.updateMany({
        where: { id: parentTaskId, projectId, organizationId },
        data: { status: newStatus },
      });
    }
  }

  private async getScopedTaskWithRelations(tx: any, taskId: string, projectId: string, organizationId: string) {
    return tx.task.findFirst({
      where: { id: taskId, projectId, organizationId },
      include: this.taskWithRelationsInclude,
    });
  }

  private async assertNoActiveTimerInSubTasks(tx: any, parentTaskId: string, projectId: string, organizationId: string) {
    const activeSubTaskTimer = await tx.timeEntry.findFirst({
      where: {
        projectId,
        organizationId,
        endTime: null,
        task: { parentTaskId, projectId, organizationId },
      },
      select: { id: true, taskId: true },
    });

    if (activeSubTaskTimer) {
      throw new BadRequestException('Cannot complete parent task while a subtask has an active timer');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  private normalizeDescription(description?: string) {
    return description ? description.trim().replace(/\s+/g, ' ') : undefined;
  }

  async listAccessibleTasks(query: ListTasksDto, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const organizationId = user.organizationId;
    const owner = await this.projectMembers.isOrgOwner(user, organizationId);
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(owner ? {} : { members: { some: { userId: user.id } } }),
      },
      select: { id: true },
    });
    const accessibleProjectIds = projects.map((project) => project.id);

    if (query.projectId && !accessibleProjectIds.includes(query.projectId)) {
      throw new NotFoundException('Project not found');
    }

    const projectIds = query.projectId ? [query.projectId] : accessibleProjectIds;
    if (projectIds.length === 0) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
    }

    const now = new Date();
    const compoundFilters: Prisma.TaskWhereInput[] = [];
    if (query.overdue === true) {
      compoundFilters.push(
        { dueDate: { lt: now } },
        { status: { not: TaskStatus.DONE } },
      );
    } else if (query.overdue === false) {
      compoundFilters.push({
        OR: [
          { dueDate: null },
          { dueDate: { gte: now } },
          { status: TaskStatus.DONE },
        ],
      });
    }
    if (query.dueFrom || query.dueTo) {
      compoundFilters.push({
        dueDate: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
        },
      });
    }
    if (query.openOnly === true) {
      compoundFilters.push({ status: { not: TaskStatus.DONE } });
    }
    if (query.assignedTo === 'me') {
      compoundFilters.push({
        OR: [
          { assignedToId: user.id },
          { subTasks: { some: { assignedToId: user.id } } },
        ],
      });
    }
    if (query.search) {
      compoundFilters.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        projectId: { in: projectIds },
        parentTaskId: null,
        archivedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(compoundFilters.length ? { AND: compoundFilters } : {}),
      },
      select: {
        id: true,
        projectId: true,
        project: { select: { id: true, name: true } },
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true, lastname: true } },
        estimatedHours: true,
        updatedAt: true,
        subTasks: { select: { assignedToId: true } },
        _count: { select: { subTasks: true } },
      },
    });

    const rank = (task: typeof tasks[number]) => {
      if (task.status === TaskStatus.DONE) return 3;
      if (task.dueDate && task.dueDate < now) return 0;
      if (task.dueDate) return 1;
      return 2;
    };
    tasks.sort((a, b) => {
      const rankDifference = rank(a) - rank(b);
      if (rankDifference) return rankDifference;
      if (rank(a) <= 1) {
        const dueDifference = (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
        if (dueDifference) return dueDifference;
      }
      const updatedDifference = b.updatedAt.getTime() - a.updatedAt.getTime();
      return updatedDifference || a.id.localeCompare(b.id);
    });

    const total = tasks.length;
    const start = (query.page - 1) * query.pageSize;
    const pageItems = tasks.slice(start, start + query.pageSize);
    return {
      items: pageItems.map(({ subTasks, _count, ...task }) => ({
        ...task,
        hasSubTasks: _count.subTasks > 0,
        assignmentSource:
          task.assignedToId === user.id
            ? 'direct'
            : subTasks.some((subTask) => subTask.assignedToId === user.id)
              ? 'subtask'
              : 'none',
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async createTask(projectId: string, dto: CreateTaskDto, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const organizationId = user.organizationId;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isActive: true, organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const canCreate = await canCreateTask(user, project, this.prisma);
    if (!canCreate) throw new NotFoundException('You are not a member of this project');

    if (dto.parentTaskId) {
      const parentTask = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, projectId, organizationId },
      });
      if (!parentTask) throw new BadRequestException('Parent task not found in this project');
      if (parentTask.parentTaskId) throw new BadRequestException('Subtasks cannot have subtasks');
    }

    if (dto.assignedToId) {
      const assignPermission = await canAssignTask(user, project, this.prisma);
      if (!assignPermission) throw new ForbiddenException('You cannot assign tasks in this project');

      const assignedUser = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, isActive: true },
      });
      if (!assignedUser) throw new BadRequestException('Assigned user not found or inactive');

      const isMember = await isProjectMember({ id: assignedUser.id }, projectId, this.prisma);
      if (!isMember) throw new BadRequestException('Assigned user is not a member of this project');
    }

    const createdTask = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ...dto,
          description: this.normalizeDescription(dto.description),
          projectId,
          organizationId: project.organizationId,
        },
        include: this.taskWithRelationsInclude,
      });

      if (dto.parentTaskId) {
        // Al crear la primera subtarea el padre pierde su assignedToId propio;
        // los responsables se derivan de las subtareas.
        await tx.task.updateMany({
          where: { id: dto.parentTaskId, projectId, organizationId },
          data: { assignedToId: null },
        });
        await this.syncParentStatus(tx, dto.parentTaskId, projectId, organizationId);
      }

      return task;
    });

    return this.enrichTaskWithMetrics(createdTask);
  }

  async getTasksByProject(projectId: string, user: PermissionUser) {
    if (!user.organizationId) throw new BadRequestException('User must belong to an organization');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isActive: true, organizationId: user.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const hasAccess = await hasProjectAccess(user, project, this.prisma);
    if (!hasAccess) throw new NotFoundException('You are not a member of this project');

    const tasks = await this.prisma.task.findMany({
      where: { projectId, organizationId: user.organizationId, parentTaskId: null, archivedAt: null },
      include: this.taskWithRelationsInclude,
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map((task) => this.enrichTaskWithMetrics(task));
  }

  async getTaskById(projectId: string, taskId: string, user: PermissionUser) {
    if (!user.organizationId) throw new BadRequestException('User must belong to an organization');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isActive: true, organizationId: user.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const hasAccess = await hasProjectAccess(user, project, this.prisma);
    if (!hasAccess) throw new NotFoundException('You are not a member of this project');

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, organizationId: user.organizationId, project: { isActive: true } },
      include: this.taskWithRelationsInclude,
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.enrichTaskWithMetrics(task);
  }

  async updateTask(projectId: string, taskId: string, dto: UpdateTaskDto, user: PermissionUser) {
    if (!user.organizationId) throw new BadRequestException('User must belong to an organization');
    const organizationId = user.organizationId;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, projectId, organizationId },
        include: { project: true, _count: { select: { subTasks: true } } },
      }) as any;
      if (!task) throw new NotFoundException('Task not found');

      const { canEdit, restricted } = await canEditTaskDetailed(user, task, dto, this.prisma);
      if (!canEdit) throw new ForbiddenException('You are not a member of this project');
      if (restricted) throw new ForbiddenException('Members can only change task status or take unassigned tasks');

      // Validar transición de estado
      if (dto.status !== undefined) {
        this.assertValidStatusTransition(task.status, dto.status);
      }

      // Las horas estimadas del padre se calculan desde las subtareas
      if (dto.estimatedHours !== undefined && (task._count?.subTasks ?? 0) > 0) {
        throw new BadRequestException('Parent task estimated hours are calculated from subtasks');
      }

      if (dto.assignedToId) {
        const assignPermission = await canAssignTask(user, task.project, this.prisma);
        if (!assignPermission) throw new ForbiddenException('You cannot assign tasks in this project');

        const assignedUser = await tx.user.findFirst({ where: { id: dto.assignedToId, isActive: true } });
        if (!assignedUser) throw new BadRequestException('Assigned user not found or inactive');

        const isMember = await isProjectMember({ id: assignedUser.id }, projectId, this.prisma);
        if (!isMember) throw new BadRequestException('Assigned user is not a member of this project');
      }

      await tx.task.updateMany({
        where: { id: taskId, projectId, organizationId },
        data: dto,
      });

      const hasSubTasks = (task._count?.subTasks ?? 0) > 0;

      if (dto.status !== undefined) {
        if (hasSubTasks) {
          // Las subtareas DONE son sticky salvo cuando el padre pasa a DONE.
          if (dto.status === TaskStatus.DONE) {
            await this.assertNoActiveTimerInSubTasks(tx, taskId, projectId, organizationId);
            await tx.task.updateMany({
              where: { parentTaskId: taskId, projectId, organizationId },
              data: { status: dto.status },
            });
          } else {
            await tx.task.updateMany({
              where: { parentTaskId: taskId, projectId, organizationId, status: { not: TaskStatus.DONE } },
              data: { status: dto.status },
            });
          }
        } else if (task.parentTaskId) {
          // Es una subtarea: recalcular el estado del padre
          await this.syncParentStatus(tx, task.parentTaskId, projectId, organizationId);
        }
      }

      const finalTask = await this.getScopedTaskWithRelations(tx, taskId, projectId, organizationId);
      if (!finalTask) throw new NotFoundException('Task not found');

      return this.enrichTaskWithMetrics(finalTask);
    });
  }

  async updateTaskStatus(projectId: string, taskId: string, status: TaskStatus, user: PermissionUser) {
    return this.updateTask(projectId, taskId, { status }, user);
  }

  async deleteTask(projectId: string, taskId: string, user: PermissionUser) {
    if (!user.organizationId) throw new BadRequestException('User must belong to an organization');
    const organizationId = user.organizationId;

    const canManage = await canManageProject(user, projectId, this.prisma);
    if (!canManage) throw new ForbiddenException('Only project owners can delete tasks');

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, organizationId: user.organizationId },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { id: taskId, projectId, organizationId } });

      // Si era una subtarea, recalcular el estado del padre
      if (task.parentTaskId) {
        await this.syncParentStatus(tx, task.parentTaskId, projectId, organizationId);
      }

      return task;
    });
  }
}
