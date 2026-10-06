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
  updatedAt: Date;
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
  dangerRate: number;
  nextStage: { at: number; kind: DemoStage['kind']; message: string } | null;
  level: number;
}

export interface DemoEvent {
  type: 'auto-stop' | DemoStage['kind'];
  title: string;
  from?: string;
  message: string;
}

export interface DemoRound {
  status: 'waiting' | 'playing' | 'finished';
  reason: 'cleared' | 'timeout' | 'ended' | null;
  limitSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  elapsedSeconds: number;
}

export interface DemoScore {
  fires: number;
  firesOut: number;
  choices: number;
  goodChoices: number;
  efficiency: number | null;
  seconds: number;
  points: number;
}

export interface DemoState {
  scenario: { key: string; name: string; intro: string };
  projectId: string | null;
  serverTime: string;
  round: DemoRound;
  score: DemoScore;
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
export const ROUND_SECONDS = 150;
export const DEFAULT_WORK_SECONDS = 10;
export const POINTS_PER_FIRE = 100;
export const POINTS_PER_MISTAKE = 25;

const rankOf = (priority: string | undefined) => PRIORITY_RANK[priority ?? ''] ?? 0;
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Segundos trabajados de un registro dentro de [from, to]: el tramo activo (sin la pausa abierta) se recorta
 * al intervalo y las pausas cerradas se descuentan en proporción.
 */
export function overlapSeconds(entry: TimeEntrySlice, from: Date, to: Date): number {
  const start = entry.startTime.getTime();
  const stop = entry.endTime?.getTime() ?? entry.pausedAt?.getTime() ?? to.getTime();
  const span = stop - start;
  const clipped = Math.min(stop, to.getTime()) - Math.max(start, from.getTime());
  if (span <= 0 || clipped <= 0) return 0;
  const active = Math.max(0, span - entry.totalPausedMs);
  return (active * Math.min(1, clipped / span)) / 1000;
}

/** Segundos trabajados por tarea hasta `now`, descontando las pausas. */
export function computeWorkedSeconds(entries: TimeEntrySlice[], now: Date): Map<string, number> {
  const worked = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.taskId) continue;
    worked.set(entry.taskId, (worked.get(entry.taskId) ?? 0) + overlapSeconds(entry, entry.startTime, now));
  }
  return worked;
}

/**
 * Peligro de un problema sin resolver: segundos desde que arrancó la partida (o desde que apareció, si es una
 * consecuencia), menos lo que se trabajó en él, más lo trabajado en tareas menos urgentes en ese lapso.
 */
export function computeDanger(
  task: { id: string; priority: string; createdAt?: Date },
  startedAt: Date,
  now: Date,
  entries: TimeEntrySlice[],
  priorityById: Map<string, string>,
  worked: Map<string, number>,
): number {
  const rank = rankOf(task.priority);
  const from = new Date(Math.max(startedAt.getTime(), task.createdAt?.getTime() ?? 0));
  const elapsed = Math.max(0, (now.getTime() - from.getTime()) / 1000);
  const mistakes = entries
    .filter((entry) => entry.taskId && rankOf(priorityById.get(entry.taskId)) < rank)
    .reduce((total, entry) => total + overlapSeconds(entry, from, now), 0);
  return Math.max(0, elapsed - (worked.get(task.id) ?? 0) + mistakes);
}

/**
 * A qué velocidad crece ahora el peligro de un problema: 0 si se trabaja en él, 2 si el timer corre en una
 * tarea menos urgente del escenario y 1 en cualquier otro caso (sin timer, en pausa o de otro proyecto).
 */
export function dangerRate(
  task: { id: string; priority: string },
  active: Loaded['active'],
  priorityById: Map<string, string>,
): number {
  if (!active?.taskId || active.pausedAt) return 1;
  if (active.taskId === task.id) return 0;
  const running = priorityById.get(active.taskId);
  return running !== undefined && rankOf(running) < rankOf(task.priority) ? 2 : 1;
}

/**
 * Partida: arranca con el primer timer (o la primera tarea Hecha), dura ROUND_SECONDS y termina antes si todos
 * los problemas quedaron Hechos o si el visitante la finalizó (`stoppedAt`, botón "Finalizar partida").
 * Devuelve también el instante con el que se evalúa todo lo demás.
 */
