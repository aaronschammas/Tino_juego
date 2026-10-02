import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { StopTimeDto } from './stopTimeDto';

describe('StopTimeDto', () => {
  describe('Validation', () => {
    it('should validate empty object (projectId optional, endTime optional)', async () => {
      const dto = plainToClass(StopTimeDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid UUID and valid ISO string endTime', async () => {
      const dto = plainToClass(StopTimeDto, {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        endTime: new Date().toISOString(),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string endTime', async () => {
      const dto = plainToClass(StopTimeDto, {
        endTime: 12345 as any,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-UUID projectId', async () => {
      const dto = plainToClass(StopTimeDto, { projectId: 'not-uuid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string projectId', async () => {
      const dto = plainToClass(StopTimeDto, { projectId: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept without projectId', async () => {
      const dto = plainToClass(StopTimeDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with various UUIDs', async () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];
      for (const uuid of uuids) {
        const dto = plainToClass(StopTimeDto, { projectId: uuid });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Timer Stop Scenarios', () => {
    it('should support stopping current timer', async () => {
      const dto = plainToClass(StopTimeDto, {});
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support stopping timer with project and endTime', async () => {
      const dto = plainToClass(StopTimeDto, {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        endTime: new Date().toISOString(),
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });
  });
});

