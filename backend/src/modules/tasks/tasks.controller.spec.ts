import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/createTaskDto';
import { UpdateTaskDto } from './dto/updateTaskDto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

describe('TasksController', () => {
  let controller: TasksController;
  const scopedUser = { id: 'user-123', organizationId: 'org-123' };

  const mockTasksService = {
    createTask: jest.fn(),
    getTasksByProject: jest.fn(),
    getTaskById: jest.fn(),
    updateTask: jest.fn(),
    updateTaskStatus: jest.fn(),
    deleteTask: jest.fn(),
  };

  const mockActiveOrganizationService = {
    resolveScopedUser: jest.fn((user: { id: string }) => ({
      ...user,
      organizationId: 'org-123',
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
        {
          provide: ActiveOrganizationService,
          useValue: mockActiveOrganizationService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  describe('POST /projects/:projectId/tasks', () => {
    it('should create a new task', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const createTaskDto: CreateTaskDto = {
        title: 'New Task',
        description: 'Task description',
        status: 'TODO',
        priority: 'HIGH',
      };

      const expectedTask = {
        id: 'task-123',
        projectId,
        ...createTaskDto,
        createdAt: new Date(),
      };

      mockTasksService.createTask.mockResolvedValue(expectedTask);

      // Act
      const result = await controller.createTask(
        projectId,
        createTaskDto,
        currentUser,
      );
      expect(
        mockActiveOrganizationService.resolveScopedUser,
      ).toHaveBeenCalledWith(currentUser, undefined);

      // Assert
      expect(result).toEqual(expectedTask);
      expect(mockTasksService.createTask).toHaveBeenCalledWith(
        projectId,
        createTaskDto,
        scopedUser,
      );
    });

    it('should handle task creation errors', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const createTaskDto: CreateTaskDto = {
        title: 'Error Task',
      };

      const error = new Error('Project not found');
      mockTasksService.createTask.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createTask(projectId, createTaskDto, currentUser),
      ).rejects.toThrow('Project not found');
    });
  });

  describe('GET /projects/:projectId/tasks', () => {
    it('should get all tasks for a project', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const expectedTasks = [
        { id: 'task-1', title: 'Task 1', status: 'TODO' },
        { id: 'task-2', title: 'Task 2', status: 'IN_PROGRESS' },
        { id: 'task-3', title: 'Task 3', status: 'DONE' },
      ];

      mockTasksService.getTasksByProject.mockResolvedValue(expectedTasks);

      // Act
      const result = await controller.getTasksByProject(projectId, currentUser);

      // Assert
      expect(result).toEqual(expectedTasks);
      expect(mockTasksService.getTasksByProject).toHaveBeenCalledWith(
        projectId,
        scopedUser,
      );
    });

    it('should return empty array if no tasks', async () => {
      // Arrange
      const projectId = 'empty-project';
      const currentUser = { id: 'user-123' };

      mockTasksService.getTasksByProject.mockResolvedValue([]);

      // Act
      const result = await controller.getTasksByProject(projectId, currentUser);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle errors when fetching tasks', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const error = new Error('Database error');

      mockTasksService.getTasksByProject.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getTasksByProject(projectId, currentUser),
      ).rejects.toThrow('Database error');
    });
  });

  describe('GET /projects/:projectId/tasks/:taskId', () => {
    it('should get task by id', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const expectedTask = {
        id: taskId,
        projectId,
        title: 'Task Details',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
      };

      mockTasksService.getTaskById.mockResolvedValue(expectedTask);

      // Act
      const result = await controller.getTaskById(
        projectId,
        taskId,
        currentUser,
      );

      // Assert
      expect(result).toEqual(expectedTask);
      expect(mockTasksService.getTaskById).toHaveBeenCalledWith(
        projectId,
        taskId,
        scopedUser,
      );
    });

    it('should handle non-existent task', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'non-existent';
      const currentUser = { id: 'user-123' };

      mockTasksService.getTaskById.mockResolvedValue(null);

      // Act
      const result = await controller.getTaskById(
        projectId,
        taskId,
        currentUser,
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('PATCH /projects/:projectId/tasks/:taskId', () => {
    it('should update task', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const updateTaskDto: UpdateTaskDto = {
        title: 'Updated Title',
        priority: 'LOW',
      };

      const updatedTask = {
        id: taskId,
        projectId,
        ...updateTaskDto,
        status: 'TODO',
      };

      mockTasksService.updateTask.mockResolvedValue(updatedTask);

      // Act
      const result = await controller.updateTask(
        projectId,
        taskId,
        updateTaskDto,
        scopedUser,
      );

      // Assert
      expect(result).toEqual(updatedTask);
      expect(mockTasksService.updateTask).toHaveBeenCalledWith(
        projectId,
        taskId,
        updateTaskDto,
        scopedUser,
      );
    });

    it('should support partial updates', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const updateTaskDto: UpdateTaskDto = {
        title: 'Only Title Updated',
      };

      const updatedTask = {
        id: taskId,
        projectId,
        title: 'Only Title Updated',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      };

      mockTasksService.updateTask.mockResolvedValue(updatedTask);

      // Act
      const result = await controller.updateTask(
        projectId,
        taskId,
        updateTaskDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(updatedTask);
      expect(mockTasksService.updateTask).toHaveBeenCalledWith(
        projectId,
        taskId,
        updateTaskDto,
        scopedUser,
      );
    });
  });

  describe('PATCH /projects/:projectId/tasks/:taskId/status', () => {
    it('should update task status', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const updateStatusDto: UpdateTaskStatusDto = {
        status: 'IN_PROGRESS',
      };

      const updatedTask = {
        id: taskId,
        projectId,
        title: 'Task',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      };

      mockTasksService.updateTaskStatus.mockResolvedValue(updatedTask);

      // Act
      const result = await controller.updateTaskStatus(
        projectId,
        taskId,
        updateStatusDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(updatedTask);
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledWith(
        projectId,
        taskId,
        'IN_PROGRESS',
        scopedUser,
      );
    });

    it('should transition task to BLOCKED status', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const updateStatusDto: UpdateTaskStatusDto = {
        status: 'BLOCKED',
      };

      const blockedTask = {
        id: taskId,
        status: 'BLOCKED',
      };

      mockTasksService.updateTaskStatus.mockResolvedValue(blockedTask);

      // Act
      const result = await controller.updateTaskStatus(
        projectId,
        taskId,
        updateStatusDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(expect.objectContaining({ status: 'BLOCKED' }));
    });

    it('should transition task to DONE status', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const updateStatusDto: UpdateTaskStatusDto = {
        status: 'DONE',
      };

      const completedTask = {
        id: taskId,
        status: 'DONE',
      };

      mockTasksService.updateTaskStatus.mockResolvedValue(completedTask);

      // Act
      const result = await controller.updateTaskStatus(
        projectId,
        taskId,
        updateStatusDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(expect.objectContaining({ status: 'DONE' }));
    });

    it('should handle invalid status transitions', async () => {
      // Arrange
      const projectId = 'project-123';
      const taskId = 'task-123';
      const currentUser = { id: 'user-123' };
      const updateStatusDto: UpdateTaskStatusDto = {
        status: 'DONE',
      };

      const error = new Error('Invalid status transition');
      mockTasksService.updateTaskStatus.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.updateTaskStatus(
          projectId,
          taskId,
          updateStatusDto,
          currentUser,
        ),
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('Integration', () => {
    it('should handle complete task lifecycle', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };

      // Create task
      const createTaskDto: CreateTaskDto = {
        title: 'New Task',
        priority: 'HIGH',
      };

      const newTask = {
        id: 'task-123',
        projectId,
        ...createTaskDto,
        status: 'TODO',
      };

      mockTasksService.createTask.mockResolvedValue(newTask);
      const created = await controller.createTask(
        projectId,
        createTaskDto,
        currentUser,
      );
      expect(created).toEqual(expect.objectContaining({ id: 'task-123' }));

      // Get task
      mockTasksService.getTaskById.mockResolvedValue(newTask);
      const retrieved = await controller.getTaskById(
        projectId,
        'task-123',
        currentUser,
      );
      expect(retrieved).toEqual(expect.objectContaining({ status: 'TODO' }));

      // Update task
      const updateDto: UpdateTaskDto = { title: 'Updated Title' };
      const updated = { ...newTask, title: 'Updated Title' };
      mockTasksService.updateTask.mockResolvedValue(updated);
      const updateResult = await controller.updateTask(
        projectId,
        'task-123',
        updateDto,
        currentUser,
      );
      expect(updateResult).toEqual(
        expect.objectContaining({ title: 'Updated Title' }),
      );

      // Update status
      const statusDto: UpdateTaskStatusDto = { status: 'IN_PROGRESS' };
      const inProgress = { ...newTask, status: 'IN_PROGRESS' };
      mockTasksService.updateTaskStatus.mockResolvedValue(inProgress);
      const statusResult = await controller.updateTaskStatus(
        projectId,
        'task-123',
        statusDto,
        currentUser,
      );
      expect(statusResult).toEqual(
        expect.objectContaining({ status: 'IN_PROGRESS' }),
      );
    });
  });
});