export function computeRound(
  problems: TaskRow[],
  entries: TimeEntrySlice[],
  now: Date,
  stoppedAt: Date | null = null,
): { round: DemoRound; at: Date } {
  const done = problems.filter((task) => task.status === 'DONE');
  const stop = stoppedAt && stoppedAt.getTime() <= now.getTime() ? stoppedAt.getTime() : null;
  const marks = [...entries.map((entry) => entry.startTime.getTime()), ...done.map((task) => task.updatedAt.getTime())];
  if (!marks.length && stop === null) {
    return {
      round: {
        status: 'waiting',
        reason: null,
        limitSeconds: ROUND_SECONDS,
        startedAt: null,
        endsAt: null,
        endedAt: null,
        elapsedSeconds: 0,
      },
      at: now,
    };
  }

  const start = marks.length ? Math.min(...marks) : (stop as number);
  const ends = start + ROUND_SECONDS * 1000;
  const lastDone = done.length ? Math.max(...done.map((task) => task.updatedAt.getTime())) : 0;
  const cleared = problems.length > 0 && done.length === problems.length && lastDone < ends;
  const timeout = !cleared && now.getTime() >= ends;
  let endedAt = cleared ? lastDone : timeout ? ends : null;
  let reason: DemoRound['reason'] = cleared ? 'cleared' : timeout ? 'timeout' : null;
  if (stop !== null && (endedAt === null || stop < endedAt)) {
    endedAt = Math.max(stop, start);
    reason = 'ended';
  }
  const at = new Date(endedAt ?? now.getTime());
  return {
    round: {
      status: endedAt === null ? 'playing' : 'finished',
      reason,
      limitSeconds: ROUND_SECONDS,
      startedAt: new Date(start).toISOString(),
      endsAt: new Date(ends).toISOString(),
      endedAt: endedAt === null ? null : at.toISOString(),
      elapsedSeconds: round1(Math.max(0, (at.getTime() - start) / 1000)),
    },
    at,
  };
}

/**
 * Puntaje de la partida: fuegos apagados (Hechos), eficiencia de priorización (cada timer iniciado en un
 * problema, ¿era el más urgente de los pendientes en ese momento?) y los segundos que sobraron.
 */
export function computeScore(
  problems: TaskRow[],
  workSeconds: Map<string, number>,
  entries: TimeEntrySlice[],
  round: DemoRound,
): DemoScore {
  const chosen = entries
    .filter((entry) => entry.taskId && workSeconds.has(entry.taskId))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  let previous: string | null = null;
  let choices = 0;
  let goodChoices = 0;
  for (const entry of chosen) {
    if (entry.taskId === previous) continue;
    previous = entry.taskId;
    const when = entry.startTime;
    const workedThen = computeWorkedSeconds(entries, when);
    const pending = problems.filter(
      (task) =>
        task.createdAt <= when &&
        !(task.status === 'DONE' && task.updatedAt <= when) &&
        (workedThen.get(task.id) ?? 0) < (workSeconds.get(task.id) ?? 0),
    );
    const best = Math.max(0, ...pending.map((task) => rankOf(task.priority)));
    const picked = rankOf(problems.find((task) => task.id === entry.taskId)?.priority);
    choices += 1;
    if (picked >= best) goodChoices += 1;
  }

  const firesOut = problems.filter((task) => task.status === 'DONE').length;
  const spare = round.reason === 'cleared' ? Math.max(0, Math.floor(round.limitSeconds - round.elapsedSeconds)) : 0;
  const points = firesOut * POINTS_PER_FIRE + spare - (choices - goodChoices) * POINTS_PER_MISTAKE;
  return {
    fires: problems.length,
    firesOut,
    choices,
    goodChoices,
    efficiency: choices ? Math.round((goodChoices / choices) * 100) : null,
    seconds: round.elapsedSeconds,
    points: Math.max(0, points),
  };
}

