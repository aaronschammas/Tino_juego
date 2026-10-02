import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserEditModal from './UserEditModal';
import { apiPut } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiPut: jest.fn(),
}));

// Mock Portal to just render children
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('UserEditModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockUser = {
    id: 'user-xyz',
    name: 'Leonardo',
    lastname: 'Morabito',
    email: 'leonardo@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when isOpen is false', () => {
    // Arrange
    const { container } = render(
      <UserEditModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act & Assert
    expect(container.firstChild).toBeNull();
  });

  test('prefills form with user data but leaves password blank', () => {
    // Arrange & Act
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Assert
    expect(screen.getByText('Editar Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/i)).toHaveValue('Leonardo');
    expect(screen.getByLabelText(/Apellido/i)).toHaveValue('Morabito');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('leonardo@example.com');
    expect(screen.getByLabelText(/Nueva Contraseña/i)).toHaveValue('');
  });

  test('submits successfully without changing password', async () => {
    // Arrange
    const user = userEvent.setup();
    (apiPut as jest.Mock).mockResolvedValue({});
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act
    await user.clear(screen.getByLabelText(/Nombre/i));
    await user.type(screen.getByLabelText(/Nombre/i), 'Leo');
    await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

    // Assert
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/admin/users/user-xyz', {
        name: 'Leo',
        lastname: 'Morabito',
        email: 'leonardo@example.com',
      });
    });
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('submits successfully including the password when entered', async () => {
    // Arrange
    const user = userEvent.setup();
    (apiPut as jest.Mock).mockResolvedValue({});
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act
    await user.type(screen.getByLabelText(/Nueva Contraseña/i), 'mynewpassword123');
    await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

    // Assert
    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/admin/users/user-xyz', {
        name: 'Leonardo',
        lastname: 'Morabito',
        email: 'leonardo@example.com',
        password: 'mynewpassword123',
      });
    });
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('renders error message when api call fails', async () => {
    // Arrange
    const user = userEvent.setup();
    const errorMessage = 'Error al actualizar';
    (apiPut as jest.Mock).mockRejectedValue(new Error(errorMessage));
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act
    await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('calls onClose when cancel button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when close x button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <UserEditModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} user={mockUser} />
    );

    // Act
    await user.click(screen.getByRole('button', { name: /^x$/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
