import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateTaskDto } from './updateTaskDto';

describe('UpdateTaskDto', () => {
  describe('Validation', () => {
    it('should validate empty update', async () => {
      const dto = plainToClass(UpdateTaskDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate title update', async () => {
      const dto = plainToClass(UpdateTaskDto, { title: 'Updated Title' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate description update', async () => {
      const dto = plainToClass(UpdateTaskDto, { description: 'Updated desc' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate status update', async () => {
      const dto = plainToClass(UpdateTaskDto, { status: 'IN_PROGRESS' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate priority update', async () => {
      const dto = plainToClass(UpdateTaskDto, { priority: 'HIGH' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate dueDate update', async () => {
      const dto = plainToClass(UpdateTaskDto, { dueDate: '2025-12-31' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate assignedToId update', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        assignedToId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate multiple field update', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        title: 'Updated',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate all fields', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        title: 'Full Update',
        description: 'Complete update',
        status: 'DONE',
        priority: 'HIGH',
        dueDate: '2025-06-30',
        assignedToId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status', async () => {
      const dto = plainToClass(UpdateTaskDto, { status: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid priority', async () => {
      const dto = plainToClass(UpdateTaskDto, { priority: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid assignedToId', async () => {
      const dto = plainToClass(UpdateTaskDto, { assignedToId: 'not-uuid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string title', async () => {
      const dto = plainToClass(UpdateTaskDto, { title: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Update Scenarios', () => {
    it('should support title update only', async () => {
      const dto = plainToClass(UpdateTaskDto, { title: 'New Title' });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support marking complete', async () => {
      const dto = plainToClass(UpdateTaskDto, { status: 'DONE' });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support reassignment', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        assignedToId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support priority deadline update', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        priority: 'CRITICAL',
        dueDate: '2025-04-30',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });

    it('should support bulk update', async () => {
      const dto = plainToClass(UpdateTaskDto, {
        title: 'Priority Task',
        description: 'Important',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      });
      const isValid = (await validate(dto)).length === 0;
      expect(isValid).toBe(true);
    });
  });

  describe('estimatedHours', () => {
    it('should still allow updating without touching estimated hours', async () => {
      const dto = plainToClass(UpdateTaskDto, { title: 'Only title' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
