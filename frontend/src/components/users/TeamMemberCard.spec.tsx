import { render, screen, fireEvent } from '@testing-library/react';
import TeamMemberCard, { TeamMember } from './TeamMemberCard';

const mockActiveMember: TeamMember = {
  userId: 'user-123',
  membershipId: 'mem-456',
  email: 'active@tino.io',
  name: 'Leonardo',
  lastname: 'Morabito',
  status: 'ACTIVE',
  role: 'ADMIN',
  joinedAt: '2024-01-15T10:00:00Z',
  projectIds: ['proj-1', 'proj-2']
};

const mockPendingMember: TeamMember = {
  userId: '',
  membershipId: 'invite-789',
  email: 'pending@tino.io',
  name: 'pending', // Split from email in some logic
  lastname: '',
  status: 'PENDING',
  role: 'MEMBER',
  joinedAt: '2024-12-31T23:59:59Z',
  inviteLink: 'https://tino.io/invite?token=secret',
  inviteId: 'inv-001'
};

describe('TeamMemberCard Component', () => {
  const mockHandlers = {
    onCopyLink: jest.fn(),
    onCancelInvite: jest.fn(),
    onResendInvite: jest.fn(),
    onEditProjects: jest.fn(),
    onRemoveUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Arrange: Active Member Rendering', () => {
    test('renders member name, email and role labels', () => {
      // Arrange
      render(<TeamMemberCard member={mockActiveMember} {...mockHandlers} />);

      // Assert
      expect(screen.getByText('Leonardo Morabito')).toBeInTheDocument();
      expect(screen.getByText('active@tino.io')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('LM')).toBeInTheDocument(); // Initials
    });

    test('renders joined date formatted', () => {
      // Arrange
      render(<TeamMemberCard member={mockActiveMember} {...mockHandlers} />);

      // Assert
      expect(screen.getByText(/se unio: 15/i)).toBeInTheDocument();
    });
  });

  describe('Arrange: Pending Member Rendering', () => {
    test('renders with pending status and invitation actions', () => {
      // Arrange
      render(<TeamMemberCard member={mockPendingMember} {...mockHandlers} />);

      // Assert
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('Copiar invitacion')).toBeInTheDocument();
      expect(screen.getByText('Reenviar')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
  });

  describe('Act: Interactions', () => {
    test('calls onEditProjects when edit button is clicked', () => {
      // Arrange
      render(<TeamMemberCard member={mockActiveMember} {...mockHandlers} canEdit={true} />);

      // Act
      fireEvent.click(screen.getByText(/editar/i));

      // Assert
      expect(mockHandlers.onEditProjects).toHaveBeenCalledWith({
        memberId: 'user-123',
        email: 'active@tino.io',
        projectIds: ['proj-1', 'proj-2']
      });
    });

    test('calls onCopyLink when copy button is clicked', () => {
      // Arrange
      render(<TeamMemberCard member={mockPendingMember} {...mockHandlers} />);

      // Act
      fireEvent.click(screen.getByText(/copiar invitacion/i));

      // Assert
      expect(mockHandlers.onCopyLink).toHaveBeenCalledWith(mockPendingMember.inviteLink, mockPendingMember.email);
    });

    test('calls onRemoveUser when delete button is clicked', () => {
      // Arrange
      render(<TeamMemberCard member={mockActiveMember} {...mockHandlers} canRemove={true} />);

      // Act
      fireEvent.click(screen.getByText(/eliminar de la organizacion/i));

      // Assert
      expect(mockHandlers.onRemoveUser).toHaveBeenCalledWith(mockActiveMember);
    });
  });
});
