import { NotFoundException } from '@nestjs/common';
import { DEMO_SCENARIOS, flattenScenario, scenarioProjectName } from './demo-scenarios';
import {
  buildState,
  computeDanger,
  computeRound,
  computeScore,
  computeWorkedSeconds,
  dangerRate,
  DemoService,
  overlapSeconds,
  ROUND_SECONDS,
  timerToStop,
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
  updatedAt: extra.createdAt ?? at(100),
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

/** Timer corto en la tarea padre (no es un problema): arranca la partida sin trabajar en ningún fuego. */
const kickoff = (ago: number) => entry('parent', ago, ago - 0.5);

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

  it('overlapSeconds leaves out the open pause and discounts closed pauses', () => {
    expect(overlapSeconds(entry('t', 50, null, { pausedAt: at(20) }), at(30), NOW)).toBe(10);
    expect(overlapSeconds(entry('t', 40, 0, { totalPausedMs: 20_000 }), at(20), NOW)).toBe(10);
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

  it('a paused timer on something less urgent does not double the danger', () => {
    const priorities = new Map([
      ['fire', 'CRITICAL'],
      ['plant', 'LOW'],
    ]);
    const paused = [entry('plant', 30, null, { pausedAt: at(25) })];
    expect(computeDanger({ id: 'fire', priority: 'CRITICAL' }, at(40), NOW, paused, priorities, new Map())).toBe(45);
  });

  it('a consequence counts its danger from when it appeared', () => {
    const fire = { id: 'archive', priority: 'CRITICAL', createdAt: at(10) };
    expect(computeDanger(fire, at(90), NOW, [], new Map(), new Map())).toBe(10);
  });

  it('dangerRate matches what the game should extrapolate', () => {
    const priorities = new Map([
      ['fire', 'CRITICAL'],
      ['plant', 'LOW'],
    ]);
    const fire = { id: 'fire', priority: 'CRITICAL' };
    const timer = (taskId: string | null, paused = false) => ({ taskId, pausedAt: paused ? at(1) : null, startTime: at(5) });

    expect(dangerRate(fire, null, priorities)).toBe(1);
    expect(dangerRate(fire, timer('fire'), priorities)).toBe(0);
    expect(dangerRate(fire, timer('plant'), priorities)).toBe(2);
    expect(dangerRate(fire, timer('plant', true), priorities)).toBe(1);
    expect(dangerRate(fire, timer('other-project'), priorities)).toBe(1);
  });
});

describe('round and score', () => {
  const problems = () => oficinaRows().filter((task) => task.id !== 'parent');

  it('waits for the first timer before the clock starts', () => {
    const { round, at: evaluatedAt } = computeRound(problems(), [], NOW);
    expect(round).toMatchObject({ status: 'waiting', startedAt: null, limitSeconds: ROUND_SECONDS, elapsedSeconds: 0 });
    expect(evaluatedAt).toEqual(NOW);
  });

  it('plays from the first timer and ends by timeout after the limit', () => {
    expect(computeRound(problems(), [kickoff(30)], NOW).round).toMatchObject({
      status: 'playing',
      startedAt: at(30).toISOString(),
      elapsedSeconds: 30,
    });
    const { round, at: evaluatedAt } = computeRound(problems(), [kickoff(200)], NOW);
    expect(round).toMatchObject({ status: 'finished', reason: 'timeout', elapsedSeconds: ROUND_SECONDS });
    expect(evaluatedAt).toEqual(at(50));
  });

  it('ends early when every problem is Hecha', () => {
    const done = problems().map((task) => ({ ...task, status: 'DONE', updatedAt: at(40) }));
    expect(computeRound(done, [kickoff(100)], NOW).round).toMatchObject({
      status: 'finished',
      reason: 'cleared',
      endedAt: at(40).toISOString(),
      elapsedSeconds: 60,
    });
  });

  it('ends when the visitor finishes it, even before the first timer', () => {
    expect(computeRound(problems(), [kickoff(30)], NOW, at(10)).round).toMatchObject({
      status: 'finished',
      reason: 'ended',
      endedAt: at(10).toISOString(),
      elapsedSeconds: 20,
    });
    expect(computeRound(problems(), [], NOW, at(5)).round).toMatchObject({ status: 'finished', reason: 'ended', elapsedSeconds: 0 });
    const done = problems().map((task) => ({ ...task, status: 'DONE', updatedAt: at(40) }));
    expect(computeRound(done, [kickoff(100)], NOW, at(10)).round.reason).toBe('cleared');
  });

  it('scores fires out, priority efficiency and the seconds left', () => {
    const done = problems().map((task) => ({ ...task, status: 'DONE', updatedAt: at(40) }));
    const work = new Map([
      ['server', 12],
      ['printer', 10],
      ['phone', 10],
      ['plant', 8],
    ]);
    const entries = [entry('server', 100, 88), entry('printer', 88, 78), entry('phone', 78, 68), entry('plant', 68, 60)];
    const { round } = computeRound(done, entries, NOW);

    expect(computeScore(done, work, entries, round)).toEqual({
      fires: 4,
      firesOut: 4,
      choices: 4,
      goodChoices: 4,
      efficiency: 100,
      seconds: 60,
      points: 4 * 100 + 90,
    });
  });

  it('counts a priority mistake when a less urgent problem is chosen first', () => {
    const work = new Map([
      ['server', 12],
      ['plant', 8],
    ]);
    const rows = problems().filter((task) => work.has(task.id));
    const entries = [entry('plant', 100, 90), entry('server', 90, 78)];
    const { round } = computeRound(rows, entries, NOW);

    expect(computeScore(rows, work, entries, round)).toMatchObject({ choices: 2, goodChoices: 1, efficiency: 50, points: 0 });
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
    const { state, pending } = buildState(OFICINA, loaded(oficinaRows(), [kickoff(100)]), NOW);

    const server = state.tasks.find((task) => task.id === 'server')!;
    expect(server).toMatchObject({ action: 'servidor', workSeconds: 12, solved: false, level: 0, danger: 100, dangerRate: 1 });
    expect(pending.map((item) => item.stage.spawn.title)).toEqual([
      'Fuego en el archivo',
      'Limpiar los restos del servidor',
      'Limpiar el tóner',
      'Responder el reclamo formal',
    ]);
    expect(state.tasks.find((task) => task.id === 'plant')).toMatchObject({ danger: null, dangerRate: 0, nextStage: null });
    expect(state.round).toMatchObject({ status: 'playing', startedAt: at(100).toISOString() });
    expect(state.score).toMatchObject({ fires: 4, firesOut: 0 });
  });

  it('does not grow danger nor apply consequences before the first timer', () => {
    const { state, pending } = buildState(OFICINA, loaded(oficinaRows()), NOW);
    expect(pending).toEqual([]);
    expect(state.round.status).toBe('waiting');
    expect(state.tasks.find((task) => task.id === 'server')).toMatchObject({
      danger: 0,
      dangerRate: 0,
      nextStage: { at: 30, kind: 'spread' },
    });
  });

  it('shows the next stage and its countdown before it happens', () => {
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(10) }));
    const { state, pending } = buildState(OFICINA, loaded(rows, [kickoff(10)]), NOW);
    expect(pending).toEqual([]);
    expect(state.tasks.find((task) => task.id === 'server')).toMatchObject({
      danger: 10,
      nextStage: { at: 30, kind: 'spread' },
    });
  });

  it('sends the danger rate of each problem for the running timer', () => {
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(20) }));
    const running = { taskId: 'plant', pausedAt: null, startTime: at(5) };
    const { state } = buildState(OFICINA, loaded(rows, [entry('plant', 5, null)], running), NOW);
    const rate = (id: string) => state.tasks.find((task) => task.id === id)!.dangerRate;

    expect(rate('server')).toBe(2);
    expect(rate('phone')).toBe(2);
    expect(rate('plant')).toBe(0);
  });

  it('freezes danger and consequences when time is up', () => {
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(300) }));
    const { state, pending } = buildState(OFICINA, loaded(rows, [kickoff(200)]), NOW);
    expect(state.round).toMatchObject({ status: 'finished', reason: 'timeout' });
    expect(pending).toEqual([]);
    expect(state.tasks.find((task) => task.id === 'server')).toMatchObject({ danger: ROUND_SECONDS, dangerRate: 0 });
  });

  it('counts applied stages and stops escalating solved problems', () => {
    const rows = [...oficinaRows(), row('archive', 'Fuego en el archivo', 'CRITICAL', { parentTaskId: 'parent', createdAt: at(50) })];
    rows[1] = { ...rows[1], status: 'DONE' };
    const { state, pending } = buildState(OFICINA, loaded(rows, [kickoff(100)]), NOW);

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
    expect(state.round.status).toBe('waiting');
    expect(pending).toEqual([]);
  });
});

