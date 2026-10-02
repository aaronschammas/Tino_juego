/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { TaskStatus } from '@prisma/client';
import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  let prisma: any;
  let service: AssistantService;
  const user = { id: 'u1', organizationId: 'org-1', role: 'USER' };

  beforeEach(() => {
    prisma = {
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_MEMBER' }),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', name: 'Proyecto' }]),
      },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'u1', name: 'Ana', lastname: 'Pérez' }]),
      },
    };
    service = new AssistantService(prisma as never);
  });

  it('answers without data instead of inventing values', async () => {
    const result = await service.query(user, {
      query: 'Qué tareas están atrasadas',
    });
    expect(result.summary).toBe('No encontré tareas atrasadas en tu alcance.');
    expect(result.data).toEqual([]);
  });

  it('returns real bounded task data', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Corregir login',
        projectId: 'p1',
        status: TaskStatus.TODO,
        dueDate: new Date('2020-01-01'),
        assignedToId: 'u1',
        subTasks: [],
      },
    ]);
    const result = await service.query(user, { query: 'Tareas vencidas' });
    expect(result.summary).toContain('1 tareas vencidas');
    expect(result.details[0]).toContain('Corregir login');
  });

  it('always scopes member queries to the authenticated organization and user', async () => {
    await service.query(user, { query: 'Resumen semanal' });
    expect(prisma.project.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        members: { some: { userId: 'u1' } },
      }),
    );
    expect(prisma.task.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        OR: [
          { assignedToId: 'u1' },
          { subTasks: { some: { assignedToId: 'u1' } } },
        ],
      }),
    );
  });

  it('uses organization aggregates only for an owner and tolerates missing task names on timers', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: 'ORG_OWNER',
    });
    prisma.timeEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'e1', userId: 'u1', projectId: 'p1', task: null },
      ]);
    const result = await service.query(user, { query: 'Timers activos' });
    expect(result.summary).toContain('1 timers activos');
    expect(prisma.project.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'members',
    );
  });

  it('answers a known intent without going through the text rules', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Corregir login',
        projectId: 'p1',
        status: TaskStatus.TODO,
        dueDate: new Date('2020-01-01'),
        assignedToId: 'u1',
        subTasks: [],
      },
    ]);

    const byIntent = await service.answerIntent(user, 'overdue_tasks');
    const byText = await service.query(user, { query: 'Tareas vencidas' });

    expect(byIntent.intent).toBe('overdue_tasks');
    expect(byIntent.summary).toBe(byText.summary);
    expect(byIntent.details).toEqual(byText.details);
  });

  it('does not leak the normalized query when it cannot answer', async () => {
    const result = await service.query(user, { query: 'Contame un chiste' });

    expect(result.intent).toBe('unknown');
    expect(result).not.toHaveProperty('normalized');
  });
});
