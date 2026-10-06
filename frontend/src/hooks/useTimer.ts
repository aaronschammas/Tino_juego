import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { useAuth } from './useAuth';
import { ActiveTimeResponse, StartTimeDto } from '@/types/time';
import { timerTargetMinutes } from '@/lib/taskDuration';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function useTimerState() {
  const { user } = useAuth();
  const [activeTimer, setActiveTimer] = useState<ActiveTimeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState<number>(30);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skewRef = useRef<number>(0);
  const hasTriggeredExpiration = useRef(false);
  const scope = `${user?.id ?? ''}:${user?.organizationId ?? ''}`;
  const scopeRef = useRef(scope);
  const generationRef = useRef(0);
  const operationLocks = useRef(new Set<string>());
  const refreshInFlight = useRef<Promise<void> | null>(null);
  if (scopeRef.current !== scope) {
    scopeRef.current = scope;
    generationRef.current += 1;
    operationLocks.current.clear();
  }

  // Fetch active timer
  const fetchActiveTimer = useCallback(async () => {
    if (!user?.id || !user.organizationId) return;
    if (refreshInFlight.current) return refreshInFlight.current;
    const requestScope = scopeRef.current;
    const requestGeneration = generationRef.current;
    const request = (async () => { try {
      const data = await apiGet<{
        activeTimer: ActiveTimeResponse | null;
        recentlyExpired: ActiveTimeResponse | null;
        serverTime?: string;
      }>('/time/active', {
        silent: true,
        skipAuthRedirect: true,
        suppressStatuses: [401, 404],
      });

      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      const active = data?.activeTimer || null;
      setActiveTimer(active);

      if (active?.id) {
        const target = timerTargetMinutes(active, 0);
        if (target) setTargetMinutes(target);
      }

      if (active?.startTime) {
        const serverTime = data?.serverTime ? new Date(data.serverTime).getTime() : Date.now();
        skewRef.current = Date.now() - serverTime;
        const start = new Date(active.startTime).getTime();
        const pausedMs = active.totalPausedMs ?? 0;
        const adjustedNow = Date.now() - skewRef.current;
        setElapsedSeconds(Math.floor((adjustedNow - start - pausedMs) / 1000));
      }

      if (data?.recentlyExpired) {
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('time:expired', { detail: data.recentlyExpired });
          window.dispatchEvent(event);
        }
      }
    } catch (err: any) {
      if (err?.status !== 401) {
        console.warn('Failed to fetch active timer:', err);
      }
    } finally { refreshInFlight.current = null; } })();
    refreshInFlight.current = request;
    return request;
  }, [user?.id, user?.organizationId]);

  // Start timer
  const startTimer = async (projectId: string, taskId?: string, minutes: number = 30) => {
    if (operationLocks.current.has('timer')) return;
    operationLocks.current.add('timer');
    const requestScope = scopeRef.current; const requestGeneration = generationRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const dto: StartTimeDto & { targetMinutes: number } = { 
        projectId, 
        ...(taskId ? { taskId } : {}),
        targetMinutes: minutes
      };
      const data = await apiPost<ActiveTimeResponse>('/time/start', dto);
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setActiveTimer(data);
      if (data) {
        const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
        skewRef.current = Date.now() - serverTime;
      }
      setElapsedSeconds(0);
      setTargetMinutes(timerTargetMinutes(data, minutes));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('time:updated'));
      }
    } catch (err: any) {
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setError(err?.message || 'Error al iniciar timer');
      throw err;
    } finally {
      operationLocks.current.delete('timer');
      if (scopeRef.current === requestScope && generationRef.current === requestGeneration) setIsLoading(false);
    }
  };

  const updateTargetMinutes = (minutes: number) => {
    if (!activeTimer?.id) return;
    setTargetMinutes(minutes);
  };

  const pauseTimer = async () => {
    if (operationLocks.current.has('timer')) return;
    operationLocks.current.add('timer'); const requestScope = scopeRef.current; const requestGeneration = generationRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const updated = await apiPatch<ActiveTimeResponse>('/time/pause');
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setActiveTimer(updated);
      if (updated) {
        const serverTime = updated.serverTime ? new Date(updated.serverTime).getTime() : Date.now();
        skewRef.current = Date.now() - serverTime;
      }
    } catch (err: any) {
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setError(err?.message || 'Error al pausar timer');
      throw err;
    } finally {
      operationLocks.current.delete('timer'); if (scopeRef.current === requestScope && generationRef.current === requestGeneration) setIsLoading(false);
    }
  };

  const resumeTimer = async () => {
    if (operationLocks.current.has('timer')) return;
    operationLocks.current.add('timer'); const requestScope = scopeRef.current; const requestGeneration = generationRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const updated = await apiPatch<ActiveTimeResponse>('/time/heartbeat');
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setActiveTimer(updated);
      if (updated) {
        const serverTime = updated.serverTime ? new Date(updated.serverTime).getTime() : Date.now();
        skewRef.current = Date.now() - serverTime;
      }
    } catch (err: any) {
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setError(err?.message || 'Error al reanudar timer');
      throw err;
    } finally {
      operationLocks.current.delete('timer'); if (scopeRef.current === requestScope && generationRef.current === requestGeneration) setIsLoading(false);
    }
  };

  // Stop timer
  const stopTimer = async (customEndTime?: Date) => {
    if (operationLocks.current.has('timer')) return;
    operationLocks.current.add('timer'); const requestScope = scopeRef.current; const requestGeneration = generationRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const timerId = activeTimer?.id;
      await apiPost('/time/stop', customEndTime ? { endTime: customEndTime.toISOString() } : undefined);
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setActiveTimer(null);
      setElapsedSeconds(0);
      
      if (timerId) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('time:updated'));
        }
      }
    } catch (err: any) {
      if (scopeRef.current !== requestScope || generationRef.current !== requestGeneration) return;
      setError(err?.message || 'Error al detener timer');
      throw err;
    } finally {
      operationLocks.current.delete('timer'); if (scopeRef.current === requestScope && generationRef.current === requestGeneration) setIsLoading(false);
    }
  };

  const acknowledgeExpiration = async () => {
    try {
      await apiPost('/time/acknowledge-expiration');
    } catch (err) {
      console.warn('Failed to acknowledge expiration:', err);
    }
  };

  const sendHeartbeat = useCallback(async () => {
    if (!activeTimer || activeTimer.pausedAt) return; // Don't heartbeat if paused
    try {
      const updated = await apiPatch<ActiveTimeResponse>('/time/heartbeat');
      setActiveTimer(updated);
      if (updated) {
        const serverTime = updated.serverTime ? new Date(updated.serverTime).getTime() : Date.now();
        skewRef.current = Date.now() - serverTime;
      }
    } catch (err) {
      console.warn('Heartbeat failed:', err);
    }
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer || activeTimer.pausedAt) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [activeTimer, sendHeartbeat]);

  useEffect(() => {
    let scheduled = false;
    const reconcile = () => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(() => { scheduled = false; void fetchActiveTimer(); }, 0);
    };
    const visible = () => { if (document.visibilityState === 'visible') reconcile(); };
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    const invalidate = () => {
      generationRef.current += 1;
      operationLocks.current.clear();
      setActiveTimer(null);
      setElapsedSeconds(0);
    };
    window.addEventListener('organization:changed', invalidate);
    window.addEventListener('auth:cleared', invalidate);
    document.addEventListener('visibilitychange', visible);
    return () => { generationRef.current += 1; window.removeEventListener('pageshow', reconcile); window.removeEventListener('focus', reconcile); window.removeEventListener('organization:changed', invalidate); window.removeEventListener('auth:cleared', invalidate); document.removeEventListener('visibilitychange', visible); };
  }, [fetchActiveTimer]);

  useEffect(() => {
    const handleTimerUpdated = () => {
      fetchActiveTimer();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('time:updated', handleTimerUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('time:updated', handleTimerUpdated);
      }
    };
  }, [fetchActiveTimer]);

  useEffect(() => {
    if (activeTimer && !activeTimer.pausedAt && elapsedSeconds >= targetMinutes * 60) {
      if (!hasTriggeredExpiration.current) {
        hasTriggeredExpiration.current = true;
        fetchActiveTimer();
      }
    } else if (elapsedSeconds < targetMinutes * 60 || !activeTimer) {
      hasTriggeredExpiration.current = false;
    }
  }, [elapsedSeconds, targetMinutes, activeTimer, fetchActiveTimer]);

  // Update elapsed time every second
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeTimer.startTime).getTime();
      const pausedMs = activeTimer.totalPausedMs ?? 0;
      
      if (activeTimer.pausedAt) {
        const currentPauseStart = new Date(activeTimer.pausedAt).getTime();
        setElapsedSeconds(Math.floor((currentPauseStart - start - pausedMs) / 1000));
      } else {
        const adjustedNow = Date.now() - skewRef.current;
        setElapsedSeconds(Math.floor((adjustedNow - start - pausedMs) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  // Limpiar timer cuando el usuario cierra sesión o es null
  useEffect(() => {
    if (!user?.id || !user.organizationId) {
      setActiveTimer(null);
      setElapsedSeconds(0);
    }
  }, [user?.id, user?.organizationId]);

  // Load active timer on mount
  useEffect(() => {
    const initTimer = async () => {
      if (!user?.id) return;
      if (!user.organizationId) return;
      try {
        const data = await apiGet<{ serverTime: string }>('/time/now', {
          silent: true,
          skipAuthRedirect: true,
          suppressStatuses: [401],
        });
        if (data?.serverTime) {
          skewRef.current = Date.now() - new Date(data.serverTime).getTime();
        }
      } catch (err) {
        if ((err as any)?.status !== 401) {
          console.warn('Failed to fetch server time for skew sync:', err);
        }
      }
      fetchActiveTimer();
    };
    initTimer();
  }, [fetchActiveTimer, user?.id, user?.organizationId]);

  return {
    activeTimer,
    isRunning: !!activeTimer,
    isPaused: !!activeTimer?.pausedAt,
    isLoading,
    error,
    elapsedSeconds,
    targetMinutes,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    updateTargetMinutes,
    refreshTimer: fetchActiveTimer,
    sendHeartbeat,
    acknowledgeExpiration,
  };
}


