import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  DEMO_SCENARIOS,
  type DemoScenario,
  findScenario,
  scenarioProjectName,
} from './demo-scenarios';

export interface DemoUser {
  id: string;
  organizationId?: string | null;
}

export interface TimeEntrySlice {
  taskId: string | null;
  startTime: Date;
  endTime: Date | null;
  pausedAt: Date | null;
  totalPausedMs: number;
}

export interface DemoTaskState {
  id: string;
  title: string;
  status: string;
  priority: string;
  action: string | null;
  workSeconds: number;
  workedSeconds: number;
}

export interface DemoState {
  scenario: { key: string; name: string; intro: string };
  projectId: string | null;
  serverTime: string;
  tasks: DemoTaskState[];
  activeTimer: { taskId: string | null; paused: boolean; startTime: string } | null;
}

/** Segundos trabajados por tarea: fin (o ahora) menos inicio, descontando las pausas. */
export function computeWorkedSeconds(entries: TimeEntrySlice[], now: Date): Map<string, number> {
  const worked = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.taskId) continue;
    const end = entry.endTime ?? now;
    const openPause = !entry.endTime && entry.pausedAt ? now.getTime() - entry.pausedAt.getTime() : 0;
    const ms = Math.max(0, end.getTime() - entry.startTime.getTime() - entry.totalPausedMs - openPause);
    worked.set(entry.taskId, (worked.get(entry.taskId) ?? 0) + ms / 1000);
  }
  return worked;
}

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Escenarios disponibles, sin los detalles internos de cada tarea. */
  listScenarios() {
    return DEMO_SCENARIOS.map(({ key, name, intro, tasks }) => ({
      key,
      name,
      intro,
      tasks: tasks.map(({ title, priority, action }) => ({ title, priority, action })),
    }));
  }

  /** Deja el escenario como nuevo: borra sus tareas, horas y el timer activo del usuario, y carga las tareas del escenario. */
  async reset(scenarioKey: string, user: DemoUser) {
    const scenario = this.requireScenario(scenarioKey);
    const organizationId = this.requireOrganization(user);

    return this.prisma.$transaction(async (tx) => {
      let project = await tx.project.findFirst({
        where: { organizationId, name: scenarioProjectName(scenario) },
        select: { id: true },
      });
      if (!project) {
        project = await tx.project.create({
          data: {
            name: scenarioProjectName(scenario),
            description: scenario.intro,
            priority: 'CRITICAL',
            ownerId: user.id,
            organizationId,
            members: { create: { userId: user.id, role: 'OWNER' } },
          },
          select: { id: true },
        });
      }

      await tx.timeEntry.deleteMany({
        where: { OR: [{ projectId: project.id }, { userId: user.id, endTime: null }] },
      });
      await tx.task.deleteMany({ where: { projectId: project.id } });

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 0, 0);
      for (const task of scenario.tasks) {
        await tx.task.create({
          data: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'TODO',
            dueDate: endOfDay,
            projectId: project.id,
            organizationId,
            assignedToId: user.id,
          },
        });
      }

      return { scenario: scenario.key, projectId: project.id };
    });
  }

  /** Lo que el juego necesita en una sola consulta: tareas del escenario, segundos trabajados y timer activo. */
  async getState(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const organizationId = this.requireOrganization(user);
    const summary = { key: scenario.key, name: scenario.name, intro: scenario.intro };

    const project = await this.prisma.project.findFirst({
      where: { organizationId, name: scenarioProjectName(scenario) },
      select: { id: true },
    });

    const active = await this.prisma.timeEntry.findFirst({
      where: { userId: user.id, endTime: null },
      select: { taskId: true, pausedAt: true, startTime: true },
    });
    const activeTimer = active
      ? { taskId: active.taskId, paused: Boolean(active.pausedAt), startTime: active.startTime.toISOString() }
      : null;

    if (!project) {
      return { scenario: summary, projectId: null, serverTime: now.toISOString(), tasks: [], activeTimer };
    }

    const [tasks, entries] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId: project.id, archivedAt: null, parentTaskId: null },
        select: { id: true, title: true, status: true, priority: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.timeEntry.findMany({
        where: { projectId: project.id, taskId: { not: null } },
        select: { taskId: true, startTime: true, endTime: true, pausedAt: true, totalPausedMs: true },
      }),
    ]);

    const worked = computeWorkedSeconds(entries, now);
    return {
      scenario: summary,
      projectId: project.id,
      serverTime: now.toISOString(),
      tasks: tasks.map((task) => {
        const definition = scenario.tasks.find((candidate) => candidate.title === task.title);
        return {
          ...task,
          action: definition?.action ?? null,
          workSeconds: definition?.workSeconds ?? 10,
          workedSeconds: Math.round((worked.get(task.id) ?? 0) * 10) / 10,
        };
      }),
      activeTimer,
    };
  }

  private requireScenario(key: string): DemoScenario {
    const scenario = findScenario(key);
    if (!scenario) throw new NotFoundException(`Escenario desconocido: ${key}`);
    return scenario;
  }

  private requireOrganization(user: DemoUser): string {
    if (!user.organizationId) throw new BadRequestException('El usuario demo no tiene organización');
    return user.organizationId;
  }
}
