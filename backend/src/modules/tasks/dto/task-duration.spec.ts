import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './createTaskDto';
import { UpdateTaskDto } from './updateTaskDto';

describe.each([CreateTaskDto, UpdateTaskDto])(
  '%s estimatedHours limits',
  (Dto) => {
    it.each([0, 59 / 60, 999 + 59 / 60])(
      'accepts %s hours',
      async (estimatedHours) => {
        const value =
          Dto === CreateTaskDto
            ? { title: 'Tarea', estimatedHours }
            : { estimatedHours };
        const errors = await validate(plainToInstance(Dto, value));
        expect(
          errors.find((error) => error.property === 'estimatedHours'),
        ).toBeUndefined();
      },
    );

    it.each([-1, 1000, 1.5 + 1 / 120, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects %s hours',
      async (estimatedHours) => {
        const value =
          Dto === CreateTaskDto
            ? { title: 'Tarea', estimatedHours }
            : { estimatedHours };
        const errors = await validate(plainToInstance(Dto, value));
        expect(
          errors.find((error) => error.property === 'estimatedHours'),
        ).toBeDefined();
      },
    );

    it.each(['1e2', '9'.repeat(10_000)])(
      'rejects numeric string %s',
      async (estimatedHours) => {
        const value =
          Dto === CreateTaskDto
            ? { title: 'Tarea', estimatedHours }
            : { estimatedHours };
        const errors = await validate(plainToInstance(Dto, value));
        expect(
          errors.find((error) => error.property === 'estimatedHours'),
        ).toBeDefined();
      },
    );
  },
);
