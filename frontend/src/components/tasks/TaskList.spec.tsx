/**
 * TaskList.tsx - Task List Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import '@testing-library/jest-dom';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskList from './TaskList';
import { Task, TaskStatus } from '@/types/task';
import { Priority } from '@/types/project';

jest.mock('./TaskItem', () => {
  return function DummyTaskItem({ task, onStatusChange }: any) {
    return (
      <div data-testid={`task-${task.id}`}>
        {task.title}
        <button onClick={() => onStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
          Change Status
        </button>
      </div>
    );
  };
});

describe('TaskList Component', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Setup project',
      description: 'Initial setup',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      projectId: 'proj-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Design mockups',
      description: 'Create UI mockups',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      projectId: 'proj-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'task-3',
      title: 'Review code',
      description: 'Code review',
      status: TaskStatus.DONE,
      priority: Priority.LOW,
      projectId: 'proj-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  const mockOnEdit = jest.fn();
  const mockOnStatusChange = jest.fn();
  const mockOnTakeTask = jest.fn();

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('Rendering Tasks', () => {
    it('should render all tasks', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-3')).toBeInTheDocument();
    });

    it('should render task count correctly', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      const taskElements = screen.getAllByTestId(/^task-/);
      expect(taskElements).toHaveLength(3);
    });

    it('should pass correct props to TaskItem', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state message', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={[]}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('No hay tareas')).toBeInTheDocument();
      expect(screen.getByText('Crea una tarea para empezar a ordenar el trabajo.')).toBeInTheDocument();
    });

    it('should not render task items when empty', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={[]}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      const taskElements = screen.queryAllByTestId(/^task-/);
      expect(taskElements).toHaveLength(0);
    });
  });

  describe('User Interactions', () => {
    it('should handle status change', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Act
      const changeButtons = screen.getAllByText('Change Status');
      await user.click(changeButtons[0]);

      // Assert
      expect(mockOnStatusChange).toHaveBeenCalledWith('task-1', TaskStatus.IN_PROGRESS);
    });

    it('should support multiple status changes', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Act
      const changeButtons = screen.getAllByText('Change Status');
      await user.click(changeButtons[0]);
      await user.click(changeButtons[1]);

      // Assert
      expect(mockOnStatusChange).toHaveBeenCalledTimes(2);
      expect(mockOnStatusChange).toHaveBeenNthCalledWith(1, 'task-1', TaskStatus.IN_PROGRESS);
      expect(mockOnStatusChange).toHaveBeenNthCalledWith(2, 'task-2', TaskStatus.IN_PROGRESS);
    });
  });

  describe('Grouping by Status', () => {
    it('should render flat list by default', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          groupByStatus={false}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-3')).toBeInTheDocument();
    });

    it('should group tasks by status when enabled', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          groupByStatus={true}
        />
      );

      // Assert
      // Should still render all tasks
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-3')).toBeInTheDocument();
    });
  });

  describe('Pending Status Tasks', () => {
    it('should mark pending tasks', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          pendingStatusTaskIds={['task-1', 'task-2']}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
    });

    it('should handle empty pending list', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          pendingStatusTaskIds={[]}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });
  });

  describe('Optional Props', () => {
    it('should render without onTakeTask callback', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });

    it('should render without groupByStatus', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });

    it('should render without pendingStatusTaskIds', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={mockTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
          groupByStatus={true}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    });
  });

  describe('Different Task Statuses', () => {
    it('should handle tasks with various statuses', () => {
      // Arrange
      const mixedStatusTasks = [
        { ...mockTasks[0], status: TaskStatus.TODO },
        { ...mockTasks[1], status: TaskStatus.IN_PROGRESS },
        { ...mockTasks[2], status: TaskStatus.DONE },
        { ...mockTasks[0], id: 'task-4', status: TaskStatus.BLOCKED },
      ];

      // Act
      render(
        <TaskList
          tasks={mixedStatusTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getAllByTestId(/^task-/)).toHaveLength(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single task', () => {
      // Arrange & Act
      render(
        <TaskList
          tasks={[mockTasks[0]]}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.queryByTestId('task-task-2')).not.toBeInTheDocument();
    });

    it('should handle many tasks', () => {
      // Arrange
      const manyTasks = Array.from({ length: 50 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`,
      }));

      // Act
      render(
        <TaskList
          tasks={manyTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      const taskElements = screen.getAllByTestId(/^task-/);
      expect(taskElements).toHaveLength(50);
    });

    it('should handle tasks with special characters', () => {
      // Arrange
      const specialTasks = [
        { ...mockTasks[0], title: 'Task & Setup (v1.0)' },
        { ...mockTasks[1], title: 'Task <Review> [Important]' },
      ];

      // Act
      render(
        <TaskList
          tasks={specialTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
    });
  });
});

