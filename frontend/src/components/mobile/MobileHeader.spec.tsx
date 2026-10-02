import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileHeader from './MobileHeader';

const mockUseAuth = jest.fn();
const replace = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
jest.mock('@/components/brand/BrandMark', () => {
  return function MockBrandMark() { return <a href="/mobile">Tino</a>; };
});

const memberships = [
  { membershipId: 'm1', organizationId: 'org-1', organizationName: 'Org One' },
  { membershipId: 'm2', organizationId: 'org-2', organizationName: 'Org Two' },
];

describe('MobileHeader', () => {
  beforeEach(() => jest.clearAllMocks());

  it('switches organization through context and returns home', async () => {
    const switchOrganization = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ activeOrganization: { id: 'org-1' }, memberships, switchOrganization, logout: jest.fn(), isSwitchingOrganization: false });
    render(<MobileHeader />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /organizacion activa/i }), 'org-2');
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith('org-2'));
    expect(replace).toHaveBeenCalledWith('/mobile');
    expect(screen.getByRole('button', { name: /cerrar sesion/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir perfil/i })).toBeInTheDocument();
  });

  it('shows a generic error and keeps the confirmed selection after failure', async () => {
    const switchOrganization = jest.fn().mockRejectedValue(new Error('private server detail'));
    mockUseAuth.mockReturnValue({ activeOrganization: { id: 'org-1' }, memberships, switchOrganization, logout: jest.fn(), isSwitchingOrganization: false });
    render(<MobileHeader />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'org-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cambiar/i);
    expect(screen.queryByText(/private server detail/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('org-1');
  });

  it('disables organization selection during a transition', () => {
    mockUseAuth.mockReturnValue({ activeOrganization: { id: 'org-1' }, memberships, switchOrganization: jest.fn(), logout: jest.fn(), isSwitchingOrganization: true });
    render(<MobileHeader />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
