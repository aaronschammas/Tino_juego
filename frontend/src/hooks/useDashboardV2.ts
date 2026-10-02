'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetCached, getActiveOrganizationId } from '@/lib/api';
import {
  DashboardHeatmapResponse,
  DashboardProjectsResponse,
  DashboardSummaryResponse,
  DashboardTasksResponse,
} from '@/types/analytics';
import { useAuth } from './useAuth';

export interface DashboardFilters {
  projectId: string | 'all';
  startDate: string | null;
  endDate: string | null;
  status: string | 'all';
}

interface DashboardData {
  summary: DashboardSummaryResponse | null;
  tasks: DashboardTasksResponse | null;
  heatmap: DashboardHeatmapResponse | null;
  projects: DashboardProjectsResponse | null;
}

const EMPTY_DATA: DashboardData = {
  summary: null,
  tasks: null,
  heatmap: null,
  projects: null,
};
const DASHBOARD_STALE_TIME_MS = 20_000;
const FILTER_DEBOUNCE_MS = 300;

type DashboardSection = keyof DashboardData;
type SectionLoadingState = Record<DashboardSection, boolean>;
type SectionErrorState = Partial<Record<DashboardSection, string>>;

const EMPTY_SECTION_LOADING: SectionLoadingState = {
  summary: false,
  tasks: false,
  heatmap: false,
  projects: false,
};

const dashboardDataCache = new Map<string, DashboardData>();

function getDashboardCacheKey(
  userId: string | null | undefined,
  userOrganizationId: string | null | undefined,
  query: string,
) {
  const organizationId = getActiveOrganizationId() ?? userOrganizationId ?? 'no-org';
  return `${userId ?? 'no-user'}:${organizationId}:${query}`;
}

function readDashboardCache(
  userId: string | null | undefined,
  userOrganizationId: string | null | undefined,
  query: string,
): DashboardData | null {
  return dashboardDataCache.get(getDashboardCacheKey(userId, userOrganizationId, query)) ?? null;
}

function writeDashboardCache(
  userId: string | null | undefined,
  userOrganizationId: string | null | undefined,
  query: string,
  data: DashboardData,
) {
  dashboardDataCache.set(getDashboardCacheKey(userId, userOrganizationId, query), data);
}

export function resetDashboardStore() {
  dashboardDataCache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth:cleared', resetDashboardStore);
  window.addEventListener('organization:changed', resetDashboardStore);
}

export function buildDashboardQuery(filters: DashboardFilters, cursor?: string) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('from', filters.startDate);
  if (filters.endDate) params.set('to', filters.endDate);
  if (filters.projectId !== 'all') params.set('projectIds', filters.projectId);
  if (filters.status !== 'all') params.set('statuses', filters.status);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

function endpoint(path: string, query: string) {
  return `/analytics/dashboard/${path}${query ? `?${query}` : ''}`;
}

/**
 * Loads the four dashboard sections in parallel for the debounced filters.
 * Disabling the hook discards responses that are still in flight.
 */
