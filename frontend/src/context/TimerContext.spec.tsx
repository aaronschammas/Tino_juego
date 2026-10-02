import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { TimerProvider, useTimer, useTimerControls } from './TimerContext';

const mockUseTimerState = jest.fn();

jest.mock('@/hooks/useTimer', () => ({
  useTimerState: () => mockUseTimerState(),
}));

describe('TimerContext', () => {
  const activeTimer = {
    id: 'time-1',
    projectId: 'project-1',
    userId: 'user-1',
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: null,
    pausedAt: null,
    totalPausedMs: 0,
  };

  const buildState = (elapsedSeconds: number) => ({
    activeTimer,
    isRunning: true,
    isPaused: false,
    isLoading: false,
    error: null,
    elapsedSeconds,
    targetMinutes: 30,
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
    pauseTimer: jest.fn(),
    resumeTimer: jest.fn(),
    updateTargetMinutes: jest.fn(),
    refreshTimer: jest.fn(),
    sendHeartbeat: jest.fn(),
    acknowledgeExpiration: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function ControlsConsumer({ onRender }: { onRender: () => void }) {
    useTimerControls();
    onRender();
    return null;
  }

  function FullConsumer({ onRender }: { onRender: () => void }) {
    useTimer();
    onRender();
    return null;
  }

  it('does not re-render controls consumers when only the clock ticks', () => {
    // Arrange
    const onControlsRender = jest.fn();
    const onFullRender = jest.fn();
    const children = (
      <>
        <ControlsConsumer onRender={onControlsRender} />
        <FullConsumer onRender={onFullRender} />
      </>
    );
    mockUseTimerState.mockReturnValue(buildState(10));

    const { rerender } = render(<TimerProvider>{children}</TimerProvider>);

    const controlsRendersBefore = onControlsRender.mock.calls.length;
    const fullRendersBefore = onFullRender.mock.calls.length;

    // Act
    mockUseTimerState.mockReturnValue(buildState(11));
    rerender(<TimerProvider>{children}</TimerProvider>);

    // Assert
    expect(onControlsRender).toHaveBeenCalledTimes(controlsRendersBefore);
    expect(onFullRender.mock.calls.length).toBeGreaterThan(fullRendersBefore);
  });

  it('re-renders controls consumers when the active timer changes', () => {
    // Arrange
    const onControlsRender = jest.fn();
    const children = <ControlsConsumer onRender={onControlsRender} />;
    mockUseTimerState.mockReturnValue(buildState(10));

    const { rerender } = render(<TimerProvider>{children}</TimerProvider>);

    const rendersBefore = onControlsRender.mock.calls.length;

    // Act
    mockUseTimerState.mockReturnValue({
      ...buildState(11),
      activeTimer: null,
      isRunning: false,
    });
    rerender(<TimerProvider>{children}</TimerProvider>);

    // Assert
    expect(onControlsRender.mock.calls.length).toBeGreaterThan(rendersBefore);
  });

  it('keeps action identities stable across clock ticks', () => {
    // Arrange
    const seen: unknown[] = [];

    function ActionCollector() {
      const { startTimer } = useTimerControls();
      seen.push(startTimer);
      return null;
    }

    const children = <ActionCollector />;
    mockUseTimerState.mockReturnValue(buildState(10));
    const { rerender } = render(<TimerProvider>{children}</TimerProvider>);

    // Act
    mockUseTimerState.mockReturnValue(buildState(11));
    rerender(<TimerProvider>{children}</TimerProvider>);

    // Assert
    expect(seen[0]).toBe(seen[seen.length - 1]);
  });

  it('exposes the full state including elapsedSeconds through useTimer', () => {
    // Arrange
    let captured: ReturnType<typeof useTimer> | null = null;

    function Capture() {
      captured = useTimer();
      return null;
    }

    mockUseTimerState.mockReturnValue(buildState(42));

    // Act
    render(
      <TimerProvider>
        <Capture />
      </TimerProvider>,
    );

    // Assert
    expect(captured!.elapsedSeconds).toBe(42);
    expect(captured!.activeTimer).toBe(activeTimer);
    expect(captured!.targetMinutes).toBe(30);
  });

  it('throws when used outside the provider', () => {
    // Arrange
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    function Orphan() {
      useTimerControls();
      return null;
    }

    // Act & Assert
    expect(() => render(<Orphan />)).toThrow(/TimerProvider/);
    consoleError.mockRestore();
  });
});
