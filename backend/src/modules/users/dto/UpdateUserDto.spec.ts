import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateUserDto } from './UpdateUserDto';

describe('UpdateUserDto', () => {
  describe('Validation', () => {
    it('should validate empty object (all optional)', async () => {
      const dto = plainToClass(UpdateUserDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with email only', async () => {
      const dto = plainToClass(UpdateUserDto, {
        email: 'newemail@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with name only', async () => {
      const dto = plainToClass(UpdateUserDto, { name: 'UpdatedName' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with lastname only', async () => {
      const dto = plainToClass(UpdateUserDto, { lastname: 'UpdatedLast' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields', async () => {
      const dto = plainToClass(UpdateUserDto, {
        email: 'updated@example.com',
        name: 'UpdatedName',
        lastname: 'UpdatedLast',
        password: 'newpass123',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate password only when updating credentials', async () => {
      const dto = plainToClass(UpdateUserDto, { password: 'secure123' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject short passwords', async () => {
      const dto = plainToClass(UpdateUserDto, { password: '123' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate multiple field update', async () => {
      const dto = plainToClass(UpdateUserDto, {
        name: 'John',
        lastname: 'Smith',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const dto = plainToClass(UpdateUserDto, {
        email: 'not-an-email',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string name', async () => {
      const dto = plainToClass(UpdateUserDto, { name: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string lastname', async () => {
      const dto = plainToClass(UpdateUserDto, { lastname: 456 });
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
        const dto = plainToClass(UpdateUserDto, { email });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept unicode names', async () => {
      const dto = plainToClass(UpdateUserDto, {
        name: 'José',
        lastname: 'García',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject decorative unicode lookalike characters in name', async () => {
      const dto = plainToClass(UpdateUserDto, {
        name: '𝔇𝔯𝔢𝔯',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('User Update Scenarios', () => {
    it('should support email update only', async () => {
      const dto = plainToClass(UpdateUserDto, {
        email: 'newemail@example.com',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support name update', async () => {
      const dto = plainToClass(UpdateUserDto, { name: 'NewName' });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support profile update', async () => {
      const dto = plainToClass(UpdateUserDto, {
        name: 'Jane',
        lastname: 'Doe',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support full user update', async () => {
      const dto = plainToClass(UpdateUserDto, {
        email: 'jane@example.com',
        name: 'Jane',
        lastname: 'Smith',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support clearing updates', async () => {
      const dto = plainToClass(UpdateUserDto, {});
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
      expect(dto.email).toBeUndefined();
      expect(dto.name).toBeUndefined();
      expect(dto.lastname).toBeUndefined();
    });
  });
});