/** Estado del escenario a partir de lo que hay en la base, y las consecuencias que ya tocan aplicarse. */
export function buildState(
  scenario: DemoScenario,
  loaded: Loaded | null,
  now: Date,
  stoppedAt: Date | null = null,
): { state: DemoState; pending: PendingStage[] } {
  const summary = { key: scenario.key, name: scenario.name, intro: scenario.intro };
  const activeTimer = loaded?.active
    ? {
        taskId: loaded.active.taskId,
        paused: Boolean(loaded.active.pausedAt),
        startTime: loaded.active.startTime.toISOString(),
      }
    : null;
  const defs = new Map<string, DemoTaskDef>(flattenScenario(scenario).map((entry) => [entry.def.title, entry.def]));
  const problems = (loaded?.tasks ?? []).filter((task) => defs.get(task.title)?.action);
  const entries = loaded?.entries ?? [];
  const { round, at } = computeRound(problems, entries, now, stoppedAt);
  const workSeconds = new Map(problems.map((task) => [task.id, defs.get(task.title)?.workSeconds ?? DEFAULT_WORK_SECONDS]));
  const score = computeScore(problems, workSeconds, entries, round);
  const empty = { scenario: summary, serverTime: now.toISOString(), round, score, activeTimer, events: [] };
  if (!loaded) {
    return { state: { ...empty, projectId: null, tasks: [] }, pending: [] };
  }

  const titles = new Set(loaded.tasks.map((task) => task.title));
  const worked = computeWorkedSeconds(entries, at);
  const priorityById = new Map(loaded.tasks.map((task) => [task.id, task.priority]));
  const startedAt = round.startedAt ? new Date(round.startedAt) : null;
  const playing = round.status === 'playing';
  const pending: PendingStage[] = [];

  const tasks: DemoTaskState[] = loaded.tasks.map((task) => {
    const def = defs.get(task.title);
    const work = def?.workSeconds ?? DEFAULT_WORK_SECONDS;
    const workedSeconds = round1(worked.get(task.id) ?? 0);
    const solved = task.status === 'DONE' || Boolean(def?.action && workedSeconds >= work);
    const stages = [...(def?.stages ?? [])].sort((a, b) => a.at - b.at);
    const level = stages.filter((stage) => titles.has(stage.spawn.title)).length;

    let danger: number | null = null;
    let nextStage: DemoTaskState['nextStage'] = null;
    if (stages.length && !solved) {
      danger = startedAt ? round1(computeDanger(task, startedAt, at, entries, priorityById, worked)) : 0;
      for (const stage of stages) {
        if (titles.has(stage.spawn.title)) continue;
        if (stage.at <= danger) {
          if (playing) pending.push({ stage, from: task.title });
        } else if (!nextStage) {
          nextStage = { at: stage.at, kind: stage.kind, message: stage.message };
        }
      }
    }

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      parentTaskId: task.parentTaskId,
      action: def?.action ?? null,
      workSeconds: work,
      workedSeconds,
      solved,
      danger,
      dangerRate: danger !== null && playing ? dangerRate(task, loaded.active, priorityById) : 0,
      nextStage,
      level,
    };
  });

  for (const parent of tasks) {
    const children = tasks.filter((task) => task.parentTaskId === parent.id);
    if (children.length && !parent.solved) parent.solved = children.every((child) => child.solved);
  }

  return { state: { ...empty, projectId: loaded.projectId, tasks }, pending };
}

/**
 * Timer que el backend apaga solo: el de un problema que el personaje ya terminó, o cualquiera del escenario
 * cuando terminó la partida. Devuelve el aviso para el juego, o null si no hay que apagar nada.
 */
