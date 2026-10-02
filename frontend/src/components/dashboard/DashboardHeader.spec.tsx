import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardHeader from './DashboardHeader';

describe('DashboardHeader Component', () => {
  describe('Rendering', () => {
    it('should render title and description', () => {
      // Arrange
      const props = {
        title: 'Executive Panel',
        description: 'View your dashboard analytics',
      };

      // Act
      render(<DashboardHeader {...props} />);
      const title = screen.getByRole('heading', { name: /executive panel/i });
      const description = screen.getByText('View your dashboard analytics');

      // Assert
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    it('should render organization label without a duplicate breadcrumb', () => {
      // Arrange
      const props = {
        title: 'Test Title',
        description: 'Test Desc',
        organizationName: 'Grido',
      };

      // Act
      render(<DashboardHeader {...props} />);
      const organizationCaption = screen.getByText('Grido');

      // Assert
      expect(organizationCaption).toBeInTheDocument();
      expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
      expect(screen.queryByText('Panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('should use workspace fallback when organization is unavailable', () => {
      render(<DashboardHeader title="Panel operativo" description="Desc" />);

      expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
    });

    it('should render the clearer dashboard copy and report button', () => {
      render(
        <DashboardHeader
          title="Panel operativo"
          description="Visualizá tareas, tiempos, avance y carga de trabajo."
          organizationName="Tino Time"
        />,
      );

      expect(screen.getByRole('heading', { name: /panel operativo/i })).toBeInTheDocument();
      expect(screen.getByText('Visualizá tareas, tiempos, avance y carga de trabajo.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /exportar informe/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onNewTask when the button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockOnNewTask = jest.fn();
      const props = {
        title: 'Title',
        description: 'Desc',
        onNewTask: mockOnNewTask,
      };
      render(<DashboardHeader {...props} />);
      const button = screen.getByRole('button', { name: /nueva tarea/i });

      // Act
      await user.click(button);

      // Assert
      expect(mockOnNewTask).toHaveBeenCalledTimes(1);
    });
  });
});
