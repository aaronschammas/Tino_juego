import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner, PermissionUser } from 'src/common/permissions';
import {
  calculateActiveMsWithinRange,
  roundHours,
} from '../analytics/analytics-dashboard.utils';
import { AssistantPeriod, AssistantQueryDto } from './dto/assistant-query.dto';
import { AssistantIntent, detectAssistantIntent } from './assistant-intent';

export const ASSISTANT_SUGGESTIONS = [
  'Qué pasó hoy en mi equipo',
  'Cuántas horas trabajamos esta semana',
  'Qué tareas están atrasadas',
  'Qué proyecto consumió más tiempo',
  'Quién tiene más carga de trabajo',
  'Qué tareas no tienen responsable',
  'Qué timers están activos',
  'Dame un resumen para una reunión',
];

export interface AssistantResponse {
  intent: AssistantIntent;
  confidence: number;
  title: string;
  summary: string;
  details: string[];
  recommendation?: string;
  data?: unknown;
}

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  private range(period: AssistantPeriod) {
    const to = new Date();
    const from = new Date(to);
    from.setHours(0, 0, 0, 0);
    if (period === AssistantPeriod.WEEK)
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    if (period === AssistantPeriod.MONTH) from.setDate(1);
    return { from, to };
  }

  async query(
    user: PermissionUser,
    dto: AssistantQueryDto,
  ): Promise<AssistantResponse> {
    const detected = detectAssistantIntent(dto.query);
    if (detected.intent === 'unknown') {
      return {
        intent: detected.intent,
        confidence: detected.confidence,
        title: 'Todavía estoy aprendiendo',
        summary:
          'Todavía no puedo responder esa consulta. Probá preguntarme por tareas atrasadas, horas de la semana, timers activos o resumen del equipo.',
        details: [],
      };
    }
    return this.answerIntent(
      user,
      detected.intent,
      dto.period,
      detected.confidence,
    );
  }

  async answerIntent(
    user: PermissionUser,
    intent: Exclude<AssistantIntent, 'unknown'>,
    requestedPeriod?: AssistantPeriod,
    confidence = 0.95,
  ): Promise<AssistantResponse> {
    if (!user.organizationId)
      throw new BadRequestException('User must belong to an organization');
    const period =
      requestedPeriod ??
      (intent === 'today_summary'
        ? AssistantPeriod.TODAY
        : AssistantPeriod.WEEK);
    const { from, to } = this.range(period);
    const organizationId = user.organizationId;
    const owner = await isOrgOwner(user, organizationId, this.prisma);
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(owner ? {} : { members: { some: { userId: user.id } } }),
      },
      select: { id: true, name: true },
    });
    const projectIds = projects.map((project) => project.id);
    const assignment: Prisma.TaskWhereInput = owner
      ? {}
      : {
          OR: [
            { assignedToId: user.id },
            { subTasks: { some: { assignedToId: user.id } } },
          ],
        };
    const [tasks, entries, timers, users] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          organizationId,
          projectId: { in: projectIds },
          parentTaskId: null,
          archivedAt: null,
          ...assignment,
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          status: true,
          dueDate: true,
          assignedToId: true,
          subTasks: { select: { assignedToId: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          organizationId,
          projectId: { in: projectIds },
          ...(owner ? {} : { userId: user.id }),
          endTime: { not: null, gt: from },
          startTime: { lt: to },
        },
        select: {
          userId: true,
          projectId: true,
          startTime: true,
          endTime: true,
          totalPausedMs: true,
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          organizationId,
          projectId: { in: projectIds },
          ...(owner ? {} : { userId: user.id }),
          endTime: null,
        },
        select: {
          id: true,
          userId: true,
          projectId: true,
          task: { select: { title: true } },
        },
        take: 10,
      }),
      this.prisma.user.findMany({
        where: {
          isActive: true,
          organizationMemberships: { some: { organizationId } },
          ...(owner ? {} : { id: user.id }),
        },
        select: { id: true, name: true, lastname: true },
      }),
    ]);
    const projectName = new Map(
      projects.map((project) => [project.id, project.name]),
    );
    const userName = new Map(
      users.map((target) => [
        target.id,
        `${target.name} ${target.lastname}`.trim(),
      ]),
    );
    const overdue = tasks.filter(
      (task) =>
        task.status !== TaskStatus.DONE && task.dueDate && task.dueDate < to,
    );
    const unassigned = tasks.filter(
      (task) =>
        !task.assignedToId &&
        task.subTasks.every((subtask) => !subtask.assignedToId),
    );
    const active = tasks.filter((task) => task.status !== TaskStatus.DONE);
    const hoursByProject = new Map<string, number>();
    const hoursByUser = new Map<string, number>();
    for (const entry of entries) {
      const ms = calculateActiveMsWithinRange(entry, from, to);
      hoursByProject.set(
        entry.projectId,
        (hoursByProject.get(entry.projectId) ?? 0) + ms,
      );
      hoursByUser.set(entry.userId, (hoursByUser.get(entry.userId) ?? 0) + ms);
    }
    const totalHours = roundHours(
      [...hoursByProject.values()].reduce((sum, value) => sum + value, 0),
    );
    const topProject = [...hoursByProject.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const topProjectText = topProject
      ? `${projectName.get(topProject[0]) ?? 'Proyecto'} (${roundHours(topProject[1])} h)`
      : 'Sin registros confirmados';
    const taskRows = (items: typeof tasks) =>
      items.slice(0, 10).map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectName: projectName.get(task.projectId),
      }));
    const baseDetails = [
      `${active.length} tareas activas.`,
      `${overdue.length} tareas atrasadas.`,
      `${unassigned.length} tareas sin responsable.`,
      `Mayor actividad: ${topProjectText}.`,
    ];

    if (intent === 'overdue_tasks')
      return this.answer(
        intent,
        confidence,
        'Tareas atrasadas',
        overdue.length
          ? `Encontré ${overdue.length} tareas vencidas sin completar.`
          : 'No encontré tareas atrasadas en tu alcance.',
        overdue
          .slice(0, 4)
          .map((task) => `${task.title} · ${projectName.get(task.projectId)}`),
        overdue.length
          ? 'Revisá primero las de vencimiento más antiguo.'
          : undefined,
        taskRows(overdue),
      );
    if (intent === 'unassigned_tasks')
      return this.answer(
        intent,
        confidence,
        'Tareas sin responsable',
        unassigned.length
          ? `Hay ${unassigned.length} tareas sin asignación directa ni mediante subtareas.`
          : 'No encontré tareas sin responsable.',
        unassigned
          .slice(0, 4)
          .map((task) => `${task.title} · ${projectName.get(task.projectId)}`),
        unassigned.length
          ? 'Asigná responsables antes de sumar trabajo nuevo.'
          : undefined,
        taskRows(unassigned),
      );
    if (intent === 'active_timers')
      return this.answer(
        intent,
        confidence,
        'Timers activos',
        timers.length
          ? `Hay ${timers.length} timers activos ahora.`
          : 'No encontré timers activos.',
        timers
          .slice(0, 4)
          .map(
            (timer) =>
              `${userName.get(timer.userId) ?? 'Usuario'} · ${timer.task?.title ?? projectName.get(timer.projectId) ?? 'Proyecto'}`,
          ),
        undefined,
        timers,
      );
    if (intent === 'top_project_by_time')
      return this.answer(
        intent,
        confidence,
        'Proyecto con más tiempo',
        topProject
          ? `${topProjectText} es el proyecto con más horas confirmadas.`
          : 'No encontré datos para este período.',
        [`Período: ${period}.`, `Total confirmado: ${totalHours} h.`],
        undefined,
        topProject
          ? { projectId: topProject[0], hours: roundHours(topProject[1]) }
          : null,
      );
    if (intent === 'workload_by_user') {
      const rows = users
        .map((target) => ({
          userId: target.id,
          name: userName.get(target.id)!,
          activeTasks: tasks.filter(
            (task) =>
              task.assignedToId === target.id ||
              task.subTasks.some(
                (subtask) => subtask.assignedToId === target.id,
              ),
          ).length,
          hours: roundHours(hoursByUser.get(target.id) ?? 0),
        }))
        .sort((a, b) => b.activeTasks - a.activeTasks || b.hours - a.hours)
        .slice(0, 10);
      return this.answer(
        intent,
        confidence,
        'Carga de trabajo',
        rows.length
          ? `${rows[0].name} tiene la mayor carga visible con ${rows[0].activeTasks} tareas activas.`
          : 'No encontré datos para este período.',
        rows
          .slice(0, 4)
          .map(
            (row) => `${row.name}: ${row.activeTasks} tareas · ${row.hours} h`,
          ),
        'Usá este dato para revisar capacidad, no para puntuar personas.',
        rows,
      );
    }
    if (intent === 'project_risk') {
      const risks = projects
        .map((project) => {
          const projectTasks = tasks.filter(
            (task) => task.projectId === project.id,
          );
          const late = projectTasks.filter((task) =>
            overdue.includes(task),
          ).length;
          const free = projectTasks.filter((task) =>
            unassigned.includes(task),
          ).length;
          const hours = roundHours(hoursByProject.get(project.id) ?? 0);
          return {
            projectId: project.id,
            name: project.name,
            overdue: late,
            unassigned: free,
            hours,
            score:
              late * 3 +
              free * 2 +
              (hours > 0 &&
              projectTasks.every((task) => task.status !== TaskStatus.DONE)
                ? 1
                : 0) +
              (hours === 0 ? 1 : 0),
          };
        })
        .sort((a, b) => b.score - a.score);
      const risk = risks[0];
      return this.answer(
        intent,
        confidence,
        'Riesgo operativo',
        risk && risk.score > 0
          ? `Conviene revisar primero ${risk.name}.`
          : 'No encontré señales de riesgo con las reglas actuales.',
        risk
          ? [
              `${risk.overdue} tareas atrasadas.`,
              `${risk.unassigned} tareas sin responsable.`,
              `${risk.hours} h confirmadas en el período.`,
            ]
          : [],
        risk?.score
          ? 'Revisá vencimientos y asignaciones con el equipo.'
          : undefined,
        risk ?? null,
      );
    }
    const summaryTitle =
      intent === 'weekly_summary'
        ? 'Resumen semanal'
        : intent === 'today_summary'
          ? 'Resumen de hoy'
          : 'Resumen para reunión';
    return this.answer(
      intent,
      confidence,
      summaryTitle,
      `${totalHours} horas confirmadas y ${active.length} tareas activas en tu alcance.`,
      [
        `Tareas completadas en el período: no disponible sin completedAt.`,
        ...baseDetails,
      ].slice(0, 4),
      overdue.length
        ? 'Revisá los atrasos antes de planificar trabajo nuevo.'
        : undefined,
      {
        totalHours,
        activeTasks: active.length,
        overdueTasks: overdue.length,
        unassignedTasks: unassigned.length,
        topProject: topProjectText,
      },
    );
  }

  private answer(
    intent: AssistantIntent,
    confidence: number,
    title: string,
    summary: string,
    details: string[],
    recommendation?: string,
    data?: unknown,
  ): AssistantResponse {
    return {
      intent,
      confidence,
      title,
      summary,
      details,
      ...(recommendation ? { recommendation } : {}),
      ...(data !== undefined ? { data } : {}),
    };
  }
}
