import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import type { PermissionUser } from 'src/common/permissions';
import { TimeTrackingService } from '../time-tracking/time-tracking.service';
import {
  DEMO_SCENARIOS,
  type DemoScenario,
  type DemoStage,
  type DemoTaskDef,
  findScenario,
  flattenScenario,
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

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  createdAt: Date;
}

export interface DemoTaskState {
  id: string;
  title: string;
  status: string;
  priority: string;
  parentTaskId: string | null;
  action: string | null;
  workSeconds: number;
  workedSeconds: number;
  solved: boolean;
  danger: number | null;
  nextStage: { at: number; kind: DemoStage['kind']; message: string } | null;
  level: number;
}

export interface DemoEvent {
  type: 'auto-stop' | DemoStage['kind'];
  title: string;
  from?: string;
  message: string;
}

export interface DemoState {
  scenario: { key: string; name: string; intro: string };
  projectId: string | null;
  serverTime: string;
  startedAt: string | null;
  tasks: DemoTaskState[];
  activeTimer: { taskId: string | null; paused: boolean; startTime: string } | null;
  events: DemoEvent[];
}

interface Loaded {
  projectId: string;
  tasks: TaskRow[];
  entries: TimeEntrySlice[];
  active: { taskId: string | null; pausedAt: Date | null; startTime: Date } | null;
}

interface PendingStage {
  stage: DemoStage;
  from: string;
}

export const PRIORITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

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

/** Segundos en que un registro de tiempo se superpone con el intervalo [from, to]. */
export function overlapSeconds(entry: TimeEntrySlice, from: Date, to: Date): number {
  const start = Math.max(entry.startTime.getTime(), from.getTime());
  const end = Math.min((entry.endTime ?? to).getTime(), to.getTime());
  return Math.max(0, (end - start) / 1000);
}

/**
 * Peligro de un problema sin resolver: segundos desde que arrancó la ronda, menos lo que se trabajó en él,
 * más el tiempo que se trabajó en tareas menos urgentes (equivocarse de prioridad lo hace crecer el doble).
 */
export function computeDanger(
  task: { id: string; priority: string },
  startedAt: Date,
  now: Date,
  entries: TimeEntrySlice[],
  priorityById: Map<string, string>,
  worked: Map<string, number>,
): number {
  const rank = PRIORITY_RANK[task.priority] ?? 0;
  const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
  const mistakes = entries
    .filter((entry) => entry.taskId && (PRIORITY_RANK[priorityById.get(entry.taskId) ?? ''] ?? 0) < rank)
    .reduce((total, entry) => total + overlapSeconds(entry, startedAt, now), 0);
  return Math.max(0, elapsed - (worked.get(task.id) ?? 0) + mistakes);
}

