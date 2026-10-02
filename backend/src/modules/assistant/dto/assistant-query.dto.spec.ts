import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssistantPeriod, AssistantQueryDto } from './assistant-query.dto';

describe('AssistantQueryDto', () => {
  it('accepts a bounded query and period', async () => {
    const dto = plainToInstance(AssistantQueryDto, {
      query: 'Resumen semanal',
      period: AssistantPeriod.WEEK,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    { query: '' },
    { query: 'x' },
    { query: 'x'.repeat(301) },
    { query: 'Timers activos', period: 'year' },
  ])('rejects invalid input %#', async (input) => {
    expect(
      await validate(plainToInstance(AssistantQueryDto, input)),
    ).not.toHaveLength(0);
  });

  it('rejects organizationId through the global validation contract', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { query: 'Resumen semanal', organizationId: 'other' },
        { type: 'body', metatype: AssistantQueryDto },
      ),
    ).rejects.toBeDefined();
  });
});
