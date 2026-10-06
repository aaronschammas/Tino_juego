import { act, render, screen, waitFor } from '@testing-library/react';
import BIDashboardPage from './page';
import { useDashboardV2 } from '@/hooks/useDashboardV2';

const push = jest.fn();
const mockGetMyOrganization = jest.fn();
let mockProjects: Array<{ id: string; name: string }> = [{ id: 'project-1', name: 'Proyecto compartido' }];
let mockWorkspaceState = {
  hasAccessibleProjects: true,
  hasAccessibleTasks: true,
};
let mockMembershipRole: 'ORG_OWNER' | 'ORG_MEMBER' = 'ORG_OWNER';

jest.mock('next/dynamic', () => (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
  const ReactRuntime = jest.requireActual<typeof import('react')>('react');
  const LazyComponent = ReactRuntime.lazy(loader);
  function DynamicComponent(props: Record<string, unknown>) {
    return (
      <ReactRuntime.Suspense fallback={null}>
        <LazyComponent {...props} />
      </ReactRuntime.Suspense>
    );
  }
  return DynamicComponent;
});
jest.mock('@/components/layout/ProtectedLayout', () => {
  function ProtectedLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
  return ProtectedLayout;
});
jest.mock('@/components/dashboard/DashboardHeader', () => {
  function DashboardHeader() { return <div>Dashboard header</div>; }
  return DashboardHeader;
});
jest.mock('@/components/dashboard/DashboardSlicers', () => {
  function DashboardSlicers({ projects }: { projects: Array<{ name: string }> }) {
    return <div>Dashboard filters: {projects.map((project) => project.name).join(', ')}</div>;
  }
  return DashboardSlicers;
});
jest.mock('@/components/dashboard/KPIStatCard', () => {
  function KPIStatCard({ label, value }: { label: string; value: string | number }) {
    return <div>{label}: {value}</div>;
  }
  return KPIStatCard;
});
jest.mock('@/components/dashboard/BurndownChart', () => {
  function BurndownChart() { return <div>Task distribution</div>; }
  return BurndownChart;
});
jest.mock('@/components/dashboard/ProjectDeviationChart', () => {
  function ProjectDeviationChart() { return <div>Project deviation</div>; }
  return ProjectDeviationChart;
});
jest.mock('@/components/dashboard/PriorityDistributionChart', () => {
  function PriorityDistributionChart() { return <div>Priority distribution</div>; }
  return PriorityDistributionChart;
});
jest.mock('@/components/dashboard/HealthStatusCard', () => {
  function HealthStatusCard() { return <div>Health status</div>; }
  return HealthStatusCard;
});
jest.mock('@/components/dashboard/ActivityHeatmap', () => {
  function ActivityHeatmap({ data }: { data: { totals: { minutes: number } } }) {
    return <div>Heatmap minutes: {data.totals.minutes}</div>;
  }
  return ActivityHeatmap;
});
jest.mock('@/components/dashboard/TaskTable', () => {
  function TaskTable({ data }: { data: Array<{ title: string }> }) {
    return <div>{data.map((task) => task.title).join(', ')}</div>;
  }
  return TaskTable;
});
jest.mock('@/components/tasks/TaskForm', () => {
  function TaskForm() { return null; }
  return TaskForm;
});
jest.mock('@/components/reports/ReportModal', () => {
  function ReportModal() { return null; }
  return ReportModal;
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
jest.mock('@/hooks/useDashboardV2');
jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: mockProjects,
    isLoading: false,
    error: null,
  }),
}));
jest.mock('@/hooks/useTasks', () => ({ useTasks: () => ({ createTask: jest.fn() }) }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'USER' },
    activeOrganization: { id: 'org-1', name: 'Grido' },
    activeMembership: { role: mockMembershipRole },
  }),
}));
jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    getMyOrganization: mockGetMyOrganization,
  }),
}));

const dashboardResult = {
  summary: {
    kpis: {
      totalTasks: 10,
      openTasks: 6,
      completedTasks: 4,
      completionRate: 40,
      estimatedHours: 20,
      actualHours: 18,
      effortDeviationHours: -2,
      overdueTasks: 2,
      blockedTasks: 1,
      tasksWithoutTime: 3,
      unassignedTasks: 1,
      activeUsers: 4,
    },
  },
  tasks: {
    statusDistribution: [{ status: 'DONE', count: 4 }],
    criticalTasks: {
      items: [{ id: 'task-1', title: 'Tarea crítica del backend' }],
      total: 1,
      nextCursor: null,
    },
  },
  time: { topTasksByDeviation: [] },
  heatmap: { totals: { minutes: 120 }, cells: [] },
  projects: { projects: [] },
  filters: { projectId: 'all', status: 'all', startDate: null, endDate: null },
  setFilters: jest.fn(),
  isLoading: false,
  isFetching: false,
  isLoadingMore: false,
  sectionErrors: {},
  isEmpty: false,
  error: null,
  loadMoreTasks: jest.fn(),
  refetch: jest.fn(),
};

