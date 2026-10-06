import { computeStress, decideBehavior, evaluateRound, evaluateTasks, mostUrgent } from '../../public/juego/js/rules.js';
import { ACTIONS as ACTIONS_JS, SCENARIOS as SCENARIOS_JS, legendFor } from '../../public/juego/js/scenarios.js';
import { GameMap } from '../../public/juego/js/map.js';
import { facingFor, Worker } from '../../public/juego/js/player.js';
import {
  coachStepLabel,
  dangerLabel,
  finalLines,
  formatClock,
  Hud,
  panelRows,
  placeBubble,
  taskStatusLabel,
} from '../../public/juego/js/hud.js';
import { Effects, MAX_PARTICLES } from '../../public/juego/js/effects.js';
import { CoachFlow, coachStep, INTRO, INTRO_SECONDS, REPOP_SECONDS } from '../../public/juego/js/coach.js';
import { pickScale } from '../../public/juego/js/renderer.js';

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
  dangerRate?: number;
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
    expect(behavior.warning).toContain('más urgente');
  });

  it('waits next to the object while the timer is paused', () => {
    const tasks = evaluate([task({})]);
    expect(decideBehavior(tasks, { taskId: 't1', paused: true }, say)).toMatchObject({ mode: 'paused', taskId: 't1' });
  });

  it('asks to stop the timer and mark it done once the problem is solved', () => {
    const tasks = evaluate([task({ workedSeconds: 10 })]);
    expect(decideBehavior(tasks, { taskId: 't1', paused: false }, say)).toMatchObject({
      mode: 'finished',
      message: expect.stringContaining('Marcala como Hecha'),
    });
  });

  it('asks for help with a short line when no timer is running (the coach names the task)', () => {
    const tasks = evaluate([task({ id: 'low', title: 'Regar la planta', priority: 'LOW', action: 'planta' }), task({})]);
    expect(decideBehavior(tasks, null, say)).toEqual({ mode: 'idle', taskId: null, message: '¡Ayuda! Iniciá un timer en Tino.' });
  });

  it('reminds to mark solved tasks as done', () => {
    const tasks = evaluate([task({ workedSeconds: 10 }), task({ id: 'b', action: 'telefono' })]);
    expect(decideBehavior(tasks, null, say).message).toBe('¡Marcala como Hecha!');
  });

  it('celebrates when every problem is solved and done', () => {
    const tasks = evaluate([task({ status: 'DONE' }), task({ id: 'b', status: 'DONE', action: 'telefono' })]);
    expect(decideBehavior(tasks, null, say)).toMatchObject({ mode: 'celebrate', message: '¡Lo logramos!' });
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
    task({ danger: 20, dangerRate: 1, nextStage: { at: 30, kind: 'spread', message: 'se extiende' }, ...overrides });

  it('extrapolates danger and the countdown to the next stage', () => {
    const [server] = evaluateTasks({ tasks: [fire()], activeTimer: null }, 4);
    expect(server.danger).toBe(24);
    expect(server.remaining).toBeCloseTo(6);
    expect(server.stageRatio).toBeCloseTo(0.8);
  });

  it('extrapolates at the danger rate sent by the backend (double for a less urgent timer)', () => {
    const plant = task({ id: 'plant', title: 'Regar la planta', priority: 'LOW', action: 'planta' });
    const [server] = evaluateTasks({ tasks: [fire({ dangerRate: 2 }), plant], activeTimer: { taskId: 'plant', paused: false } }, 2);
    expect(server.danger).toBe(24);
    expect(server.remaining).toBeCloseTo(3);
  });

  it('does not extrapolate before the first timer nor after the round ends', () => {
    const waiting = { status: 'waiting', reason: null, limitSeconds: 150, elapsedSeconds: 0 };
    const [server] = evaluateTasks({ tasks: [fire({ dangerRate: 0 })], activeTimer: null, round: waiting }, 5);
    expect(server.danger).toBe(20);
    const finished = { ...waiting, status: 'finished', reason: 'timeout', elapsedSeconds: 150 };
    const [frozen] = evaluateTasks({ tasks: [fire()], activeTimer: { taskId: 't1', paused: false }, round: finished }, 5);
    expect(frozen.danger).toBe(20);
    expect(frozen.progress).toBe(0);
  });

  it('danger stops while the problem itself is being worked', () => {
    const [server] = evaluateTasks({ tasks: [fire()], activeTimer: { taskId: 't1', paused: false } }, 3);
    expect(server.danger).toBe(20);
    expect(server.remaining).toBeNull();
  });

  it('warns to hurry when a consequence is close', () => {
    const tasks = evaluateTasks({ tasks: [fire({ danger: 25 })], activeTimer: null }, 0);
    expect(decideBehavior(tasks, null).message).toBe('¡Rápido, que se extiende!');
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
    expect(decideBehavior(tasks, { taskId: 'p', paused: false }).message).toContain('subtarea');
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

describe('round, stress and end of the game', () => {
  const round = (status: string, elapsedSeconds: number, reason: string | null = null) => ({
    status,
    reason,
    limitSeconds: 150,
    elapsedSeconds,
  });

  it('counts down only while playing', () => {
    expect(evaluateRound(null, 3)).toMatchObject({ status: 'waiting', remaining: 150 });
    expect(evaluateRound({ round: round('waiting', 0) }, 3)).toMatchObject({ remaining: 150 });
    expect(evaluateRound({ round: round('playing', 100) }, 2)).toMatchObject({ elapsed: 102, remaining: 48 });
    expect(evaluateRound({ round: round('playing', 149) }, 5)).toMatchObject({ remaining: 0 });
    expect(evaluateRound({ round: round('finished', 60, 'cleared') }, 5)).toMatchObject({ remaining: 90, reason: 'cleared' });
  });

  it('stress adds the active fires and drops when one is solved', () => {
    const fires = evaluateTasks({ tasks: [task({}), task({ id: 'b', priority: 'HIGH', action: 'impresora' })], activeTimer: null }, 0);
    const high = computeStress(fires);
    expect(high).toBeGreaterThan(0);
    const oneOut = evaluateTasks({ tasks: [task({ status: 'DONE' }), task({ id: 'b', priority: 'HIGH', action: 'impresora' })], activeTimer: null }, 0);
    expect(computeStress(oneOut)).toBeLessThan(high);
    expect(computeStress([])).toBe(0);
  });

  it('announces the end of the round in the bubble', () => {
    const tasks = evaluateTasks({ tasks: [task({})], activeTimer: null }, 0);
    expect(decideBehavior(tasks, null, say, { status: 'finished', reason: 'timeout' }).message).toContain('Se acabó el tiempo');
    expect(decideBehavior(tasks, null, say, { status: 'finished', reason: 'cleared' }).mode).toBe('celebrate');
  });

  it('formats the clock and the final screen', () => {
    expect(formatClock(150)).toBe('2:30');
    expect(formatClock(4.2)).toBe('0:05');
    expect(formatClock(-1)).toBe('0:00');
    expect(finalLines({ fires: 5, firesOut: 4, efficiency: 75, seconds: 95, points: 425 })).toEqual([
      ['Fuegos apagados', '4 de 5'],
      ['Eficiencia de priorización', '75%'],
      ['Tiempo', '1:35'],
      ['Puntos', '425'],
    ]);
  });
});

describe('engine details', () => {
  it('the hud updates task rows in place instead of rebuilding them', () => {
    document.body.innerHTML = '<ul id="tasks"></ul>';
    const hud = new Hud(document);
    const timer = { taskId: 't1', paused: false };
    hud.renderTasks(evaluateTasks({ tasks: [task({ workedSeconds: 2 })], activeTimer: timer }, 0), timer);
    const row = document.querySelector('#tasks li');
    hud.renderTasks(evaluateTasks({ tasks: [task({ workedSeconds: 6 })], activeTimer: timer }, 0), timer);

    expect(document.querySelector('#tasks li')).toBe(row);
    expect((row!.querySelector('.fill') as HTMLElement).style.width).toBe('60%');
    hud.renderTasks(evaluateTasks({ tasks: [task({}), task({ id: 'b', action: 'impresora' })], activeTimer: null }, 0), null);
    expect(document.querySelectorAll('#tasks li')).toHaveLength(2);
  });

  it('particles keep the newest when full, are removed without new arrays and grouped by cell', () => {
    const effects = new Effects(() => 0.5);
    for (let i = 0; i < MAX_PARTICLES + 10; i++) effects.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1, palette: ['#fff'] }, i % 2);
    expect(effects.particles).toHaveLength(MAX_PARTICLES);

    const list = effects.particles;
    effects.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 0.01, palette: ['#fff'] });
    effects.particles[0].life = 0.01;
    effects.update(0.1);
    expect(effects.particles).toBe(list);
    expect(effects.particles).toHaveLength(MAX_PARTICLES - 2);

    const cells = effects.byCell();
    expect((cells.get(0)?.length ?? 0) + (cells.get(1)?.length ?? 0) + (cells.get(-1)?.length ?? 0)).toBe(MAX_PARTICLES - 2);
  });

  it('the worker replans when an object appears on its way', () => {
    const map = new GameMap(['.....', '.....', '.....'], { '.': { material: 'wood', height: 0 } });
    const worker = new Worker(0, 1);
    worker.goTo(map, { tx: 4, ty: 1 });
    expect(worker.path.map((step: { tx: number; ty: number }) => `${step.tx},${step.ty}`)).toContain('2,1');

    map.block(2, 1);
    worker.replan(map);
    expect(worker.path.map((step: { tx: number; ty: number }) => `${step.tx},${step.ty}`)).not.toContain('2,1');
    expect(worker.path.at(-1)).toEqual({ tx: 4, ty: 1 });
  });
});

