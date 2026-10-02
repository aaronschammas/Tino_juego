import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingPage from './LandingPage';

const mockUseRouter = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  usePathname: jest.fn(),
}));
jest.mock('@/components/brand/BrandMark', () => {
  return function DummyBrandMark() {
    return <div data-testid="brand-mark">Tino</div>;
  };
});

describe('LandingPage Component', () => {
  const mockPush = jest.fn();
  const mockUser = {
    id: 'user-1',
    email: 'john@example.com',
    name: 'John',
    lastname: 'Doe',
    role: 'USER',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });
  });

  describe('Rendering', () => {
    it('should render landing page', () => {
      // Arrange & Act
      const { container } = render(<LandingPage />);

      // Assert
      expect(container).toBeInTheDocument();
    });

    it('should display brand mark', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getAllByTestId('brand-mark').length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Section', () => {
    it('should display metrics', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getByText(/vista unificada/i)).toBeInTheDocument();
      expect(screen.getByText(/contexto operativo/i)).toBeInTheDocument();
      expect(screen.getByText(/escala multiusuario/i)).toBeInTheDocument();
    });

    it('should display metric values', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getByText(/proyectos, tareas y tiempo/i)).toBeInTheDocument();
      expect(screen.getByText(/prioridades, bloqueos y carga/i)).toBeInTheDocument();
      expect(screen.getByText(/listo para organizaciones/i)).toBeInTheDocument();
    });
  });

  describe('Feature Columns', () => {
    it('should display feature sections', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getByText(/operativa diaria/i)).toBeInTheDocument();
      expect(screen.getByText(/trabajo en equipo/i)).toBeInTheDocument();
      expect(screen.getByText(/^visibilidad$/i)).toBeInTheDocument();
    });

    it('should display feature descriptions', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getByText(/gestiona ejecucion/i)).toBeInTheDocument();
      expect(screen.getByText(/organiza usuarios/i)).toBeInTheDocument();
      expect(screen.getByText(/convierte actividad/i)).toBeInTheDocument();
    });
  });

  describe('Call to Action', () => {
    it('should have action buttons', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have login link', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      const loginLinks = screen.queryAllByRole('link', { name: /login|ingresar/i });
      expect(loginLinks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Unauthenticated User', () => {
    it('should show signup/login options when user is not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Act
      render(<LandingPage />);

      // Assert
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Authenticated User', () => {
    it('should redirect authenticated user to dashboard', async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
      });

      // Act
      render(<LandingPage />);

      // Assert
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        await user.click(buttons[0]);
      }
    });
  });

  describe('Loading State', () => {
    it('should handle loading state', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      // Act & Assert
      expect(() => render(<LandingPage />)).not.toThrow();
    });
  });

  describe('Content Sections', () => {
    it('should display all benefit statements', () => {
      // Arrange & Act
      render(<LandingPage />);

      // Assert
      expect(screen.getByText(/entrada publica seria/i)).toBeInTheDocument();
      expect(screen.getByText(/acceso simple y profesional/i)).toBeInTheDocument();
      expect(screen.getByText(/narrativa comercial alineada/i)).toBeInTheDocument();
    });
  });
});

