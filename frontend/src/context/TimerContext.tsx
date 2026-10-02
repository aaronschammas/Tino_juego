'use client';

import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useTimerState } from '@/hooks/useTimer';

type TimerState = ReturnType<typeof useTimerState>;
type TimerControlsValue = Omit<TimerState, 'elapsedSeconds'>;
type TimerTickValue = Pick<TimerState, 'elapsedSeconds'>;

export const TimerControlsContext = createContext<TimerControlsValue | undefined>(undefined);
export const TimerTickContext = createContext<TimerTickValue | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useTimerState();
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const actions = useMemo(
    () => ({
      startTimer: (...args: Parameters<TimerState['startTimer']>) =>
        timerRef.current.startTimer(...args),
      stopTimer: (...args: Parameters<TimerState['stopTimer']>) =>
        timerRef.current.stopTimer(...args),
      pauseTimer: (...args: Parameters<TimerState['pauseTimer']>) =>
        timerRef.current.pauseTimer(...args),
      resumeTimer: (...args: Parameters<TimerState['resumeTimer']>) =>
        timerRef.current.resumeTimer(...args),
      updateTargetMinutes: (...args: Parameters<TimerState['updateTargetMinutes']>) =>
        timerRef.current.updateTargetMinutes(...args),
      refreshTimer: (...args: Parameters<TimerState['refreshTimer']>) =>
        timerRef.current.refreshTimer(...args),
      sendHeartbeat: (...args: Parameters<TimerState['sendHeartbeat']>) =>
        timerRef.current.sendHeartbeat(...args),
      acknowledgeExpiration: (...args: Parameters<TimerState['acknowledgeExpiration']>) =>
        timerRef.current.acknowledgeExpiration(...args),
    }),
    [],
  );

  const controls = useMemo<TimerControlsValue>(
    () => ({
      activeTimer: timer.activeTimer,
      isRunning: timer.isRunning,
      isPaused: timer.isPaused,
      isLoading: timer.isLoading,
      error: timer.error,
      targetMinutes: timer.targetMinutes,
      ...actions,
    }),
    [
      timer.activeTimer,
      timer.isRunning,
      timer.isPaused,
      timer.isLoading,
      timer.error,
      timer.targetMinutes,
      actions,
    ],
  );

  const tick = useMemo<TimerTickValue>(
    () => ({ elapsedSeconds: timer.elapsedSeconds }),
    [timer.elapsedSeconds],
  );

  return (
    <TimerControlsContext.Provider value={controls}>
      <TimerTickContext.Provider value={tick}>{children}</TimerTickContext.Provider>
    </TimerControlsContext.Provider>
  );
}

export function useTimerControls(): TimerControlsValue {
  const context = useContext(TimerControlsContext);
  if (context === undefined) {
    throw new Error('useTimerControls debe usarse dentro de un TimerProvider');
  }
  return context;
}

export function useTimer(): TimerState {
  const controls = useTimerControls();
  const tick = useContext(TimerTickContext);
  if (tick === undefined) {
    throw new Error('useTimer debe usarse dentro de un TimerProvider');
  }
  return { ...controls, ...tick };
}