describe('Dashboard page v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjects = [{ id: 'project-1', name: 'Proyecto compartido' }];
    mockWorkspaceState = {
      hasAccessibleProjects: true,
      hasAccessibleTasks: true,
    };
    mockMembershipRole = 'ORG_OWNER';
    mockGetMyOrganization.mockImplementation(() => Promise.resolve({ workspaceState: mockWorkspaceState }));
    (useDashboardV2 as jest.Mock).mockReturnValue(dashboardResult);
  });

  it('renders KPIs, heatmap and critical tasks from v2 responses', async () => {
    render(<BIDashboardPage />);
    expect(await screen.findByText('Total de tareas: 10')).toBeInTheDocument();
    expect(screen.getByText('Tasa de completitud: 40%')).toBeInTheDocument();
    expect(screen.getByText('Heatmap minutes: 120')).toBeInTheDocument();
    expect(screen.getByText('Tarea crítica del backend')).toBeInTheDocument();
  });

  it('renders KPIs before the heatmap section is available', async () => {
    (useDashboardV2 as jest.Mock).mockReturnValue({
      ...dashboardResult,
      heatmap: null,
      isLoading: true,
      sectionErrors: {},
    });
    render(<BIDashboardPage />);
    expect(await screen.findByText('Total de tareas: 10')).toBeInTheDocument();
    expect(screen.queryByText('Heatmap minutes: 120')).not.toBeInTheDocument();
  });

  it('shows a partial section error without hiding loaded KPIs and tasks', async () => {
    (useDashboardV2 as jest.Mock).mockReturnValue({
      ...dashboardResult,
      heatmap: null,
      sectionErrors: { heatmap: 'Heatmap lento' },
    });
    render(<BIDashboardPage />);
    expect(await screen.findByText('Total de tareas: 10')).toBeInTheDocument();
    expect(screen.getByText(/backend/)).toBeInTheDocument();
    expect(screen.getByText('Heatmap lento')).toBeInTheDocument();
  });

  it('renders the shared error state without stale dashboard blocks', async () => {
    (useDashboardV2 as jest.Mock).mockReturnValue({
      ...dashboardResult,
      summary: null,
      tasks: null,
      time: null,
      heatmap: null,
      error: 'No se pudo consultar analytics',
    });
    render(<BIDashboardPage />);
    expect(await screen.findByText('No se pudo consultar analytics')).toBeInTheDocument();
    expect(screen.queryByText('Total de tareas: 10')).not.toBeInTheDocument();
  });

  it('renders the empty state when v2 reports no activity', async () => {
    (useDashboardV2 as jest.Mock).mockReturnValue({
      ...dashboardResult,
      filters: {
        projectId: 'all',
        status: 'all',
        startDate: '2026-07-01',
        endDate: '2026-07-24',
      },
      isEmpty: true,
    });
    render(<BIDashboardPage />);
    await waitFor(() => expect(screen.getByText('Todavía no hay datos para analizar')).toBeInTheDocument());
  });

  it('routes to projects from the empty dashboard when the organization has no projects', async () => {
    mockProjects = [];
    mockWorkspaceState = {
      hasAccessibleProjects: false,
      hasAccessibleTasks: false,
    };
    (useDashboardV2 as jest.Mock).mockReturnValue({ ...dashboardResult, isEmpty: true });
    render(<BIDashboardPage />);
    expect(await screen.findByText('Creá un proyecto para ver tus métricas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    screen.getByRole('button', { name: /Crear tu primer proyecto/i }).click();
    expect(push).toHaveBeenCalledWith('/projects');
  });

  it('does not show organization onboarding only because the current user has no visible projects', async () => {
    mockProjects = [];
    (useDashboardV2 as jest.Mock).mockReturnValue({ ...dashboardResult, isEmpty: true });
    render(<BIDashboardPage />);
    expect(await screen.findByText('Todavía no hay datos para analizar')).toBeInTheDocument();
    expect(screen.queryByText('Creá un proyecto para ver tus métricas')).not.toBeInTheDocument();
  });

  it('starts loading dashboard metrics without waiting for the workspace state', async () => {
    let resolveWorkspace: (value: unknown) => void = () => undefined;
    mockGetMyOrganization.mockImplementation(
      () => new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );

    render(<BIDashboardPage />);

    expect(useDashboardV2).toHaveBeenCalledWith({ enabled: true });
    expect(useDashboardV2).not.toHaveBeenCalledWith({ enabled: false });
    await act(async () => resolveWorkspace({ workspaceState: mockWorkspaceState }));
    expect(useDashboardV2).toHaveBeenLastCalledWith({ enabled: true });
  });

  it('skips dashboard metrics once the workspace is known to have no tasks', async () => {
    mockWorkspaceState = {
      hasAccessibleProjects: true,
      hasAccessibleTasks: false,
    };

    render(<BIDashboardPage />);

    await waitFor(() =>
      expect(useDashboardV2).toHaveBeenLastCalledWith({ enabled: false }),
    );
  });

  it('coalesces task and project mutation events into one workspace refresh', async () => {
    jest.useFakeTimers();
    render(<BIDashboardPage />);
    await Promise.resolve();
    mockGetMyOrganization.mockClear();

    window.dispatchEvent(new Event('task:updated'));
    window.dispatchEvent(new Event('projects:updated'));
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    expect(mockGetMyOrganization).toHaveBeenCalledTimes(1);
    expect(mockGetMyOrganization).toHaveBeenCalledWith({ force: true });
    jest.useRealTimers();
  });

  it('shows an assignment-specific empty state to a member without accessible projects', async () => {
    mockProjects = [];
    mockMembershipRole = 'ORG_MEMBER';
    mockWorkspaceState = {
      hasAccessibleProjects: false,
      hasAccessibleTasks: false,
    };
    (useDashboardV2 as jest.Mock).mockReturnValue({ ...dashboardResult, isEmpty: true });

    render(<BIDashboardPage />);

    expect(
      await screen.findByText('Todavía no tenés proyectos asignados'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Crear tu primer proyecto' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir a proyectos' })).toBeInTheDocument();
  });

  it('opens filtered by the project in the URL from the first request (end screen of the fair)', () => {
    window.history.pushState({}, '', '/dashboard?projectId=project-1');
    render(<BIDashboardPage />);
    expect((useDashboardV2 as jest.Mock).mock.calls[0][0]).toMatchObject({ initialFilters: { projectId: 'project-1' } });
    window.history.pushState({}, '', '/');
  });
});
