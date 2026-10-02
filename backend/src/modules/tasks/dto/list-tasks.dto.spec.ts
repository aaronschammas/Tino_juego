import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTasksDto } from './list-tasks.dto';

describe('ListTasksDto', () => {
  it('applies defaults and accepts supported filters', async () => {
    const dto = plainToInstance(ListTasksDto, {
      assignedTo: 'me',
      overdue: 'true',
      search: '  Login  ',
      openOnly: 'true',
      dueFrom: '2026-09-01T00:00:00.000Z',
      dueTo: '2026-09-08T00:00:00.000Z',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 25,
        assignedTo: 'me',
        overdue: true,
        search: 'Login',
        openOnly: true,
      }),
    );
  });

  it.each([
    { page: 0 },
    { pageSize: 51 },
    { projectId: 'not-a-uuid' },
    { assignedTo: 'user-id' },
    { overdue: 'yes' },
    { openOnly: 'yes' },
    { dueFrom: 'tomorrow' },
    { dueTo: 'next-week' },
    { status: 'INVALID' },
    { priority: 'INVALID' },
    { search: 'x'.repeat(101) },
  ])('rejects invalid query %#', async (value) => {
    expect(
      await validate(plainToInstance(ListTasksDto, value)),
    ).not.toHaveLength(0);
  });

  it('normalizes an empty search to undefined', async () => {
    const dto = plainToInstance(ListTasksDto, { search: '   ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.search).toBeUndefined();
  });
});
