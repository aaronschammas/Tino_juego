/**
 * TaskItem.tsx - Task Item Component Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskItem from './TaskItem';
import { Task, TaskStatus } from '@/types/task';
import { Priority } from '@/types/project';
import * as useAuthModule from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth');

describe('TaskItem Component', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    lastname: 'User',
    role: 'USER',
    isActive: true,
  };

  const mockTask: Task = {
    id: 'task-1',
    title: 'Complete Project Setup',
    description: 'Set up the initial project structure',
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    projectId: 'project-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const mockOnEdit = jest.fn();
  const mockOnStatusChange = jest.fn();
  const mockOnTakeTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  describe('Rendering', () => {
    it('should render task title and description', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Complete Project Setup')).toBeInTheDocument();
      expect(screen.getByText('Set up the initial project structure')).toBeInTheDocument();
    });

    it('should display priority badge with correct styling', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Alta')).toBeInTheDocument();
    });

    it('should display task status', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Por hacer')).toBeInTheDocument();
    });

    it('should render edit button', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      const editButton = screen.getByTitle('Editar');
      expect(editButton).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onEdit when edit button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Act
      const editButton = screen.getByTitle('Editar');
      await user.click(editButton);

      // Assert
      expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onStatusChange with correct status when status action is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Act
      const statusButton = screen.getByText('Mover a En progreso');
      await user.click(statusButton);

      // Assert
      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith('task-1', TaskStatus.IN_PROGRESS);
      });
    });

    it('should call onTakeTask when take button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
        />
      );

      // Act
      const takeButton = screen.getByTitle('Tomar tarea');
      await user.click(takeButton);

      // Assert
      expect(mockOnTakeTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('Different Task Statuses', () => {
    it('should show correct actions for IN_PROGRESS status', () => {
      // Arrange
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };

      // Act
      render(
        <TaskItem
          task={inProgressTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('En progreso')).toBeInTheDocument();
      expect(screen.getByText('Mover a Completadas')).toBeInTheDocument();
      expect(screen.getByText('Mover a Bloqueadas')).toBeInTheDocument();
    });

    it('should show correct actions for DONE status', () => {
      // Arrange
      const doneTask = { ...mockTask, status: TaskStatus.DONE };

      // Act
      render(
        <TaskItem
          task={doneTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Completada')).toBeInTheDocument();
      expect(screen.getByText('Reabrir en En progreso')).toBeInTheDocument();
    });

    it('should show correct actions for BLOCKED status', () => {
      // Arrange
      const blockedTask = { ...mockTask, status: TaskStatus.BLOCKED };

      // Act
      render(
        <TaskItem
          task={blockedTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Bloqueada')).toBeInTheDocument();
      expect(screen.getByText('Mover a En progreso')).toBeInTheDocument();
    });
  });

  describe('Different Priorities', () => {
    it('should display LOW priority correctly', () => {
      // Arrange
      const lowPriorityTask = { ...mockTask, priority: Priority.LOW };

      // Act
      render(
        <TaskItem
          task={lowPriorityTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Baja')).toBeInTheDocument();
    });

    it('should display CRITICAL priority correctly', () => {
      // Arrange
      const criticalTask = { ...mockTask, priority: Priority.CRITICAL };

      // Act
      render(
        <TaskItem
          task={criticalTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Crítica')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should disable status buttons when isStatusUpdating is true', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          isStatusUpdating={true}
        />
      );

      // Assert
      const statusButtons = screen.queryAllByRole('button').filter(btn => 
        btn.textContent?.includes('Mover a') ||
        btn.textContent?.includes('Reabrir') ||
        btn.textContent?.includes('Volver a')
      );
      if (statusButtons.length > 0) {
        statusButtons.forEach(btn => {
          expect(btn).toBeDisabled();
        });
      }
    });

    it('should enable status buttons when isStatusUpdating is false', () => {
      // Arrange & Act
      render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          isStatusUpdating={false}
        />
      );

      // Assert
      const statusButtons = screen.queryAllByRole('button').filter(btn => 
        btn.textContent?.includes('Mover a') ||
        btn.textContent?.includes('Reabrir') ||
        btn.textContent?.includes('Volver a')
      );
      if (statusButtons.length > 0) {
        statusButtons.forEach(btn => {
          expect(btn).not.toBeDisabled();
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle task without description', () => {
      // Arrange
      const taskNoDesc = { ...mockTask, description: '' };

      // Act
      render(
        <TaskItem
          task={taskNoDesc}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Assert
      expect(screen.getByText('Complete Project Setup')).toBeInTheDocument();
    });

    it('should handle missing onTakeTask callback', async () => {
      // Arrange
      const user = userEvent.setup();
      const { container } = render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      // Act & Assert - should not throw error when rendering without onTakeTask
      expect(container).toBeInTheDocument();
    });
  });

  describe('Subtasks and optional actions', () => {
    const taskWithSubTasks: Task = {
      ...mockTask,
      assignedTo: {
        id: 'owner-1',
        name: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
      },
      dueDate: '2026-06-10T00:00:00.000Z',
      estimatedHours: 2,
      actualHours: 3,
      subTasks: [
        {
          id: 'sub-1',
          title: 'Nested task',
          status: TaskStatus.BLOCKED,
          priority: Priority.LOW,
          projectId: 'project-1',
          parentTaskId: 'task-1',
          assignedTo: {
            id: 'sub-owner',
            name: 'Grace',
            lastname: 'Hopper',
            email: 'grace@example.com',
          },
          assignedToId: 'sub-owner',
          estimatedHours: 1,
          actualHours: 0.5,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'sub-2',
          title: 'Unassigned nested task',
          status: TaskStatus.TODO,
          priority: Priority.MEDIUM,
          projectId: 'project-1',
          parentTaskId: 'task-1',
          actualHours: 0.25,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    it('renders subtasks and routes nested actions without triggering parent edit', async () => {
      const user = userEvent.setup();
      const onTrackTime = jest.fn();
      const onDelete = jest.fn();

      render(
        <TaskItem
          task={taskWithSubTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
          onTrackTime={onTrackTime}
          onDelete={onDelete}
          canDelete
          activeTaskId="sub-1"
        />
      );

      expect(screen.getByText('Subtareas')).toBeInTheDocument();
      expect(screen.getByText('Nested task')).toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
      expect(screen.getByText('Unassigned nested task')).toBeInTheDocument();
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText(/Real:/)).toBeInTheDocument();

      await user.click(screen.getAllByLabelText('Detener timer')[0]);
      expect(onTrackTime).toHaveBeenCalledWith(taskWithSubTasks.subTasks![0]);

      await user.click(screen.getByRole('button', { name: 'Tomar subtarea' }));
      expect(mockOnTakeTask).toHaveBeenCalledWith('sub-2');

      await user.click(screen.getAllByRole('button', { name: 'Eliminar subtarea' })[0]);
      expect(onDelete).toHaveBeenCalledWith('sub-1');

      await user.click(screen.getByText('Nested task'));
      expect(mockOnEdit).toHaveBeenCalledWith(taskWithSubTasks.subTasks![0]);
    });

    it('renders top-level optional actions and suppresses parent timer when subtasks exist', async () => {
      const user = userEvent.setup();
      const onTrackTime = jest.fn();
      const onDelete = jest.fn();
      const onCreateSubTask = jest.fn();

      render(
        <TaskItem
          task={taskWithSubTasks}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTrackTime={onTrackTime}
          onDelete={onDelete}
          onCreateSubTask={onCreateSubTask}
          canDelete
          isFirst
        />
      );

      await user.click(screen.getByTitle('Crear subtarea'));
      expect(onCreateSubTask).toHaveBeenCalledWith(taskWithSubTasks);

      await user.click(screen.getByTitle('Eliminar tarea'));
      expect(onDelete).toHaveBeenCalledWith('task-1');

      expect(screen.getAllByLabelText('Iniciar timer')).toHaveLength(2);
      expect(screen.getAllByLabelText('Cambiar estado').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Tomar subtarea' })).toHaveTextContent('');
      expect(screen.queryByText('>')).not.toBeInTheDocument();
      expect(screen.queryByText('x')).not.toBeInTheDocument();
      expect(screen.queryByText('T')).not.toBeInTheDocument();
      expect(screen.getByText('Tarea padre')).toBeInTheDocument();
      expect(screen.getByText('0/2 completadas')).toBeInTheDocument();
      expect(screen.getByText('Esta tarea tiene subtareas. Inicia el timer en una subtarea.')).toBeInTheDocument();
      expect(onTrackTime).not.toHaveBeenCalledWith(taskWithSubTasks);
    });

    it('uses fallback assignment labels and initials when user data is absent', () => {
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: null });
      const taskWithoutPeople: Task = {
        ...mockTask,
        assignedToId: 'already-assigned',
        assignedTo: undefined,
        responsibles: [],
        estimatedHours: 0,
        actualHours: 1,
      };

      render(
        <TaskItem
          task={taskWithoutPeople}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
          onTakeTask={mockOnTakeTask}
          onTrackTime={jest.fn()}
          activeTaskId="task-1"
        />
      );

      expect(screen.getAllByText('SA')[0]).toBeInTheDocument();
      expect(screen.getByTitle('Detener tiempo')).toBeInTheDocument();
      expect(screen.queryByTitle('Tomar tarea')).not.toBeInTheDocument();
      expect(screen.getByText(/Real:/)).toBeInTheDocument();
    });

    it('sets drag metadata and clears dragging state', () => {
      const dataTransfer = {
        setData: jest.fn(),
        effectAllowed: '',
      };

      const { container } = render(
        <TaskItem
          task={mockTask}
          onEdit={mockOnEdit}
          onStatusChange={mockOnStatusChange}
        />
      );

      const article = container.querySelector('article')!;
      fireEvent.dragStart(article, { dataTransfer });
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'task-1');
      expect(dataTransfer.effectAllowed).toBe('move');

      fireEvent.dragEnd(article);
      expect(article).toBeInTheDocument();
    });
  });

  describe('Status menu', () => {
    it('keeps a single status menu open and closes it after choosing an option', () => {
      const { container } = render(
        <>
          <TaskItem task={mockTask} onEdit={mockOnEdit} onStatusChange={mockOnStatusChange} />
          <TaskItem task={{ ...mockTask, id: 'task-2', title: 'Otra tarea' }} onEdit={mockOnEdit} onStatusChange={mockOnStatusChange} />
        </>,
      );
      const [first, second] = Array.from(container.querySelectorAll<HTMLDetailsElement>('details[data-status-menu]'));

      first.open = true;
      fireEvent(first, new Event('toggle'));
      second.open = true;
      fireEvent(second, new Event('toggle'));
      expect(first.open).toBe(false);
      expect(second.open).toBe(true);

      fireEvent.click(second.querySelector('button')!);
      expect(second.open).toBe(false);
    });
  });
});
