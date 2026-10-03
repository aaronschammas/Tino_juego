import { NotFoundException } from '@nestjs/common';
import { DEMO_SCENARIOS, scenarioProjectName } from './demo-scenarios';
import { computeWorkedSeconds, DemoService } from './demo.service';

const NOW = new Date('2026-10-02T15:00:00.000Z');
const at = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);
const USER = { id: 'demo-1', organizationId: 'org-1' };
const OFICINA = DEMO_SCENARIOS.find((scenario) => scenario.key === 'oficina')!;

describe('DEMO_SCENARIOS', () => {
  it('has three scenarios, each with its own actions and an urgent problem', () => {
    expect(DEMO_SCENARIOS.map((scenario) => scenario.key)).toEqual(['oficina', 'casa', 'jardin']);
    const allActions = DEMO_SCENARIOS.flatMap((scenario) => scenario.tasks.map((task) => task.action));
    expect(new Set(allActions).size).toBe(allActions.length);
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.tasks.some((task) => task.priority === 'CRITICAL')).toBe(true);
      const titles = scenario.tasks.map((task) => task.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

describe('computeWorkedSeconds', () => {
  it('adds closed and running entries per task', () => {
    const worked = computeWorkedSeconds(
      [
        { taskId: 't1', startTime: at(100), endTime: at(90), pausedAt: null, totalPausedMs: 0 },
        { taskId: 't1', startTime: at(20), endTime: null, pausedAt: null, totalPausedMs: 0 },
        { taskId: 't2', startTime: at(5), endTime: null, pausedAt: null, totalPausedMs: 0 },
      ],
      NOW,
    );
    expect(worked.get('t1')).toBe(30);
    expect(worked.get('t2')).toBe(5);
  });

  it('discounts finished and ongoing pauses', () => {
    const worked = computeWorkedSeconds(
      [
        { taskId: 't1', startTime: at(60), endTime: null, pausedAt: at(10), totalPausedMs: 20_000 },
        { taskId: null, startTime: at(60), endTime: null, pausedAt: null, totalPausedMs: 0 },
      ],
      NOW,
    );
    expect(worked.get('t1')).toBe(30);
    expect(worked.size).toBe(1);
  });
});

describe('DemoService', () => {
  function build() {
    const tx = {
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
      timeEntry: { deleteMany: jest.fn() },
      task: { deleteMany: jest.fn(), create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      project: { findFirst: jest.fn() },
      timeEntry: { findFirst: jest.fn(), findMany: jest.fn() },
      task: { findMany: jest.fn() },
    };
    return { prisma, tx, service: new DemoService(prisma as never) };
  }

  it('lists scenarios with their tasks', () => {
    const { service } = build();
    const [first] = service.listScenarios();
    expect(first).toMatchObject({ key: 'oficina', name: OFICINA.name });
    expect(first.tasks[0]).toEqual({ title: OFICINA.tasks[0].title, priority: 'CRITICAL', action: 'servidor' });
  });

  it('reset creates the scenario project and its tasks for the demo user', async () => {
    const { service, tx } = build();

    const result = await service.reset('oficina', USER);

    expect(result).toEqual({ scenario: 'oficina', projectId: 'project-1' });
    expect(tx.project.create.mock.calls[0][0].data).toMatchObject({
      name: scenarioProjectName(OFICINA),
      ownerId: 'demo-1',
      organizationId: 'org-1',
      members: { create: { userId: 'demo-1', role: 'OWNER' } },
    });
    expect(tx.timeEntry.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ projectId: 'project-1' }, { userId: 'demo-1', endTime: null }] },
    });
    expect(tx.task.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'project-1' } });
    expect(tx.task.create).toHaveBeenCalledTimes(OFICINA.tasks.length);
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({
      title: OFICINA.tasks[0].title,
      priority: 'CRITICAL',
      status: 'TODO',
      assignedToId: 'demo-1',
    });
  });

  it('reset reuses an existing scenario project', async () => {
    const { service, tx } = build();
    tx.project.findFirst.mockResolvedValue({ id: 'project-9' });

    const result = await service.reset('oficina', USER);

    expect(result.projectId).toBe('project-9');
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('rejects unknown scenarios and users without organization', async () => {
    const { service } = build();
    await expect(service.reset('marte', USER)).rejects.toThrow(NotFoundException);
    await expect(service.reset('oficina', { id: 'x', organizationId: null })).rejects.toThrow('organización');
  });

  it('state maps each task to its action, worked seconds and the active timer', async () => {
    const { service, prisma } = build();
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.timeEntry.findFirst.mockResolvedValue({ taskId: 'task-1', pausedAt: null, startTime: at(6) });
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-1', title: OFICINA.tasks[0].title, status: 'IN_PROGRESS', priority: 'CRITICAL' },
      { id: 'task-2', title: 'Una tarea agregada a mano', status: 'TODO', priority: 'LOW' },
    ]);
    prisma.timeEntry.findMany.mockResolvedValue([
      { taskId: 'task-1', startTime: at(6), endTime: null, pausedAt: null, totalPausedMs: 0 },
    ]);

    const state = await service.getState('oficina', USER, NOW);

    expect(state.projectId).toBe('project-1');
    expect(state.activeTimer).toEqual({ taskId: 'task-1', paused: false, startTime: at(6).toISOString() });
    expect(state.tasks[0]).toMatchObject({ action: 'servidor', workSeconds: 15, workedSeconds: 6 });
    expect(state.tasks[1]).toMatchObject({ action: null, workedSeconds: 0 });
  });

  it('state without a project yet returns no tasks', async () => {
    const { service, prisma } = build();
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    const state = await service.getState('casa', USER, NOW);

    expect(state).toMatchObject({ projectId: null, tasks: [], activeTimer: null });
    expect(state.scenario.key).toBe('casa');
  });
});