describe('coach', () => {
  const playing = { status: 'playing', reason: null };
  const evaluate = (tasks: Task[], activeTimer: Timer = null) => evaluateTasks({ tasks, activeTimer }, 0);
  const low = () => task({ id: 'low', title: 'Regar la planta', priority: 'LOW', action: 'planta' });

  it('step 1: start the timer of the most urgent task, pointing at its clock in Tino', () => {
    const step = coachStep(evaluate([low(), task({})]), null, playing);
    expect(step).toMatchObject({ step: 1, target: { kind: 'start', title: 'Apagar el incendio del servidor' }, needsAction: true });
    expect(step.text).toContain('Iniciar cronómetro');
  });

  it('step 2: watch the character work, or fix the priority', () => {
    const running = { taskId: 't1', paused: false };
    expect(coachStep(evaluate([task({}), low()], running), running, playing)).toMatchObject({
      step: 2,
      target: null,
      needsAction: false,
    });

    const wrong = { taskId: 'low', paused: false };
    expect(coachStep(evaluate([task({}), low()], wrong), wrong, playing)).toMatchObject({
      id: 'wrong:low',
      tone: 'warn',
      target: { kind: 'stop', title: 'Regar la planta' },
    });
    const paused = { taskId: 't1', paused: true };
    expect(coachStep(evaluate([task({})], paused), paused, playing).id).toBe('paused:t1');
  });

  it('step 3: mark the solved task as done with the real option name', () => {
    const step = coachStep(evaluate([task({ workedSeconds: 10, status: 'IN_PROGRESS' })]), null, playing);
    expect(step).toMatchObject({ step: 3, target: { kind: 'done', title: 'Apagar el incendio del servidor' } });
    expect(step.text).toContain('Mover a Completadas');
  });

  it('moves on to the next problem and closes at the end', () => {
    const next = coachStep(evaluate([task({ status: 'DONE' }), low()]), null, playing);
    expect(next).toMatchObject({ step: 1, target: { title: 'Regar la planta' } });
    expect(next.title).toContain('Un problema menos');
    expect(coachStep(evaluate([task({})]), null, { status: 'finished', reason: 'timeout' })).toMatchObject({
      id: 'end',
      target: null,
    });
    expect(coachStep([], null, playing).id).toBe('loading');
  });

  it('shows the welcome dialogs one after another before the first timer, then the step', () => {
    const flow = new CoachFlow();
    const step = coachStep(evaluate([task({})]), null, { status: 'waiting', reason: null });
    let view = flow.update(0.1, step, 'waiting');
    expect(view).toMatchObject({ intro: { index: 0, total: INTRO.length }, popped: true });

    view = flow.update(INTRO_SECONDS, step, 'waiting');
    expect(view).toMatchObject({ intro: { index: 1 }, popped: true });
    flow.next();
    expect(flow.update(0.1, step, 'waiting').intro?.index).toBe(2);

    flow.dismiss();
    view = flow.update(0.1, step, 'waiting');
    expect(view).toMatchObject({ intro: null, dialog: { step: 1 }, popped: true });
  });

  it('says goodbye when the visitor ends the round with "Finalizar partida"', () => {
    const ended = { status: 'finished', reason: 'ended' };
    expect(coachStep(evaluate([task({})]), null, ended).title).toBe('¡Partida terminada!');
    expect(decideBehavior(evaluate([task({})]), null, say, ended).message).toBe('¡Hasta la próxima!');
  });

  it('skips the welcome once the round started', () => {
    const flow = new CoachFlow();
    expect(flow.update(0.1, coachStep(evaluate([task({})]), null, playing), 'playing').intro).toBeNull();
  });

  it('a hidden step that needs action pops up again after a while', () => {
    const flow = new CoachFlow();
    flow.skipIntro();
    const step = coachStep(evaluate([task({})]), null, playing);
    flow.update(0.1, step, 'playing');
    flow.dismiss();
    expect(flow.update(1, step, 'playing')).toMatchObject({ hidden: true, popped: false });
    expect(flow.update(REPOP_SECONDS, step, 'playing')).toMatchObject({ hidden: false, popped: true });
  });

  it('labels the dialog with the welcome or the step number', () => {
    expect(coachStepLabel({ step: null }, { index: 1, total: 4 }, 3)).toBe('Bienvenida 2 de 4');
    expect(coachStepLabel({ step: 2 }, null, 3)).toBe('Paso 2 de 3');
    expect(coachStepLabel({ step: null }, null, 3)).toBe('');
  });

  it('renders the dialog with the arrow to Tino and the right buttons', () => {
    document.body.innerHTML = `
      <aside id="coach" hidden><span id="coach-arrow"></span><small id="coach-step"></small><strong id="coach-title"></strong>
      <p id="coach-text"></p><button id="coach-next"></button><button id="coach-hide"></button></aside>`;
    const hud = new Hud(document);
    const coach = document.getElementById('coach')!;
    hud.renderCoach({ dialog: coachStep(evaluate([task({})]), null, playing), intro: null, hidden: false, popped: true }, 3);

    expect(coach.hidden).toBe(false);
    expect(document.getElementById('coach-title')!.textContent).toBe('Paso 1 · Iniciá el timer');
    expect(document.getElementById('coach-arrow')!.hidden).toBe(false);
    expect(document.getElementById('coach-next')!.hidden).toBe(true);
    expect(coach.classList.contains('pop')).toBe(true);

    hud.renderCoach({ dialog: { ...INTRO[0], step: null }, intro: { index: 0, total: 4 }, hidden: true, popped: false }, 3);
    expect(document.getElementById('coach-hide')!.textContent).toBe('Saltar');
    expect(coach.classList.contains('collapsed')).toBe(true);
  });
});

describe('bigger stage and bubble placement', () => {
  it('uses a whole scale when it fills the space, otherwise the scale that fills it', () => {
    expect(pickScale(3.05, 4, 0.9)).toBe(3);
    expect(pickScale(1.6, 2, 0.9)).toBe(1.6);
    expect(pickScale(0.8, 2, 0.9)).toBe(0.8);
  });

  it('keeps the bubble inside the scene and the tail on the character', () => {
    const bounds = { left: 0, top: 50, right: 300, bottom: 400 };
    const size = { width: 100, height: 30 };
    expect(placeBubble({ x: 150, y: 200 }, size, bounds)).toEqual({ x: 150, y: 200, tail: 50 });
    expect(placeBubble({ x: 10, y: 60 }, size, bounds)).toEqual({ x: 54, y: 84, tail: 10 });
  });
});
