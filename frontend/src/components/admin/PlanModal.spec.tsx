import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanModal from './PlanModal';
import { apiPost, apiPut } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));

// Mock Portal to just render children
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('PlanModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Creation Mode', () => {
    test('renders empty form for new plan', () => {
      // Arrange
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Act & Assert
      expect(screen.getByText('Nuevo Plan')).toBeInTheDocument();
      expect(screen.getByLabelText(/Identificador/i)).toHaveValue('');
      expect(screen.getByLabelText(/Título/i)).toHaveValue('');
    });

    test('submits new plan successfully', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPost as jest.Mock).mockResolvedValue({});
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Act
      await user.type(screen.getByLabelText(/Identificador/i), 'pro');
      await user.type(screen.getByLabelText(/Título/i), 'Plan Pro');
      await user.type(screen.getByLabelText(/Precio/i), '10');
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      // Assert
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/admin/plans', expect.objectContaining({
          name: 'pro',
          title: 'Plan Pro',
          price: 10,
        }));
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Mode', () => {
    const mockPlan = {
      id: 'p1',
      name: 'free',
      title: 'Plan Gratis',
      description: 'Zero cost',
      price: 0,
      maxUsers: 5,
      maxProjects: 10,
      hasAnalytics: false,
      hasSso: false,
      hasPrioritySupport: false,
      hasEmailInvites: false,
      hasAdvancedPerms: false,
      hasAudit: false,
    };

    test('prefills form with plan data', () => {
      // Arrange
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} plan={mockPlan} />);

      // Act & Assert
      expect(screen.getByText('Editar Plan')).toBeInTheDocument();
      expect(screen.getByLabelText(/Identificador/i)).toHaveValue('free');
      expect(screen.getByLabelText(/Título/i)).toHaveValue('Plan Gratis');
      expect(screen.getByLabelText(/Precio/i)).toHaveValue(0);
      expect(screen.getByLabelText(/Max Usuarios/i)).toHaveValue(5);
    });

    test('submits updated plan successfully', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPut as jest.Mock).mockResolvedValue({});
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} plan={mockPlan} />);

      // Act
      await user.clear(screen.getByLabelText(/Título/i));
      await user.type(screen.getByLabelText(/Título/i), 'Plan Gratis Editado');
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      // Assert
      await waitFor(() => {
        expect(apiPut).toHaveBeenCalledWith('/admin/plans/p1', expect.objectContaining({
          name: 'free',
          title: 'Plan Gratis Editado',
        }));
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interactions', () => {
    test('calls onClose when cancel button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Act
      await user.click(screen.getByRole('button', { name: /Cancelar/i }));

      // Assert
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when close icon is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PlanModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Act
      await user.click(screen.getByRole('button', { name: /^x$/i }));

      // Assert
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