describe('timerToStop', () => {
  const state = (round: 'playing' | 'finished', worked: number, paused = false) =>
    buildState(
      OFICINA,
      {
        projectId: 'project-1',
        tasks: oficinaRows().map((task) => ({ ...task, createdAt: at(400) })),
        entries: [entry('phone', round === 'finished' ? 200 : worked, null, paused ? { pausedAt: NOW } : {})],
        active: { taskId: 'phone', pausedAt: paused ? NOW : null, startTime: at(worked) },
      },
      NOW,
    ).state;

  it('stops a finished problem, but not one with work left or paused', () => {
    expect(timerToStop(state('playing', 11))?.message).toContain('Marcala como Hecha');
    expect(timerToStop(state('playing', 5))).toBeNull();
    expect(timerToStop(state('playing', 11, true))).toBeNull();
  });

  it('stops any timer of the scenario when the round is over', () => {
    expect(timerToStop(state('finished', 0))?.message).toContain('Se terminó la partida');
  });
});

describe('DemoService', () => {
  function build() {
    const created = new Set<string>();
    const tx = {
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
      timeEntry: { deleteMany: jest.fn() },
      task: {
        deleteMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          created.add(data.title);
          return Promise.resolve({ id: `id-${data.title}` });
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      timeEntry: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const timeTracking = { stopTime: jest.fn().mockResolvedValue({}) };
    return { prisma, tx, created, timeTracking, service: new DemoService(prisma as never, timeTracking as never) };
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
    expect(created[1]).toMatchObject({
      parentTaskId: 'id-Apagar el incendio',
      assignedToId: 'demo-1',
      status: 'TODO',
      estimatedHours: 12 / 3600,
    });
    expect(created[0]).toMatchObject({ parentTaskId: null, estimatedHours: null });
  });

  it('resetAll removes every fair project with its tasks, hours and the open timer', async () => {
    const { service, tx } = build();
    const project = Object.assign(tx.project, {
      findMany: jest.fn().mockResolvedValue([{ id: 'p-oficina' }, { id: 'p-casa' }]),
      deleteMany: jest.fn(),
    });

    await expect(service.resetAll(USER)).resolves.toEqual({ removed: 2 });

    expect(project.findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      name: { in: DEMO_SCENARIOS.map(scenarioProjectName) },
    });
    expect(tx.timeEntry.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ projectId: { in: ['p-oficina', 'p-casa'] } }, { userId: 'demo-1', endTime: null }] },
    });
    expect(tx.task.deleteMany).toHaveBeenCalledTimes(2);
    expect(project.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['p-oficina', 'p-casa'] } } });
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

  it('tick stops the scenario timer when time is up', async () => {
    const { service, prisma, timeTracking } = build();
    prisma.task.findMany.mockResolvedValue(oficinaRows().map((task) => ({ ...task, createdAt: at(300) })));
    prisma.timeEntry.findMany.mockResolvedValue([entry('plant', 200, null)]);
    prisma.timeEntry.findFirst.mockResolvedValue({ taskId: 'plant', pausedAt: null, startTime: at(200) });

    const state = await service.tick('oficina', USER, NOW);

    expect(timeTracking.stopTime).toHaveBeenCalledWith(USER);
    expect(state.events).toEqual([expect.objectContaining({ type: 'auto-stop', message: expect.stringContaining('partida') })]);
  });

  it('tick creates the consequence in Tino, as a subtask when it has a parent', async () => {
    const { service, prisma, tx } = build();
    const rows = oficinaRows().map((task) => ({ ...task, createdAt: at(35) }));
    prisma.task.findMany.mockResolvedValue(rows);
    prisma.timeEntry.findMany.mockResolvedValue([kickoff(35)]);
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
    prisma.timeEntry.findMany.mockResolvedValue([kickoff(35)]);
    tx.task.findFirst.mockResolvedValue({ id: 'already' });

    const state = await service.tick('oficina', USER, NOW);

    expect(tx.task.create).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });

  it('finish ends the round now, stops the scenario timer and keeps it ended until a reset', async () => {
    const { service, prisma, timeTracking } = build();
    prisma.task.findMany.mockResolvedValue(oficinaRows().map((task) => ({ ...task, createdAt: at(60) })));
    prisma.timeEntry.findMany.mockResolvedValue([entry('phone', 20, null)]);
    prisma.timeEntry.findFirst.mockResolvedValue({ taskId: 'phone', pausedAt: null, startTime: at(20) });

    const state = await service.finish('oficina', USER, NOW);

    expect(state.round).toMatchObject({ status: 'finished', reason: 'ended', elapsedSeconds: 20 });
    expect(timeTracking.stopTime).toHaveBeenCalledWith(USER);
    expect((await service.getState('oficina', USER, new Date(NOW.getTime() + 30_000))).round.reason).toBe('ended');

    await service.reset('oficina', USER);
    expect((await service.getState('oficina', USER, NOW)).round.reason).toBeNull();
  });

  it('two ticks at the same time (two tabs) create each consequence once', async () => {
    const { service, prisma, tx, created } = build();
    prisma.task.findMany.mockResolvedValue(oficinaRows().map((task) => ({ ...task, createdAt: at(35) })));
    prisma.timeEntry.findMany.mockResolvedValue([kickoff(35)]);
    tx.task.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(created.has(where.title) || where.title === 'Apagar el incendio' ? { id: 'x' } : null),
    );

    await Promise.all([service.tick('oficina', USER, NOW), service.tick('oficina', USER, NOW)]);

    expect(tx.task.create).toHaveBeenCalledTimes(1);
  });
});
