import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MemberModal from './MemberModal';
import { apiPost } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

// Mock Portal to just render children
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('MemberModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const orgId = 'org-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when isOpen is false', () => {
    // Arrange
    const { container } = render(
      <MemberModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act & Assert
    expect(container.firstChild).toBeNull();
  });

  test('renders empty form with all fields in creation mode', () => {
    // Arrange
    render(
      <MemberModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act & Assert
    expect(screen.getByText('Crear Miembro')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('');
    expect(screen.getByLabelText(/Apellido/i)).toHaveValue('');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('');
    expect(screen.getByLabelText(/Contraseña/i)).toHaveValue('');
    expect(screen.getByLabelText(/Rol en la Organización/i)).toHaveValue('ORG_MEMBER');
  });

  test('submits new member successfully', async () => {
    // Arrange
    (apiPost as jest.Mock).mockResolvedValue({});
    render(
      <MemberModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/Apellido/i), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'securepassword123' } });
    fireEvent.change(screen.getByLabelText(/Rol en la Organización/i), { target: { value: 'ORG_OWNER' } });
    fireEvent.click(screen.getByRole('button', { name: /^Crear$/i }));

    // Assert
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(`/admin/orgs/${orgId}/members`, {
        name: 'Juan',
        lastname: 'Pérez',
        email: 'juan@example.com',
        password: 'securepassword123',
        role: 'ORG_OWNER',
      });
    });
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('renders error message when api call fails', async () => {
    // Arrange
    const errorMessage = 'El email ya está registrado';
    (apiPost as jest.Mock).mockRejectedValue(new Error(errorMessage));
    render(
      <MemberModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/Apellido/i), { target: { value: 'Pérez' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'securepassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Crear$/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('calls onClose when cancel button is clicked', () => {
    // Arrange
    render(
      <MemberModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when close x button is clicked', () => {
    // Arrange
    render(
      <MemberModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} orgId={orgId} />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^x$/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
