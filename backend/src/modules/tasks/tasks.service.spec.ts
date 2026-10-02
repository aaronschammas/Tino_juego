import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectMembersService } from '../projects/project-members.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import * as permissions from 'src/common/permissions';

jest.mock('src/common/permissions');

describe('TasksService', () => {
  let service: TasksService;
  let mockPrismaService: any;
  let mockProjectMembersService: any;

  beforeEach(async () => {
    mockPrismaService = {
      project: {
        findFirst: jest.fn(),
      },
      task: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      timeEntry: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      organizationMembership: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrismaService)),
    };

    mockProjectMembersService = {
      isOrgOwner: jest.fn(),
      canManageProject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectMembersService, useValue: mockProjectMembersService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  const mockUser = { id: 'user-1', organizationId: 'org-1', role: 'USER' } as any;

  describe('createTask', () => {
    it('should create a task successfully when user is project member', async () => {
      // Arrange
      const projectId = 'proj-1';
      const dto = { title: 'New Task' };
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId, organizationId: 'org-1' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue({ id: 'task-1', ...dto, timeEntries: [] });

      // Act
      const result = await service.createTask(projectId, dto as any, mockUser);

      // Assert
      expect(result.id).toBe('task-1');
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
          isActive: true,
          organizationId: 'org-1',
        },
      });
      expect(mockPrismaService.task.create).toHaveBeenCalled();
    });

    it('should collapse repeated whitespace and trim the description', async () => {
      // Arrange
      const projectId = 'proj-1';
      const dto = { title: 'New Task', description: '   Mi    descripción    con    espacios   ' };
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId, organizationId: 'org-1' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue({ id: 'task-1', timeEntries: [] });

      // Act
      await service.createTask(projectId, dto as any, mockUser);

      // Assert
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Mi descripción con espacios',
          }),
        }),
      );
    });

    it('should collapse newlines and tabs into single spaces', async () => {
      // Arrange
      const projectId = 'proj-1';
      const dto = { title: 'New Task', description: 'linea uno\n\n\tlinea dos' };
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId, organizationId: 'org-1' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue({ id: 'task-1', timeEntries: [] });

      // Act
      await service.createTask(projectId, dto as any, mockUser);

      // Assert
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'linea uno linea dos' }),
        }),
      );
    });

    it('should leave the description undefined when it was not provided', async () => {
      // Arrange
      const projectId = 'proj-1';
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId, organizationId: 'org-1' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue({ id: 'task-1', timeEntries: [] });

      // Act
      await service.createTask(projectId, { title: 'New Task' } as any, mockUser);

      // Assert
      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: undefined }),
        }),
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createTask('p', {} as any, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user is not a member', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.createTask('p', {} as any, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if parent task not found', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createTask('p', { parentTaskId: 'parent' } as any, mockUser)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith({
        where: { id: 'parent', projectId: 'p', organizationId: 'org-1' },
      });
    });

    it('should reject creating a subtask for a parent task in another organization', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'org-1' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      await expect(
        service.createTask('p', { parentTaskId: 'cross-org-parent' } as any, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith({
        where: { id: 'cross-org-parent', projectId: 'p', organizationId: 'org-1' },
      });
    });

    it('should throw ForbiddenException if user cannot assign tasks', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.createTask('p', { assignedToId: 'u2' } as any, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if assigned user not found or inactive', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createTask('p', { assignedToId: 'u2' } as any, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if assigned user is not member of the project', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'u2', isActive: true });
      (permissions.isProjectMember as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.createTask('p', { assignedToId: 'u2' } as any, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should calculate metrics correctly when timeEntry endtime is missing', async () => {
      // Arrange
      const now = new Date();
      const task = {
        id: 't1',
        timeEntries: [
          { startTime: now, endTime: null, totalPausedMs: 0 } // missing endTime, should be skipped
        ],
        subTasks: []
      };
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue(task);

      // Act
      const result = await service.createTask('p', {} as any, mockUser);

      // Assert
      expect(result.actualHours).toBe(0);
    });

    it('should calculate metrics correctly', async () => {
      // Arrange
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const task = {
        id: 't1',
        timeEntries: [
          { startTime: oneHourAgo, endTime: now, totalPausedMs: 0 }
        ],
        subTasks: [
          {
            id: 'sub1',
            timeEntries: [
              { startTime: oneHourAgo, endTime: now, totalPausedMs: 1800000 } // 30 min paused -> 0.5 hours active
            ]
          }
        ]
      };
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p', organizationId: 'o' });
      (permissions.canCreateTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.create.mockResolvedValue(task);

      // Act
      const result = await service.createTask('p', {} as any, mockUser);

      // Assert
      expect(result.actualHours).toBe(0.5);
      expect(result.subTasks[0].actualHours).toBe(0.5);
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks for project member', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findMany.mockResolvedValue([{ id: 't1', timeEntries: [] }]);

      // Act
      const result = await service.getTasksByProject('p', mockUser);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'p',
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('hides archived tasks and archived subtasks', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findMany.mockResolvedValue([]);

      await service.getTasksByProject('p', mockUser);

      const [[args]] = mockPrismaService.task.findMany.mock.calls;
      expect(args.where).toEqual(expect.objectContaining({ archivedAt: null }));
      expect(args.include.subTasks.where).toEqual({ archivedAt: null });
    });

    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTasksByProject('p', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if project member validation fails', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(false);

      await expect(service.getTasksByProject('p', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTaskById', () => {
    it('should return task if user has access', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue({ id: 't1', timeEntries: [] });

      // Act
      const result = await service.getTaskById('p', 't1', mockUser);

      // Assert
      expect(result.id).toBe('t1');
      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 't1',
            projectId: 'p',
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.getTaskById('p', 't1', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user is not project member', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(false);

      await expect(service.getTaskById('p', 't1', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if task not found', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTaskById('p', 't1', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('does not expose a task from another organization even when ids are manipulated', async () => {
      const prisma = mockPrismaService as {
        project: { findFirst: jest.Mock };
        task: { findFirst: jest.Mock<Promise<unknown>, [unknown]> };
      };
      const permissionUser = mockUser as {
        id: string;
        organizationId: string;
        role: string;
      };
      prisma.project.findFirst.mockResolvedValue({ id: 'project-a' });
      (permissions.hasProjectAccess as jest.Mock).mockResolvedValue(true);
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskById('project-a', 'task-from-org-b', permissionUser),
      ).rejects.toThrow(NotFoundException);

      const taskQuery = prisma.task.findFirst.mock.calls[0][0] as {
        where: { id: string; projectId: string; organizationId: string };
      };
      expect(taskQuery.where).toMatchObject({
        id: 'task-from-org-b',
        projectId: 'project-a',
        organizationId: 'org-1',
      });
    });
  });

  describe('updateTask', () => {
    it('should update task status correctly for member', async () => {
      // Arrange
      const projectId = 'p1';
      const taskId = 't1';
      const userId = 'u1';
      const task = { 
        id: taskId, 
        projectId, 
        status: TaskStatus.TODO, 
        project: { organizationId: 'o1' },
        assignedToId: userId
      };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ ...task, status: TaskStatus.IN_PROGRESS, timeEntries: [], subTasks: [] });

      // Act
      const result = await service.updateTask(projectId, taskId, { status: TaskStatus.IN_PROGRESS }, mockUser);

      // Assert
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: taskId,
            projectId,
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('should return successfully when status is changed to the current same status', async () => {
      const task = { status: TaskStatus.TODO, project: { organizationId: 'o1' }, _count: { subTasks: 0 } };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce({ ...task, timeEntries: [], subTasks: [] });
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateTask('p', 't', { status: TaskStatus.TODO }, mockUser);

      expect(result.status).toBe(TaskStatus.TODO);
    });

    it('should throw NotFoundException if task to update not found', async () => {
      // Arrange
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateTask('p', 't', {}, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if canEdit is false', async () => {
      const task = { status: TaskStatus.TODO, project: { organizationId: 'o1' } };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: false, restricted: false });

      await expect(service.updateTask('p', 't', {}, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if member tries to change restricted fields', async () => {
      // Arrange
      const task = { 
        id: 't1', 
        projectId: 'p1', 
        status: TaskStatus.TODO, 
        project: { organizationId: 'o1' },
        assignedToId: 'u2' 
      };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: true });

      // Act & Assert
      await expect(service.updateTask('p1', 't1', { title: 'New Title' }, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should reject a restricted member assigning an unassigned task to another user', async () => {
      const task = {
        id: 't1', projectId: 'p1', status: TaskStatus.TODO,
        project: { organizationId: 'o1' }, assignedToId: null,
      };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: true });

      await expect(
        service.updateTask('p1', 't1', { assignedToId: 'u2' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.task.updateMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user cannot assign tasks', async () => {
      const task = { projectId: 'p', project: { organizationId: 'o1' } };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(false);

      await expect(service.updateTask('p', 't', { assignedToId: 'u2' }, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if assignedUser not found or inactive', async () => {
      const task = { projectId: 'p', project: { organizationId: 'o1' } };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.updateTask('p', 't', { assignedToId: 'u2' }, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if assignedUser is not member of project', async () => {
      const task = { projectId: 'p', project: { organizationId: 'o1' } };
      mockPrismaService.task.findFirst.mockResolvedValue(task);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      (permissions.canAssignTask as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'u2', isActive: true });
      (permissions.isProjectMember as jest.Mock).mockResolvedValue(false);

      await expect(service.updateTask('p', 't', { assignedToId: 'u2' }, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should allow manually changing a parent task status to BLOCKED and cascade only non-completed subtasks', async () => {
      const parentTask = {
        id: 'parent1',
        status: TaskStatus.IN_PROGRESS,
        parentTaskId: null,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
      };
      const updatedTask = {
        ...parentTask,
        status: TaskStatus.BLOCKED,
        timeEntries: [],
        subTasks: [
          { id: 'sub1', status: TaskStatus.BLOCKED, timeEntries: [] },
          { id: 'sub2', status: TaskStatus.BLOCKED, timeEntries: [] },
        ],
      };
      mockPrismaService.task.findFirst.mockResolvedValue(parentTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(updatedTask);
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateTask('p', 'parent1', { status: TaskStatus.BLOCKED }, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1', status: { not: TaskStatus.DONE } },
        data: { status: TaskStatus.BLOCKED },
      });
      expect(result.status).toBe(TaskStatus.BLOCKED);
    });

    it('should allow manually changing a parent task status to DONE and cascade to all subtasks', async () => {
      const parentTask = {
        id: 'parent1',
        status: TaskStatus.IN_PROGRESS,
        parentTaskId: null,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
      };
      const updatedTask = {
        ...parentTask,
        status: TaskStatus.DONE,
        timeEntries: [],
        subTasks: [
          { id: 'sub1', status: TaskStatus.DONE, timeEntries: [] },
          { id: 'sub2', status: TaskStatus.DONE, timeEntries: [] },
        ],
      };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(updatedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateTask('p', 'parent1', { status: TaskStatus.DONE }, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.DONE },
      });
      expect(result.status).toBe(TaskStatus.DONE);
    });

    it('should cascade IN_PROGRESS to non-completed subtasks only when parent is set to IN_PROGRESS', async () => {
      const parentTask = {
        id: 'parent1',
        status: TaskStatus.TODO,
        parentTaskId: null,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
      };
      const updatedTask = { ...parentTask, status: TaskStatus.IN_PROGRESS, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(updatedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 1 });

      await service.updateTask('p', 'parent1', { status: TaskStatus.IN_PROGRESS }, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1', status: { not: TaskStatus.DONE } },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('should cascade TODO to non-completed subtasks when parent is manually reset to TODO', async () => {
      const parentTask = {
        id: 'parent1',
        status: TaskStatus.DONE,
        parentTaskId: null,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
      };
      const updatedTask = { ...parentTask, status: TaskStatus.TODO, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(updatedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 2 });

      await service.updateTask('p', 'parent1', { status: TaskStatus.TODO }, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1', status: { not: TaskStatus.DONE } },
        data: { status: TaskStatus.TODO },
      });
    });

    it('should sync parent status when a subtask status is updated via updateTask', async () => {
      const subtask = {
        id: 'sub1',
        status: TaskStatus.TODO,
        parentTaskId: 'parent1',
        project: { organizationId: 'o1' },
        _count: { subTasks: 0 },
      };
      const updatedTask = { ...subtask, status: TaskStatus.IN_PROGRESS, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(updatedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.updateMany.mockResolvedValue({ count: 1 });
      // syncParentStatus calls findMany then update
      mockPrismaService.task.findMany.mockResolvedValue([{ status: TaskStatus.IN_PROGRESS }]);

      await service.updateTask('p', 'sub1', { status: TaskStatus.IN_PROGRESS }, mockUser);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1', archivedAt: null },
        select: { status: true },
      });
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status normally when task has no subtasks', async () => {
      // Arrange: tarea simple (sin subtareas)
      const baseTask = {
        id: 't1',
        parentTaskId: null,
        status: TaskStatus.TODO,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...baseTask, status: TaskStatus.IN_PROGRESS, timeEntries: [], subTasks: [] };

      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(baseTask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });

      // Act
      const result = await service.updateTaskStatus('p', 't1', TaskStatus.IN_PROGRESS, mockUser);

      // Assert
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('should allow reopening a blocked task to done under the current transition matrix', async () => {
      const baseTask = {
        id: 't1',
        parentTaskId: null,
        status: TaskStatus.BLOCKED,
        project: { organizationId: 'o1' },
        _count: { subTasks: 0 },
        subTasks: [],
      };
      const refreshedTask = { ...baseTask, status: TaskStatus.DONE, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(baseTask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });

      const result = await service.updateTaskStatus('p', 't1', TaskStatus.DONE, mockUser);

      expect(result.status).toBe(TaskStatus.DONE);
    });

    it('should reject completing a parent task when a subtask has an active timer', async () => {
      const parentTask = {
        id: 'parent1',
        status: TaskStatus.IN_PROGRESS,
        parentTaskId: null,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
      };
      mockPrismaService.task.findFirst.mockResolvedValueOnce(parentTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.timeEntry.findFirst.mockResolvedValue({ id: 'timer1', taskId: 'sub1' });

      await expect(
        service.updateTask('p', 'parent1', { status: TaskStatus.DONE }, mockUser),
      ).rejects.toThrow('Cannot complete parent task while a subtask has an active timer');

      expect(mockPrismaService.timeEntry.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'p',
          organizationId: 'org-1',
          endTime: null,
          task: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1' },
        },
        select: { id: true, taskId: true },
      });
      expect(mockPrismaService.task.updateMany).not.toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.DONE },
      });
    });

    it('should sync parent status when updating a subtask', async () => {
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.TODO,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.IN_PROGRESS, timeEntries: [], subTasks: [] };

      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.findMany.mockResolvedValue([{ status: TaskStatus.IN_PROGRESS }]);

      const result = await service.updateTaskStatus('p', 'sub1', TaskStatus.IN_PROGRESS, mockUser);

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      // syncParentStatus -> recalcula y actualiza el padre
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1', archivedAt: null },
        select: { status: true },
      });
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('should cascade status to all subtasks when dragging a parent task with subtasks', async () => {
      // Arrange: tarea padre (TP) con 2 subtareas
      const parentTask = {
        id: 'parent1',
        parentTaskId: null,
        status: TaskStatus.TODO,
        project: { organizationId: 'o1' },
        _count: { subTasks: 2 },
        subTasks: [
          { id: 'sub1', status: TaskStatus.TODO },
          { id: 'sub2', status: TaskStatus.BLOCKED },
        ],
      };
      const refreshedTask = {
        ...parentTask,
        status: TaskStatus.DONE,
        timeEntries: [],
        subTasks: [
          { id: 'sub1', status: TaskStatus.DONE },
          { id: 'sub2', status: TaskStatus.DONE },
        ],
      };

      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      // Tras la cascada, ambas subtareas ya quedaron en DONE
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.DONE },
        { status: TaskStatus.DONE },
      ]);

      // Act: se arrastra la tarjeta padre a la columna "Finalizada"
      const result = await service.updateTaskStatus('p', 'parent1', TaskStatus.DONE, mockUser);

      // Assert: se actualizan TODAS las subtareas al mismo estado destino
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.DONE },
      });
      // El estado de TP se recalcula a partir de las subtareas (todas DONE -> DONE)
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.DONE },
      });
      expect(result.status).toBe(TaskStatus.DONE);
      expect(result.subTasks.every((s: any) => s.status === TaskStatus.DONE)).toBe(true);
    });

    it('should throw ForbiddenException if member tries a restricted status change on a parent task', async () => {
      const parentTask = {
        id: 'parent1',
        parentTaskId: null,
        status: TaskStatus.TODO,
        project: { organizationId: 'o1' },
        subTasks: [{ id: 'sub1', status: TaskStatus.TODO }],
      };
      mockPrismaService.task.findFirst.mockResolvedValueOnce(parentTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: true });

      await expect(
        service.updateTaskStatus('p', 'parent1', TaskStatus.DONE, mockUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.task.updateMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateTaskStatus('p', 'missing', TaskStatus.DONE, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set parent to BLOCKED when any subtask is blocked', async () => {
      // Subtask goes BLOCKED. Parent has another subtask in TODO.
      // Parent should remain TODO, not become BLOCKED.
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.TODO,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.BLOCKED, timeEntries: [], subTasks: [] };

      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });

      // Siblings: one BLOCKED (this one), one still TODO
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.BLOCKED },
        { status: TaskStatus.TODO },
      ]);

      await service.updateTaskStatus('p', 'sub1', TaskStatus.BLOCKED, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.BLOCKED },
      });
    });

    it('should set parent to IN_PROGRESS when some subtasks are DONE but not all', async () => {
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.IN_PROGRESS,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.DONE, timeEntries: [], subTasks: [] };

      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });

      // One sibling DONE (this one), another still TODO
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.DONE },
        { status: TaskStatus.TODO },
      ]);

      await service.updateTaskStatus('p', 'sub1', TaskStatus.DONE, mockUser);

      // Parent must be IN_PROGRESS (some done but not all)
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    });

    it('should set parent to DONE when all subtasks are DONE', async () => {
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.IN_PROGRESS,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.DONE, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.DONE },
        { status: TaskStatus.DONE },
      ]);

      await service.updateTaskStatus('p', 'sub1', TaskStatus.DONE, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.DONE },
      });
    });

    it('should set parent to TODO when all subtasks are pending again', async () => {
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.DONE,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.TODO, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.TODO },
        { status: TaskStatus.TODO },
      ]);

      await service.updateTaskStatus('p', 'sub1', TaskStatus.TODO, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.TODO },
      });
    });

    it('should allow manually reopening a completed subtask without changing siblings', async () => {
      const subtask = {
        id: 'sub1',
        parentTaskId: 'parent1',
        status: TaskStatus.DONE,
        project: { organizationId: 'o1' },
        subTasks: [],
      };
      const refreshedTask = { ...subtask, status: TaskStatus.TODO, timeEntries: [], subTasks: [] };
      mockPrismaService.task.findFirst
        .mockResolvedValueOnce(subtask)
        .mockResolvedValueOnce(refreshedTask);
      (permissions.canEditTaskDetailed as jest.Mock).mockResolvedValue({ canEdit: true, restricted: false });
      mockPrismaService.task.findMany.mockResolvedValue([
        { status: TaskStatus.TODO },
        { status: TaskStatus.DONE },
      ]);

      await service.updateTaskStatus('p', 'sub1', TaskStatus.TODO, mockUser);

      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.TODO },
      });
      expect(mockPrismaService.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'parent1', projectId: 'p', organizationId: 'org-1' },
        data: { status: TaskStatus.IN_PROGRESS },
      });
      expect(mockPrismaService.task.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parentTaskId: 'parent1' }),
        }),
      );
    });
  });

  describe('deleteTask', () => {
    it('should delete task if user can manage project', async () => {
      // Arrange
      (permissions.canManageProject as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue({ id: 't1' });
      mockPrismaService.task.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.deleteTask('p1', 't1', mockUser);

      // Assert
      expect(result.id).toBe('t1');
      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith({
        where: { id: 't1', projectId: 'p1', organizationId: 'org-1' },
      });
      expect(mockPrismaService.task.deleteMany).toHaveBeenCalledWith({
        where: { id: 't1', projectId: 'p1', organizationId: 'org-1' },
      });
    });

    it('should delete a subtask with organization and project scope and sync the parent', async () => {
      (permissions.canManageProject as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue({
        id: 'sub1',
        parentTaskId: 'parent1',
        projectId: 'p1',
        organizationId: 'org-1',
      });
      mockPrismaService.task.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.task.findMany.mockResolvedValue([{ status: TaskStatus.TODO }]);

      const result = await service.deleteTask('p1', 'sub1', mockUser);

      expect(result.id).toBe('sub1');
      expect(mockPrismaService.task.deleteMany).toHaveBeenCalledWith({
        where: { id: 'sub1', projectId: 'p1', organizationId: 'org-1' },
      });
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent1', projectId: 'p1', organizationId: 'org-1', archivedAt: null },
        select: { status: true },
      });
    });

    it('should not delete a subtask outside the active organization', async () => {
      (permissions.canManageProject as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      await expect(service.deleteTask('p1', 'sub-cross-org', mockUser)).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-cross-org', projectId: 'p1', organizationId: 'org-1' },
      });
      expect(mockPrismaService.task.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user cannot manage project', async () => {
      // Arrange
      (permissions.canManageProject as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.deleteTask('p1', 't1', mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if task not found', async () => {
      (permissions.canManageProject as jest.Mock).mockResolvedValue(true);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      await expect(service.deleteTask('p1', 't1', mockUser)).rejects.toThrow(NotFoundException);
    });
  });
});
