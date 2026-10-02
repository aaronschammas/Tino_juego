import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPasswordPage from './page';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const mockReplace = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe('SetupPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      isLoading: false,
      user: {
        id: 'user-1',
        email: 'google@test.com',
        requiresInternalPasswordSetup: true,
      },
      updateUser: mockUpdateUser,
    });
  });

  it('validates minimum password length', async () => {
    const user = userEvent.setup();
    render(<SetupPasswordPage />);

    await user.type(screen.getByLabelText(/^contraseña$/i), 'short');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'short');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('validates matching password confirmation', async () => {
    const user = userEvent.setup();
    render(<SetupPasswordPage />);

    await user.type(screen.getByLabelText(/^contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'password456');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('calls endpoint and redirects after saving password', async () => {
    const user = userEvent.setup();
    const updatedUser = {
      id: 'user-1',
      email: 'google@test.com',
      requiresInternalPasswordSetup: false,
    };
    (apiPost as jest.Mock).mockResolvedValue({ user: updatedUser });

    render(<SetupPasswordPage />);

    await user.type(screen.getByLabelText(/^contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/set-internal-password', {
        password: 'password123',
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
