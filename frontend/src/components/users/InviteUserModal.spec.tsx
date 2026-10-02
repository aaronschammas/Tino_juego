import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InviteUserModal from './InviteUserModal';
import { useAuth } from '@/hooks/useAuth';

const mockInviteMember = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    inviteMember: mockInviteMember,
  }),
}));

describe('InviteUserModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'u1', name: 'Test User', organizationPlan: 'pro' },
      isAuthenticated: true,
    });
  });

  it('does not render when closed', () => {
    render(<InviteUserModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText(/invitar miembro/i)).not.toBeInTheDocument();
  });

  it('validates email before moving to confirmation step', async () => {
    render(<InviteUserModal isOpen onClose={mockOnClose} />);

    const emailInput = screen.getByLabelText(/email del miembro/i);
    fireEvent.change(emailInput, { target: { value: 'invalido' } });
    
    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/ingresa un email valido/i)).toBeInTheDocument();
    expect(screen.queryByText(/confirmar invitacion/i)).not.toBeInTheDocument();
  });

  it('completes flow up to success', async () => {
    mockInviteMember.mockResolvedValue({ inviteLink: 'https://example.com/invite?token=abc' });
    render(<InviteUserModal isOpen onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Form
    const emailInput = screen.getByLabelText(/email del miembro/i);
    fireEvent.change(emailInput, { target: { value: 'test@demo.com' } });
    fireEvent.submit(emailInput.closest('form')!);

    // Confirm
    expect(await screen.findByText(/confirmar invitacion/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Enviar invitacion'));

    expect(mockInviteMember).toHaveBeenCalledWith({
      email: 'test@demo.com',
      role: 'ORG_MEMBER',
    });

    // Success
    await waitFor(() => {
      expect(screen.getByText(/invitacion enviada/i)).toBeInTheDocument();
    });
    expect(screen.getByText('https://example.com/invite?token=abc')).toBeInTheDocument();
    expect(
      screen.getByText(/cuenta de google correspondiente a ese correo/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/invite?token=abc',
      );
    });
  });

  it('does not show or submit initial project assignment fields', () => {
    render(<InviteUserModal isOpen onClose={mockOnClose} />);

    expect(screen.queryByText(/proyectos iniciales/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/project one/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /primero invita a la persona a la organizacion.*cuando acepte la invitacion.*asignarla a proyectos/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows blocked message if user is on free plan', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'u1', organizationPlan: 'free' },
    });

    render(<InviteUserModal isOpen onClose={mockOnClose} />);
    expect(screen.getByText(/invitaciones bloqueadas/i)).toBeInTheDocument();
  });
});
