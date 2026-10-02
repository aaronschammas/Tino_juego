import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateProjectDto } from './update-project';

describe('UpdateProjectDto', () => {
  describe('Validation', () => {
    it('should validate with only name', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        name: 'Updated Project Name',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with only description', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        description: 'New description',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with empty object (all optional)', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        name: 'New Name',
        description: 'New Description',
        dueDate: '2025-12-31',
        priority: 'MEDIUM',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept valid priorities', async () => {
      // Arrange
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const priority of priorities) {
        const dto = plainToClass(UpdateProjectDto, {
          priority,
        });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid priority', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        priority: 'INVALID_PRIORITY',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string name', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        name: 12345,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string description', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        description: { invalid: 'object' },
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have all properties as optional', () => {
      // Arrange
      const dto = new UpdateProjectDto();

      // Act & Assert
      expect(dto).toHaveProperty('name');
      expect(dto).toHaveProperty('description');
      expect(dto).toHaveProperty('dueDate');
      expect(dto).toHaveProperty('priority');
    });
  });

  describe('Project Update Scenarios', () => {
    it('should support updating only project name', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        name: 'Renamed Project',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support partial updates', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        description: 'Updated description only',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support updating deadline', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        dueDate: '2025-06-30',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support updating priority', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        priority: 'CRITICAL',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support simultaneous multiple field updates', async () => {
      // Arrange
      const dto = plainToClass(UpdateProjectDto, {
        name: 'Completely Updated',
        description: 'All fields updated',
        priority: 'HIGH',
        dueDate: '2025-08-15',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support clearing fields with partial update', async () => {
      // Arrange - simulates scenario where we only update name
      const dto = plainToClass(UpdateProjectDto, {
        name: 'New Name',
        // description, dueDate, and priority remain undefined
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
      expect(dto.description).toBeUndefined();
    });
  });
});
