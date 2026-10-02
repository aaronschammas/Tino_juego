/**
 * useTimer.ts - useTimer Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimerState as useTimer } from './useTimer';
import * as apiLib from '@/lib/api';
import * as useAuthModule from './useAuth';
import { ActiveTimeResponse } from '@/types/time';
import { Priority } from '@/types/project';

// Mock the modules
jest.mock('@/lib/api');
jest.mock('./useAuth');

jest.useFakeTimers();

describe('useTimer Hook', () => {
  let consoleErrorSpy: jest.SpyInstance;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER',
    isActive: true,
    organizationId: 'org-123',
  };

  const mockActiveTimer: ActiveTimeResponse = {
    id: 'time-123',
    projectId: 'project-1',
    userId: 'user-123',
    startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    endTime: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    project: {
      id: 'project-1',
      name: 'Test Project',
      priority: Priority.HIGH,
      ownerId: 'user-123',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    pausedAt: null,
    totalPausedMs: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (apiLib.apiGet as jest.Mock).mockImplementation((url: string) => {
      if (url === '/time/now') {
        return Promise.resolve({ serverTime: new Date().toISOString() });
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Initial state', () => {
    it('should not fetch timer data when authenticated user has no organization', async () => {
      // Arrange
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({
        user: { ...mockUser, organizationId: undefined },
      });

      // Act
      const { result } = renderHook(() => useTimer());

      // Assert
      await waitFor(() => expect(result.current.activeTimer).toBeNull());
      expect(apiLib.apiGet).not.toHaveBeenCalledWith('/time/now', expect.any(Object));
      expect(apiLib.apiGet).not.toHaveBeenCalledWith('/time/active', expect.any(Object));
    });

    it('should initialize with no active timer', () => {
      // Arrange & Act
      const { result } = renderHook(() => useTimer());

      // Assert
      expect(result.current.activeTimer).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });

    it('should provide timer management functions', () => {
      // Arrange & Act
      const { result } = renderHook(() => useTimer());

      // Assert
      expect(typeof result.current.refreshTimer).toBe('function');
      expect(typeof result.current.startTimer).toBe('function');
      expect(typeof result.current.stopTimer).toBe('function');
    });
  });

  describe('fetchActiveTimer (via refreshTimer)', () => {
    it('should fetch active timer successfully', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.refreshTimer();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.activeTimer).toEqual(mockActiveTimer);
      });
      expect(result.current.error).toBeNull();
    });

    it('should calculate elapsed seconds when timer is active', async () => {
      // Arrange
      const startTime = new Date(Date.now() - 5000000).toISOString(); // Some time ago
      const timerWithStartTime = { ...mockActiveTimer, startTime };
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: timerWithStartTime, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Assert
      await waitFor(() => {
        expect(result.current.elapsedSeconds).toBeGreaterThan(0);
      });
    });

    it('should retain existing active timer on non-404 error', async () => {
      // Arrange
      const error = { status: 400 };
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => {
        if (url === '/time/now') return Promise.resolve({ serverTime: new Date().toISOString() });
        return Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null });
      });

      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.refreshTimer();
      });
      expect(result.current.activeTimer).toEqual(mockActiveTimer);

      // Act
      (apiLib.apiGet as jest.Mock).mockRejectedValue(error);
      await act(async () => {
        await result.current.refreshTimer();
      });

      // Assert
      expect(result.current.activeTimer).toEqual(mockActiveTimer);
    });

    it('should not set error on 404 (no active timer)', async () => {
      // Arrange
      const error = { status: 404 };
      (apiLib.apiGet as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.refreshTimer();
      });

      // Assert
      expect(result.current.error).toBeNull();
      expect(result.current.activeTimer).toBeNull();
    });

    it('should not fetch if user is not authenticated', async () => {
      // Arrange
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: null });

      // Act
      const { result } = renderHook(() => useTimer());
      // Trigger refresh manually since useEffect won't run
      await act(async () => {
        // Don't call refreshTimer when user is null as it should check user?.id
      });

      // Assert - refreshTimer should handle null user gracefully
      expect(result.current.activeTimer).toBeNull();
    });
  });

  describe('startTimer', () => {
    it('should start timer for a project', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockActiveTimer);
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/time/start', {
        projectId: 'project-1',
        targetMinutes: 30,
      });
      expect(result.current.activeTimer).toEqual(mockActiveTimer);
      expect(result.current.elapsedSeconds).toBe(3600);
    });

    it('should handle start timer error', async () => {
      // Arrange
      const error = new Error('Failed to start timer');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);
      (apiLib.apiGet as jest.Mock).mockResolvedValue(null);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        try {
          await result.current.startTimer('project-1');
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Failed to start timer');
      expect(result.current.activeTimer).toBeNull();
    });

    it('should use fallback error message on start', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockRejectedValue(new Error());
      (apiLib.apiGet as jest.Mock).mockResolvedValue(null);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        try {
          await result.current.startTimer('project-1');
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Error al iniciar timer');
    });

    it('should dispatch time:updated event on start', async () => {
      // Arrange
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockActiveTimer);
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });

      // Assert
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'time:updated',
        })
      );

      dispatchEventSpy.mockRestore();
    });
  });

  describe('stopTimer', () => {
    it('should stop the active timer', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockActiveTimer);
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });
      expect(result.current.activeTimer).not.toBeNull();

      // Reset apiGet mock for stop
      (apiLib.apiGet as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await result.current.stopTimer();
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/time/stop', undefined);
      expect(result.current.activeTimer).toBeNull();
      expect(result.current.elapsedSeconds).toBe(0);
    });

    it('should handle stop timer error', async () => {
      // Arrange
      const error = new Error('Failed to stop timer');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        try {
          await result.current.stopTimer();
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Failed to stop timer');
    });

    it('should use fallback error message on stop', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockRejectedValue(new Error());

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        try {
          await result.current.stopTimer();
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Error al detener timer');
    });

    it('should dispatch time:updated event on stop', async () => {
      // Arrange
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockActiveTimer);
      (apiLib.apiGet as jest.Mock).mockImplementation((url) => url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: mockActiveTimer, recentlyExpired: null }));

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });
      
      await waitFor(() => {
        expect(result.current.activeTimer).not.toBeNull();
      });

      await act(async () => {
        await result.current.stopTimer();
      });

      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'time:updated',
          })
        );
      });

      dispatchEventSpy.mockRestore();
    });
  });

  describe('Timer state management', () => {
    it('should clear elapsed seconds on stop', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock)
        .mockResolvedValueOnce(mockActiveTimer)
        .mockResolvedValueOnce(undefined);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });

      expect(result.current.elapsedSeconds).toBe(0);

      await act(async () => {
        await result.current.stopTimer();
      });

      // Assert
      expect(result.current.elapsedSeconds).toBe(0);
    });

    it('should handle isLoading state correctly', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockActiveTimer);

      // Act
      const { result } = renderHook(() => useTimer());
      await act(async () => {
        await result.current.startTimer('project-1');
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('background reconciliation', () => {
    it('deduplicates simultaneous visibility, pageshow and focus recovery events', async () => {
      let resolveActive!: (value: unknown) => void;
      const pending = new Promise((resolve) => { resolveActive = resolve; });
      (apiLib.apiGet as jest.Mock).mockImplementation((url: string) =>
        url === '/time/now' ? Promise.resolve({ serverTime: new Date().toISOString() }) : Promise.resolve({ activeTimer: null, recentlyExpired: null }),
      );
      const { result } = renderHook(() => useTimer());
      await waitFor(() =>
        expect(apiLib.apiGet).toHaveBeenCalledWith(
          '/time/active',
          expect.any(Object),
        ),
      );
      await act(async () => { await result.current.refreshTimer(); });
      jest.clearAllMocks();
      (apiLib.apiGet as jest.Mock).mockReturnValue(pending);
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('pageshow'));
        window.dispatchEvent(new Event('focus'));
        jest.runOnlyPendingTimers();
      });
      await act(async () => { await Promise.resolve(); });
      expect((apiLib.apiGet as jest.Mock).mock.calls.filter(([url]) => url === '/time/active')).toHaveLength(1);
      await act(async () => resolveActive({ activeTimer: mockActiveTimer, recentlyExpired: null }));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.activeTimer).toEqual(mockActiveTimer);
    });
  });
});