/** Estado del escenario a partir de lo que hay en la base, y las consecuencias que ya tocan aplicarse. */
export function buildState(
  scenario: DemoScenario,
  loaded: Loaded | null,
  now: Date,
): { state: DemoState; pending: PendingStage[] } {
  const summary = { key: scenario.key, name: scenario.name, intro: scenario.intro };
  const activeTimer = loaded?.active
    ? {
        taskId: loaded.active.taskId,
        paused: Boolean(loaded.active.pausedAt),
        startTime: loaded.active.startTime.toISOString(),
      }
    : null;
  const empty = { scenario: summary, serverTime: now.toISOString(), activeTimer, events: [] };
  if (!loaded) {
    return { state: { ...empty, projectId: null, startedAt: null, tasks: [] }, pending: [] };
  }

  const defs = new Map<string, DemoTaskDef>(flattenScenario(scenario).map((entry) => [entry.def.title, entry.def]));
  const titles = new Set(loaded.tasks.map((task) => task.title));
  const worked = computeWorkedSeconds(loaded.entries, now);
  const priorityById = new Map(loaded.tasks.map((task) => [task.id, task.priority]));
  const startedAt = loaded.tasks.reduce<Date | null>(
    (min, task) => (!min || task.createdAt < min ? task.createdAt : min),
    null,
  ) ?? now;
  const pending: PendingStage[] = [];

  const tasks: DemoTaskState[] = loaded.tasks.map((task) => {
    const def = defs.get(task.title);
    const workSeconds = def?.workSeconds ?? 10;
    const workedSeconds = Math.round((worked.get(task.id) ?? 0) * 10) / 10;
    const solved = task.status === 'DONE' || Boolean(def?.action && workedSeconds >= workSeconds);
    const stages = [...(def?.stages ?? [])].sort((a, b) => a.at - b.at);
    const level = stages.filter((stage) => titles.has(stage.spawn.title)).length;

    let danger: number | null = null;
    let nextStage: DemoTaskState['nextStage'] = null;
    if (stages.length && !solved) {
      danger = Math.round(computeDanger(task, startedAt, now, loaded.entries, priorityById, worked) * 10) / 10;
      for (const stage of stages) {
        if (titles.has(stage.spawn.title)) continue;
        if (stage.at <= danger) pending.push({ stage, from: task.title });
        else if (!nextStage) nextStage = { at: stage.at, kind: stage.kind, message: stage.message };
      }
    }

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      parentTaskId: task.parentTaskId,
      action: def?.action ?? null,
      workSeconds,
      workedSeconds,
      solved,
      danger,
      nextStage,
      level,
    };
  });

  for (const parent of tasks) {
    const children = tasks.filter((task) => task.parentTaskId === parent.id);
    if (children.length && !parent.solved) parent.solved = children.every((child) => child.solved);
  }

  return {
    state: { ...empty, projectId: loaded.projectId, startedAt: startedAt.toISOString(), tasks },
    pending,
  };
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeTracking: TimeTrackingService,
  ) {}

  /** Escenarios disponibles, con sus tareas iniciales. */
  listScenarios() {
    return DEMO_SCENARIOS.map(({ key, name, intro, tasks }) => ({
      key,
      name,
      intro,
      tasks: tasks.map(({ title, priority, action, subtasks }) => ({
        title,
        priority,
        action: action ?? null,
        subtasks: (subtasks ?? []).map((sub) => sub.title),
      })),
    }));
  }

  /** Deja el escenario como nuevo: borra sus tareas, horas y el timer activo del usuario, y carga las tareas iniciales. */
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
      await tx.task.deleteMany({ where: { projectId: project.id, parentTaskId: { not: null } } });
      await tx.task.deleteMany({ where: { projectId: project.id } });

      for (const def of scenario.tasks) {
        const parent = await this.createTask(tx, def, project.id, organizationId, user.id, null);
        for (const sub of def.subtasks ?? []) {
          await this.createTask(tx, sub, project.id, organizationId, user.id, parent.id);
        }
      }

      return { scenario: scenario.key, projectId: project.id };
    });
  }

  /** Estado del escenario, sin cambiar nada. */
  async getState(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const loaded = await this.load(scenario, this.requireOrganization(user), user.id);
    return buildState(scenario, loaded, now).state;
  }

  /**
   * Un paso del juego: apaga el timer de la tarea que el personaje terminó, crea en Tino las consecuencias
   * de los problemas desatendidos y devuelve el estado con los eventos que pasaron.
   */
  async tick(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const organizationId = this.requireOrganization(user);
    let loaded = await this.load(scenario, organizationId, user.id);
    const { state, pending } = buildState(scenario, loaded, now);
    if (!loaded) return state;

    const events: DemoEvent[] = [];
    const active = loaded.active;
    const running = active && !active.pausedAt ? state.tasks.find((task) => task.id === active.taskId) : null;
    if (running?.action && running.workedSeconds >= running.workSeconds) {
      try {
        await this.timeTracking.stopTime(user as PermissionUser);
        events.push({
          type: 'auto-stop',
          title: running.title,
          message: `¡Listo! Apagué el timer de "${running.title}". Marcala como Hecha.`,
        });
      } catch (error) {
        this.logger.warn(`No se pudo apagar el timer: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (pending.length) {
      const projectId = loaded.projectId;
      await this.prisma.$transaction(async (tx) => {
        for (const { stage, from } of pending) {
          const exists = await tx.task.findFirst({ where: { projectId, title: stage.spawn.title }, select: { id: true } });
          if (exists) continue;
          const parent = stage.spawn.parent
            ? await tx.task.findFirst({ where: { projectId, title: stage.spawn.parent }, select: { id: true } })
            : null;
          await this.createTask(tx, stage.spawn, projectId, organizationId, user.id, parent?.id ?? null);
          events.push({ type: stage.kind, title: stage.spawn.title, from, message: stage.message });
        }
      });
    }

    if (!events.length) return state;
    loaded = await this.load(scenario, organizationId, user.id);
    return { ...buildState(scenario, loaded, now).state, events };
  }

  private async load(scenario: DemoScenario, organizationId: string, userId: string): Promise<Loaded | null> {
    const project = await this.prisma.project.findFirst({
      where: { organizationId, name: scenarioProjectName(scenario) },
      select: { id: true },
    });
    const active = await this.prisma.timeEntry.findFirst({
      where: { userId, endTime: null },
      select: { taskId: true, pausedAt: true, startTime: true },
    });
    if (!project) return null;

    const [tasks, entries] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId: project.id, archivedAt: null },
        select: { id: true, title: true, status: true, priority: true, parentTaskId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.timeEntry.findMany({
        where: { projectId: project.id, taskId: { not: null } },
        select: { taskId: true, startTime: true, endTime: true, pausedAt: true, totalPausedMs: true },
      }),
    ]);
    return { projectId: project.id, tasks, entries, active };
  }

  private createTask(
    tx: Prisma.TransactionClient,
    def: DemoTaskDef,
    projectId: string,
    organizationId: string,
    userId: string,
    parentTaskId: string | null,
  ) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 0, 0);
    return tx.task.create({
      data: {
        title: def.title,
        description: def.description,
        priority: def.priority,
        status: 'TODO',
        dueDate: endOfDay,
        projectId,
        organizationId,
        assignedToId: userId,
        parentTaskId,
      },
      select: { id: true },
    });
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
