/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';

describe('TimeTrackingService.getSummary', () => {
  const user = { id: 'u1', organizationId: 'org-1' };
  function setup(entries: any[] = []) {
    const prisma = {
      timeEntry: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(entries)
          .mockResolvedValueOnce(entries),
        count: jest.fn().mockResolvedValue(entries.length),
      },
      $transaction: jest.fn((queries) => Promise.all(queries)),
    };
    return {
      prisma,
      service: new TimeTrackingService(prisma as never, {} as never),
    };
  }
  it('scopes totals and paginated history to the authenticated user and organization', async () => {
    const entry = {
      id: 'e1',
      projectId: 'p1',
      taskId: null,
      startTime: new Date('2026-09-02T13:00:00Z'),
      endTime: new Date('2026-09-02T14:00:00Z'),
      totalPausedMs: 0,
      project: { id: 'p1', name: 'P' },
      task: null,
    };
    const { prisma, service } = setup([entry]);
    const result = await service.getSummary(
      user,
      { page: 1, pageSize: 10, timezone: 'America/Argentina/Buenos_Aires' },
      new Date('2026-09-02T15:00:00Z'),
    );
    expect(result.todayMilliseconds).toBe(3_600_000);
    expect(result.weekMilliseconds).toBe(3_600_000);
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ page: 1, total: 1, totalPages: 1 }),
    );
    expect(prisma.timeEntry.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 10,
        select: expect.objectContaining({
          project: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        }),
      }),
    );
  });
  it('rejects an invalid timezone', async () => {
    const { service } = setup();
    await expect(
      service.getSummary(user, { page: 1, pageSize: 10, timezone: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('converts Monday midnight to UTC for a DST timezone', async () => {
    const { prisma, service } = setup([]);
    const result = await service.getSummary(
      user,
      { page: 2, pageSize: 5, timezone: 'America/New_York' },
      new Date('2026-07-08T16:00:00Z'),
    );
    expect(result.timezone).toBe('America/New_York');
    expect(prisma.timeEntry.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          endTime: { gt: new Date('2026-07-06T04:00:00.000Z') },
        }),
      }),
    );
    expect(prisma.timeEntry.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});
