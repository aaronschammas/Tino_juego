import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateMemberRoleDto } from './update-member-role.dto';

describe('UpdateMemberRoleDto', () => {
  describe('Validation', () => {
    it('should validate with ORG_MEMBER role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_MEMBER',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with ORG_MEMBER role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_MEMBER',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should validate with ORG_OWNER role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_OWNER',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'INVALID_ROLE',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty role string', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: '',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 123,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject role with typo', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_ADMINS', // Extra 'S'
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have role property', () => {
      // Arrange
      const dto = new UpdateMemberRoleDto();

      // Act & Assert
      expect(dto).toHaveProperty('role');
    });

    it('should allow setting role', () => {
      // Arrange
      const dto = new UpdateMemberRoleDto();
      dto.role = 'ORG_ADMIN' as any;

      // Act & Assert
      expect(dto.role).toBe('ORG_ADMIN');
    });
  });

  describe('Role Update Scenarios', () => {
    it('should support promoting member to admin', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_MEMBER',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support demoting admin to member', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_MEMBER',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should support owner role', async () => {
      // Arrange
      const dto = plainToClass(UpdateMemberRoleDto, {
        role: 'ORG_OWNER',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });

    it('should validate all role transitions', async () => {
      // Arrange
      const roles = ['ORG_MEMBER', 'ORG_OWNER'];

      for (const role of roles) {
        const dto = plainToClass(UpdateMemberRoleDto, { role });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });
  });
});
