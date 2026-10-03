import { decideBehavior, evaluateTasks, mostUrgent } from '../../public/juego/js/rules.js';
import { ACTIONS as ACTIONS_JS, SCENARIOS as SCENARIOS_JS, legendFor } from '../../public/juego/js/scenarios.js';
import { GameMap } from '../../public/juego/js/map.js';
import { facingFor } from '../../public/juego/js/player.js';
import { dangerLabel, panelRows, taskStatusLabel } from '../../public/juego/js/hud.js';

jest.mock('../../public/juego/js/sprites.js', () => ({
  getBlockSprites: () => [{}],
  PLAYER_SPRITES: {},
  PLAYER_ANCHOR: { x: 6, y: 17 },
  SHADOWS: [],
}));

const SCENARIOS = SCENARIOS_JS as Record<string, (typeof SCENARIOS_JS)['oficina']>;
const ACTIONS = ACTIONS_JS as Record<string, unknown>;

type Timer = { taskId: string | null; paused: boolean } | null;

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  action: string | null;
  workSeconds: number;
  workedSeconds: number;
  parentTaskId?: string | null;
  danger?: number | null;
  nextStage?: { at: number; kind: string; message: string } | null;
};

const task = (overrides: Partial<Task>): Task => ({
  id: 't1',
  title: 'Apagar el incendio del servidor',
  status: 'TODO',
  priority: 'CRITICAL',
  action: 'servidor',
  workSeconds: 10,
  workedSeconds: 0,
  ...overrides,
});

const say = (action: string) => `trabajando en ${action}`;

describe('evaluateTasks', () => {
  it('turns worked seconds into progress and extrapolates the running timer', () => {
    const state = {
      tasks: [task({ id: 'a', workedSeconds: 4 }), task({ id: 'b', workedSeconds: 4, action: 'telefono' })],
      activeTimer: { taskId: 'a', paused: false },
    };
    const [a, b] = evaluateTasks(state, 2);
    expect(a.progress).toBeCloseTo(0.6);
    expect(b.progress).toBeCloseTo(0.4);
  });

  it('marks a task solved when the work is complete or it is DONE in Tino', () => {
    const [byTime, byStatus, pending] = evaluateTasks(
      { tasks: [task({ workedSeconds: 12 }), task({ id: 'x', status: 'DONE' }), task({ id: 'y' })], activeTimer: null },
      0,
    );
    expect(byTime).toMatchObject({ progress: 1, solved: true });
    expect(byStatus.solved).toBe(true);
    expect(pending.solved).toBe(false);
  });

  it('does not extrapolate a paused timer', () => {
    const [a] = evaluateTasks({ tasks: [task({ workedSeconds: 3 })], activeTimer: { taskId: 't1', paused: true } }, 5);
    expect(a.progress).toBeCloseTo(0.3);
  });
});

