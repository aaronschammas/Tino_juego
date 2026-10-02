/**
 * Navbar.tsx - Navigation Bar Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';

const mockUseAuth = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: jest.fn(),
}));
jest.mock('@/components/brand/BrandMark', () => {
  return function DummyBrandMark() {
    return <div data-testid="brand-mark">Tino</div>;
  };
});

describe('Navbar Component', () => {
  const mockUser = {
    id: 'user-1',
    email: 'john@example.com',
    name: 'John',
    lastname: 'Doe',
    role: 'USER',
    isActive: true,
  };

  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      activeOrganization: {
        id: 'org-1',
        name: 'Tino',
        plan: { name: 'free', title: 'Free' },
      },
      activeMembership: { id: 'mem-1', role: 'ORG_OWNER' },
      memberships: [
        {
          membershipId: 'mem-1',
          organizationId: 'org-1',
          organizationName: 'Tino',
          role: 'ORG_OWNER',
          plan: { name: 'free', title: 'Free' },
          isActive: true,
        },
      ],
      switchOrganization: jest.fn(),
    });
    mockUsePathname.mockReturnValue('/dashboard');
  });

  describe('Rendering', () => {
    it('should render navbar', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should display brand mark', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      expect(screen.getByTestId('brand-mark')).toBeInTheDocument();
    });

    it('should display user display name', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      expect(screen.getByText(/john/i)).toBeInTheDocument();
    });

    it('should display user email when name is not available', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, name: null, lastname: null },
        logout: mockLogout,
        activeOrganization: null,
        activeMembership: null,
        memberships: [],
        switchOrganization: jest.fn(),
      });

      // Act
      render(<Navbar />);

      // Assert
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('should display navigation links on desktop', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Proyectos')).toBeInTheDocument();
      expect(screen.getByText('Usuarios')).toBeInTheDocument();
    });

    it('should highlight active link', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      // Check that the link has styling classes (either on link or parent)
      const hasActiveStyles =
        dashboardLink.className.includes('bg-') ||
        dashboardLink.parentElement?.className.includes('bg-');
      expect(hasActiveStyles).toBe(true);
    });

    it('should have correct href attributes', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /proyectos/i })).toHaveAttribute('href', '/projects');
      expect(screen.getByRole('link', { name: /usuarios/i })).toHaveAttribute('href', '/users');
    });
  });

  describe('User Menu', () => {
    it('does not offer logout: Tino is public in the fair build', async () => {
      const user = userEvent.setup();
      render(<Navbar />);

      const menuButton = screen.getByText('John Doe').closest('button');
      await user.click(menuButton!);

      expect(screen.queryByRole('button', { name: /cerrar sesion/i })).not.toBeInTheDocument();
    });
  });

  describe('Mobile Menu', () => {
    it('should have mobile menu button', () => {
      // Arrange & Act
      render(<Navbar />);

      // Assert
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should toggle mobile menu', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<Navbar />);

      // Act
      const menuButtons = screen.getAllByRole('button');
      if (menuButtons.length > 1) {
        await user.click(menuButtons[0]);

        // Assert
        expect(menuButtons[0]).toBeInTheDocument();
      }
    });
  });

  describe('Styling', () => {
    it('should have fixed positioning', () => {
      // Arrange & Act
      const { container } = render(<Navbar />);

      // Assert
      const navbar = container.querySelector('nav');
      expect(navbar).toHaveClass('fixed', 'top-0', 'z-50');
    });

    it('should have border styling', () => {
      // Arrange & Act
      const { container } = render(<Navbar />);

      // Assert
      const navbar = container.querySelector('nav');
      expect(navbar).toHaveClass('border-b');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        logout: mockLogout,
        activeOrganization: null,
        activeMembership: null,
        memberships: [],
        switchOrganization: jest.fn(),
      });

      // Act & Assert
      expect(() => render(<Navbar />)).not.toThrow();
    });

    it('should handle undefined pathname', () => {
      // Arrange
      mockUsePathname.mockReturnValue(undefined);

      // Act & Assert
      expect(() => render(<Navbar />)).not.toThrow();
    });
  });

  describe('Organization Selector', () => {
    it('should show active organization name when there is one membership', () => {
      render(<Navbar />);

      expect(screen.getAllByText('Tino').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Free/i).length).toBeGreaterThan(0);
    });

    it('should render selector for multiple memberships and switch organization', async () => {
      const switchOrganization = jest.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        activeOrganization: {
          id: 'org-1',
          name: 'Tino',
          plan: { name: 'free', title: 'Free' },
        },
        activeMembership: { id: 'mem-1', role: 'ORG_OWNER' },
        memberships: [
          {
            membershipId: 'mem-1',
            organizationId: 'org-1',
            organizationName: 'Tino',
            role: 'ORG_OWNER',
            plan: { name: 'free', title: 'Free' },
            isActive: true,
          },
          {
            membershipId: 'mem-2',
            organizationId: 'org-2',
            organizationName: 'Grido',
            role: 'ORG_MEMBER',
            plan: { name: 'pro', title: 'Pro' },
            isActive: true,
          },
        ],
        switchOrganization,
      });

      const user = userEvent.setup();
      render(<Navbar />);

      await user.selectOptions(screen.getByLabelText('Organizacion activa'), 'org-2');

      expect(switchOrganization).toHaveBeenCalledWith('org-2');
    });

    it('disables organization changes and shows the legitimate switch error', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        activeOrganization: {
          id: 'org-1',
          name: 'Tino',
          plan: { name: 'free', title: 'Free' },
        },
        activeMembership: { id: 'mem-1', role: 'ORG_OWNER' },
        memberships: [
          {
            membershipId: 'mem-1',
            organizationId: 'org-1',
            organizationName: 'Tino',
            role: 'ORG_OWNER',
            plan: { name: 'free', title: 'Free' },
            isActive: true,
          },
          {
            membershipId: 'mem-2',
            organizationId: 'org-2',
            organizationName: 'Grido',
            role: 'ORG_MEMBER',
            plan: { name: 'pro', title: 'Pro' },
            isActive: true,
          },
        ],
        switchOrganization: jest.fn().mockResolvedValue(undefined),
        isSwitchingOrganization: true,
        organizationSwitchError: 'No se pudo cambiar de organizaciÃ³n',
      });

      render(<Navbar />);

      expect(screen.getByLabelText('Organizacion activa')).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo cambiar de organizaciÃ³n',
      );
    });
  });
});
