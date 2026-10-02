import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPage from './page';

const createProject = jest.fn();
const updateProject = jest.fn();
const deleteProject = jest.fn();
const refetch = jest.fn();
const getMyOrganization = jest.fn();

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
  });

  it('does not offer Trello actions in the fair build', () => {
    render(<ProjectsPage />);

    expect(screen.queryByRole('button', { name: /trello/i })).not.toBeInTheDocument();
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
