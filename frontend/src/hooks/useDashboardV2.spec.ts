import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGetCached } from '@/lib/api';
import { useAuth } from './useAuth';
import {
  buildDashboardQuery,
  resetDashboardStore,
  useDashboardV2,
} from './useDashboardV2';
import {
  DashboardHeatmapResponse,
  DashboardProjectsResponse,
  DashboardSummaryResponse,
  DashboardTasksResponse,
} from '@/types/analytics';

jest.mock('@/lib/api', () => ({
  apiGetCached: jest.fn(),
  getActiveOrganizationId: jest.fn(() => null),
}));
jest.mock('./useAuth');

const context = {
  range: { from: '2026-06-01T03:00:00.000Z', to: '2026-07-01T03:00:00.000Z' },
  timezone: 'America/Argentina/Buenos_Aires',
  scope: { organizationId: 'org-1', projectIds: ['project-1'], userIds: [] },
};
const summary: DashboardSummaryResponse = {
  ...context,
  metricSemantics: { tasks: 'stock', time: 'range' },
  kpis: {
    totalTasks: 10,
    openTasks: 6,
    completedTasks: 4,
    overdueTasks: 2,
    blockedTasks: 1,
    completionRate: 40,
    estimatedHours: 20,
    actualHours: 18,
    effortDeviationHours: -2,
    activeUsers: 3,
    tasksWithoutTime: 2,
    unassignedTasks: 1,
  },
};
const tasks: DashboardTasksResponse = {
  ...context,
  statusDistribution: [{ status: 'DONE', count: 4 }],
  priorityDistribution: [{ priority: 'HIGH', count: 2 }],
  criticalTasks: { items: [], nextCursor: null, total: 0 },
};
const heatmap: DashboardHeatmapResponse = {
  range: context.range,
  timezone: context.timezone,
  groupBy: 'hourOfWeek',
  totals: { minutes: 1080, entries: 10, users: 3, projects: 1 },
  cells: [],
  normalization: { method: 'p95', maxMinutes: 60 },
};
const projectsResponse: DashboardProjectsResponse = {
  ...context,
  projects: [],
};

function mockEndpoints() {
  (apiGetCached as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/summary')) return Promise.resolve(summary);
    if (url.includes('/tasks')) return Promise.resolve(tasks);
    if (url.includes('/heatmap')) return Promise.resolve(heatmap);
    if (url.includes('/projects')) return Promise.resolve(projectsResponse);
    return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
  });
}

