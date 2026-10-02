import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateTaskStatusDto } from './update-task-status.dto';

describe('UpdateTaskStatusDto', () => {
  describe('Validation', () => {
    it('should validate with TODO status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'TODO',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with IN_PROGRESS status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'IN_PROGRESS',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with DONE status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'DONE',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with BLOCKED status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'BLOCKED',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'INVALID_STATUS',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string status', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 123,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate all valid task statuses', async () => {
      // Arrange
      const validStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

      for (const status of validStatuses) {
        const dto = plainToClass(UpdateTaskStatusDto, { status });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Task Status Updates', () => {
    it('should support marking task as started', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'IN_PROGRESS',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support completing task', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'DONE',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support blocking task', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'BLOCKED',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support reverting to TODO', async () => {
      // Arrange
      const dto = plainToClass(UpdateTaskStatusDto, {
        status: 'TODO',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });
  });
});
