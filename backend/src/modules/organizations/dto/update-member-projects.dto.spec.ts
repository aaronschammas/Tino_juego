import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateMemberProjectsDto } from './update-member-projects.dto';

describe('UpdateMemberProjectsDto', () => {
  describe('Validation', () => {
    it('should validate with single project', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['project-001'],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with multiple projects', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['project-001', 'project-002', 'project-003'],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with empty project array', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: [],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array projectIds', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: 'project-001',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string items in array', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['project-001', 123],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing projectIds', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject null projectIds', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: null,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept array of UUIDs', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        ],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate large number of projects', async () => {
      // Arrange
      const projectIds = Array.from({ length: 100 }, (_, i) =>
        `project-${i}`.padEnd(20, '0'),
      );
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have projectIds property', () => {
      // Arrange
      const dto = new UpdateMemberProjectsDto();

      // Act & Assert
      expect(dto).toHaveProperty('projectIds');
    });

    it('should allow setting projectIds', () => {
      // Arrange
      const dto = new UpdateMemberProjectsDto();
      dto.projectIds = ['proj-1', 'proj-2'];

      // Act & Assert
      expect(dto.projectIds).toEqual(['proj-1', 'proj-2']);
    });

    it('should allow assignment of new array', () => {
      // Arrange
      const dto = new UpdateMemberProjectsDto();
      const newProjects = ['new-proj-1', 'new-proj-2', 'new-proj-3'];

      // Act
      dto.projectIds = newProjects;

      // Assert
      expect(dto.projectIds).toEqual(newProjects);
      expect(dto.projectIds.length).toBe(3);
    });
  });

  describe('Project Management Scenarios', () => {
    it('should support removing all projects', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: [],
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
      expect(dto.projectIds.length).toBe(0);
    });

    it('should support adding member to single project', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['backend-service'],
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support adding member to multiple projects', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['frontend', 'backend', 'mobile', 'devops'],
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support unique project IDs', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberProjectsDto, {
        projectIds: ['proj-1', 'proj-2', 'proj-3', 'proj-1'], // Duplicate
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true); // Validator doesn't check uniqueness
      expect(dto.projectIds.length).toBe(4);
    });
  });
});