describe('useDashboardV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDashboardStore();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1', organizationId: 'org-1' },
      isLoading: false,
    });
    mockEndpoints();
  });

  it('omits optional date and scope filters when all filters are cleared', () => {
    expect(buildDashboardQuery({
      projectId: 'all',
      startDate: null,
      endDate: null,
      status: 'all',
    })).toBe('');
  });

  it('loads the four v2 endpoints used by the dashboard and never calls /analytics/bi', async () => {
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const urls = (apiGetCached as jest.Mock).mock.calls.map(([url]) => String(url));
    expect(urls.map((url) => url.split('?')[0])).toEqual(expect.arrayContaining([
      '/analytics/dashboard/summary',
      '/analytics/dashboard/tasks',
      '/analytics/dashboard/heatmap',
      '/analytics/dashboard/projects',
    ]));
    for (const url of urls) {
      expect(url).not.toContain('from=');
      expect(url).not.toContain('to=');
    }
    expect(urls.some((url) => url.includes('/analytics/bi'))).toBe(false);
    expect(result.current.summary?.kpis.totalTasks).toBe(10);
    expect(result.current.tasks?.criticalTasks.total).toBe(0);
    expect(result.current.filters).toEqual({
      projectId: 'all',
      startDate: null,
      endDate: null,
      status: 'all',
    });
  });

  it('keeps dashboard data on screen when remounting after a navigation', async () => {
    const first = renderHook(() => useDashboardV2());
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current.summary?.kpis.totalTasks).toBe(10);
    first.unmount();

    const second = renderHook(() => useDashboardV2());

    expect(second.result.current.summary?.kpis.totalTasks).toBe(10);
    expect(second.result.current.isLoading).toBe(false);
  });

  it('starts empty and loading when nothing was cached for the organization', () => {
    resetDashboardStore();

    const { result } = renderHook(() => useDashboardV2());

    expect(result.current.summary).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('drops cached dashboard data when the organization changes', async () => {
    const first = renderHook(() => useDashboardV2());
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    resetDashboardStore();
    const second = renderHook(() => useDashboardV2());

    expect(second.result.current.summary).toBeNull();
    expect(second.result.current.isLoading).toBe(true);
  });

  it('does not share cached dashboard data between users in the same organization', async () => {
    const first = renderHook(() => useDashboardV2());
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-2', organizationId: 'org-1' },
      isLoading: false,
    });
    const second = renderHook(() => useDashboardV2());

    expect(second.result.current.summary).toBeNull();
    expect(second.result.current.isLoading).toBe(true);
  });

  it('sends project, status and date filters to the backend', async () => {
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    (apiGetCached as jest.Mock).mockClear();
    jest.useFakeTimers();

    act(() => {
      result.current.setFilters({
        projectId: 'project-2',
        status: 'BLOCKED',
        startDate: '2026-06-01',
        endDate: '2026-06-21',
      });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(apiGetCached).toHaveBeenCalledTimes(4));
    for (const [url] of (apiGetCached as jest.Mock).mock.calls) {
      expect(url).toContain('from=2026-06-01');
      expect(url).toContain('to=2026-06-21');
      expect(url).toContain('projectIds=project-2');
      expect(url).toContain('statuses=BLOCKED');
    }
    jest.useRealTimers();
  });

  it('clears all endpoint data and exposes one error if a request fails', async () => {
    (apiGetCached as jest.Mock).mockRejectedValue(new Error('API caída'));
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.error).toBe('API caída'));
    expect(result.current.summary).toBeNull();
    expect(result.current.tasks).toBeNull();
    expect(result.current.heatmap).toBeNull();
  });

  it('does not request analytics without an organization', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, isLoading: false });
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiGetCached).not.toHaveBeenCalled();
  });

  it('discards in-flight responses once the dashboard is disabled', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const respond = (apiGetCached as jest.Mock).getMockImplementation()!;
    (apiGetCached as jest.Mock).mockImplementation(async (url: string) => {
      await gate;
      return respond(url);
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useDashboardV2({ enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(apiGetCached).toHaveBeenCalledTimes(4));

    rerender({ enabled: false });
    await act(async () => {
      release();
      await gate;
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it('waits for authentication before requesting dashboard data', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    const { result } = renderHook(() => useDashboardV2());

    expect(result.current.isLoading).toBe(true);
    expect(apiGetCached).not.toHaveBeenCalled();
  });

  it('keeps successful sections when one dashboard endpoint fails', async () => {
    (apiGetCached as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/heatmap')) return Promise.reject(new Error('Heatmap lento'));
      if (url.includes('/summary')) return Promise.resolve(summary);
      if (url.includes('/tasks')) return Promise.resolve(tasks);
      if (url.includes('/projects')) return Promise.resolve(projectsResponse);
      return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });

    const { result } = renderHook(() => useDashboardV2());

    await waitFor(() => expect(result.current.summary?.kpis.totalTasks).toBe(10));
    await waitFor(() => expect(result.current.sectionErrors.heatmap).toBe('Heatmap lento'));
    expect(result.current.error).toBeNull();
    expect(result.current.tasks?.criticalTasks.total).toBe(0);
    expect(result.current.heatmap).toBeNull();
  });

  it('uses a safe section error for non-Error rejections', async () => {
    (apiGetCached as jest.Mock).mockRejectedValue('offline');
    const { result } = renderHook(() => useDashboardV2());

    await waitFor(() => expect(result.current.error).toBe('No se pudo cargar esta sección'));
    expect(result.current.sectionErrors).toEqual({
      summary: 'No se pudo cargar esta sección',
      tasks: 'No se pudo cargar esta sección',
      heatmap: 'No se pudo cargar esta sección',
      projects: 'No se pudo cargar esta sección',
    });
  });

  it('debounces rapid filter changes into one dashboard request batch', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    (apiGetCached as jest.Mock).mockClear();

    act(() => {
      result.current.setFilters((current) => ({ ...current, status: 'TODO' }));
      result.current.setFilters((current) => ({ ...current, status: 'BLOCKED' }));
      result.current.setFilters((current) => ({ ...current, projectId: 'project-2' }));
    });

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(apiGetCached).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => expect(apiGetCached).toHaveBeenCalledTimes(4));
    for (const [url] of (apiGetCached as jest.Mock).mock.calls) {
      expect(url).toContain('projectIds=project-2');
      expect(url).toContain('statuses=BLOCKED');
    }
    jest.useRealTimers();
  });

  it('marks an all-zero response as empty without breaking on empty arrays', async () => {
    const emptySummary = { ...summary, kpis: { ...summary.kpis, totalTasks: 0 } };
    const emptyHeatmap = { ...heatmap, totals: { minutes: 0, entries: 0, users: 0, projects: 0 } };
    (apiGetCached as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/summary')) return Promise.resolve(emptySummary);
      if (url.includes('/tasks')) return Promise.resolve(tasks);
      if (url.includes('/projects')) return Promise.resolve(projectsResponse);
      return Promise.resolve(emptyHeatmap);
    });
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
  });

  it.each(['task:updated', 'projects:updated'])('%s forces fresh dashboard requests', async (eventName) => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    (apiGetCached as jest.Mock).mockClear();
    act(() => window.dispatchEvent(new Event(eventName)));
    act(() => jest.advanceTimersByTime(250));
    await waitFor(() => expect(apiGetCached).toHaveBeenCalledTimes(4));
    for (const [, options] of (apiGetCached as jest.Mock).mock.calls) {
      expect(options).toEqual(expect.objectContaining({ force: true }));
    }
    jest.useRealTimers();
  });

  it('uses nextCursor to append another backend task page', async () => {
    const firstItem = {
      id: 'task-1',
      title: 'Primera',
      projectId: 'project-1',
      projectName: 'Proyecto',
      status: 'BLOCKED' as const,
      priority: 'HIGH' as const,
      assignedTo: null,
      estimatedHours: 1,
      actualHours: 2,
      deviationHours: 1,
      dueDate: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    const firstPage = {
      ...tasks,
      criticalTasks: { items: [firstItem], nextCursor: 'task-1', total: 2 },
    };
    const secondPage = {
      ...tasks,
      criticalTasks: {
        items: [{ ...firstItem, id: 'task-2', title: 'Segunda' }],
        nextCursor: null,
        total: 2,
      },
    };
    (apiGetCached as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/summary')) return Promise.resolve(summary);
      if (url.includes('/tasks'))
        return Promise.resolve(url.includes('cursor=task-1') ? secondPage : firstPage);
      if (url.includes('/projects')) return Promise.resolve(projectsResponse);
      return Promise.resolve(heatmap);
    });

    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.tasks?.criticalTasks.items).toHaveLength(1));
    await act(async () => void (await result.current.loadMoreTasks()));
    await waitFor(() => expect(result.current.tasks?.criticalTasks.items).toHaveLength(2));
    expect(result.current.tasks?.criticalTasks.nextCursor).toBeNull();
  });

  it('does not request another page when there is no next cursor', async () => {
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.tasks).not.toBeNull());
    (apiGetCached as jest.Mock).mockClear();

    await act(async () => void (await result.current.loadMoreTasks()));

    expect(apiGetCached).not.toHaveBeenCalled();
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('reports a safe error when loading the next task page rejects with a non-Error value', async () => {
    const firstPage = {
      ...tasks,
      criticalTasks: { items: [], nextCursor: 'next-task', total: 1 },
    };
    (apiGetCached as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('cursor=next-task')) return Promise.reject('offline');
      if (url.includes('/summary')) return Promise.resolve(summary);
      if (url.includes('/tasks')) return Promise.resolve(firstPage);
      if (url.includes('/projects')) return Promise.resolve(projectsResponse);
      return Promise.resolve(heatmap);
    });
    const { result } = renderHook(() => useDashboardV2());
    await waitFor(() => expect(result.current.tasks?.criticalTasks.nextCursor).toBe('next-task'));

    await act(async () => void (await result.current.loadMoreTasks()));

    expect(result.current.error).toBe('No se pudieron cargar más tareas');
    expect(result.current.isLoadingMore).toBe(false);
  });
});