describe('decideBehavior', () => {
  const evaluate = (tasks: Task[], activeTimer: Timer = null) => evaluateTasks({ tasks, activeTimer }, 0);

  it('works on the task whose timer is running and says the action line', () => {
    const tasks = evaluate([task({})], { taskId: 't1', paused: false });
    expect(decideBehavior(tasks, { taskId: 't1', paused: false }, say)).toEqual({
      mode: 'work',
      taskId: 't1',
      message: 'trabajando en servidor',
      warning: null,
    });
  });

  it('warns when a less urgent task is chosen first', () => {
    const tasks = evaluate([task({}), task({ id: 'low', title: 'Regar la planta', priority: 'LOW', action: 'planta' })]);
    const behavior = decideBehavior(tasks, { taskId: 'low', paused: false }, say);
    expect(behavior.mode).toBe('work');
    expect(behavior.warning).toContain('Apagar el incendio del servidor');
    expect(behavior.warning).toContain('el doble');
  });

  it('waits next to the object while the timer is paused', () => {
    const tasks = evaluate([task({})]);
    expect(decideBehavior(tasks, { taskId: 't1', paused: true }, say)).toMatchObject({ mode: 'paused', taskId: 't1' });
  });

  it('asks to stop the timer and mark it done once the problem is solved', () => {
    const tasks = evaluate([task({ workedSeconds: 10 })]);
    expect(decideBehavior(tasks, { taskId: 't1', paused: false }, say)).toMatchObject({
      mode: 'finished',
      message: expect.stringContaining('marcala como Hecha'),
    });
  });

  it('suggests the most urgent task when no timer is running', () => {
    const tasks = evaluate([task({ id: 'low', title: 'Regar la planta', priority: 'LOW', action: 'planta' }), task({})]);
    expect(decideBehavior(tasks, null, say)).toEqual({
      mode: 'idle',
      taskId: null,
      message: 'Iniciá el timer de "Apagar el incendio del servidor" en Tino.',
    });
  });

  it('reminds to mark solved tasks as done', () => {
    const tasks = evaluate([task({ workedSeconds: 10 }), task({ id: 'b', action: 'telefono' })]);
    expect(decideBehavior(tasks, null, say).message).toBe('Marcá como Hecha "Apagar el incendio del servidor" en Tino.');
  });

  it('celebrates when every problem is solved and done', () => {
    const tasks = evaluate([task({ status: 'DONE' }), task({ id: 'b', status: 'DONE', action: 'telefono' })]);
    expect(decideBehavior(tasks, null, say)).toMatchObject({ mode: 'celebrate', message: expect.stringContaining('Dashboard') });
  });

  it('ignores timers of tasks outside the scenario', () => {
    const tasks = evaluate([task({})]);
    expect(decideBehavior(tasks, { taskId: 'otra', paused: false }, say)).toMatchObject({ mode: 'idle' });
  });

  it('mostUrgent skips solved tasks', () => {
    const tasks = evaluate([task({ status: 'DONE' }), task({ id: 'b', priority: 'MEDIUM', action: 'telefono' })]);
    expect(mostUrgent(tasks)?.id).toBe('b');
  });
});

describe('scenarios', () => {
  const BACKEND_ACTIONS: Record<string, string[]> = {
    oficina: ['servidor', 'impresora', 'archivo', 'escombros', 'toner', 'telefono', 'mail', 'planta'],
    casa: ['sarten', 'cortinas', 'hollin', 'basura', 'cucarachas', 'platos', 'polvo', 'cama'],
    jardin: ['canilla', 'inundacion', 'cano', 'parrilla', 'pastizal', 'huerta', 'semillas', 'pasto', 'cerca'],
  };

  it('matches the scenarios and actions of the backend demo module', () => {
    expect(Object.keys(SCENARIOS)).toEqual(Object.keys(BACKEND_ACTIONS));
    for (const [key, actions] of Object.entries(BACKEND_ACTIONS)) {
      expect([...SCENARIOS[key].slots].sort()).toEqual([...actions].sort());
      for (const action of actions) expect(ACTIONS[action]).toBeDefined();
    }
  });

  it.each(Object.keys(SCENARIOS))('%s: every object has a reachable work spot', (key) => {
    const scenario = SCENARIOS[key];
    const map = new GameMap(scenario.rows, legendFor(scenario));
    const slots = map.markers.filter((m: { marker: string }) => m.marker === 'slot');
    expect(slots).toHaveLength(scenario.slots.length);
    for (const m of map.markers) if (m.marker !== 'spawn') map.block(m.tx, m.ty);

    const spawn = map.marker('spawn');
    for (const slot of slots) {
      const spot = map.workSpot(slot.tx, slot.ty);
      expect(spot).not.toBeNull();
      expect(map.findPath(spawn, spot)).not.toBeNull();
    }
  });
});

