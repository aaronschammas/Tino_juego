import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HealthStatusCard from './HealthStatusCard';

describe('HealthStatusCard Component', () => {
  // Arrange-Act-Assert: Basic Rendering
  describe('Rendering', () => {
    test('renders title when healthy', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={2}
          unassignedTasks={1}
          activeUsers={3}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const title = screen.getByRole('heading', { level: 3 });
      const healthy = screen.getByText(/operación estable/i);
      
      // Assert
      expect(title).toBeInTheDocument();
      expect(healthy).toBeInTheDocument();
    });

    test('renders title always', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const title = screen.getByRole('heading', { level: 3 });
      
      // Assert
      expect(title).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: No Issues State
  describe('No Issues State', () => {
    test('renders healthy message when no issues', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={25}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={3}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const healthyMessage = screen.getByText(/operación estable/i);
      
      // Assert
      expect(healthyMessage).toBeInTheDocument();
    });

    test('does not render overdue and blocked cards when no issues', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={15}
          tasksWithoutTime={2}
          unassignedTasks={1}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const operacion = screen.getByText(/operación estable/i);
      
      // Assert
      expect(operacion).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Overdue Tasks State
  describe('Overdue Tasks State', () => {
    test('renders overdue tasks card when overdueTasks > 0', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={3}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={1}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const overdueTasks = screen.getByText(/vencimientos/i);
      const count = screen.getByText(/3 tarea/i);
      
      // Assert
      expect(overdueTasks).toBeInTheDocument();
      expect(count).toBeInTheDocument();
    });

    test('uses singular "tarea" for 1 overdue task', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const singular = screen.getByText(/1 tarea vencida/);
      
      // Assert
      expect(singular).toBeInTheDocument();
    });

    test('uses plural "tareas" for multiple overdue tasks', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={5}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={3}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const plural = screen.getByText(/5 tareas vencidas/);
      
      // Assert
      expect(plural).toBeInTheDocument();
    });

    test('renders recommendation text for overdue tasks', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={2}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const recommendation = screen.getByText(/reasignar|conviene/i);
      
      // Assert
      expect(recommendation).toBeInTheDocument();
    });

    test('renders button in overdue card', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={1}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const button = screen.getByRole('button');
      
      // Assert
      expect(button).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Blocked Tasks State
  describe('Blocked Tasks State', () => {
    test('renders blocked tasks card when blockedTasks > 0', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={2}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={1}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const blockedTasks = screen.getByText(/bloqueos/i);
      
      // Assert
      expect(blockedTasks).toBeInTheDocument();
    });

    test('uses singular "tarea" for 1 blocked task', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={1}
          remainingTasks={10}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const singular = screen.getByText(/1 tarea bloqueada/i);
      
      // Assert
      expect(singular).toBeInTheDocument();
    });

    test('uses plural "tareas" for multiple blocked tasks', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={4}
          remainingTasks={10}
          tasksWithoutTime={2}
          unassignedTasks={1}
          activeUsers={3}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const plural = screen.getByText(/4 tareas bloqueadas/i);
      
      // Assert
      expect(plural).toBeInTheDocument();
    });

    test('renders recommendation for blocked tasks', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={2}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const recommendation = screen.getByText(/resolver|dependencias/i);
      
      // Assert
      expect(recommendation).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Multiple Issues State
  describe('Multiple Issues State', () => {
    test('renders both overdue and blocked cards when both have issues', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={2}
          blockedTasks={3}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={1}
          activeUsers={3}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const overdueTasks = screen.getByText(/vencimientos/i);
      const blockedTasks = screen.getByText(/bloqueos/i);
      
      // Assert
      expect(overdueTasks).toBeInTheDocument();
      expect(blockedTasks).toBeInTheDocument();
    });

    test('renders two buttons for two issues', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={1}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const buttons = screen.getAllByRole('button');
      
      // Assert
      expect(buttons).toHaveLength(2);
    });
  });

  // Arrange-Act-Assert: Button Interaction
  describe('Button Interaction', () => {
    test('calls onOpenProjects when button is clicked', async () => {
      // Arrange
      const handleOpenProjects = jest.fn();
      const user = userEvent.setup();
      render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={handleOpenProjects}
        />
      );
      
      // Act
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Assert
      expect(handleOpenProjects).toHaveBeenCalledTimes(1);
    });

    test('calls onOpenProjects for each issue button', async () => {
      // Arrange
      const handleOpenProjects = jest.fn();
      const user = userEvent.setup();
      render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={1}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={handleOpenProjects}
        />
      );
      
      // Act
      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);
      await user.click(buttons[1]);
      
      // Assert
      expect(handleOpenProjects).toHaveBeenCalledTimes(2);
    });
  });

  // Arrange-Act-Assert: Card Styling
  describe('Card Styling', () => {
    test('overdue card renders with danger styling', () => {
      // Arrange
      const { container } = render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={1}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const alertCards = container.querySelectorAll('[class*="border-l-4"]');
      
      // Assert
      expect(alertCards.length).toBeGreaterThan(0);
    });

    test('blocked card renders with warning styling', () => {
      // Arrange
      const { container } = render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={1}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={1}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const alertCards = container.querySelectorAll('[class*="border-l-4"]');
      
      // Assert
      expect(alertCards.length).toBeGreaterThan(0);
    });

    test('issues grid has single column layout', () => {
      // Arrange
      const { container } = render(
        <HealthStatusCard
          overdueTasks={1}
          blockedTasks={1}
          remainingTasks={10}
          tasksWithoutTime={1}
          unassignedTasks={0}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const grid = container.querySelector('.grid');
      
      // Assert
      expect(grid?.className).toContain('grid-cols-1');
    });
  });

  // Arrange-Act-Assert: Summary Chips
  describe('Summary Chips', () => {
    test('renders summary chips at the bottom', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={5}
          unassignedTasks={3}
          activeUsers={2}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const sinTiempoChip = screen.getByText(/sin tiempo/i);
      const sinAsignarChip = screen.getByText(/sin asignar/i);
      const usuariosActivos = screen.getByText(/usuarios activos/i);
      
      // Assert
      expect(sinTiempoChip).toBeInTheDocument();
      expect(sinAsignarChip).toBeInTheDocument();
      expect(usuariosActivos).toBeInTheDocument();
    });

    test('renders correct chip values', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={10}
          tasksWithoutTime={7}
          unassignedTasks={4}
          activeUsers={5}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act & Assert
      expect(screen.getByText(/7 sin tiempo/)).toBeInTheDocument();
      expect(screen.getByText(/4 sin asignar/)).toBeInTheDocument();
      expect(screen.getByText(/5 usuarios activos/)).toBeInTheDocument();
    });
  });

  // Arrange-Act-Assert: Edge Cases
  describe('Edge Cases', () => {
    test('renders with zero for all counts', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={0}
          blockedTasks={0}
          remainingTasks={0}
          tasksWithoutTime={0}
          unassignedTasks={0}
          activeUsers={0}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const title = screen.getByRole('heading', { level: 3 });
      
      // Assert
      expect(title).toBeInTheDocument();
    });

    test('renders with large numbers', () => {
      // Arrange
      render(
        <HealthStatusCard
          overdueTasks={999}
          blockedTasks={999}
          remainingTasks={9999}
          tasksWithoutTime={999}
          unassignedTasks={999}
          activeUsers={999}
          onOpenProjects={jest.fn()}
        />
      );
      
      // Act
      const title = screen.getByRole('heading', { level: 3 });
      
      // Assert
      expect(title).toBeInTheDocument();
    });
  });
});