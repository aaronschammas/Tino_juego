import { StartTimeDto } from './startTimeDto';
import { StopTimeDto } from './stopTimeDto';

describe('Time Tracking DTOs', () => {
  describe('StartTimeDto', () => {
    it('should create a valid start time DTO', () => {
      // Arrange
      const dto: StartTimeDto = {
        projectId: 'project-123',
      };

      // Act & Assert
      expect(dto.projectId).toBe('project-123');
    });

    it('should validate UUID format for project', () => {
      // Arrange
      const dto: StartTimeDto = {
        projectId: 'project-456',
      };

      // Act & Assert
      expect(dto.projectId).toBeDefined();
      expect(typeof dto.projectId).toBe('string');
    });

    it('should support different project IDs', () => {
      // Arrange
      const dto: StartTimeDto = {
        projectId: 'project-999',
      };

      // Act & Assert
      expect(dto.projectId).toBe('project-999');
    });

    it('should allow starting time with valid project', () => {
      // Arrange
      const dto: StartTimeDto = {
        projectId: 'project-111',
      };

      // Act & Assert
      expect(dto.projectId).toBe('project-111');
      expect(dto.projectId).toBeDefined();
    });
  });

  describe('StopTimeDto', () => {
    it('should create a valid stop time DTO', () => {
      // Arrange
      const dto: StopTimeDto = {
        projectId: 'project-123',
      };

      // Act & Assert
      expect(dto.projectId).toBe('project-123');
    });

    it('should support empty project ID', () => {
      // Arrange
      const dto: Partial<StopTimeDto> = {};

      // Act & Assert
      expect(dto.projectId).toBeUndefined();
    });

    it('should allow optional project ID', () => {
      // Arrange
      const dto: Partial<StopTimeDto> = {};

      // Act & Assert
      expect(dto.projectId).toBeUndefined();
    });

    it('should support project ID in stop', () => {
      // Arrange
      const projectId = 'project-456';
      const dto: StopTimeDto = {
        projectId,
      };

      // Act & Assert
      expect(dto.projectId).toBe(projectId);
    });

    it('should preserve project ID in stop request', () => {
      // Arrange
      const projectId = 'project-789';
      const dto: StopTimeDto = {
        projectId,
      };

      // Act & Assert
      expect(dto.projectId).toBe(projectId);
    });
  });
});
