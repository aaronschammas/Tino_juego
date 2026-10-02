import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateUserDto } from './CreateUserDto';

describe('CreateUserDto', () => {
  describe('Validation', () => {
    it('should validate complete user data', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 'John',
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'not-an-email',
        name: 'John',
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing email', async () => {
      const dto = plainToClass(CreateUserDto, {
        name: 'John',
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing name', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing lastname', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 'John',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string name', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 123,
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string lastname', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 'John',
        lastname: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept various email formats', async () => {
      const emails = [
        'user@example.com',
        'first.last@company.co.uk',
        'user+tag@example.org',
      ];
      for (const email of emails) {
        const dto = plainToClass(CreateUserDto, {
          email,
          name: 'Test',
          lastname: 'User',
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept unicode names', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 'José',
        lastname: 'García',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject decorative unicode lookalike characters in name', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: '𝔇𝔯𝔢𝔯',
        lastname: 'Doe',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept long names', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.com',
        name: 'Alejandro',
        lastname: 'Constantinopolis',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('User Creation Scenarios', () => {
    it('should support basic user registration', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'newuser@example.com',
        name: 'Jane',
        lastname: 'Smith',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support international emails', async () => {
      const dto = plainToClass(CreateUserDto, {
        email: 'user@example.co.uk',
        name: 'User',
        lastname: 'International',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });
  });
});
