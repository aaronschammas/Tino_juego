import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPage from './page';

const createProject = jest.fn();
const updateProject = jest.fn();
const deleteProject = jest.fn();
const refetch = jest.fn();
const getMyOrganization = jest.fn();
const mockUseIntegrationAvailability = jest.fn();

jest.mock('@/components/layout/ProtectedLayout', () => {
  function ProtectedLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
  return ProtectedLayout;
});
jest.mock('@/components/projects/ProjectCard', () => {
  function ProjectCard({ project }: { project: { name: string } }) { return <div>{project.name}</div>; }
  return ProjectCard;
});
jest.mock('@/components/projects/ProjectForm', () => {
  function ProjectForm() { return <div>Project form modal</div>; }
  return ProjectForm;
});
jest.mock('@/components/projects/TrelloImportModal', () => {
  function TrelloImportModal() { return null; }
  return TrelloImportModal;
});
jest.mock('@/components/integrations/TrelloConnectModal', () => {
  function TrelloConnectModal() { return <div>Trello connect modal</div>; }
  return TrelloConnectModal;
});
jest.mock('@/hooks/useIntegrations', () => ({
  useIntegrationAvailability: () => mockUseIntegrationAvailability(),
}));
jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [],
    isLoading: false,
    isFetching: false,
    error: null,
    createProject,
    updateProject,
    deleteProject,
    refetch,
  }),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      role: 'ADMIN',
      organizationPlan: { name: 'free', maxProjects: 2 },
    },
  }),
}));
jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    getMyOrganization,
  }),
}));

describe('ProjectsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMyOrganization.mockResolvedValue({ userRole: 'ORG_OWNER' });
    mockUseIntegrationAvailability.mockReturnValue({ availability: null, isLoading: false });
  });

  it('hides the Trello connection when the organization cannot manage integrations', () => {
    mockUseIntegrationAvailability.mockReturnValue({
      availability: { enabled: true, canManage: false, reason: 'OWNER_REQUIRED' },
      isLoading: false,
    });

    render(<ProjectsPage />);

    expect(screen.queryByRole('button', { name: /conectar trello/i })).not.toBeInTheDocument();
  });

  it('opens the Trello connection modal for owners with integrations enabled', async () => {
    const user = userEvent.setup();
    mockUseIntegrationAvailability.mockReturnValue({
      availability: { enabled: true, canManage: true, reason: null },
      isLoading: false,
    });

    render(<ProjectsPage />);
    expect(screen.queryByText('Trello connect modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /conectar trello/i }));

    expect(screen.getByText('Trello connect modal')).toBeInTheDocument();
  });

  it('shows a first-project onboarding state when there are no projects', async () => {
    render(<ProjectsPage />);

    await waitFor(() => expect(getMyOrganization).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Crea tu primer proyecto' })).toBeInTheDocument();
    expect(screen.getByText('Agrega tareas')).toBeInTheDocument();
    expect(screen.queryByText('Listado de proyectos')).not.toBeInTheDocument();
  });

  it('opens the project form from the first-project action', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    await user.click(screen.getByRole('button', { name: /crear primer proyecto/i }));

    expect(screen.getByText('Project form modal')).toBeInTheDocument();
  });

  it('warns the user instead of silently failing when the role fetch errors out', async () => {
    // Arrange
    getMyOrganization.mockRejectedValue(new Error('network down'));

    // Act
    render(<ProjectsPage />);

    // Assert
    await waitFor(() =>
      expect(screen.getByText('No pudimos verificar tus permisos')).toBeInTheDocument(),
    );
  });
});
