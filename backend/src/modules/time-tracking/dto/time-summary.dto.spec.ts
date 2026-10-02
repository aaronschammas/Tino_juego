import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { TimeSummaryDto } from './time-summary.dto';

describe('TimeSummaryDto', () => {
  it('applies bounded pagination defaults', async () => {
    const dto = plainToInstance(TimeSummaryDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        timezone: 'America/Argentina/Buenos_Aires',
      }),
    );
  });
  it.each([{ page: 0 }, { pageSize: 51 }, { pageSize: 0 }])(
    'rejects invalid values %#',
    async (input) => {
      expect(
        await validate(plainToInstance(TimeSummaryDto, input)),
      ).not.toHaveLength(0);
    },
  );
  it('rejects organizationId and unknown parameters with the global pipe settings', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { organizationId: 'other' },
        { type: 'query', metatype: TimeSummaryDto },
      ),
    ).rejects.toBeDefined();
  });
});