describe('consequences', () => {
  const fire = (overrides: Partial<Task> = {}) =>
    task({ danger: 20, nextStage: { at: 30, kind: 'spread', message: 'se extiende' }, ...overrides });

  it('extrapolates danger and the countdown to the next stage', () => {
    const [server] = evaluateTasks({ tasks: [fire()], activeTimer: null }, 4);
    expect(server.danger).toBe(24);
    expect(server.remaining).toBeCloseTo(6);
    expect(server.stageRatio).toBeCloseTo(0.8);
  });

  it('danger grows twice as fast while working on something less urgent', () => {
    const plant = task({ id: 'plant', title: 'Regar la planta', priority: 'LOW', action: 'planta' });
    const [server] = evaluateTasks({ tasks: [fire(), plant], activeTimer: { taskId: 'plant', paused: false } }, 2);
    expect(server.danger).toBe(24);
    expect(server.remaining).toBeCloseTo(3);
  });

  it('danger stops while the problem itself is being worked', () => {
    const [server] = evaluateTasks({ tasks: [fire()], activeTimer: { taskId: 't1', paused: false } }, 3);
    expect(server.danger).toBe(20);
    expect(server.remaining).toBeNull();
  });

  it('warns to hurry when a consequence is close', () => {
    const tasks = evaluateTasks({ tasks: [fire({ danger: 25 })], activeTimer: null }, 0);
    expect(decideBehavior(tasks, null).message).toBe('¡Rápido! "Apagar el incendio del servidor" se extiende en 5 s.');
  });

  it('a solved parent needs all its subtasks solved', () => {
    const tasks = evaluateTasks(
      {
        tasks: [
          task({ id: 'p', title: 'Apagar el incendio', action: null }),
          task({ id: 'a', parentTaskId: 'p', status: 'DONE' }),
          task({ id: 'b', parentTaskId: 'p', action: 'impresora', workedSeconds: 5 }),
        ],
        activeTimer: null,
      },
      0,
    );
    expect(tasks[0]).toMatchObject({ solved: false, progress: 0.75 });
  });

  it('tells to use subtasks when the timer is on the parent', () => {
    const tasks = evaluateTasks({ tasks: [task({ id: 'p', action: null }), task({ id: 'a', parentTaskId: 'p' })], activeTimer: null }, 0);
    expect(decideBehavior(tasks, { taskId: 'p', paused: false }).message).toContain('subtareas');
  });

  it('groups subtasks under their parent in the panel and labels the countdown', () => {
    const tasks = evaluateTasks(
      {
        tasks: [
          task({ id: 'p', title: 'Apagar el incendio', action: null }),
          fire({ id: 'a', parentTaskId: 'p' }),
          task({ id: 'phone', title: 'Atender al cliente', action: 'telefono' }),
          task({ id: 'own', title: 'Tarea creada a mano', action: null }),
        ],
        activeTimer: null,
      },
      0,
    );
    expect(panelRows(tasks).map((row: { kind: string; task: { id: string } }) => `${row.kind}:${row.task.id}`)).toEqual([
      'group:p',
      'sub:a',
      'task:phone',
    ]);
    expect(dangerLabel(tasks[1])).toBe('Se extiende en 10 s');
    expect(dangerLabel(tasks[2])).toBeNull();
  });
});

describe('player and hud helpers', () => {
  it('faces where the movement goes on screen', () => {
    expect(facingFor(1, 0)).toBe('right');
    expect(facingFor(-1, 0)).toBe('left');
    expect(facingFor(1, 1)).toBe('down');
    expect(facingFor(-1, -1)).toBe('up');
  });

  it('labels each task state for the panel', () => {
    const [running, solved, done] = evaluateTasks(
      {
        tasks: [task({}), task({ id: 'b', workedSeconds: 10 }), task({ id: 'c', status: 'DONE' })],
        activeTimer: { taskId: 't1', paused: false },
      },
      0,
    );
    const timer = { taskId: 't1', paused: false };
    expect(taskStatusLabel(running, timer)).toBe('Trabajando...');
    expect(taskStatusLabel(solved, timer)).toBe('¡Resuelta! Marcala como Hecha');
    expect(taskStatusLabel(done, timer)).toBe('Hecha ✓');
  });
});
