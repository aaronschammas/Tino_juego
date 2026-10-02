import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIdleDetectionOptions {
  idleAfterMinutes?: number;
}

export function useIdleDetection({
  idleAfterMinutes = 10,
}: UseIdleDetectionOptions = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleMs = idleAfterMinutes * 60 * 1000;

  const resetIdle = useCallback(() => {
    setIsIdle(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetIdle, { passive: true });
    });

    resetIdle();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetIdle);
      });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetIdle]);

  return { isIdle, resetIdle };
}
