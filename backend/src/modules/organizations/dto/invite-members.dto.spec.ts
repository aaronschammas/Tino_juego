import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { InviteMembersDto } from './invite-members.dto';

describe('InviteMembersDto', () => {
  describe('Validation', () => {
    it('should validate a valid invite with default role', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'user@example.com',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'not-an-email',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate various email formats', async () => {
      // Arrange
      const validEmails = [
        'user@example.com',
        'first.last@example.co.uk',
        'user+tag@example.com',
        'test123@sub.example.org',
      ];

      for (const email of validEmails) {
        const dto = plainToClass(InviteMembersDto, { email });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject empty email', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: '',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string email', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 12345,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept optional role parameter', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'user@example.com',
        role: 'ORG_MEMBER',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept optional projectIds', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'user@example.com',
        projectIds: ['proj-1', 'proj-2'],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject projectIds that is not an array', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'user@example.com',
        projectIds: 'proj-1',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string items in projectIds', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'user@example.com',
        projectIds: [123, 456],
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have required properties', () => {
      // Arrange
      const dto = new InviteMembersDto();

      // Act & Assert
      expect(dto).toHaveProperty('email');
    });

    it('should have optional properties', () => {
      // Arrange
      const dto = new InviteMembersDto();

      // Act & Assert
      expect(dto).toHaveProperty('role');
      expect(dto).toHaveProperty('projectIds');
    });

    it('should initialize projectIds with empty array by default', () => {
      // Arrange
      const dto = new InviteMembersDto();

      // Act & Assert
      expect(Array.isArray(dto.projectIds)).toBe(true);
      expect(dto.projectIds).toHaveLength(0);
    });
  });

  describe('Invite Scenarios', () => {
    it('should support inviting user to organization only', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'newuser@example.com',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support inviting user with specific role', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'admin@example.com',
        role: 'ORG_MEMBER',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support inviting user to projects', async () => {
      // Arrange
      const dto = plainToClass(InviteMembersDto, {
        email: 'dev@example.com',
        projectIds: ['project-backend', 'project-frontend'],
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });
  });
});
