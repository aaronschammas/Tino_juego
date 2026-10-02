import { act, render, screen, waitFor } from '@testing-library/react';
import ProjectDetailPage from './page';
import { Project } from '@/types/project';
import { ApiClientError } from '@/lib/api';

const push = jest.fn();
const replace = jest.fn();
const mockRouter = { push, replace };
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockFetchTasks = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useRouter: () => mockRouter,
}));

jest.mock('@/components/layout/ProtectedLayout', () => {
  function ProtectedLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
  return ProtectedLayout;
});

jest.mock('@/lib/api', () => ({
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

const mockTasksApi = {
  tasks: [],
  fetchTasks: (...args: unknown[]) => mockFetchTasks(...args),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  deleteTask: jest.fn(),
};

jest.mock('@/components/integrations/ProjectIntegrationPanel', () => {
  function ProjectIntegrationPanel({ canManage }: { canManage: boolean }) {
    return <div>Integration panel {canManage ? 'manage' : 'read-only'}</div>;
  }
  return ProjectIntegrationPanel;
});
jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => mockTasksApi,
}));

jest.mock('@/context/TimerContext', () => ({
  useTimerControls: () => ({
    activeTimer: null,
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
  }),
}));

let mockUserRole: string | null = 'ORG_OWNER';
let mockMembersError: string | null = null;

jest.mock('@/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    members: [],
    userRole: mockUserRole,
    error: mockMembersError,
    refreshMembers: jest.fn(),
  }),
}));

let mockAuthUser: { id: string; role: string } = { id: 'user-1', role: 'USER' };

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const mockProject: Project = {
  id: 'project-1',
  name: 'Proyecto Demo',
  priority: 'MEDIUM' as Project['priority'],
  ownerId: 'owner-1',
  isActive: true,
  members: [],
  timeEntries: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRole = 'ORG_OWNER';
    mockMembersError = null;
    mockAuthUser = { id: 'user-1', role: 'USER' };
    mockFetchTasks.mockResolvedValue([]);
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/projects/')) return Promise.resolve(mockProject);
      if (url.startsWith('/time/history')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it('shows "Agregar persona" for an ORG_OWNER who is not the project owner', async () => {
    // Arrange
    mockUserRole = 'ORG_OWNER';
    mockAuthUser = { id: 'someone-else', role: 'USER' };

    // Act
    render(<ProjectDetailPage />);

    // Assert
    await waitFor(() => expect(screen.getByText('Proyecto Demo')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Agregar persona' })).toBeInTheDocument();
  });

  it('hides "Agregar persona" for a regular member who does not own the project', async () => {
    // Arrange
    mockUserRole = 'ORG_MEMBER';
    mockAuthUser = { id: 'someone-else', role: 'USER' };

    // Act
    render(<ProjectDetailPage />);

    // Assert
    await waitFor(() => expect(screen.getByText('Proyecto Demo')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Agregar persona' })).not.toBeInTheDocument();
  });

  it('shows "Agregar persona" for the project owner even without an ORG_OWNER role', async () => {
    // Arrange
    mockUserRole = 'ORG_MEMBER';
    mockAuthUser = { id: 'owner-1', role: 'USER' };

    // Act
    render(<ProjectDetailPage />);

    // Assert
    await waitFor(() => expect(screen.getByText('Proyecto Demo')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Agregar persona' })).toBeInTheDocument();
  });

  it('warns the user when the organization role could not be verified', async () => {
    // Arrange
    mockMembersError = 'Error al cargar miembros de la organizacion';

    // Act
    render(<ProjectDetailPage />);

    // Assert
    await waitFor(() => expect(screen.getByText('Proyecto Demo')).toBeInTheDocument());
    expect(screen.getByText('No pudimos verificar tus permisos')).toBeInTheDocument();
  });

  it('redirects without rendering when the project is not accessible', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/projects/')) {
        return Promise.reject(new ApiClientError('Project not found', 404));
      }
      return Promise.resolve([]);
    });

    render(<ProjectDetailPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/projects'));
    expect(screen.queryByText('Proyecto Demo')).not.toBeInTheDocument();
  });

  it('keeps legitimate server errors visible instead of treating them as missing projects', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/projects/')) {
        return Promise.reject(new ApiClientError('Backend unavailable', 500));
      }
      return Promise.resolve([]);
    });

    render(<ProjectDetailPage />);

    await waitFor(() => expect(screen.getByText('Backend unavailable')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not render a late project response after a newer request completed', async () => {
    let resolveOld!: (project: Project) => void;
    const oldRequest = new Promise<Project>((resolve) => {
      resolveOld = resolve;
    });
    const currentProject = { ...mockProject, name: 'Proyecto Actual' };
    mockApiGet
      .mockImplementationOnce(() => oldRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(currentProject)
      .mockResolvedValue([]);

    render(<ProjectDetailPage />);
    window.dispatchEvent(new Event('projects:updated'));

    await waitFor(() => expect(screen.getByText('Proyecto Actual')).toBeInTheDocument());
    resolveOld({ ...mockProject, name: 'Proyecto Anterior' });
    await Promise.resolve();

    expect(screen.queryByText('Proyecto Anterior')).not.toBeInTheDocument();
    expect(screen.getByText('Proyecto Actual')).toBeInTheDocument();
  });

  describe('background refresh after a change', () => {
    const projectCalls = () =>
      mockApiGet.mock.calls.filter(([url]) => url === '/projects/project-1');

    async function renderLoadedPage(refresh: () => Promise<Project>) {
      render(<ProjectDetailPage />);
      await screen.findByText('Proyecto Demo');
      mockApiGet.mockClear();
      mockFetchTasks.mockClear();
      mockApiGet.mockImplementation((url: string) =>
        url.startsWith('/projects/') ? refresh() : Promise.resolve([]),
      );
    }

    it('keeps the table on screen and coalesces events fired together into one refresh', async () => {
      let resolveRefresh!: (project: Project) => void;
      await renderLoadedPage(
        () => new Promise<Project>((resolve) => { resolveRefresh = resolve; }),
      );

      act(() => {
        window.dispatchEvent(new Event('task:updated'));
        window.dispatchEvent(new Event('projects:updated'));
      });
      await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(1));

      expect(screen.queryByText('Cargando proyecto...')).not.toBeInTheDocument();
      expect(screen.getByText('Proyecto Demo')).toBeInTheDocument();
      await act(async () => resolveRefresh({ ...mockProject, name: 'Proyecto Renombrado' }));
      expect(await screen.findByText('Proyecto Renombrado')).toBeInTheDocument();
      expect(projectCalls()).toHaveLength(1);
    });

    it('keeps the current project when a background refresh fails', async () => {
      await renderLoadedPage(() =>
        Promise.reject(new ApiClientError('Backend unavailable', 500)),
      );

      act(() => {
        window.dispatchEvent(new Event('task:updated'));
      });
      await waitFor(() => expect(projectCalls()).toHaveLength(1));

      expect(screen.getByText('Proyecto Demo')).toBeInTheDocument();
      expect(screen.queryByText('No pudimos cargar el proyecto')).not.toBeInTheDocument();
    });

    it('still redirects when a background refresh finds the project inaccessible', async () => {
      await renderLoadedPage(() =>
        Promise.reject(new ApiClientError('Project not found', 404)),
      );

      act(() => {
        window.dispatchEvent(new Event('projects:updated'));
      });

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/projects'));
    });
  });
});
