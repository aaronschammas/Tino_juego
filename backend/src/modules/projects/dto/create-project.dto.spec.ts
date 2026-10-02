import { CreateProjectDto } from './create-project';
import { UpdateProjectDto } from './update-project';

describe('Project DTOs', () => {
  describe('CreateProjectDto', () => {
    it('should create a valid create project DTO', () => {
      // Arrange
      const dto: CreateProjectDto = {
        name: 'New Project',
        description: 'A new project for testing',
      };

      // Act & Assert
      expect(dto.name).toBe('New Project');
      expect(dto.description).toBe('A new project for testing');
    });

    it('should allow creation without description', () => {
      // Arrange
      const dto: CreateProjectDto = {
        name: 'Minimal Project',
      };

      // Act & Assert
      expect(dto.name).toBe('Minimal Project');
      expect(dto.description).toBeUndefined();
    });

    it('should preserve empty string description', () => {
      // Arrange
      const dto: CreateProjectDto = {
        name: 'Project',
        description: '',
      };

      // Act & Assert
      expect(dto.description).toBe('');
    });

    it('should support long descriptions', () => {
      // Arrange
      const longDescription = 'A'.repeat(500);
      const dto: CreateProjectDto = {
        name: 'Project',
        description: longDescription,
      };

      // Act & Assert
      expect(dto.description?.length).toBe(500);
    });
  });

  describe('UpdateProjectDto', () => {
    it('should allow partial updates with name only', () => {
      // Arrange
      const dto: Partial<UpdateProjectDto> = {
        name: 'Updated Name',
      };

      // Act & Assert
      expect(dto.name).toBe('Updated Name');
      expect(dto.description).toBeUndefined();
    });

    it('should allow partial updates with description only', () => {
      // Arrange
      const dto: Partial<UpdateProjectDto> = {
        description: 'New description',
      };

      // Act & Assert
      expect(dto.description).toBe('New description');
      expect(dto.name).toBeUndefined();
    });

    it('should allow updating both name and description', () => {
      // Arrange
      const dto: UpdateProjectDto = {
        name: 'New Name',
        description: 'New Description',
      };

      // Act & Assert
      expect(dto.name).toBe('New Name');
      expect(dto.description).toBe('New Description');
    });

    it('should allow null values for optional fields', () => {
      // Arrange
      const dto: Partial<UpdateProjectDto> = {
        name: 'Name',
        description: undefined,
      };

      // Act & Assert
      expect(dto.name).toBe('Name');
      expect(dto.description).toBeUndefined();
    });
  });
});
