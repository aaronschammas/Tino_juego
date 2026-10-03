import { NotFoundException } from '@nestjs/common';
import { DEMO_SCENARIOS, flattenScenario, scenarioProjectName } from './demo-scenarios';
import {
  buildState,
  computeDanger,
  computeWorkedSeconds,
  DemoService,
  overlapSeconds,
  type TaskRow,
  type TimeEntrySlice,
} from './demo.service';

const NOW = new Date('2026-10-02T15:00:00.000Z');
const at = (secondsAgo: number) => new Date(NOW.getTime() - secondsAgo * 1000);
const USER = { id: 'demo-1', organizationId: 'org-1' };
const OFICINA = DEMO_SCENARIOS.find((scenario) => scenario.key === 'oficina')!;

const entry = (taskId: string | null, startAgo: number, endAgo: number | null, extra: Partial<TimeEntrySlice> = {}) => ({
  taskId,
  startTime: at(startAgo),
  endTime: endAgo === null ? null : at(endAgo),
  pausedAt: null,
  totalPausedMs: 0,
  ...extra,
});

const row = (id: string, title: string, priority: string, extra: Partial<TaskRow> = {}): TaskRow => ({
  id,
  title,
  status: 'TODO',
  priority,
  parentTaskId: null,
  createdAt: at(100),
  ...extra,
});

/** Tareas iniciales de la oficina, como quedan después de un reset hace 100 s. */
function oficinaRows(): TaskRow[] {
  return [
    row('parent', 'Apagar el incendio', 'CRITICAL'),
    row('server', 'Fuego en el servidor', 'CRITICAL', { parentTaskId: 'parent' }),
    row('printer', 'Fuego en la impresora', 'HIGH', { parentTaskId: 'parent' }),
    row('phone', 'Atender al cliente furioso', 'HIGH'),
    row('plant', 'Regar la planta', 'LOW'),
  ];
}

