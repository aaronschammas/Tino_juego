import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ProtectedLayout from './ProtectedLayout';
import { usePathname } from 'next/navigation';

const mockUseAuth = jest.fn();
const mockUseRouter = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  usePathname: jest.fn(),
}));
jest.mock('./Navbar', () => {
  return function DummyNavbar() {
    return <nav data-testid="navbar">Navbar</nav>;
  };
});
jest.mock('@/components/timer/TimerWidget', () => {
  return function DummyTimerWidget() {
    return <div data-testid="timer-widget">Timer Widget</div>;
  };
});
jest.mock('./Breadcrumb', () => {
  return function DummyBreadcrumb() {
    return <div data-testid="breadcrumb">Breadcrumb</div>;
  };
});

describe('ProtectedLayout Component', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  const mockUser = {
    id: 'user-1',
    email: 'john@example.com',
    name: 'John',
    lastname: 'Doe',
    role: 'USER',
    isActive: true,
    organizationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard', search: '' },
      writable: true,
    });
  });

  describe('Authenticated User', () => {
    it('should render children when user is authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Protected Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render navbar when user is authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    it('should render timer widget when user is authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.getByTestId('timer-widget')).toBeInTheDocument();
    });

    it('hides tenant content and timer while switching organization', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isSwitchingOrganization: true,
      });

      render(
        <ProtectedLayout>
          <div>Previous organization project</div>
        </ProtectedLayout>,
      );

      expect(screen.getByText('Cambiando espacio de trabajo...')).toBeInTheDocument();
      expect(screen.queryByText('Previous organization project')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timer-widget')).not.toBeInTheDocument();
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    it('should redirect authenticated user without organization to onboarding', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, organizationId: undefined },
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Protected Content</div>
        </ProtectedLayout>
      );

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/register?step=organization&userId=user-1');
      });
      expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timer-widget')).not.toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to setup password when Google user needs internal password', async () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, requiresInternalPasswordSetup: true },
        isLoading: false,
      });

      render(
        <ProtectedLayout>
          <div>Protected Content</div>
        </ProtectedLayout>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/auth/setup-password');
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading message while loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.getByText(/cargando espacio de trabajo/i)).toBeInTheDocument();
    });

    it('should not render navbar while loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated User', () => {
    it('should redirect to login when user is not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/login'));
      });
    });

    it('should include current pathname in redirect URL', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      Object.defineProperty(window, 'location', {
        value: { pathname: '/projects/123', search: '' },
        writable: true,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('projects'));
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('123'));
      });
    });

    it('should display redirecting message while redirecting', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.getByText(/redirigiendo/i)).toBeInTheDocument();
    });

    it('should not render navbar when unauthenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Act
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      // Assert
      expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle redirect only once', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Act
      const { rerender } = render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledTimes(1);
      });

      // Assert
      rerender(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });
});

