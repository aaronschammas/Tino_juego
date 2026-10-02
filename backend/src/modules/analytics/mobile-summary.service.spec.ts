/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ForbiddenException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { MobileSummaryPeriod, MobileSummaryScope } from './dto/mobile-summary.dto';

describe('AnalyticsDashboardService mobile summary', () => {
  let prisma: any;
  let service: AnalyticsDashboardService;
  const user = { id: 'user-1', organizationId: 'org-1', role: 'USER' };

  beforeEach(() => {
    prisma = {
      organizationMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'ORG_MEMBER' }) },
      project: { findMany: jest.fn().mockResolvedValue([{ id: 'project-1' }]) },
      task: {
        groupBy: jest.fn().mockResolvedValue([
          { status: TaskStatus.TODO, _count: { id: 2 } },
          { status: TaskStatus.IN_PROGRESS, _count: { id: 1 } },
          { status: TaskStatus.BLOCKED, _count: { id: 1 } },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AnalyticsDashboardService(prisma);
  });

  it('limits a member to active authorized projects and direct or subtask assignment', async () => {
    const result = await service.getMobileSummary(user, {
      period: MobileSummaryPeriod.WEEK,
      scope: MobileSummaryScope.SELF,
    });
    expect(result.privacy).toBe('self-only');
    expect(result.own).toEqual(expect.objectContaining({ pendingTasks: 2, inProgressTasks: 1, blockedTasks: 1, overdueTasks: 1 }));
    expect(result.completedInPeriod).toBeNull();
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1', isActive: true, members: { some: { userId: 'user-1' } } }),
    }));
    const ownWhere = prisma.task.groupBy.mock.calls[0][0].where;
    expect(ownWhere.AND[0]).toEqual(expect.objectContaining({ organizationId: 'org-1', parentTaskId: null }));
    expect(ownWhere.AND[1].OR).toEqual([
      { assignedToId: 'user-1' },
      { subTasks: { some: { assignedToId: 'user-1' } } },
    ]);
  });

  it('rejects organization aggregates requested by a member', async () => {
    await expect(service.getMobileSummary(user, {
      period: MobileSummaryPeriod.MONTH,
      scope: MobileSummaryScope.ORGANIZATION,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns owner-only aggregates without counting subtask-assigned work as unassigned', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
    prisma.task.groupBy
      .mockResolvedValueOnce([{ status: TaskStatus.TODO, _count: { id: 1 } }])
      .mockResolvedValueOnce([{ status: TaskStatus.DONE, _count: { id: 3 } }]);
    prisma.task.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'Ada', lastname: 'Lovelace' }]);
    prisma.timeEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'user-1', startTime: new Date('2026-09-01T12:00:00Z'), endTime: new Date('2026-09-01T13:00:00Z'), totalPausedMs: 0 }]);

    const result = await service.getMobileSummary(user, {
      period: MobileSummaryPeriod.MONTH,
      scope: MobileSummaryScope.ORGANIZATION,
      timezone: 'America/Argentina/Buenos_Aires',
    });
    expect(result.privacy).toBe('organization-aggregate');
    if (!('organization' in result)) {
      throw new Error('Expected organization aggregates');
    }
    expect(result.organization).toEqual(expect.objectContaining({ overdueTasks: 4, unassignedTasks: 2, activeProjects: 1 }));
    expect(result.organization.hoursByUser[0]).toEqual(expect.objectContaining({ name: 'Ada Lovelace' }));
    const unassignedWhere = prisma.task.count.mock.calls[2][0].where;
    expect(unassignedWhere.AND[1]).toEqual({ assignedToId: null, subTasks: { every: { assignedToId: null } } });
  });

  it('never scopes queries from a client supplied organization id', async () => {
    await service.getMobileSummary(user, {
      period: MobileSummaryPeriod.WEEK,
      scope: MobileSummaryScope.SELF,
    });
    expect(prisma.project.findMany.mock.calls[0][0].where.organizationId).toBe('org-1');
  });
});
