import { Test, TestingModule } from '@nestjs/testing';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';
import { StartTimeDto } from './dto/startTimeDto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { LinkTimeEntryDto } from './dto/linkTimeEntryDto';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

describe('TimeTrackingController', () => {
  let controller: TimeTrackingController;
  let service: TimeTrackingService;

  const mockTimeTrackingService = {
    startTime: jest.fn(),
    stopTime: jest.fn(),
    getActiveTime: jest.fn(),
    getHistory: jest.fn(),
    getSummary: jest.fn(),
    linkTimeEntry: jest.fn(),
    heartbeat: jest.fn(),
    pauseTime: jest.fn(),
    acknowledgeExpired: jest.fn(),
  };

  const mockActiveOrganization = {
    resolveScopedUser: jest.fn((user) => Promise.resolve(user)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeTrackingController],
      providers: [
        {
          provide: TimeTrackingService,
          useValue: mockTimeTrackingService,
        },
        {
          provide: ActiveOrganizationService,
          useValue: mockActiveOrganization,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<TimeTrackingController>(TimeTrackingController);
    service = module.get<TimeTrackingService>(TimeTrackingService);
  });

  describe('POST /time/start', () => {
    it('should start time tracking', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const startTimeDto: StartTimeDto = {
        projectId: 'project-123',
      };

      const expectedTimeEntry = {
        id: 'timer-123',
        projectId: 'project-123',
        userId: 'user-123',
        organizationId: 'org-123',
        startedAt: new Date(),
        status: 'ACTIVE',
      };

      mockTimeTrackingService.startTime.mockResolvedValue(expectedTimeEntry);

      // Act
      const result = await controller.startTime(startTimeDto, currentUser, {} as any);

      // Assert
      expect(result).toEqual({
        ...expectedTimeEntry,
        serverTime: expect.any(String),
      });
      expect(service.startTime).toHaveBeenCalledWith(
        'project-123',
        currentUser,
        undefined,
        undefined,
      );
    });

    it('should pass user context to service', async () => {
      // Arrange
      const currentUser = { id: 'user-456', organizationId: 'org-456' };
      const startTimeDto: StartTimeDto = {
        projectId: 'project-456',
      };

      mockTimeTrackingService.startTime.mockResolvedValue({});

      // Act
      await controller.startTime(startTimeDto, currentUser, {} as any);

      // Assert
      expect(service.startTime).toHaveBeenCalledWith(
        'project-456',
        currentUser,
        undefined,
        undefined,
      );
    });

    it('should handle errors when starting time', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const startTimeDto: StartTimeDto = {
        projectId: 'project-123',
      };

      const error = new Error('Timer already active');
      mockTimeTrackingService.startTime.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.startTime(startTimeDto, currentUser, {} as any),
      ).rejects.toThrow('Timer already active');
    });
  });

  describe('POST /time/stop', () => {
    it('should stop time tracking', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      const expectedTimeEntry = {
        id: 'timer-123',
        projectId: 'project-123',
        userId: 'user-123',
        organizationId: 'org-123',
        startedAt: new Date(),
        stoppedAt: new Date(),
        status: 'STOPPED',
      };

      mockTimeTrackingService.stopTime.mockResolvedValue(expectedTimeEntry);

      // Act
      const result = await controller.stopTime(currentUser, {} as any);

      // Assert
      expect(result).toEqual({
        ...expectedTimeEntry,
        serverTime: expect.any(String),
      });
      expect(service.stopTime).toHaveBeenCalledWith(currentUser, undefined);
    });

    it('should pass user context to service', async () => {
      // Arrange
      const currentUser = { id: 'user-789', organizationId: 'org-789' };

      mockTimeTrackingService.stopTime.mockResolvedValue({});

      // Act
      await controller.stopTime(currentUser, {} as any);

      // Assert
      expect(service.stopTime).toHaveBeenCalledWith(currentUser, undefined);
    });

    it('should handle errors when stopping time', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const error = new Error('No active timer');

      mockTimeTrackingService.stopTime.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.stopTime(currentUser, {} as any)).rejects.toThrow(
        'No active timer',
      );
    });
  });

  describe('GET /time/active', () => {
    it('should get active time entry', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      const expectedActiveEntry = {
        id: 'timer-active-123',
        projectId: 'project-123',
        userId: 'user-123',
        organizationId: 'org-123',
        startedAt: new Date(),
        status: 'ACTIVE',
      };

      mockTimeTrackingService.getActiveTime.mockResolvedValue({
        activeTimer: expectedActiveEntry,
        recentlyExpired: null,
      });

      // Act
      const result = await controller.getActive(currentUser, {} as any);

      // Assert
      expect(result).toEqual({
        activeTimer: expectedActiveEntry,
        recentlyExpired: null,
        serverTime: expect.any(String),
      });
      expect(service.getActiveTime).toHaveBeenCalledWith(currentUser);
    });

    it('should return null if no active timer', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      mockTimeTrackingService.getActiveTime.mockResolvedValue({
        activeTimer: null,
        recentlyExpired: null,
      });

      // Act
      const result = await controller.getActive(currentUser, {} as any);

      // Assert
      expect(result).toEqual({
        activeTimer: null,
        recentlyExpired: null,
        serverTime: expect.any(String),
      });
    });

    it('should pass user context to service', async () => {
      // Arrange
      const currentUser = { id: 'user-456', organizationId: 'org-456' };

      mockTimeTrackingService.getActiveTime.mockResolvedValue({
        activeTimer: {},
        recentlyExpired: null,
      });

      // Act
      await controller.getActive(currentUser, {} as any);

      // Assert
      expect(service.getActiveTime).toHaveBeenCalledWith(currentUser);
    });
  });

  describe('GET /time/history', () => {
    it('should get time tracking history', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      const expectedHistory = [
        {
          id: 'timer-1',
          projectId: 'project-123',
          startedAt: new Date('2025-03-30T09:00:00Z'),
          stoppedAt: new Date('2025-03-30T10:00:00Z'),
          status: 'STOPPED',
        },
        {
          id: 'timer-2',
          projectId: 'project-456',
          startedAt: new Date('2025-03-30T10:30:00Z'),
          stoppedAt: new Date('2025-03-30T11:30:00Z'),
          status: 'STOPPED',
        },
      ];

      mockTimeTrackingService.getHistory.mockResolvedValue(expectedHistory);

      // Act
      const result = await controller.getHistory(currentUser, {} as any);

      // Assert
      expect(result).toEqual(expectedHistory);
      expect(service.getHistory).toHaveBeenCalledWith(currentUser, undefined);
    });

    it('should return empty array if no history', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      mockTimeTrackingService.getHistory.mockResolvedValue([]);

      // Act
      const result = await controller.getHistory(currentUser, {} as any);

      // Assert
      expect(result).toEqual([]);
    });

    it('should pass user context to service', async () => {
      // Arrange
      const currentUser = { id: 'user-789', organizationId: 'org-789' };

      mockTimeTrackingService.getHistory.mockResolvedValue([]);

      // Act
      await controller.getHistory(currentUser, {} as any);

      // Assert
      expect(service.getHistory).toHaveBeenCalledWith(currentUser, undefined);
    });
  });

  describe('Integration', () => {
    it('should handle complete time tracking workflow', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      // Start time
      const startDto: StartTimeDto = { projectId: 'project-123' };
      const startedTimer = {
        id: 'timer-123',
        projectId: 'project-123',
        status: 'ACTIVE',
        startedAt: new Date(),
      };

      mockTimeTrackingService.startTime.mockResolvedValue(startedTimer);
      const started = await controller.startTime(startDto, currentUser, {} as any);
      expect((started as any).status).toBe('ACTIVE');

      // Get active time
      mockTimeTrackingService.getActiveTime.mockResolvedValue({
        activeTimer: startedTimer,
        recentlyExpired: null,
      });
      const active = await controller.getActive(currentUser, {} as any);
      expect(active?.activeTimer?.id).toBe('timer-123');

      // Stop time
      const stoppedTimer = {
        ...startedTimer,
        status: 'STOPPED',
        stoppedAt: new Date(),
      };

      mockTimeTrackingService.stopTime.mockResolvedValue(stoppedTimer);
      const stopped = await controller.stopTime(currentUser, {} as any);
      expect((stopped as any).status).toBe('STOPPED');

      // Get history
      mockTimeTrackingService.getHistory.mockResolvedValue([stoppedTimer]);
      const history = await controller.getHistory(currentUser, {} as any);
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('timer-123');
    });

    it('should handle multiple time entries', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      const entries = [
        { id: 'timer-1', projectId: 'project-1', status: 'STOPPED' },
        { id: 'timer-2', projectId: 'project-2', status: 'STOPPED' },
        { id: 'timer-3', projectId: 'project-3', status: 'STOPPED' },
      ];

      mockTimeTrackingService.getHistory.mockResolvedValue(entries);

      // Act
      const result = await controller.getHistory(currentUser, {} as any);

      // Assert
      expect(result.length).toBe(3);
      expect(result).toEqual(entries);
    });
  });

  describe('PATCH /time/:id/link', () => {
    it('should link/split time entry', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const linkDto: LinkTimeEntryDto = {
        taskId: 'task-123',
        durationMs: 5000,
      };

      const expectedResponse = {
        id: 'new-timer-123',
        projectId: 'project-123',
        taskId: 'task-123',
        userId: 'user-123',
        organizationId: 'org-123',
        startTime: new Date(),
        endTime: new Date(),
        totalPausedMs: 0,
      };

      mockTimeTrackingService.linkTimeEntry.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.linkTime('entry-123', linkDto, currentUser, {} as any);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.linkTimeEntry).toHaveBeenCalledWith('entry-123', linkDto, currentUser);
    });

    it('should handle errors when linking time entry', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const linkDto: LinkTimeEntryDto = {
        taskId: 'task-123',
      };

      const error = new Error('Time entry not found');
      mockTimeTrackingService.linkTimeEntry.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.linkTime('invalid-entry', linkDto, currentUser, {} as any),
      ).rejects.toThrow('Time entry not found');
    });
  });

  describe('POST /time/acknowledge-expiration', () => {
    it('should acknowledge expiration with active organization scoped user', async () => {
      const currentUser = { id: 'user-123', organizationId: 'raw-org' };
      const scopedUser = { id: 'user-123', organizationId: 'active-org' };
      mockActiveOrganization.resolveScopedUser.mockResolvedValueOnce(scopedUser);

      const result = await controller.acknowledgeExpiration(currentUser, {} as any);

      expect(result).toEqual({ success: true });
      expect(mockActiveOrganization.resolveScopedUser).toHaveBeenCalledWith(currentUser, {});
      expect(service.acknowledgeExpired).toHaveBeenCalledWith(scopedUser);
    });
  });
});
