import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectMembersService } from '../projects/project-members.service';
import { TaskStatus } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrismaService: any;
  let mockProjectMembersService: any;

  beforeEach(async () => {
    mockPrismaService = {
      organizationMembership: {
        findUnique: jest.fn(),
      },
      task: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      project: {
        findFirst: jest.fn(),
      },
      projectMember: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockProjectMembersService = {
      hasProjectAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectMembersService, useValue: mockProjectMembersService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should throw BadRequestException if user has no organizationId', async () => {
      const user = { id: 'user-123' }; // Missing organizationId
      await expect(service.getOverview(user)).rejects.toThrow(BadRequestException);
    });

    it('should return overview for org owner for total period', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 6 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(1); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T09:00:00Z'),
        }, // 1 hour
        {
          startTime: new Date('2026-03-30T10:00:00Z'),
          endTime: new Date('2026-03-30T13:00:00Z'),
        }, // 3 hours
      ]);

      // Act
      const result = await service.getOverview(user, 'total');

      // Assert
      expect(result).toHaveProperty('totalTasks');
      expect(result).toHaveProperty('completedTasks');
      expect(result).toHaveProperty('completionRate');
      expect(result).toHaveProperty('tasksInProgress');
      expect(result).toHaveProperty('blockedTasks');
      expect(result).toHaveProperty('overdueTasks');
      expect(result).toHaveProperty('totalSecondsWorked');
      expect(result).toHaveProperty('totalHoursWorked');
      expect(result.completionRate).toBe(100);
      expect(result.totalHoursWorked).toBe(4);
    });

    it('should return overview with week period for org owner', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 3 } },
        { status: 'IN_PROGRESS', _count: { id: 1 } },
        { status: 'BLOCKED', _count: { id: 1 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(1); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getOverview(user, 'week');

      // Assert
      expect(result.totalTasks).toBe(5);
      expect(result.completedTasks).toBe(3);
      expect(result.completionRate).toBe(60);
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
          }),
        }),
      );
    });

    it('should filter tasks by user membership for non-owner', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 1 } },
        { status: 'IN_PROGRESS', _count: { id: 2 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getOverview(user, 'total');

      // Assert
      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(1);
      expect(result.completionRate).toBe(33);
      // Verify that the where clause filters by user membership
      expect(mockPrismaService.task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project: expect.objectContaining({
              members: { some: { userId: 'user-123' } },
            }),
          }),
        }),
      );
    });

    it('should return 0% completion rate when no tasks exist', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getOverview(user);

      // Assert
      expect(result.totalTasks).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it('should calculate month period correctly', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValueOnce(0);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      // Act
      await service.getOverview(user, 'month');

      // Assert - verify month start was passed to timeEntry query
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should handle time entries with valid times', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValueOnce(0);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T09:00:00Z'),
        },
      ]);

      // Act
      const result = await service.getOverview(user);

      // Assert
      expect(result.totalSecondsWorked).toBe(3600);
      expect(result.totalHoursWorked).toBe(1);
    });
  });

  describe('getProjectAnalytics', () => {
    it('should throw BadRequestException if user has no organizationId', async () => {
      const user = { id: 'user-123' };
      await expect(service.getProjectAnalytics('proj-123', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException for non-member non-owner', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockProjectMembersService.hasProjectAccess.mockResolvedValue(false);

      // Act & Assert
      await expect(service.getProjectAnalytics('proj-123', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProjectAnalytics('proj-123', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if project not in org', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockProjectMembersService.hasProjectAccess.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProjectAnalytics('proj-123', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return project analytics for org owner', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.task.groupBy.mockResolvedValueOnce([
        { status: 'DONE', _count: { id: 7 } },
        { status: 'IN_PROGRESS', _count: { id: 2 } },
        { status: 'BLOCKED', _count: { id: 1 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T17:00:00Z'),
        }, // 9 hours
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        {
          userId: 'member-1',
          user: { id: 'member-1', name: 'John Doe', email: 'john@example.com' },
        },
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T12:00:00Z'),
          userId: 'member-1',
        }, // 4 hours
      ]);
      mockPrismaService.task.findMany.mockResolvedValueOnce([
        { assignedToId: 'member-1', subTasks: [] },
        { assignedToId: null, subTasks: [{ assignedToId: 'member-1' }] },
        { assignedToId: null, subTasks: [{ assignedToId: 'member-1' }] },
      ]);

      // Act
      const result = await service.getProjectAnalytics('proj-123', user);

      // Assert
      expect(result.projectId).toBe('proj-123');
      expect(result.totalTasks).toBe(10);
      expect(result.completedTasks).toBe(7);
      expect(result.completionRate).toBe(70);
      expect(result.tasksInProgress).toBe(2);
      expect(result.blockedTasks).toBe(1);
      expect(result.overdueTasks).toBe(0);
      expect(result.totalHoursWorked).toBe(9);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].name).toBe('John Doe');
      expect(result.members[0].totalHours).toBe(4);
      expect(result.members[0].tasksCompleted).toBe(3);
    });

    it('should return project analytics for project member', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockProjectMembersService.hasProjectAccess.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.task.groupBy.mockResolvedValueOnce([
        { status: 'DONE', _count: { id: 4 } },
        { status: 'IN_PROGRESS', _count: { id: 1 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.getProjectAnalytics('proj-123', user);

      // Assert
      expect(result.totalTasks).toBe(5);
      expect(result.completionRate).toBe(80);
    });

    it('should calculate avgTaskHours correctly', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.task.groupBy.mockResolvedValueOnce([
        { status: 'DONE', _count: { id: 5 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T18:00:00Z'),
        }, // 10 hours = 36000 seconds
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.getProjectAnalytics('proj-123', user);

      // Assert
      expect(result.avgTaskHours).toBe(2); // 10 hours / 5 tasks = 2 hours per task
    });

    it('should return 0 avgTaskHours when no tasks completed', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.task.groupBy.mockResolvedValueOnce([
        { status: 'IN_PROGRESS', _count: { id: 5 } },
      ]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.getProjectAnalytics('proj-123', user);

      // Assert
      expect(result.avgTaskHours).toBe(0);
    });

    it('should filter project analytics by week period', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.task.groupBy.mockResolvedValueOnce([]);
      mockPrismaService.task.count.mockResolvedValueOnce(0); // overdueTasks
      mockPrismaService.timeEntry.findMany.mockResolvedValueOnce([]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValueOnce([]);

      // Act
      await service.getProjectAnalytics('proj-123', user, 'week');

      // Assert
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('getUserAnalytics', () => {
    it('should throw BadRequestException if user has no organizationId', async () => {
      const user = { id: 'user-123' };
      await expect(service.getUserAnalytics('user-456', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if target user not in same org', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationMemberships: [],
      });

      // Act & Assert
      await expect(service.getUserAnalytics('user-456', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if target user not found', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserAnalytics('user-456', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return user analytics', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationMemberships: [{ id: 'membership-1' }],
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 6 } },
        { status: 'IN_PROGRESS', _count: { id: 4 } },
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T17:00:00Z'),
        }, // 9 hours
      ]);

      // Act
      const result = await service.getUserAnalytics('user-456', user);

      // Assert
      expect(result.userId).toBe('user-456');
      expect(result.totalTasks).toBe(10);
      expect(result.completedTasks).toBe(6);
      expect(result.completionRate).toBe(60);
      expect(result.totalHoursWorked).toBe(9);
      expect(result.avgHoursPerTask).toBe(1.5); // 9 hours / 6 completed = 1.5
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        select: {
          organizationMemberships: {
            where: { organizationId: 'org-123' },
            select: { id: true },
          },
        },
      });
    });

    it('should return 0% completion rate when no tasks', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationMemberships: [{ id: 'membership-1' }],
      });
      mockPrismaService.task.groupBy.mockResolvedValue([]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getUserAnalytics('user-456', user);

      // Assert
      expect(result.completionRate).toBe(0);
      expect(result.avgHoursPerTask).toBe(0);
    });

    it('should calculate avgHoursPerTask correctly', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationMemberships: [{ id: 'membership-1' }],
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 4 } },
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T20:00:00Z'),
        }, // 12 hours = 43200 seconds
      ]);

      // Act
      const result = await service.getUserAnalytics('user-456', user);

      // Assert
      expect(result.totalSecondsWorked).toBe(43200);
      expect(result.avgHoursPerTask).toBe(3); // 12 hours / 4 tasks = 3
    });

    it('should handle multiple time entries', async () => {
      // Arrange
      const user = { id: 'user-123', organizationId: 'org-123' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationMemberships: [{ id: 'membership-1' }],
      });
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 2 } },
      ]);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-03-30T08:00:00Z'),
          endTime: new Date('2026-03-30T12:00:00Z'),
        }, // 4 hours
        {
          startTime: new Date('2026-03-31T09:00:00Z'),
          endTime: new Date('2026-03-31T15:00:00Z'),
        }, // 6 hours
      ]);

      // Act
      const result = await service.getUserAnalytics('user-456', user);

      // Assert
      expect(result.totalHoursWorked).toBe(10);
      expect(result.avgHoursPerTask).toBe(5); // 10 hours / 2 tasks = 5
    });
  });
});
