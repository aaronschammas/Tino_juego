import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MobileSummaryDto,
  MobileSummaryPeriod,
  MobileSummaryScope,
} from './mobile-summary.dto';

describe('MobileSummaryDto', () => {
  it('accepts only the bounded period and scope contract', async () => {
    const dto = plainToInstance(MobileSummaryDto, {
      period: 'week',
      scope: 'self',
      timezone: 'America/Argentina/Buenos_Aires',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.period).toBe(MobileSummaryPeriod.WEEK);
    expect(dto.scope).toBe(MobileSummaryScope.SELF);
  });

  it.each([{ period: 'year' }, { period: 'month', scope: 'team' }])(
    'rejects invalid values %#',
    async (input) => {
      expect(await validate(plainToInstance(MobileSummaryDto, input))).not.toHaveLength(0);
    },
  );

  it('rejects organizationId and every unknown query parameter', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    await expect(pipe.transform(
      { period: 'week', organizationId: 'org-other' },
      { type: 'query', metatype: MobileSummaryDto },
    )).rejects.toBeDefined();
  });
});
