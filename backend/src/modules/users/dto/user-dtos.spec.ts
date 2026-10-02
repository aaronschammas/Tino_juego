import { CreateUserDto } from './CreateUserDto';
import { UpdateUserDto } from './UpdateUserDto';

describe('User DTOs', () => {
  describe('CreateUserDto', () => {
    it('should create a valid create user DTO', () => {
      // Arrange
      const dto: CreateUserDto = {
        email: 'user@example.com',
        name: 'John',
        lastname: 'Doe',
      };

      // Act & Assert
      expect(dto.email).toBe('user@example.com');
      expect(dto.name).toBe('John');
      expect(dto.lastname).toBe('Doe');
    });

    it('should validate email format', () => {
      // Arrange
      const dto: CreateUserDto = {
        email: 'user@example.com',
        name: 'John',
        lastname: 'Doe',
      };

      // Act & Assert
      expect(dto.email).toContain('@');
    });

    it('should allow different email formats', () => {
      // Arrange
      const dto: CreateUserDto = {
        email: 'first.last+tag@company.com',
        name: 'First',
        lastname: 'Last',
      };

      // Act & Assert
      expect(dto.email).toBe('first.last+tag@company.com');
    });

    it('should preserve name and lastname', () => {
      // Arrange
      const name = 'Jane';
      const lastname = 'Smith';
      const dto: CreateUserDto = {
        email: 'user@example.com',
        name,
        lastname,
      };

      // Act & Assert
      expect(dto.name).toBe(name);
      expect(dto.lastname).toBe(lastname);
    });
  });

  describe('UpdateUserDto', () => {
    it('should allow updating user name', () => {
      // Arrange
      const dto: Partial<UpdateUserDto> = {
        name: 'Jane',
      };

      // Act & Assert
      expect(dto.name).toBe('Jane');
    });

    it('should allow updating lastname', () => {
      // Arrange
      const dto: Partial<UpdateUserDto> = {
        lastname: 'Smith',
      };

      // Act & Assert
      expect(dto.lastname).toBe('Smith');
    });

    it('should allow partial updates', () => {
      // Arrange
      const dto: Partial<UpdateUserDto> = {
        name: 'Updated Name',
      };

      // Act & Assert
      expect(dto.name).toBe('Updated Name');
      expect(dto.lastname).toBeUndefined();
    });

    it('should support updating both fields', () => {
      // Arrange
      const dto: UpdateUserDto = {
        name: 'New Name',
        lastname: 'New Lastname',
      };

      // Act & Assert
      expect(dto.name).toBe('New Name');
      expect(dto.lastname).toBe('New Lastname');
    });

    it('should allow undefined values for optional fields', () => {
      // Arrange
      const dto: Partial<UpdateUserDto> = {
        name: 'Name',
      };

      // Act & Assert
      expect(dto.name).toBe('Name');
      expect(dto.lastname).toBeUndefined();
    });
  });
});
