import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AcceptInviteDto } from './accept-invite.dto';

describe('AcceptInviteDto', () => {
  describe('Validation', () => {
    it('should validate a complete valid invite', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'ValidPassword123',
        name: 'John',
        lastname: 'Doe',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject password with less than 6 characters', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: '12345',
        name: 'John',
        lastname: 'Doe',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'password')).toBe(true);
    });

    it('should reject non-string password', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 123456,
        name: 'John',
        lastname: 'Doe',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty name', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'ValidPassword123',
        name: '',
        lastname: 'Doe',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty lastname', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'ValidPassword123',
        name: 'John',
        lastname: '',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept minimum valid password (6 chars)', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: '123456',
        name: 'J',
        lastname: 'D',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should accept long names and passwords', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'VeryLongPasswordWithManyCharacters1234567890',
        name: 'Alejandro',
        lastname: 'Constantinopolis',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject decorative unicode lookalike characters in name', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'ValidPassword123',
        name: '𝔇𝔯𝔢𝔯',
        lastname: 'Doe',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters in names', async () => {
      // Arrange
      const dto = plainToClass(AcceptInviteDto, {
        password: 'ValidPassword123',
        name: 'José',
        lastname: 'García',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });
  });

  describe('DTO Structure', () => {
    it('should have required properties', () => {
      // Arrange
      const dto = new AcceptInviteDto();

      // Act & Assert
      expect(dto).toHaveProperty('password');
      expect(dto).toHaveProperty('name');
      expect(dto).toHaveProperty('lastname');
    });

    it('should allow setting properties', () => {
      // Arrange
      const dto = new AcceptInviteDto();
      dto.password = 'Test123456';
      dto.name = 'Test';
      dto.lastname = 'User';

      // Act & Assert
      expect(dto.password).toBe('Test123456');
      expect(dto.name).toBe('Test');
      expect(dto.lastname).toBe('User');
    });
  });
});