export function useDashboardV2(options: { enabled?: boolean } = {}) {
  const { user, isLoading: authLoading } = useAuth();
  const canUseWorkspace =
    Boolean(user?.organizationId) && options.enabled !== false;
  const defaultFilters: DashboardFilters = {
    projectId: 'all',
    startDate: null,
    endDate: null,
    status: 'all',
  };
  const initialCachedData = readDashboardCache(
    user?.id,
    user?.organizationId,
    buildDashboardQuery(defaultFilters),
  );
  const [data, setData] = useState<DashboardData>(initialCachedData ?? EMPTY_DATA);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [sectionLoading, setSectionLoading] = useState<SectionLoadingState>(EMPTY_SECTION_LOADING);
  const [sectionErrors, setSectionErrors] = useState<SectionErrorState>({});
  const [isLoading, setIsLoading] = useState(!initialCachedData);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const dataRef = useRef(data);
  const lastQueryRef = useRef<string | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchDashboard = useCallback(
    async (options?: { force?: boolean; background?: boolean }) => {
      if (authLoading) return;
      if (!canUseWorkspace) {
        requestSequence.current += 1;
        setData(
          readDashboardCache(
            user?.id,
            user?.organizationId,
            buildDashboardQuery(debouncedFilters),
          ) ??
            EMPTY_DATA,
        );
        setError(null);
        setSectionErrors({});
        setSectionLoading(EMPTY_SECTION_LOADING);
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      const requestId = ++requestSequence.current;
      const query = buildDashboardQuery(debouncedFilters);
      const isFilterChange = lastQueryRef.current !== null && lastQueryRef.current !== query;
      lastQueryRef.current = query;
      const isBackground = Boolean(options?.background) && !isFilterChange;
      const cachedForQuery = readDashboardCache(user?.id, user?.organizationId, query);
      try {
        setError(null);
        setSectionErrors({});
        setIsLoading((current) => (isBackground || cachedForQuery ? current : true));
        setIsFetching(true);
        setSectionLoading({
          summary: true,
          tasks: true,
          heatmap: true,
          projects: true,
        });
        if (!isBackground && cachedForQuery) {
          setData(cachedForQuery);
        }
        const cacheOptions = {
          staleTime: DASHBOARD_STALE_TIME_MS,
          force: options?.force,
        };

        const requests = [
          ['summary', endpoint('summary', query), apiGetCached<DashboardSummaryResponse>],
          ['tasks', endpoint('tasks', query), apiGetCached<DashboardTasksResponse>],
          ['heatmap', endpoint('heatmap', query), apiGetCached<DashboardHeatmapResponse>],
          ['projects', endpoint('projects', query), apiGetCached<DashboardProjectsResponse>],
        ] as const;

        const results = await Promise.all(
          requests.map(async ([section, url, request]) => {
            try {
              const value = await request(url, cacheOptions);
              return { ok: true as const, section, value };
            } catch (requestError) {
              const message =
                requestError instanceof Error
                  ? requestError.message
                  : 'No se pudo cargar esta sección';
              return { ok: false as const, section, message };
            }
          }),
        );

        if (requestId === requestSequence.current) {
          const nextData = results.reduce<DashboardData>(
            (current, result) =>
              result.ok ? { ...current, [result.section]: result.value } : current,
            isBackground ? dataRef.current : EMPTY_DATA,
          );
          const nextErrors = results.reduce<SectionErrorState>(
            (current, result) =>
              result.ok ? current : { ...current, [result.section]: result.message },
            {},
          );
          const firstFailure = results.find((result) => !result.ok);
          setData(nextData);
          if (results.every((result) => result.ok)) {
            writeDashboardCache(user?.id, user?.organizationId, query, nextData);
          }
          setSectionErrors(nextErrors);
          setSectionLoading(EMPTY_SECTION_LOADING);
          setError(results.every((result) => !result.ok) && firstFailure ? firstFailure.message : null);
        }
      } finally {
        if (requestId === requestSequence.current) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    },
    [authLoading, canUseWorkspace, debouncedFilters, user?.id, user?.organizationId],
  );

  const loadMoreTasks = useCallback(async () => {
    const cursor = data.tasks?.criticalTasks.nextCursor;
    if (!cursor || isLoadingMore) return;
    const requestId = requestSequence.current;
    setIsLoadingMore(true);
    try {
      const query = buildDashboardQuery(debouncedFilters, cursor);
      const next = await apiGetCached<DashboardTasksResponse>(endpoint('tasks', query), {
        staleTime: DASHBOARD_STALE_TIME_MS,
      });
      setData((current) => {
        if (!current.tasks || requestId !== requestSequence.current) return current;
        return {
          ...current,
          tasks: {
            ...next,
            statusDistribution: current.tasks.statusDistribution,
            priorityDistribution: current.tasks.priorityDistribution,
            criticalTasks: {
              ...next.criticalTasks,
              items: [...current.tasks.criticalTasks.items, ...next.criticalTasks.items],
            },
          },
        };
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar más tareas');
    } finally {
      setIsLoadingMore(false);
    }
  }, [data.tasks, debouncedFilters, isLoadingMore]);

  useEffect(() => {
    if (!authLoading) void fetchDashboard({ background: true });
  }, [authLoading, fetchDashboard]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilters(filters);
    }, FILTER_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void fetchDashboard({ background: true, force: true }), 250);
    };
    window.addEventListener('task:updated', refresh);
    window.addEventListener('time:updated', refresh);
    window.addEventListener('projects:updated', refresh);
    window.addEventListener('projects:reset', refresh);
    window.addEventListener('organization:changed', refresh);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('task:updated', refresh);
      window.removeEventListener('time:updated', refresh);
      window.removeEventListener('projects:updated', refresh);
      window.removeEventListener('projects:reset', refresh);
      window.removeEventListener('organization:changed', refresh);
    };
  }, [fetchDashboard]);

  return {
    ...data,
    filters,
    setFilters,
    isLoading,
    isFetching,
    isLoadingMore,
    sectionLoading,
    sectionErrors,
    error,
    isEmpty:
      data.summary !== null &&
      data.summary.kpis.totalTasks === 0 &&
      (data.heatmap?.totals.minutes ?? 0) === 0,
    refetch: (options?: { force?: boolean }) => void fetchDashboard(options),
    loadMoreTasks,
  };
}