export function timerToStop(state: DemoState): { title: string; message: string } | null {
  const active = state.activeTimer;
  const task = active?.taskId ? state.tasks.find((candidate) => candidate.id === active.taskId) : null;
  if (!active || !task) return null;
  if (state.round.status === 'finished') {
    return { title: task.title, message: `Se terminó la partida: apagué el timer de "${task.title}".` };
  }
  if (!active.paused && task.action && task.workedSeconds >= task.workSeconds) {
    return { title: task.title, message: `¡Listo! Apagué el timer de "${task.title}". Marcala como Hecha.` };
  }
  return null;
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly stopped = new Map<string, Date>();

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

    return this.serialize(user.id, () =>
      this.prisma.$transaction(async (tx) => {
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

        this.stopped.delete(project.id);
        return { scenario: scenario.key, projectId: project.id };
      }),
    );
  }

  /**
   * Borra todo lo que dejaron las partidas (proyectos "Feria · ...", sus tareas, horas y el timer abierto del usuario):
   * el próximo visitante empieza de cero. El resto de la empresa demo no se toca.
   */
  async resetAll(user: DemoUser) {
    const organizationId = this.requireOrganization(user);
    const names = DEMO_SCENARIOS.map(scenarioProjectName);

    return this.serialize(user.id, () =>
      this.prisma.$transaction(async (tx) => {
        const projects = await tx.project.findMany({ where: { organizationId, name: { in: names } }, select: { id: true } });
        const projectIds = projects.map((project) => project.id);
        await tx.timeEntry.deleteMany({
          where: { OR: [{ projectId: { in: projectIds } }, { userId: user.id, endTime: null }] },
        });
        await tx.task.deleteMany({ where: { projectId: { in: projectIds }, parentTaskId: { not: null } } });
        await tx.task.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.project.deleteMany({ where: { id: { in: projectIds } } });
        for (const id of projectIds) this.stopped.delete(id);
        return { removed: projectIds.length };
      }),
    );
  }

  /** Estado del escenario, sin cambiar nada. */
  async getState(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const loaded = await this.load(scenario, this.requireOrganization(user), user.id);
    return buildState(scenario, loaded, now, this.stoppedAt(loaded)).state;
  }

  /**
   * Un paso del juego: apaga el timer de la tarea que el personaje terminó (o el del escenario si terminó la
   * partida), crea en Tino las consecuencias de los problemas desatendidos y devuelve el estado con los eventos.
   * Los pasos del mismo usuario van de a uno, así dos pestañas abiertas no duplican nada.
   */
  async tick(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const organizationId = this.requireOrganization(user);
    return this.serialize(user.id, () => this.runTick(scenario, organizationId, user, now));
  }

  private async runTick(scenario: DemoScenario, organizationId: string, user: DemoUser, now: Date): Promise<DemoState> {
    let loaded = await this.load(scenario, organizationId, user.id);
    const { state, pending } = buildState(scenario, loaded, now, this.stoppedAt(loaded));
    if (!loaded) return state;

    const events: DemoEvent[] = [];
    const stop = timerToStop(state);
    if (stop) {
      try {
        await this.timeTracking.stopTime(user as PermissionUser);
        events.push({ type: 'auto-stop', title: stop.title, message: stop.message });
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
    return { ...buildState(scenario, loaded, now, this.stoppedAt(loaded)).state, events };
  }

  /**
   * Botón "Finalizar partida": la da por terminada ahora (si ya había terminado, no cambia nada) y hace un paso
   * del juego, que apaga el timer del escenario. Se guarda en memoria: alcanza para un backend local.
   */
  async finish(scenarioKey: string, user: DemoUser, now = new Date()): Promise<DemoState> {
    const scenario = this.requireScenario(scenarioKey);
    const organizationId = this.requireOrganization(user);
    return this.serialize(user.id, async () => {
      const loaded = await this.load(scenario, organizationId, user.id);
      if (loaded && !this.stopped.has(loaded.projectId)) this.stopped.set(loaded.projectId, now);
      return this.runTick(scenario, organizationId, user, now);
    });
  }

  /** Cuándo se finalizó a mano la partida de este proyecto, si se finalizó. */
  private stoppedAt(loaded: Loaded | null): Date | null {
    return loaded ? this.stopped.get(loaded.projectId) ?? null : null;
  }

  /** Corre `run` cuando terminó lo anterior del mismo usuario (un solo backend local: alcanza con una cola en memoria). */
  private serialize<T>(key: string, run: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(run);
    this.queues.set(key, next);
    next
      .catch(() => undefined)
      .finally(() => {
        if (this.queues.get(key) === next) this.queues.delete(key);
      });
    return next;
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
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          parentTaskId: true,
          createdAt: true,
          updatedAt: true,
        },
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
        estimatedHours: def.action ? (def.workSeconds ?? DEFAULT_WORK_SECONDS) / 3600 : null,
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
