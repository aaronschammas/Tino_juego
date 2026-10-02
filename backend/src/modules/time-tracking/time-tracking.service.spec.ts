import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import * as permissions from 'src/common/permissions';
import { Prisma, TaskStatus } from '@prisma/client';

jest.mock('src/common/permissions');

describe('TimeTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);
  });

  const createService = () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue(undefined),
      timeEntry: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
      task: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;

    const prisma = {
      $transaction: jest.fn(async (cb: any) => cb(tx)),
      organizationMembership: {
        findUnique: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      timeEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;

    const projectMembers = {
      canTrackTime: jest.fn(),
      isMemberOfProject: jest.fn(),
    } as any;
    const service = new TimeTrackingService(prisma, projectMembers);

    const mockUser = { id: 'user-1', organizationId: 'org-1', role: 'USER' } as any;

    return { service, prisma, tx, projectMembers, mockUser };
  };

  describe('startTime', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when user already has an active timer', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue({ id: 'active' });

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when project not found', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue(null);

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails when user has no project access', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(false);

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails when taskId is specified but task not found in project', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue(null); // task not found

      await expect(
        service.startTime('project-1', mockUser, 'task-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails on Prisma P2002 conflict error and throws BadRequestException', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);

      const prismaError = new Prisma.PrismaClientKnownRequestError('msg', { code: 'P2002', clientVersion: '5' });
      tx.timeEntry.create.mockRejectedValue(prismaError);

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rethrows other database errors', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);

      const dbError = new Error('Connection lost');
      tx.timeEntry.create.mockRejectedValue(dbError);

      await expect(
        service.startTime('project-1', mockUser),
      ).rejects.toThrow('Connection lost');
    });

    it('should start time successfully', async () => {
      const { service, tx, mockUser } = createService();

      const mockTimeEntry = {
        id: 'time-1',
        userId: 'user-1',
        projectId: 'project-1',
        organizationId: 'org-1',
        startTime: new Date(),
        endTime: null,
        project: { id: 'project-1', name: 'Test Project' },
      };

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);
      tx.timeEntry.create.mockResolvedValue(mockTimeEntry);

      const result = await service.startTime('project-1', mockUser);

      expect(result.id).toBe('time-1');
      expect(result.userId).toBe('user-1');
      expect(tx.timeEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            endTime: null,
            organizationId: 'org-1',
          }),
        }),
      );
      expect(tx.timeEntry.create).toHaveBeenCalled();
    });

    it('rejects starting a timer for a project outside the active organization', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue(null);

      await expect(service.startTime('project-other-org', mockUser)).rejects.toThrow(NotFoundException);
      expect(tx.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-other-org',
          isActive: true,
          organizationId: 'org-1',
        },
      });
    });

    it('should start time with taskId successfully', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({ id: 'task-1', parentTaskId: null, _count: { subTasks: 0 } });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);
      tx.timeEntry.create.mockResolvedValue({ id: 'time-1', taskId: 'task-1' });

      const result = await service.startTime('project-1', mockUser, 'task-1');

      expect(result.taskId).toBe('task-1');
      expect(tx.task.findFirst).toHaveBeenCalled();
      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'task-1',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it.each([
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      TaskStatus.DONE,
    ])('marks a %s task as IN_PROGRESS when starting its timer', async (status) => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({
        id: 'task-1',
        parentTaskId: null,
        status,
        _count: { subTasks: 0 },
      });
      tx.timeEntry.create.mockResolvedValue({ id: 'time-1', taskId: 'task-1' });

      await service.startTime('project-1', mockUser, 'task-1');

      expect(tx.task.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'task-1',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('rejects starting a timer on a parent task with subtasks', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({ id: 'parent-task', _count: { subTasks: 2 } });

      await expect(
        service.startTime('project-1', mockUser, 'parent-task'),
      ).rejects.toThrow(BadRequestException);
      expect(tx.task.updateMany).not.toHaveBeenCalled();
      expect(tx.timeEntry.create).not.toHaveBeenCalled();
    });

    it('allows starting a timer on a valid subtask', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({
        id: 'subtask-1',
        parentTaskId: 'parent-task',
        parentTask: {
          id: 'parent-task',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        _count: { subTasks: 0 },
      });
      tx.task.findMany.mockResolvedValue([{ status: TaskStatus.IN_PROGRESS }]);
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(true);
      tx.timeEntry.create.mockResolvedValue({ id: 'time-1', taskId: 'subtask-1' });

      const result = await service.startTime('project-1', mockUser, 'subtask-1');

      expect(result.taskId).toBe('subtask-1');
    });

    it.each([
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.BLOCKED,
      TaskStatus.DONE,
    ])('marks only a %s subtask as IN_PROGRESS and recalculates its parent', async (status) => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({
        id: 'subtask-1',
        parentTaskId: 'parent-task',
        parentTask: {
          id: 'parent-task',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        status,
        _count: { subTasks: 0 },
      });
      tx.task.findMany.mockResolvedValue([
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.TODO },
      ]);
      tx.timeEntry.create.mockResolvedValue({ id: 'time-1', taskId: 'subtask-1' });

      await service.startTime('project-1', mockUser, 'subtask-1');

      expect(tx.task.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'subtask-1',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        data: { status: TaskStatus.IN_PROGRESS },
      });
      expect(tx.task.findMany).toHaveBeenCalledWith({
        where: {
          parentTaskId: 'parent-task',
          projectId: 'project-1',
          organizationId: 'org-1',
          archivedAt: null,
        },
        select: { status: true },
      });
      expect(tx.task.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: 'parent-task',
          projectId: 'project-1',
          organizationId: 'org-1',
        },
        data: { status: TaskStatus.IN_PROGRESS },
      });
      expect(tx.task.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentTaskId: 'parent-task' }),
        }),
      );
    });

    it('does not update task status when project access is denied', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);
      tx.project.findFirst.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
        isActive: true,
      });
      tx.task.findFirst.mockResolvedValue({
        id: 'task-1',
        parentTaskId: null,
        _count: { subTasks: 0 },
      });
      (permissions.canTrackTime as jest.Mock).mockResolvedValue(false);

      await expect(service.startTime('project-1', mockUser, 'task-1')).rejects.toThrow(NotFoundException);
      expect(tx.task.updateMany).not.toHaveBeenCalled();
      expect(tx.timeEntry.create).not.toHaveBeenCalled();
    });

    it('does not update task status when an active timer already exists', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue({ id: 'active' });

      await expect(service.startTime('project-1', mockUser, 'task-1')).rejects.toThrow(BadRequestException);
      expect(tx.task.findFirst).not.toHaveBeenCalled();
      expect(tx.task.updateMany).not.toHaveBeenCalled();
      expect(tx.timeEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('stopTime', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.stopTime(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail stopping time when no active timer', async () => {
      const { service, tx, mockUser } = createService();

      tx.timeEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.stopTime(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should stop time successfully', async () => {
      const { service, tx, mockUser } = createService();

      const mockActiveEntry = {
        id: 'time-1',
        userId: 'user-1',
        startTime: new Date(Date.now() - 10000),
        totalPausedMs: 1000,
        pausedAt: null,
      };

      const mockUpdatedEntry = {
        id: 'time-1',
        userId: 'user-1',
        endTime: new Date(),
        project: { id: 'project-1' },
      };

      tx.timeEntry.findFirst.mockResolvedValue(mockActiveEntry);
      tx.timeEntry.update.mockResolvedValue(mockUpdatedEntry);

      const result = await service.stopTime(mockUser);

      expect(result.id).toBe('time-1');
      expect(tx.timeEntry.update).toHaveBeenCalled();
    });

    it('should stop time and calculate accumulated paused ms correctly if paused when stopped', async () => {
      const { service, tx, mockUser } = createService();

      const pausedAt = new Date(Date.now() - 5000);
      const mockActiveEntry = {
        id: 'time-1',
        userId: 'user-1',
        startTime: new Date(Date.now() - 10000),
        totalPausedMs: 1000,
        pausedAt,
      };

      tx.timeEntry.findFirst.mockResolvedValue(mockActiveEntry);
      tx.timeEntry.update.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'time-1',
          totalPausedMs: data.totalPausedMs,
        });
      });

      const result = await service.stopTime(mockUser);

      expect(result.totalPausedMs).toBeGreaterThanOrEqual(6000);
    });
  });

  describe('getActiveTime', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.getActiveTime(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should get active time entry', async () => {
      const { service, prisma, mockUser } = createService();

      const mockEntry = { id: 'time-1', userId: 'user-1', endTime: null, startTime: new Date(), totalPausedMs: 0 };
      prisma.timeEntry = {
        findFirst: jest.fn().mockResolvedValue(mockEntry),
      };

      const result = await service.getActiveTime(mockUser);

      expect(result).toBeDefined();
      expect(result.activeTimer!.id).toBe('time-1');
      expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            endTime: null,
            organizationId: 'org-1',
          }),
        }),
      );
    });
  });

  describe('heartbeat', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.heartbeat(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when active timer is not found', async () => {
      const { service, prisma, mockUser } = createService();
      prisma.timeEntry.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.heartbeat(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update heartbeat and handle paused timers properly', async () => {
      const { service, tx, mockUser } = createService();
      const mockEntry = { id: 'time-1', totalPausedMs: 1000, pausedAt: new Date(Date.now() - 5000) };

      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);
      tx.timeEntry.update.mockImplementation(({ data }) => Promise.resolve({ id: 'time-1', totalPausedMs: data.totalPausedMs }));

      const result = await service.heartbeat(mockUser);

      expect(result).toBeDefined();
      expect(result.totalPausedMs).toBeGreaterThanOrEqual(6000);
    });
  });

  describe('pauseTime', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.pauseTime(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when no active timer exists', async () => {
      const { service, prisma, mockUser } = createService();
      prisma.timeEntry.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.pauseTime(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns the entry unchanged if already paused', async () => {
      const { service, tx, mockUser } = createService();
      const mockEntry = { id: 'time-1', pausedAt: new Date() };
      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);

      const result = await service.pauseTime(mockUser);

      expect(result).toBe(mockEntry);
    });

    it('should pause a running timer', async () => {
      const { service, tx, mockUser } = createService();
      const mockEntry = { id: 'time-1', pausedAt: null };
      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);
      tx.timeEntry.update.mockResolvedValue({ id: 'time-1', pausedAt: new Date() });

      const result = await service.pauseTime(mockUser);

      expect(result.pausedAt).toBeDefined();
    });
  });

  describe('autoPauseIdleTimers', () => {
    it('should return 0 when no idle entries are found', async () => {
      const { service, prisma } = createService();
      prisma.timeEntry.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.autoPauseIdleTimers();

      expect(result).toBe(0);
    });

    it('should auto-pause idle timers', async () => {
      const { service, prisma } = createService();
      prisma.timeEntry.findMany = jest.fn().mockResolvedValue([{ id: 'time-1' }]);
      prisma.timeEntry.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      const count = await service.autoPauseIdleTimers();

      expect(count).toBe(1);
      expect(prisma.timeEntry.updateMany).toHaveBeenCalled();
    });
  });

  describe('getProjectTime', () => {
    it('should get project time summary', async () => {
      const { service, prisma, projectMembers, mockUser } = createService();

      projectMembers.isMemberOfProject = jest.fn().mockResolvedValue(true);
      prisma.timeEntry = {
        findMany: jest.fn().mockResolvedValue([
          {
            startTime: new Date('2026-03-30T10:00:00'),
            endTime: new Date('2026-03-30T11:00:00'),
            totalPausedMs: 1000,
          },
          {
            startTime: new Date('2026-03-30T12:00:00'),
            endTime: new Date('2026-03-30T13:30:00'),
            totalPausedMs: 0,
          },
        ]),
      };

      const result = await service.getProjectTime('project-1', mockUser);

      expect(result.projectId).toBe('project-1');
      expect(result.totalHours).toBeGreaterThan(0);
    });

    it('should fail getting project time when not member', async () => {
      const { service, projectMembers, mockUser } = createService();

      projectMembers.isMemberOfProject = jest.fn().mockResolvedValue(false);

      await expect(
        service.getProjectTime('project-1', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.getHistory(mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should get history successfully', async () => {
      const { service, prisma, mockUser } = createService();
      prisma.timeEntry.findMany = jest.fn().mockResolvedValue([{ id: 'time-1' }]);

      const result = await service.getHistory(mockUser);

      expect(result).toHaveLength(1);
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            organizationId: 'org-1',
          }),
        }),
      );
    });
  });

  describe('linkTimeEntry', () => {
    it('fails when user has no organization', async () => {
      const { service, mockUser } = createService();
      mockUser.organizationId = null;

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when time entry is not found', async () => {
      const { service, tx, mockUser } = createService();
      tx.timeEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails when time entry is active (no endTime)', async () => {
      const { service, tx, mockUser } = createService();
      tx.timeEntry.findFirst.mockResolvedValue({ id: 'time-1', endTime: null });

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails when user is not member of project', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      tx.timeEntry.findFirst.mockResolvedValue({ id: 'time-1', projectId: 'project-1', endTime: new Date() });
      projectMembers.isMemberOfProject.mockResolvedValue(false);

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('fails when task is not in same project', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      tx.timeEntry.findFirst.mockResolvedValue({ id: 'time-1', projectId: 'project-1', endTime: new Date() });
      projectMembers.isMemberOfProject.mockResolvedValue(true);
      tx.task.findFirst.mockResolvedValue(null);

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('links entire entry if durationMs is not provided', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const mockEntry = { id: 'time-1', projectId: 'project-1', startTime, endTime, totalPausedMs: 0 };
      
      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);
      projectMembers.isMemberOfProject.mockResolvedValue(true);
      tx.task.findFirst.mockResolvedValue({ id: 'task-1', projectId: 'project-1', _count: { subTasks: 0 } });
      tx.timeEntry.update.mockResolvedValue({ ...mockEntry, taskId: 'task-1' });

      const result = await service.linkTimeEntry('time-1', { taskId: 'task-1' }, mockUser);

      expect(tx.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'time-1' },
        data: { taskId: 'task-1' },
        include: { project: true, task: true },
      });
      expect(result.taskId).toBe('task-1');
    });

    it('splits entry if valid durationMs is provided', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      const startTime = new Date(Date.now() - 3600000); // 1 hour ago
      const endTime = new Date();
      const mockEntry = { id: 'time-1', projectId: 'project-1', userId: 'user-1', startTime, endTime, totalPausedMs: 0 };

      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);
      projectMembers.isMemberOfProject.mockResolvedValue(true);
      tx.task.findFirst.mockResolvedValue({ id: 'task-1', projectId: 'project-1', _count: { subTasks: 0 } });
      tx.timeEntry.update.mockResolvedValue({});
      tx.timeEntry.create.mockResolvedValue({ id: 'time-new', taskId: 'task-1' });

      const result = await service.linkTimeEntry('time-1', { taskId: 'task-1', durationMs: 1800000 }, mockUser); // split 30 min

      expect(tx.timeEntry.update).toHaveBeenCalled();
      expect(tx.timeEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          projectId: 'project-1',
          taskId: 'task-1',
          totalPausedMs: 0,
        }),
      }));
      expect(result.id).toBe('time-new');
    });

    it('fails if durationMs would leave zero/negative duration in original entry', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const endTime = new Date();
      const mockEntry = { id: 'time-1', projectId: 'project-1', userId: 'user-1', startTime, endTime, totalPausedMs: 0 };

      tx.timeEntry.findFirst.mockResolvedValue(mockEntry);
      projectMembers.isMemberOfProject.mockResolvedValue(true);
      tx.task.findFirst.mockResolvedValue({ id: 'task-1', projectId: 'project-1', _count: { subTasks: 0 } });

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'task-1', durationMs: 15000 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects linking time to a parent task with subtasks', async () => {
      const { service, tx, projectMembers, mockUser } = createService();
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      tx.timeEntry.findFirst.mockResolvedValue({
        id: 'time-1',
        projectId: 'project-1',
        startTime,
        endTime,
        totalPausedMs: 0,
      });
      projectMembers.isMemberOfProject.mockResolvedValue(true);
      tx.task.findFirst.mockResolvedValue({ id: 'parent-task', _count: { subTasks: 1 } });

      await expect(
        service.linkTimeEntry('time-1', { taskId: 'parent-task' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
