import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditMemberProjectsModal from './EditMemberProjectsModal';

const mockRefetch = jest.fn();
const mockUpdateMemberProjects = jest.fn();

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [
      {
        id: 'p1',
        name: 'Project One',
        priority: 'HIGH',
        ownerId: 'u1',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        name: 'Project Two',
        priority: 'LOW',
        ownerId: 'u1',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    isLoading: false,
    refetch: mockRefetch,
  }),
}));

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    updateMemberProjects: mockUpdateMemberProjects,
  }),
}));

const mockUseAuth = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('EditMemberProjectsModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Org owner by default, so existing tests keep exercising the
    // unrestricted path (see organizations.service.ts updateMemberProjects).
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', role: 'USER' },
      activeMembership: { id: 'mem-1', role: 'ORG_OWNER' },
    });
  });

  it('does not render when closed', () => {
    render(
      <EditMemberProjectsModal
        isOpen={false}
        memberId="u2"
        memberEmail="user@demo.com"
        currentProjectIds={[]}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/asignar proyectos/i)).not.toBeInTheDocument();
  });

  it('renders member info and current selected projects', async () => {
    render(
      <EditMemberProjectsModal
        isOpen
        memberId="u2"
        memberEmail="user@demo.com"
        currentProjectIds={['p1']}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('user@demo.com')).toBeInTheDocument();
    expect(await screen.findByLabelText(/project one/i)).toBeChecked();
    expect(screen.getByLabelText(/project two/i)).not.toBeChecked();
  });

  it('saves selected projects and triggers callbacks', async () => {
    const user = userEvent.setup();
    mockUpdateMemberProjects.mockResolvedValue({});

    render(
      <EditMemberProjectsModal
        isOpen
        memberId="u2"
        memberEmail="user@demo.com"
        currentProjectIds={['p1']}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.click(await screen.findByLabelText(/project two/i));
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockUpdateMemberProjects).toHaveBeenCalledWith('u2', ['p1', 'p2']);
    });

    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows error when save fails', async () => {
    const user = userEvent.setup();
    mockUpdateMemberProjects.mockRejectedValue(new Error('Update failed'));

    render(
      <EditMemberProjectsModal
        isOpen
        memberId="u2"
        memberEmail="user@demo.com"
        currentProjectIds={[]}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument();
  });

  it('disables checkboxes and save button for a non-owner', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u2', role: 'USER' },
      activeMembership: { id: 'mem-2', role: 'ORG_MEMBER' },
    });

    render(
      <EditMemberProjectsModal
        isOpen
        memberId="u2"
        memberEmail="user@demo.com"
        currentProjectIds={['p1']}
        onClose={mockOnClose}
      />
    );

    expect(await screen.findByLabelText(/project one/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
    expect(screen.getByText(/solo los propietarios/i)).toBeInTheDocument();
  });
});
