'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useAuth } from './useAuth';
import { TaskStatus } from '@/types/task';
import type { TasksPage } from '@/types/task-list';
import type { TimeSummaryPage } from '@/types/mobile-time';
import type { MobileHomeTasks } from '@/types/mobile-dashboard';

const ZONE = 'America/Argentina/Buenos_Aires';
type Block = keyof MobileHomeTasks | 'time';
type BlockStatus = { loading: boolean; error: string | null };
const initialStatus = (): Record<Block, BlockStatus> => ({
  overdue: { loading: true, error: null },
  upcoming: { loading: true, error: null },
  inProgress: { loading: true, error: null },
  time: { loading: true, error: null },
});

export function useMobileHome() {
  const { user, activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const contextRef = useRef({ organizationId, userId: user?.id ?? null });
  contextRef.current = { organizationId, userId: user?.id ?? null };
  const generation = useRef(0);
  const requestIds = useRef<Record<Block, number>>({ overdue: 0, upcoming: 0, inProgress: 0, time: 0 });
  const mounted = useRef(true);
  const [tasks, setTasks] = useState<MobileHomeTasks>({ overdue: [], upcoming: [], inProgress: [] });
  const [time, setTime] = useState<TimeSummaryPage | null>(null);
  const [status, setStatus] = useState(initialStatus);

  const clear = useCallback(() => {
    generation.current += 1;
    setTasks({ overdue: [], upcoming: [], inProgress: [] });
    setTime(null);
    setStatus(initialStatus());
  }, []);

  const load = useCallback(async (block: Block) => {
    const context = contextRef.current;
    if (!context.organizationId || !context.userId) return;
    const requestGeneration = generation.current;
    const requestId = ++requestIds.current[block];
    setStatus((current) => ({ ...current, [block]: { loading: true, error: null } }));
    try {
      if (block === 'time') {
        const result = await apiGet<TimeSummaryPage>(
          `/time/summary?page=1&pageSize=1&timezone=${encodeURIComponent(ZONE)}`,
        );
        if (valid()) setTime(result);
      } else {
        const params = new URLSearchParams({ assignedTo: 'me', page: '1', pageSize: block === 'upcoming' ? '10' : '5' });
        if (block === 'overdue') params.set('overdue', 'true');
        if (block === 'upcoming') {
          const now = new Date();
          params.set('dueFrom', now.toISOString());
          params.set('dueTo', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
          params.set('openOnly', 'true');
        }
        if (block === 'inProgress') params.set('status', TaskStatus.IN_PROGRESS);
        const result = await apiGet<TasksPage>(`/tasks?${params.toString()}`);
        let items = result.items;
        if (block === 'upcoming') {
          items = items.slice(0, 5);
        }
        if (valid()) setTasks((current) => ({ ...current, [block]: items }));
      }
      if (valid()) setStatus((current) => ({ ...current, [block]: { loading: false, error: null } }));
    } catch (error) {
      if (valid()) {
        setStatus((current) => ({
          ...current,
          [block]: {
            loading: false,
            error: error instanceof Error ? error.message : 'No se pudo cargar este bloque.',
          },
        }));
      }
    }

    function valid() {
      return mounted.current &&
        generation.current === requestGeneration &&
        requestIds.current[block] === requestId &&
        contextRef.current.organizationId === context.organizationId &&
        contextRef.current.userId === context.userId;
    }
  }, []);

  useEffect(() => {
    clear();
    if (organizationId && user?.id) {
      void Promise.all([
        load('overdue'),
        load('upcoming'),
        load('inProgress'),
        load('time'),
      ]);
    }
  }, [clear, load, organizationId, user?.id]);

  useEffect(() => {
    mounted.current = true;
    window.addEventListener('organization:changed', clear);
    window.addEventListener('auth:cleared', clear);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener('organization:changed', clear);
      window.removeEventListener('auth:cleared', clear);
    };
  }, [clear]);

  return { tasks, time, status, retry: load, timezone: ZONE };
}
