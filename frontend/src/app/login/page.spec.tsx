import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';
import { ApiClientError, apiGet } from '@/lib/api';
import { clearClientSession } from '@/lib/session-cleanup';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

jest.mock('@/lib/api');
jest.mock('@/lib/session-cleanup');
jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe('LoginPage', () => {
  const replace = jest.fn();
  const login = jest.fn();
  const logout = jest.fn();
  const updateUser = jest.fn();
  const refreshContext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace, push: jest.fn(), prefetch: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout,
      updateUser,
      refreshContext,
    });
    (apiGet as jest.Mock).mockResolvedValue({ url: 'https://accounts.google.com/oauth' });
  });

  it('shows the unified Google action and keeps traditional login', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar al workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar con Google/i })).toBeInTheDocument();
    expect(screen.queryByText('Registrarse')).not.toBeInTheDocument();
    expect(screen.queryByText('Acceder de otra forma')).not.toBeInTheDocument();
  });

  it('starts the unified Google flow from the login page', async () => {
    (apiGet as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    render(<LoginPage />);

    await userEvent.click(screen.getByRole('button', { name: /Continuar con Google/i }));

    await waitFor(() => {
      expect(clearClientSession).toHaveBeenCalledTimes(1);
      expect(apiGet).toHaveBeenCalledWith('/auth/google/continue-url?returnTo=%2Fdashboard');
    });
  });

  it('redirects an authenticated user with organization to the dashboard', async () => {
    (apiGet as jest.Mock).mockResolvedValue({
      workspaceState: { hasAccessibleProjects: true },
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'User',
        lastname: 'Test',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
        organizationPlan: { name: 'free' },
      },
      isLoading: false,
      login,
      logout,
      updateUser,
    });

    render(<LoginPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('redirects an authenticated user without projects to projects', async () => {
    (apiGet as jest.Mock).mockResolvedValue({
      workspaceState: { hasAccessibleProjects: false },
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'User',
        lastname: 'Test',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
        organizationPlan: { name: 'free' },
      },
      isLoading: false,
      login,
      logout,
      updateUser,
    });

    render(<LoginPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/projects'));
  });

  it('redirects an authenticated user without organization to onboarding', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-new',
        email: 'new@test.com',
        name: 'New',
        lastname: 'User',
        role: 'ADMIN',
        isActive: true,
        organizationId: null,
        organizationPlan: null,
      },
      isLoading: false,
      login,
      logout,
      updateUser,
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/register?step=organization&userId=user-new');
    });
  });

  it('syncs Google callback user and lets auth state decide the destination', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('google=success'));
    refreshContext.mockResolvedValue({
      user: {
        id: 'user-google',
        email: 'google@test.com',
        name: 'Google',
        lastname: 'User',
        role: 'ADMIN',
        isActive: true,
        organizationId: null,
        organizationPlan: null,
      },
      activeOrganization: null,
      activeMembership: null,
      memberships: [],
      features: {
        hasActiveOrganization: false,
        canSwitchOrganization: false,
        hasMultipleOrganizations: false,
      },
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(refreshContext).toHaveBeenCalledTimes(1);
      expect(updateUser).not.toHaveBeenCalled();
    });
  });

  it('releases the Google spinner when the context refresh becomes obsolete', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('google=success'));
    refreshContext.mockResolvedValue(null);

    render(<LoginPage />);

    expect(
      await screen.findByRole('button', { name: /Continuar con Google/i }),
    ).toBeInTheDocument();
  });

  it('does not show an error for an expected unauthenticated bootstrap', () => {
    render(<LoginPage />);

    expect(screen.queryByText(/sesion valida/i)).not.toBeInTheDocument();
  });

  it('distinguishes a missing Google session from a network failure', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('google=success'));
    const missingSession = new ApiClientError('Unauthorized', 401);
    missingSession.status = 401;
    refreshContext.mockRejectedValue(missingSession);

    render(<LoginPage />);

    expect(await screen.findByText(/no se recibio una sesion valida/i)).toBeInTheDocument();
  });

  it('shows a connection message when Google session validation has no response', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('google=success'));
    refreshContext.mockRejectedValue(new ApiClientError('Network unavailable'));

    render(<LoginPage />);

    expect(await screen.findByText(/no se pudo conectar con Tino/i)).toBeInTheDocument();
  });
});
