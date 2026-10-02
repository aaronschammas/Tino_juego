import { render, screen, waitFor } from '@testing-library/react';
import MobileProtectedLayout from './MobileProtectedLayout';

const mockUseAuth = jest.fn();
const replace = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/mobile' }));
jest.mock('./MobileHeader', () => {
  return function MockMobileHeader() { return <header data-testid="mobile-header">Mobile header</header>; };
});
jest.mock('./MobileBottomNav', () => {
  return function MockMobileBottomNav() { return <nav data-testid="mobile-nav">Mobile nav</nav>; };
});
jest.mock('./MobileInstallPrompt', () => {
  return function MockMobileInstallPrompt() { return <aside data-testid="install-prompt">Install</aside>; };
});

const organization = { id: 'org-1', name: 'Tino', plan: { id: 'plan-1', name: 'free', title: 'Free', maxUsers: 3, maxProjects: 3 } };
const user = { id: 'user-1', organizationId: 'org-1', requiresInternalPasswordSetup: false };

describe('MobileProtectedLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows loading without desktop chrome', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, user: null });
    render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    expect(screen.getByText(/cargando espacio/i)).toBeInTheDocument();
    expect(screen.queryByText('Tenant content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer-widget')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to login with the mobile return path', async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: null, activeOrganization: null });
    render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fmobile'));
  });

  it('preserves password setup and organization onboarding rules', async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: { ...user, requiresInternalPasswordSetup: true }, activeOrganization: organization });
    const { unmount } = render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/setup-password'));

    unmount();
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, user, activeOrganization: null });
    render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/register?step=organization&userId=user-1'));
  });

  it('redirects an organization without a plan to plan onboarding', async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user, activeOrganization: { ...organization, plan: null } });
    render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/register?step=plan&userId=user-1'));
  });

  it('hides old tenant content while switching', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user, activeOrganization: organization, isSwitchingOrganization: true });
    render(<MobileProtectedLayout>Previous tenant content</MobileProtectedLayout>);
    expect(screen.getByText(/cambiando espacio/i)).toBeInTheDocument();
    expect(screen.queryByText('Previous tenant content')).not.toBeInTheDocument();
  });

  it('renders only mobile chrome for a valid session', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user, activeOrganization: organization, isSwitchingOrganization: false });
    render(<MobileProtectedLayout>Tenant content</MobileProtectedLayout>);
    expect(screen.getByText('Tenant content')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timer-widget')).not.toBeInTheDocument();
  });
});
