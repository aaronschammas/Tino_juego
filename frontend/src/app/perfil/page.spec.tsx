import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PerfilPage from './page';
import { apiGetCached, apiPost } from '@/lib/api';

const mockReplace = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetMyOrganization = jest.fn();
let searchTab: string | null = 'security';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? searchTab : null),
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'user@test.com' },
    updateUser: mockUpdateUser,
  }),
}));

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    getMyOrganization: mockGetMyOrganization,
  }),
}));

jest.mock('@/lib/api', () => ({
  apiDelete: jest.fn(),
  apiGetCached: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
  invalidateApiCache: jest.fn(),
}));

jest.mock('@/components/layout/ProtectedLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Card', () => ({
  __esModule: true,
  default: ({ children, className }: { children: ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
}));

jest.mock('@/components/ui/ConfirmDialog', () => ({
  __esModule: true,
  default: () => null,
}));

const baseProfile = {
  id: 'user-123',
  email: 'user@test.com',
  name: 'User',
  lastname: 'Test',
  role: 'USER',
  isActive: true,
  organizationId: 'org-123',
};

describe('PerfilPage security password form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchTab = 'security';
    mockGetMyOrganization.mockResolvedValue({ name: 'Tino Org' });
    (apiGetCached as jest.Mock).mockResolvedValue({
      ...baseProfile,
      hasInternalPassword: true,
      requiresInternalPasswordSetup: false,
    });
  });

  it('requires current password when the user already has an internal password', async () => {
    render(<PerfilPage />);

    expect(await screen.findByRole('heading', { name: /cambiar contraseña/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña actual/i)).toBeRequired();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('shows backend error and does not show success when current password is incorrect', async () => {
    const user = userEvent.setup();
    (apiPost as jest.Mock).mockRejectedValue(new Error('La contraseña actual es incorrecta.'));

    render(<PerfilPage />);

    await screen.findByRole('heading', { name: /cambiar contraseña/i });
    await user.type(screen.getByLabelText(/contraseña actual/i), 'wrong-password');
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(await screen.findByText('La contraseña actual es incorrecta.')).toBeInTheDocument();
    expect(screen.queryByText(/contraseña actualizada correctamente/i)).not.toBeInTheDocument();
  });

  it('calls change-password endpoint when the user has an internal password', async () => {
    const user = userEvent.setup();
    (apiPost as jest.Mock).mockResolvedValue({ message: 'Contraseña actualizada correctamente' });

    render(<PerfilPage />);

    await screen.findByRole('heading', { name: /cambiar contraseña/i });
    await user.type(screen.getByLabelText(/contraseña actual/i), 'current-password');
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'current-password',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });
    });
  });

  it('shows create internal password form when the user has no password', async () => {
    (apiGetCached as jest.Mock).mockResolvedValue({
      ...baseProfile,
      hasInternalPassword: false,
      requiresInternalPasswordSetup: true,
    });

    render(<PerfilPage />);

    expect(await screen.findByRole('heading', { name: /crear contraseña interna/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument();
    expect(screen.getByText(/creá una contraseña para poder ingresar también/i)).toBeInTheDocument();
  });

  it('validates setup password length and confirmation', async () => {
    const user = userEvent.setup();
    (apiGetCached as jest.Mock).mockResolvedValue({
      ...baseProfile,
      hasInternalPassword: false,
      requiresInternalPasswordSetup: true,
    });

    render(<PerfilPage />);

    await screen.findByRole('heading', { name: /crear contraseña interna/i });
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'short');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'short');
    await user.click(screen.getByRole('button', { name: /crear contraseña/i }));

    expect(await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/nueva contraseña/i));
    await user.clear(screen.getByLabelText(/confirmar contraseña/i));
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'password123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'password456');
    await user.click(screen.getByRole('button', { name: /crear contraseña/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('calls set-internal-password endpoint when the user has no internal password', async () => {
    const user = userEvent.setup();
    const updatedUser = {
      ...baseProfile,
      hasInternalPassword: true,
      requiresInternalPasswordSetup: false,
    };
    (apiGetCached as jest.Mock).mockResolvedValue({
      ...baseProfile,
      hasInternalPassword: false,
      requiresInternalPasswordSetup: true,
    });
    (apiPost as jest.Mock).mockResolvedValue({ user: updatedUser });

    render(<PerfilPage />);

    await screen.findByRole('heading', { name: /crear contraseña interna/i });
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'password123');
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /crear contraseña/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/set-internal-password', {
        password: 'password123',
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
    });
  });
});
