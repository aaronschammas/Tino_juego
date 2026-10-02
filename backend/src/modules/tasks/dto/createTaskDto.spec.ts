import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateTaskDto } from './createTaskDto';

describe('CreateTaskDto', () => {
  describe('Validation', () => {
    it('should validate with required title only', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'New Task',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject missing title', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string title', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 123,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept with description', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task with Description',
        description: 'This is a detailed task description',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with status', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        status: 'TODO',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with priority', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        priority: 'HIGH',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with dueDate', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        dueDate: '2025-12-31',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with parentTaskId (subtask)', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Subtask',
        parentTaskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept complete task data', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Complete Task',
        description: 'Full task details',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        dueDate: '2025-06-30',
        parentTaskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        status: 'INVALID_STATUS',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid priority', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        priority: 'INVALID_PRIORITY',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid parentTaskId (non-UUID)', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        parentTaskId: 'not-a-uuid',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Task Creation Scenarios', () => {
    it('should support simple task creation', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Simple Task',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support task with deadline', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Deadline Task',
        dueDate: '2025-09-15',
        priority: 'HIGH',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support creating subtask', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Subtask',
        parentTaskId: '550e8400-e29b-41d4-a716-446655440000',
        priority: 'MEDIUM',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support creating task with initial status', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'In Progress Task',
        status: 'IN_PROGRESS',
        description: 'Already being worked on',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('description limit', () => {
    const EXPECTED_MESSAGE =
      'La descripción no puede exceder 1,000 caracteres. Máximo de caracteres alcanzado.';

    it('should accept a description at the maximum length', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        description: 'a'.repeat(1000),
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject a description one character above the maximum', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, {
        title: 'Task',
        description: 'a'.repeat(1001),
      });

      // Act
      const errors = await validate(dto);
      const descriptionError = errors.find((error) => error.property === 'description');

      // Assert
      expect(descriptionError).toBeDefined();
      expect(Object.values(descriptionError!.constraints ?? {})).toContain(EXPECTED_MESSAGE);
    });

    it('should still allow omitting the description', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, { title: 'Task' });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });

  describe('estimatedHours', () => {
    it('should still allow omitting estimated hours', async () => {
      // Arrange
      const dto = plainToClass(CreateTaskDto, { title: 'Task' });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });
});
