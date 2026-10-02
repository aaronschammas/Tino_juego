import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

export const DEMO_ORGANIZATION_NAME = 'Tino Demo';
export const DEMO_EMAIL_DOMAIN = 'tino-demo.local';
export const DEMO_PLAN_NAME = 'max';
export const DEMO_HISTORY_DAYS = 21;

const ARGENTINA_UTC_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DemoSeedOptions {
  email: string;
  password: string;
  now?: Date;
  force?: boolean;
}

export interface DemoSeedResult {
  created: boolean;
  organizationId: string;
  userId: string;
}

export interface DemoPerson {
  key: string;
  name: string;
  lastname: string;
}

export interface DemoTaskSeed {
  title: string;
  project: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  assignee: string | null;
  dueInDays: number | null;
  estimatedHours: number;
}

export interface DemoHistoryEntry {
  userKey: string;
  taskTitle: string;
  startTime: Date;
  endTime: Date;
}

export const DEMO_TEAMMATES: DemoPerson[] = [
  { key: 'ana', name: 'Ana', lastname: 'Gómez' },
  { key: 'bruno', name: 'Bruno', lastname: 'Díaz' },
  { key: 'carla', name: 'Carla', lastname: 'Ruiz' },
  { key: 'diego', name: 'Diego', lastname: 'Sosa' },
  { key: 'elena', name: 'Elena', lastname: 'Paz' },
];

export const DEMO_PROJECTS = [
  { name: 'Operaciones', description: 'El día a día de la empresa.', priority: 'HIGH' as const },
  { name: 'Sitio web', description: 'Rediseño y mantenimiento del sitio.', priority: 'MEDIUM' as const },
  { name: 'Clientes', description: 'Atención y seguimiento de cuentas.', priority: 'HIGH' as const },
];

export const DEMO_TASKS: DemoTaskSeed[] = [
  { title: 'Inventario mensual', project: 'Operaciones', priority: 'MEDIUM', status: 'DONE', assignee: 'ana', dueInDays: -10, estimatedHours: 6 },
  { title: 'Renovar contrato de hosting', project: 'Operaciones', priority: 'HIGH', status: 'IN_PROGRESS', assignee: 'bruno', dueInDays: -2, estimatedHours: 3 },
  { title: 'Cargar facturas de proveedores', project: 'Operaciones', priority: 'MEDIUM', status: 'TODO', assignee: null, dueInDays: 3, estimatedHours: 4 },
  { title: 'Ordenar el depósito', project: 'Operaciones', priority: 'LOW', status: 'TODO', assignee: 'diego', dueInDays: 10, estimatedHours: 5 },
  { title: 'Nueva página de inicio', project: 'Sitio web', priority: 'HIGH', status: 'DONE', assignee: 'carla', dueInDays: -5, estimatedHours: 12 },
  { title: 'Formulario de contacto', project: 'Sitio web', priority: 'MEDIUM', status: 'IN_PROGRESS', assignee: 'carla', dueInDays: 4, estimatedHours: 6 },
  { title: 'Optimizar imágenes', project: 'Sitio web', priority: 'LOW', status: 'DONE', assignee: 'elena', dueInDays: -8, estimatedHours: 3 },
  { title: 'Arreglar el menú en celulares', project: 'Sitio web', priority: 'HIGH', status: 'BLOCKED', assignee: 'elena', dueInDays: -1, estimatedHours: 4 },
  { title: 'Encuesta de satisfacción', project: 'Clientes', priority: 'MEDIUM', status: 'DONE', assignee: 'ana', dueInDays: -12, estimatedHours: 5 },
  { title: 'Responder reclamos pendientes', project: 'Clientes', priority: 'CRITICAL', status: 'IN_PROGRESS', assignee: 'diego', dueInDays: -3, estimatedHours: 8 },
  { title: 'Preparar propuesta comercial', project: 'Clientes', priority: 'HIGH', status: 'TODO', assignee: null, dueInDays: 2, estimatedHours: 6 },
  { title: 'Actualizar base de contactos', project: 'Clientes', priority: 'LOW', status: 'TODO', assignee: 'bruno', dueInDays: 14, estimatedHours: 2 },
];

/** Generador pseudoaleatorio determinista (mulberry32): mismo historial en cada seed. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fecha UTC de un día y hora locales de Argentina (UTC-3, sin horario de verano). */
export function argentinaTime(day: Date, hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour + ARGENTINA_UTC_OFFSET_HOURS,
      minute,
    ),
  );
}

