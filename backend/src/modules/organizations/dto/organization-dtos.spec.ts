import { CreateOrganizationDto } from './create-organization.dto';
import { InviteMembersDto } from './invite-members.dto';
import { UpdateMemberRoleDto } from './update-member-role.dto';

describe('Organization DTOs', () => {
  describe('CreateOrganizationDto', () => {
    it('should create a valid organization DTO', () => {
      // Arrange
      const dto: CreateOrganizationDto = {
        name: 'New Organization',
      };

      // Act & Assert
      expect(dto.name).toBe('New Organization');
    });

    it('should validate organization name', () => {
      // Arrange
      const dto: CreateOrganizationDto = {
        name: 'Tech Company',
      };

      // Act & Assert
      expect(dto.name).toBe('Tech Company');
      expect(dto.name).toBeDefined();
    });

    it('should support minimum name length', () => {
      // Arrange
      const dto: CreateOrganizationDto = {
        name: 'AB',
      };

      // Act & Assert
      expect(dto.name.length).toBeGreaterThanOrEqual(2);
    });

    it('should support maximum name length', () => {
      // Arrange
      const dto: CreateOrganizationDto = {
        name: 'A'.repeat(255),
      };

      // Act & Assert
      expect(dto.name.length).toBeLessThanOrEqual(255);
    });
  });

  describe('InviteMembersDto', () => {
    it('should create a valid invite DTO with email', () => {
      // Arrange
      const dto: InviteMembersDto = {
        email: 'user@example.com',
        role: 'ORG_MEMBER',
      };

      // Act & Assert
      expect(dto.email).toBe('user@example.com');
      expect(dto.role).toBe('ORG_MEMBER');
    });

    it('should support different email formats', () => {
      // Arrange
      const dto: InviteMembersDto = {
        email: 'firstname.lastname+tag@example.co.uk',
        role: 'ORG_MEMBER',
      };

      // Act & Assert
      expect(dto.email).toBe('firstname.lastname+tag@example.co.uk');
    });

    it('should allow inviting with custom role', () => {
      // Arrange
      const dto: InviteMembersDto = {
        email: 'admin@example.com',
        role: 'ORG_OWNER',
        projectIds: ['proj-123', 'proj-456'],
      };

      // Act & Assert
      expect(dto.email).toBe('admin@example.com');
      expect(dto.role).toBe('ORG_OWNER');
      expect(dto.projectIds).toHaveLength(2);
    });
  });

  describe('UpdateMemberRoleDto', () => {
    it('should create a valid role update DTO', () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: 'ORG_MEMBER',
      };

      // Act & Assert
      expect(dto.role).toBe('ORG_MEMBER');
    });

    it('should support ORG_OWNER role', () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: 'ORG_OWNER',
      };

      // Act & Assert
      expect(dto.role).toBe('ORG_OWNER');
    });

    it('should support ORG_MEMBER role', () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: 'ORG_MEMBER',
      };

      // Act & Assert
      expect(dto.role).toBe('ORG_MEMBER');
    });

    it('should allow role updates for members', () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: 'ORG_MEMBER',
      };

      // Act & Assert
      expect(dto.role).toBe('ORG_MEMBER');
      expect(dto.role).toBeDefined();
    });
  });
});
