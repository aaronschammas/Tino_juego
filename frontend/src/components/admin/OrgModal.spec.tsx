import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgModal from './OrgModal';
import { apiGet, apiPost, apiPut } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));

// Mock Portal to just render children
jest.mock('@/components/ui/Portal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('OrgModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockPlans = [
    { id: 'plan-free', name: 'free', title: 'Plan Gratis' },
    { id: 'plan-pro', name: 'pro', title: 'Plan Pro' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiGet as jest.Mock).mockResolvedValue(mockPlans);
  });

  test('returns null when isOpen is false', () => {
    // Arrange
    const { container } = render(
      <OrgModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Act & Assert
    expect(container.firstChild).toBeNull();
  });

  test('fetches plans on mount when open', async () => {
    // Arrange & Act
    render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Assert
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/plans');
    });
  });

  describe('Creation Mode', () => {
    test('renders empty form with plan selector', async () => {
      // Arrange & Act
      render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Assert
      expect(screen.getByText('Nueva Organización')).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombre de la Organización/i)).toHaveValue('');
      expect(screen.getByLabelText(/Plan/i)).toHaveValue('');
      expect(screen.getByLabelText(/Organización Activa/i)).toBeChecked();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Plan Gratis' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Plan Pro' })).toBeInTheDocument();
      });
    });

    test('submits new organization successfully', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPost as jest.Mock).mockResolvedValue({});
      render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Plan Pro' })).toBeInTheDocument();
      });

      // Act
      await user.type(screen.getByLabelText(/Nombre de la Organización/i), 'Nueva Empresa');
      await user.selectOptions(screen.getByLabelText(/Plan/i), 'plan-pro');
      await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

      // Assert
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/admin/orgs', {
          name: 'Nueva Empresa',
          planId: 'plan-pro',
          isActive: true,
        });
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('submits with null planId if "Sin Plan" selected', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPost as jest.Mock).mockResolvedValue({});
      render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

      // Act
      await user.type(screen.getByLabelText(/Nombre de la Organización/i), 'Nueva Empresa');
      await user.selectOptions(screen.getByLabelText(/Plan/i), '');
      await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

      // Assert
      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/admin/orgs', {
          name: 'Nueva Empresa',
          planId: null,
          isActive: true,
        });
      });
    });
  });

  describe('Edit Mode', () => {
    const mockOrg = {
      id: 'org-abc',
      name: 'Empresa Existente',
      isActive: false,
      planId: 'plan-free',
    };

    test('prefills form with organization data', async () => {
      // Arrange & Act
      render(
        <OrgModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          organization={mockOrg}
        />
      );

      // Assert
      expect(screen.getByText('Editar Organización')).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombre de la Organización/i)).toHaveValue('Empresa Existente');
      expect(screen.getByLabelText(/Organización Activa/i)).not.toBeChecked();

      await waitFor(() => {
        expect(screen.getByLabelText(/Plan/i)).toHaveValue('plan-free');
      });
    });

    test('submits updated organization successfully', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPut as jest.Mock).mockResolvedValue({});
      render(
        <OrgModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          organization={mockOrg}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Plan/i)).toHaveValue('plan-free');
      });

      // Act
      await user.clear(screen.getByLabelText(/Nombre de la Organización/i));
      await user.type(screen.getByLabelText(/Nombre de la Organización/i), 'Empresa Editada');
      await user.click(screen.getByLabelText(/Organización Activa/i)); // toggles to true
      await user.click(screen.getByRole('button', { name: /^Guardar$/i }));

      // Assert
      await waitFor(() => {
        expect(apiPut).toHaveBeenCalledWith('/admin/orgs/org-abc', {
          name: 'Empresa Editada',
          planId: 'plan-free',
          isActive: true,
        });
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  test('renders error message when api call fails', async () => {
    // Arrange
    const user = userEvent.setup();
    const errorMessage = 'Error de servidor';
    (apiPost as jest.Mock).mockRejectedValue(new Error(errorMessage));
    render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    await user.type(screen.getByLabelText(/Nombre de la Organización/i), 'Falla Org');
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
    render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when close x button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<OrgModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    await user.click(screen.getByRole('button', { name: /^x$/i }));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
