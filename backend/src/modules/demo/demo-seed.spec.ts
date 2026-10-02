import {
  argentinaTime,
  buildDemoHistory,
  createRng,
  DEMO_ORGANIZATION_NAME,
  DEMO_PROJECTS,
  DEMO_TASKS,
  DEMO_TEAMMATES,
  seedDemoBase,
} from './demo-seed';

const NOW = new Date('2026-10-02T15:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function localHourOf(date: Date): number {
  return (date.getUTCHours() - 3 + 24) % 24 + date.getUTCMinutes() / 60;
}

function localWeekday(date: Date): number {
  return new Date(date.getTime() - 3 * HOUR_MS).getUTCDay();
}

describe('demo seed data', () => {
  it('assigns every task to a known project and teammate', () => {
    const projects = DEMO_PROJECTS.map((project) => project.name);
    const people = DEMO_TEAMMATES.map((person) => person.key);
    for (const task of DEMO_TASKS) {
      expect(projects).toContain(task.project);
      if (task.assignee) expect(people).toContain(task.assignee);
    }
  });

  it('includes overdue and unassigned tasks so the assistant has answers', () => {
    const overdue = DEMO_TASKS.filter((task) => task.status !== 'DONE' && (task.dueInDays ?? 0) < 0);
    const unassigned = DEMO_TASKS.filter((task) => task.assignee === null && task.status !== 'DONE');
    expect(overdue.length).toBeGreaterThan(0);
    expect(unassigned.length).toBeGreaterThan(0);
  });
});

describe('argentinaTime', () => {
  it('converts a local Argentina hour to UTC', () => {
    expect(argentinaTime(new Date('2026-10-01T00:00:00Z'), 9).toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });
});

describe('buildDemoHistory', () => {
  const history = buildDemoHistory(DEMO_TASKS, NOW);

  it('is deterministic', () => {
    expect(buildDemoHistory(DEMO_TASKS, NOW)).toEqual(history);
  });

  it('fills several weeks of work', () => {
    expect(history.length).toBeGreaterThan(100);
    expect(Math.min(...history.map((entry) => entry.startTime.getTime()))).toBeLessThan(NOW.getTime() - 14 * 24 * HOUR_MS);
  });

  it('only logs weekdays between 9 and 18 hs, before now', () => {
    for (const entry of history) {
      expect([0, 6]).not.toContain(localWeekday(entry.startTime));
      expect(localHourOf(entry.startTime)).toBeGreaterThanOrEqual(9);
      expect(localHourOf(entry.endTime)).toBeLessThanOrEqual(18);
      expect(entry.endTime.getTime()).toBeGreaterThan(entry.startTime.getTime());
      expect(entry.endTime.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it('never overlaps entries of the same person', () => {
    const byUser = new Map<string, typeof history>();
    for (const entry of history) byUser.set(entry.userKey, [...(byUser.get(entry.userKey) ?? []), entry]);
    for (const entries of byUser.values()) {
      const sorted = [...entries].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].startTime.getTime()).toBeGreaterThanOrEqual(sorted[i - 1].endTime.getTime());
      }
    }
  });

  it('only logs time on started tasks of the assignee', () => {
    for (const entry of history) {
      const task = DEMO_TASKS.find((candidate) => candidate.title === entry.taskTitle)!;
      expect(task.assignee).toBe(entry.userKey);
      expect(task.status).not.toBe('TODO');
    }
  });

  it('createRng returns values in [0, 1)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('seedDemoBase', () => {
  function buildPrisma(overrides: { organization?: unknown; user?: unknown; plan?: unknown; role?: unknown } = {}) {
    const tx = {
      organization: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'org-1' }) },
      user: {
        deleteMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: data.id })),
      },
      organizationMembership: { create: jest.fn() },
      project: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `project-${data.name}` })) },
      projectMember: { createMany: jest.fn() },
      task: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `task-${data.title}` })) },
      timeEntry: { createMany: jest.fn() },
    };
    const prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue(overrides.organization ?? null) },
      user: { findUnique: jest.fn().mockResolvedValue(overrides.user ?? null) },
      plan: { findUnique: jest.fn().mockResolvedValue(overrides.plan === undefined ? { id: 'plan-max' } : overrides.plan) },
      role: { findUnique: jest.fn().mockResolvedValue(overrides.role === undefined ? { id: 'role-user' } : overrides.role) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { prisma, tx };
  }

  it('does nothing when the demo company and user already exist', async () => {
    const { prisma, tx } = buildPrisma({ organization: { id: 'org-9' }, user: { id: 'user-9' } });

    const result = await seedDemoBase(prisma as never, { email: 'demo@tino-demo.local', password: 'secreto1' });

    expect(result).toEqual({ created: false, organizationId: 'org-9', userId: 'user-9' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('creates company, owner, teammates, projects, tasks and history', async () => {
    const { prisma, tx } = buildPrisma();

    const result = await seedDemoBase(prisma as never, {
      email: ' Demo@Tino-Demo.local ',
      password: 'secreto1',
      now: NOW,
    });

    expect(result.created).toBe(true);
    expect(tx.organization.deleteMany).toHaveBeenCalledWith({ where: { name: DEMO_ORGANIZATION_NAME } });
    const organization = tx.organization.create.mock.calls[0][0].data;
    expect(organization).toMatchObject({ name: DEMO_ORGANIZATION_NAME, planId: 'plan-max' });
    const earliestEntry = Math.min(
      ...tx.timeEntry.createMany.mock.calls[0][0].data.map((entry: { startTime: Date }) => entry.startTime.getTime()),
    );
    expect(organization.createdAt.getTime()).toBeLessThan(earliestEntry);
    for (const [task] of tx.task.create.mock.calls) {
      expect(task.data.createdAt.getTime()).toBeLessThan(earliestEntry);
    }
    const owner = tx.user.create.mock.calls[0][0].data;
    expect(owner.email).toBe('demo@tino-demo.local');
    expect(owner.password).not.toBe('secreto1');
    expect(tx.user.create).toHaveBeenCalledTimes(1 + DEMO_TEAMMATES.length);
    expect(tx.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', userId: owner.id, role: 'ORG_OWNER' },
    });
    expect(tx.project.create).toHaveBeenCalledTimes(DEMO_PROJECTS.length);
    expect(tx.task.create).toHaveBeenCalledTimes(DEMO_TASKS.length);
    expect(tx.timeEntry.createMany.mock.calls[0][0].data.length).toBeGreaterThan(100);
  });

  it('rebuilds an existing company with force', async () => {
    const { prisma, tx } = buildPrisma({ organization: { id: 'org-9' }, user: { id: 'user-9' } });

    const result = await seedDemoBase(prisma as never, { email: 'demo@tino-demo.local', password: 'secreto1', force: true });

    expect(result.created).toBe(true);
    expect(tx.user.deleteMany).toHaveBeenCalled();
  });

  it('fails clearly when plans or roles were not seeded', async () => {
    const { prisma } = buildPrisma({ plan: null });

    await expect(
      seedDemoBase(prisma as never, { email: 'demo@tino-demo.local', password: 'secreto1' }),
    ).rejects.toThrow('prisma/seed.ts');
  });
});