describe('DEMO_SCENARIOS', () => {
  it('has three scenarios with subtasks, consequences and their own actions', () => {
    expect(DEMO_SCENARIOS.map((scenario) => scenario.key)).toEqual(['oficina', 'casa', 'jardin']);
    const allActions = DEMO_SCENARIOS.flatMap((scenario) =>
      flattenScenario(scenario).map((item) => item.def.action).filter(Boolean),
    );
    expect(new Set(allActions).size).toBe(allActions.length);

    for (const scenario of DEMO_SCENARIOS) {
      const entries = flattenScenario(scenario);
      const titles = entries.map((item) => item.def.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(scenario.tasks.some((task) => task.subtasks?.length)).toBe(true);
      expect(entries.some((item) => item.spawned)).toBe(true);
      expect(scenario.tasks.some((task) => task.priority === 'CRITICAL')).toBe(true);
      for (const item of entries) {
        if (item.parentTitle) expect(titles).toContain(item.parentTitle);
        if (!item.def.subtasks) expect(item.def.action).toBeTruthy();
      }
    }
  });
});

describe('time helpers', () => {
  it('adds closed and running entries per task, discounting pauses', () => {
    const worked = computeWorkedSeconds(
      [
        entry('t1', 100, 90),
        entry('t1', 20, null),
        entry('t2', 60, null, { pausedAt: at(10), totalPausedMs: 20_000 }),
        entry(null, 60, null),
      ],
      NOW,
    );
    expect(worked.get('t1')).toBe(30);
    expect(worked.get('t2')).toBe(30);
    expect(worked.size).toBe(2);
  });

  it('overlapSeconds clips an entry to an interval', () => {
    expect(overlapSeconds(entry('t', 50, 10), at(30), NOW)).toBe(20);
    expect(overlapSeconds(entry('t', 50, null), at(30), NOW)).toBe(30);
    expect(overlapSeconds(entry('t', 50, 40), at(30), NOW)).toBe(0);
  });

  it('danger grows with time, stops while the problem is worked and doubles with less urgent work', () => {
    const priorities = new Map([
      ['fire', 'CRITICAL'],
      ['plant', 'LOW'],
    ]);
    const fire = { id: 'fire', priority: 'CRITICAL' };

    expect(computeDanger(fire, at(40), NOW, [], priorities, new Map())).toBe(40);
    expect(computeDanger(fire, at(40), NOW, [], priorities, new Map([['fire', 15]]))).toBe(25);
    const onPlant = [entry('plant', 30, 10)];
    expect(computeDanger(fire, at(40), NOW, onPlant, priorities, new Map())).toBe(60);
  });
});

describe('buildState', () => {
  const loaded = (tasks: TaskRow[], entries: TimeEntrySlice[] = [], active: unknown = null) => ({
    projectId: 'project-1',
    tasks,
    entries,
    active: active as never,
  });

  it('maps tasks to actions and marks pending consequences of neglected problems', () => {
    const { state, pending } = buildState(OFICINA, loaded(oficinaRows()), NOW);

    const server = state.tasks.find((task) => task.id === 'server')!;
    expect(server).toMatchObject({ action: 'servidor', workSeconds: 12, solved: false, level: 0, danger: 100 });
    expect(pending.map((item) => item.stage.spawn.title)).toEqual([
      'Fuego en el archivo',
      'Limpiar los restos del servidor',
      'Limpiar el tóner',
      'Responder el reclamo formal',
    ]);
    expect(state.tasks.find((task) => task.id === 'plant')).toMatchObject({ danger: null, nextStage: null });
    expect(state.startedAt).toBe(at(100).toISOString());
  });

  it('shows the next stage and its countdown before it happens', () => {
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(10) }));
    const { state, pending } = buildState(OFICINA, loaded(rows), NOW);
    expect(pending).toEqual([]);
    expect(state.tasks.find((task) => task.id === 'server')).toMatchObject({
      danger: 10,
      nextStage: { at: 30, kind: 'spread' },
    });
  });

  it('counts applied stages and stops escalating solved problems', () => {
    const rows = [...oficinaRows(), row('archive', 'Fuego en el archivo', 'CRITICAL', { parentTaskId: 'parent', createdAt: at(50) })];
    rows[1] = { ...rows[1], status: 'DONE' };
    const { state, pending } = buildState(OFICINA, loaded(rows), NOW);

    expect(state.tasks.find((task) => task.id === 'server')).toMatchObject({ solved: true, level: 1, danger: null });
    expect(pending.some((item) => item.from === 'Fuego en el servidor')).toBe(false);
  });

  it('solves a parent when all its subtasks are solved', () => {
    const rows = oficinaRows().map((task) => (task.parentTaskId ? { ...task, status: 'DONE' } : task));
    const { state } = buildState(OFICINA, loaded(rows), NOW);
    expect(state.tasks.find((task) => task.id === 'parent')).toMatchObject({ action: null, solved: true });
  });

  it('without a project returns no tasks', () => {
    const { state, pending } = buildState(OFICINA, null, NOW);
    expect(state).toMatchObject({ projectId: null, tasks: [], activeTimer: null, events: [] });
    expect(pending).toEqual([]);
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
      task: {
        deleteMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `id-${data.title}` })),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      timeEntry: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const timeTracking = { stopTime: jest.fn().mockResolvedValue({}) };
    return { prisma, tx, timeTracking, service: new DemoService(prisma as never, timeTracking as never) };
  }

  it('lists scenarios with their initial tasks and subtasks', () => {
    const { service } = build();
    const [first] = service.listScenarios();
    expect(first).toMatchObject({ key: 'oficina', name: OFICINA.name });
    expect(first.tasks[0]).toEqual({
      title: 'Apagar el incendio',
      priority: 'CRITICAL',
      action: null,
      subtasks: ['Fuego en el servidor', 'Fuego en la impresora'],
    });
  });

  it('reset creates the scenario project, its tasks and subtasks for the demo user', async () => {
    const { service, tx, prisma } = build();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await service.reset('oficina', USER);

    expect(result).toEqual({ scenario: 'oficina', projectId: 'project-1' });
    expect(tx.project.create.mock.calls[0][0].data).toMatchObject({
      name: scenarioProjectName(OFICINA),
      members: { create: { userId: 'demo-1', role: 'OWNER' } },
    });
    expect(tx.timeEntry.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ projectId: 'project-1' }, { userId: 'demo-1', endTime: null }] },
    });
    const created = tx.task.create.mock.calls.map(([args]) => args.data);
    expect(created.map((task) => task.title)).toEqual([
      'Apagar el incendio',
      'Fuego en el servidor',
      'Fuego en la impresora',
      'Atender al cliente furioso',
      'Regar la planta',
    ]);
    expect(created[1]).toMatchObject({ parentTaskId: 'id-Apagar el incendio', assignedToId: 'demo-1', status: 'TODO' });
    expect(created[0].parentTaskId).toBeNull();
  });

  it('rejects unknown scenarios and users without organization', async () => {
    const { service } = build();
    await expect(service.reset('marte', USER)).rejects.toThrow(NotFoundException);
    await expect(service.tick('oficina', { id: 'x', organizationId: null })).rejects.toThrow('organización');
  });

  it('tick stops the timer when the character finished the task', async () => {
    const { service, prisma, timeTracking } = build();
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(15) }));
    prisma.task.findMany.mockResolvedValue(rows);
    prisma.timeEntry.findMany.mockResolvedValue([entry('server', 13, null)]);
    prisma.timeEntry.findFirst.mockResolvedValue({ taskId: 'server', pausedAt: null, startTime: at(13) });

    const state = await service.tick('oficina', USER, NOW);

    expect(timeTracking.stopTime).toHaveBeenCalledWith(USER);
    expect(state.events).toEqual([expect.objectContaining({ type: 'auto-stop', title: 'Fuego en el servidor' })]);
  });

  it('tick does not stop a timer that still has work left', async () => {
    const { service, prisma, timeTracking } = build();
    prisma.task.findMany.mockResolvedValue(oficinaRows().map((task) => ({ ...task, createdAt: at(15) })));
    prisma.timeEntry.findMany.mockResolvedValue([entry('server', 5, null)]);
    prisma.timeEntry.findFirst.mockResolvedValue({ taskId: 'server', pausedAt: null, startTime: at(5) });

    const state = await service.tick('oficina', USER, NOW);

    expect(timeTracking.stopTime).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });

  it('tick creates the consequence in Tino, as a subtask when it has a parent', async () => {
    const { service, prisma, tx } = build();
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(35) }));
    prisma.task.findMany.mockResolvedValue(rows);
    tx.task.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(where.title === 'Apagar el incendio' ? { id: 'parent' } : null),
    );

    const state = await service.tick('oficina', USER, NOW);

    expect(tx.task.create).toHaveBeenCalledTimes(1);
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({
      title: 'Fuego en el archivo',
      priority: 'CRITICAL',
      parentTaskId: 'parent',
    });
    expect(state.events).toEqual([
      expect.objectContaining({ type: 'spread', title: 'Fuego en el archivo', from: 'Fuego en el servidor' }),
    ]);
  });

  it('tick does not duplicate a consequence that already exists', async () => {
    const { service, prisma, tx } = build();
    prisma.task.findMany.mockResolvedValue(oficinaRows().map((task) => ({ ...task, createdAt: at(35) })));
    tx.task.findFirst.mockResolvedValue({ id: 'already' });

    const state = await service.tick('oficina', USER, NOW);

    expect(tx.task.create).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });
});
