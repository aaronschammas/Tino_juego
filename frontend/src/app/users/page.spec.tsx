import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from './page';
import { User } from '@/types/user';

const deactivateUser = jest.fn();
const resendInvite = jest.fn();
const revokeInvite = jest.fn();
const removeMember = jest.fn();

jest.mock('@/components/layout/ProtectedLayout', () => {
  function ProtectedLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
  return ProtectedLayout;
});

jest.mock('@/components/users/UserCard', () => {
  function UserCard({
    user,
    onEdit,
    onDeactivate,
  }: {
    user: User;
    onEdit?: (user: User) => void;
    onDeactivate?: (id: string) => void;
  }) {
    return (
      <div>
        <span>{user.email}</span>
        {onEdit ? (
          <button onClick={() => onEdit(user)}>{`Editar ${user.email}`}</button>
        ) : null}
        {onDeactivate ? (
          <button onClick={() => onDeactivate(user.id)}>{`Desactivar ${user.email}`}</button>
        ) : null}
      </div>
    );
  }
  return UserCard;
});

let mockUsers: User[] = [];
let mockUserRole: string | null = 'ORG_OWNER';
let mockMembersError: string | null = null;
let mockAuthUser: { id: string; role: string } = { id: 'requester-1', role: 'ADMIN' };

jest.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({
    users: mockUsers,
    isLoading: false,
    isFetching: false,
    error: null,
    deactivateUser,
  }),
}));

jest.mock('@/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    members: [],
    pendingInvites: [],
    userRole: mockUserRole,
    isLoading: false,
    isFetching: false,
    error: mockMembersError,
    refreshMembers: jest.fn(),
  }),
}));

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    resendInvite,
    revokeInvite,
    removeMember,
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const targetUser: User = {
  id: 'target-1',
  email: 'target@example.com',
  name: 'Target',
  lastname: 'User',
  role: 'USER',
  isActive: true,
};

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsers = [targetUser];
    mockUserRole = 'ORG_OWNER';
    mockMembersError = null;
    mockAuthUser = { id: 'requester-1', role: 'ADMIN' };
  });

  it('does not offer "Desactivar" to an ORG_OWNER requester who is not SUPERADMIN', async () => {
    // Arrange
    const user = userEvent.setup();
    mockAuthUser = { id: 'requester-1', role: 'ADMIN' };
    render(<UsersPage />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Usuarios del sistema' }));

    // Assert
    expect(screen.getByText('target@example.com')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Desactivar ${targetUser.email}` }),
    ).not.toBeInTheDocument();
  });

  it('offers "Desactivar" to a SUPERADMIN requester', async () => {
    // Arrange
    const user = userEvent.setup();
    mockAuthUser = { id: 'requester-1', role: 'SUPERADMIN' };
    render(<UsersPage />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Usuarios del sistema' }));

    // Assert
    expect(
      screen.getByRole('button', { name: `Desactivar ${targetUser.email}` }),
    ).toBeInTheDocument();
  });

  it('warns when the organization role could not be verified', async () => {
    // Arrange
    mockMembersError = 'Error al cargar miembros de la organizacion';

    // Act
    render(<UsersPage />);

    // Assert
    await waitFor(() =>
      expect(screen.getByText('No pudimos verificar tus permisos')).toBeInTheDocument(),
    );
  });
});