/** Horas cargadas de los últimos días hábiles: bloques de 30 a 120 min entre las 9 y las 18, sin superponerse. */
export function buildDemoHistory(
  tasks: DemoTaskSeed[],
  now: Date,
  days = DEMO_HISTORY_DAYS,
  rng = createRng(20261002),
): DemoHistoryEntry[] {
  const workable = tasks.filter((task) => task.assignee && task.status !== 'TODO');
  const entries: DemoHistoryEntry[] = [];

  for (let offset = days; offset >= 1; offset--) {
    const localNow = new Date(now.getTime() - ARGENTINA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    const day = new Date(localNow.getTime() - offset * DAY_MS);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    for (const person of DEMO_TEAMMATES) {
      const ownTasks = workable.filter((task) => task.assignee === person.key);
      if (ownTasks.length === 0) continue;

      let minuteOfDay = 9 * 60 + Math.floor(rng() * 4) * 15;
      const blocks = 1 + Math.floor(rng() * 3);
      for (let block = 0; block < blocks; block++) {
        const duration = 30 + Math.floor(rng() * 7) * 15;
        if (minuteOfDay + duration > 18 * 60) break;
        const task = ownTasks[Math.floor(rng() * ownTasks.length)];
        const startTime = argentinaTime(day, 0, minuteOfDay);
        entries.push({
          userKey: person.key,
          taskTitle: task.title,
          startTime,
          endTime: new Date(startTime.getTime() + duration * 60 * 1000),
        });
        minuteOfDay += duration + 15 + Math.floor(rng() * 4) * 15;
      }
    }
  }
  return entries;
}

/** Crea la empresa demo, el usuario demo, los compañeros, proyectos, tareas e historial. Si ya existe no hace nada salvo con force. */
export async function seedDemoBase(
  prisma: PrismaClient,
  options: DemoSeedOptions,
): Promise<DemoSeedResult> {
  const email = options.email.trim().toLowerCase();
  const now = options.now ?? new Date();

  const existing = await prisma.organization.findFirst({
    where: { name: DEMO_ORGANIZATION_NAME },
    select: { id: true },
  });
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existingUser && !options.force) {
    return { created: false, organizationId: existing.id, userId: existingUser.id };
  }

  const [plan, userRole] = await Promise.all([
    prisma.plan.findUnique({ where: { name: DEMO_PLAN_NAME } }),
    prisma.role.findUnique({ where: { name: 'USER' } }),
  ]);
  if (!plan || !userRole) {
    throw new Error('Faltan planes o roles: corré antes prisma/seed.ts');
  }
  const passwordHash = await bcrypt.hash(options.password, 10);

  return prisma.$transaction(async (tx) => {
    await removeDemoData(tx, email);

    const foundedAt = new Date(now.getTime() - (DEMO_HISTORY_DAYS + 7) * DAY_MS);
    const organization = await tx.organization.create({
      data: { name: DEMO_ORGANIZATION_NAME, planId: plan.id, createdAt: foundedAt },
    });

    const owner = await tx.user.create({
      data: {
        id: randomUUID(),
        email,
        name: 'Visitante',
        lastname: 'Demo',
        password: passwordHash,
        roleId: userRole.id,
        isActive: true,
        isEmailVerified: true,
        organizationId: organization.id,
      },
    });
    await tx.organizationMembership.create({
      data: { organizationId: organization.id, userId: owner.id, role: 'ORG_OWNER' },
    });

    const userIds = new Map<string, string>();
    for (const person of DEMO_TEAMMATES) {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          email: `${person.key}@${DEMO_EMAIL_DOMAIN}`,
          name: person.name,
          lastname: person.lastname,
          roleId: userRole.id,
          isActive: true,
          isEmailVerified: true,
          organizationId: organization.id,
        },
      });
      await tx.organizationMembership.create({
        data: { organizationId: organization.id, userId: user.id, role: 'ORG_MEMBER' },
      });
      userIds.set(person.key, user.id);
    }

    const projectIds = new Map<string, string>();
    for (const project of DEMO_PROJECTS) {
      const created = await tx.project.create({
        data: { ...project, ownerId: owner.id, organizationId: organization.id, createdAt: foundedAt },
      });
      await tx.projectMember.createMany({
        data: [
          { projectId: created.id, userId: owner.id, role: 'OWNER' },
          ...[...userIds.values()].map((userId) => ({
            projectId: created.id,
            userId,
            role: 'MEMBER' as const,
          })),
        ],
      });
      projectIds.set(project.name, created.id);
    }

    const taskIds = new Map<string, { id: string; projectId: string }>();
    for (const [index, task] of DEMO_TASKS.entries()) {
      const projectId = projectIds.get(task.project)!;
      const created = await tx.task.create({
        data: {
          createdAt: new Date(foundedAt.getTime() + (index % 5) * DAY_MS),
          title: task.title,
          status: task.status,
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          dueDate: task.dueInDays === null ? null : new Date(now.getTime() + task.dueInDays * DAY_MS),
          projectId,
          organizationId: organization.id,
          assignedToId: task.assignee ? userIds.get(task.assignee) : null,
        },
      });
      taskIds.set(task.title, { id: created.id, projectId });
    }

    const history = buildDemoHistory(DEMO_TASKS, now);
    await tx.timeEntry.createMany({
      data: history.map((entry) => {
        const task = taskIds.get(entry.taskTitle)!;
        return {
          userId: userIds.get(entry.userKey)!,
          projectId: task.projectId,
          taskId: task.id,
          organizationId: organization.id,
          startTime: entry.startTime,
          endTime: entry.endTime,
          lastHeartbeat: entry.endTime,
          targetMinutes: Math.round((entry.endTime.getTime() - entry.startTime.getTime()) / 60000),
        };
      }),
    });

    return { created: true, organizationId: organization.id, userId: owner.id };
  });
}

/** Borra la empresa demo (en cascada: proyectos, tareas, horas) y sus usuarios. */
async function removeDemoData(tx: Prisma.TransactionClient, email: string): Promise<void> {
  await tx.organization.deleteMany({ where: { name: DEMO_ORGANIZATION_NAME } });
  await tx.user.deleteMany({
    where: { OR: [{ email }, { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } }] },
  });
}
