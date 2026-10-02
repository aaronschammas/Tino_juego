import { CreateTaskDto } from './createTaskDto';
import { UpdateTaskDto } from './updateTaskDto';
import { UpdateTaskStatusDto } from './update-task-status.dto';

describe('Task DTOs', () => {
  describe('CreateTaskDto', () => {
    it('should create a valid create task DTO', () => {
      // Arrange
      const dto: CreateTaskDto = {
        title: 'New Task',
        description: 'Task description',
      };

      // Act & Assert
      expect(dto.title).toBe('New Task');
      expect(dto.description).toBe('Task description');
    });

    it('should allow tasks with priority', () => {
      // Arrange
      const dto: CreateTaskDto = {
        title: 'High Priority Task',
        description: 'Critical task',
        priority: 'HIGH',
      };

      // Act & Assert
      expect(dto.priority).toBe('HIGH');
    });

    it('should allow tasks with assignee', () => {
      // Arrange
      const dto: CreateTaskDto = {
        title: 'Task',
        assignedToId: 'user-123',
      };

      // Act & Assert
      expect(dto.assignedToId).toBe('user-123');
    });

    it('should allow tasks with due date', () => {
      // Arrange
      const dueDate = new Date('2025-12-31');
      const dto: CreateTaskDto = {
        title: 'Task with deadline',
        dueDate,
      };

      // Act & Assert
      expect(dto.dueDate).toEqual(dueDate);
    });
  });

  describe('UpdateTaskDto', () => {
    it('should allow updating task title', () => {
      // Arrange
      const dto: Partial<UpdateTaskDto> = {
        title: 'Updated Title',
      };

      // Act & Assert
      expect(dto.title).toBe('Updated Title');
    });

    it('should allow updating task description', () => {
      // Arrange
      const dto: Partial<UpdateTaskDto> = {
        description: 'Updated description',
      };

      // Act & Assert
      expect(dto.description).toBe('Updated description');
    });

    it('should allow updating priority', () => {
      // Arrange
      const dto: Partial<UpdateTaskDto> = {
        priority: 'MEDIUM',
      };

      // Act & Assert
      expect(dto.priority).toBe('MEDIUM');
    });

    it('should allow updating assignee', () => {
      // Arrange
      const dto: Partial<UpdateTaskDto> = {
        assignedToId: 'user-456',
      };

      // Act & Assert
      expect(dto.assignedToId).toBe('user-456');
    });

    it('should allow updating due date', () => {
      // Arrange
      const newDueDate = new Date('2025-06-30');
      const dto: Partial<UpdateTaskDto> = {
        dueDate: newDueDate,
      };

      // Act & Assert
      expect(dto.dueDate).toEqual(newDueDate);
    });

    it('should allow multiple field updates', () => {
      // Arrange
      const dto: UpdateTaskDto = {
        title: 'New Title',
        description: 'New Description',
        priority: 'LOW',
        assignedToId: 'user-789',
      };

      // Act & Assert
      expect(dto.title).toBe('New Title');
      expect(dto.description).toBe('New Description');
      expect(dto.priority).toBe('LOW');
      expect(dto.assignedToId).toBe('user-789');
    });
  });

  describe('UpdateTaskStatusDto', () => {
    it('should create a valid status update DTO', () => {
      // Arrange
      const dto: UpdateTaskStatusDto = {
        status: 'IN_PROGRESS',
      };

      // Act & Assert
      expect(dto.status).toBe('IN_PROGRESS');
    });

    it('should support DONE status', () => {
      // Arrange
      const dto: UpdateTaskStatusDto = {
        status: 'DONE',
      };

      // Act & Assert
      expect(dto.status).toBe('DONE');
    });

    it('should support BLOCKED status', () => {
      // Arrange
      const dto: UpdateTaskStatusDto = {
        status: 'BLOCKED',
      };

      // Act & Assert
      expect(dto.status).toBe('BLOCKED');
    });

    it('should support TODO status', () => {
      // Arrange
      const dto: UpdateTaskStatusDto = {
        status: 'TODO',
      };

      // Act & Assert
      expect(dto.status).toBe('TODO');
    });
  });
});
