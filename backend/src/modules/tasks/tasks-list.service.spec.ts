/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

const date = (value: string) => new Date(value);
const baseQuery = { page: 1, pageSize: 25 };
const user = { id: 'u1', organizationId: 'org-1', role: 'USER' };

function setup(owner = false) {
  const prisma = {
    project: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const members = { isOrgOwner: jest.fn().mockResolvedValue(owner) };
  return {
    prisma,
    members,
    service: new TasksService(prisma as never, members as never),
  };
}

describe('TasksService.listAccessibleTasks', () => {
  it('scopes a member to active memberships and uses the same filtered set for total and items', async () => {
    const { service, prisma } = setup(false);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        projectId: 'p1',
        project: { id: 'p1', name: 'P' },
        title: 'Mine',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: null,
        assignedToId: 'u1',
        assignedTo: { id: 'u1', name: 'A', lastname: 'B' },
        estimatedHours: 2,
        updatedAt: date('2026-01-01'),
        subTasks: [],
        _count: { subTasks: 0 },
      },
    ]);
    const result = await service.listAccessibleTasks(
      { ...baseQuery, assignedTo: 'me' },
      user,
    );
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isActive: true,
          members: { some: { userId: 'u1' } },
        }),
      }),
    );
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          projectId: { in: ['p1'] },
          AND: [
            {
              OR: [
                { assignedToId: 'u1' },
                { subTasks: { some: { assignedToId: 'u1' } } },
              ],
            },
          ],
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        assignmentSource: 'direct',
        hasSubTasks: false,
      }),
    );
  });

  it('lets an owner query all active projects only inside the active organization', async () => {
    const { service, prisma } = setup(true);
    await service.listAccessibleTasks(baseQuery, user);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true },
      select: { id: true },
    });
  });

  it('returns a generic 404 for an inaccessible or nonexistent explicit project', async () => {
    const { service } = setup(false);
    await expect(
      service.listAccessibleTasks(
        { ...baseQuery, projectId: 'other-org-project' },
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('supports assignment through a subtask without inventing direct assignment', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        projectId: 'p1',
        project: { id: 'p1', name: 'P' },
        title: 'Parent',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        dueDate: null,
        assignedToId: null,
        assignedTo: null,
        estimatedHours: null,
        updatedAt: date('2026-01-01'),
        subTasks: [{ assignedToId: 'u1' }],
        _count: { subTasks: 1 },
      },
    ]);
    const result = await service.listAccessibleTasks(
      { ...baseQuery, assignedTo: 'me' },
      user,
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        assignedToId: null,
        assignmentSource: 'subtask',
        hasSubTasks: true,
      }),
    );
  });

  it('applies status, priority, overdue and case-insensitive search filters', async () => {
    const { service, prisma } = setup();
    await service.listAccessibleTasks(
      {
        ...baseQuery,
        status: TaskStatus.BLOCKED,
        priority: Priority.CRITICAL,
        overdue: true,
        search: 'login',
      },
      user,
    );
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: TaskStatus.BLOCKED,
          priority: Priority.CRITICAL,
          AND: [
            { dueDate: { lt: expect.any(Date) } },
            { status: { not: TaskStatus.DONE } },
            {
              OR: [
                { title: { contains: 'login', mode: 'insensitive' } },
                { description: { contains: 'login', mode: 'insensitive' } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('bounds upcoming open tasks by due date before applying the payload limit', async () => {
    const { service, prisma } = setup();
    await service.listAccessibleTasks(
      {
        ...baseQuery,
        dueFrom: '2026-09-02T12:00:00.000Z',
        dueTo: '2026-09-09T12:00:00.000Z',
        openOnly: true,
      },
      user,
    );
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              dueDate: {
                gte: new Date('2026-09-02T12:00:00.000Z'),
                lte: new Date('2026-09-09T12:00:00.000Z'),
              },
            },
            { status: { not: TaskStatus.DONE } },
          ],
        }),
      }),
    );
  });

  it('orders globally before paginating with completed tasks last and a stable id tie-breaker', async () => {
    const { service, prisma } = setup();
    const task = (
      id: string,
      status: TaskStatus,
      dueDate: Date | null,
      updatedAt: Date,
    ) => ({
      id,
      projectId: 'p1',
      project: { id: 'p1', name: 'P' },
      title: id,
      status,
      priority: Priority.MEDIUM,
      dueDate,
      assignedToId: null,
      assignedTo: null,
      estimatedHours: null,
      updatedAt,
      subTasks: [],
      _count: { subTasks: 0 },
    });
    prisma.task.findMany.mockResolvedValue([
      task('done', TaskStatus.DONE, date('2020-01-01'), date('2026-01-01')),
      task('none', TaskStatus.TODO, null, date('2026-03-01')),
      task('future', TaskStatus.TODO, date('2099-01-01'), date('2026-01-01')),
      task(
        'overdue',
        TaskStatus.BLOCKED,
        date('2020-01-01'),
        date('2026-01-01'),
      ),
    ]);
    const result = await service.listAccessibleTasks(
      { page: 1, pageSize: 2 },
      user,
    );
    expect(result.items.map((item) => item.id)).toEqual(['overdue', 'future']);
    expect(result).toEqual(
      expect.objectContaining({ total: 4, totalPages: 2 }),
    );
  });
});
