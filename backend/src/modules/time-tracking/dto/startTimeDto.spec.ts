import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { StartTimeDto } from './startTimeDto';

describe('StartTimeDto', () => {
  describe('Validation', () => {
    it('should validate with valid UUID', async () => {
      const dto = plainToClass(StartTimeDto, {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-UUID projectId', async () => {
      const dto = plainToClass(StartTimeDto, { projectId: 'not-uuid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing projectId', async () => {
      const dto = plainToClass(StartTimeDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string projectId', async () => {
      const dto = plainToClass(StartTimeDto, { projectId: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept multiple valid UUIDs', async () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];
      for (const uuid of uuids) {
        const dto = plainToClass(StartTimeDto, { projectId: uuid });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Timer Start Scenarios', () => {
    it('should support starting timer for project', async () => {
      const dto = plainToClass(StartTimeDto, {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });
  });
});
