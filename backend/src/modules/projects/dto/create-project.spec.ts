import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateProjectDto } from './create-project';

describe('CreateProjectDto', () => {
  describe('Validation', () => {
    it('should validate with required name only', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'My Project',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject missing name', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept with description', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Project Name',
        description: 'Detailed project description',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with dueDate', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Project Name',
        dueDate: '2025-12-31',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept with priority', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Project Name',
        priority: 'HIGH',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept all valid priorities', async () => {
      // Arrange
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const priority of priorities) {
        const dto = plainToClass(CreateProjectDto, {
          name: 'Project',
          priority,
        });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept complete project data', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Complete Project',
        description: 'Full project setup',
        dueDate: '2025-06-30',
        priority: 'HIGH',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string name', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 123,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid priority', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Project',
        priority: 'INVALID',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have all properties', () => {
      // Arrange
      const dto = new CreateProjectDto();

      // Act & Assert
      expect(dto).toHaveProperty('name');
      expect(dto).toHaveProperty('description');
      expect(dto).toHaveProperty('dueDate');
      expect(dto).toHaveProperty('priority');
    });
  });

  describe('Project Creation Scenarios', () => {
    it('should support minimal project', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Simple Project',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support full project details', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Advanced Project',
        description: 'Complex project with full details',
        dueDate: '2025-12-31',
        priority: 'HIGH',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support project with deadline only', async () => {
      // Arrange
      const dto = plainToClass(CreateProjectDto, {
        name: 'Deadline Project',
        dueDate: '2025-09-15',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });
  });
});
