import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AddMemberDto } from './add-member.dto';

describe('AddMemberDto', () => {
  describe('Validation', () => {
    it('should validate with valid UUID', async () => {
      // Arrange
      const dto = plainToClass(AddMemberDto, {
        userIdToAdd: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors).toHaveLength(0);
    });

    it('should reject non-UUID string', async () => {
      // Arrange
      const dto = plainToClass(AddMemberDto, {
        userIdToAdd: 'not-a-uuid',
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing userIdToAdd', async () => {
      // Arrange
      const dto = plainToClass(AddMemberDto, {});

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string userIdToAdd', async () => {
      // Arrange
      const dto = plainToClass(AddMemberDto, {
        userIdToAdd: 123,
      });

      // Act
      const errors = await validate(dto);

      // Assert
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept various valid UUID formats', async () => {
      // Arrange
      const validUuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      for (const uuid of validUuids) {
        const dto = plainToClass(AddMemberDto, {
          userIdToAdd: uuid,
        });

        // Act
        const errors = await validate(dto);

        // Assert
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('DTO Structure', () => {
    it('should have userIdToAdd property', () => {
      // Arrange
      const dto = new AddMemberDto();

      // Act & Assert
      expect(dto).toHaveProperty('userIdToAdd');
    });
  });

  describe('Member Addition Scenarios', () => {
    it('should support adding a user to project', async () => {
      // Arrange
      const dto = plainToClass(AddMemberDto, {
        userIdToAdd: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Act
      const isValid = (await validate(dto)).length === 0;

      // Assert
      expect(isValid).toBe(true);
    });
  });
});
