import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LinkTimeModal from './LinkTimeModal';
import { ProjectTimeEntry, Priority } from '@/types/project';
import { Task, TaskStatus } from '@/types/task';
import { apiPatch } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiPatch: jest.fn(),
}));

describe('LinkTimeModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnLinkSuccess = jest.fn();

  const mockEntry: ProjectTimeEntry = {
    id: 'entry-1',
    userId: 'user-1',
    startTime: '2026-03-30T08:00:00Z',
    endTime: '2026-03-30T09:00:00Z', // 1 hour (3600 seconds)
    totalPausedMs: 0,
    user: {
      name: 'John',
      lastname: 'Doe',
      email: 'john@example.com',
    },
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Design UI',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      projectId: 'proj-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Implement Auth',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      projectId: 'proj-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      // Arrange & Act
      const { container } = render(
        <LinkTimeModal
          isOpen={false}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when entry is null', () => {
      // Arrange & Act
      const { container } = render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={null}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should render modal content when open and entry exists', () => {
      // Arrange & Act
      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Assert
      expect(screen.getByText('Vincular tiempo a tarea')).toBeInTheDocument();
      expect(screen.getByText('01:00:00')).toBeInTheDocument(); // 1 hour duration
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });
  });

  describe('User Interactions & Validations', () => {
    it('should show error when submitting without selecting a task', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      expect(screen.getByText('Debes seleccionar una tarea')).toBeInTheDocument();
      expect(apiPatch).not.toHaveBeenCalled();
    });

    it('should link full time entry on submit', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPatch as jest.Mock).mockResolvedValueOnce({});

      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');
      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(apiPatch).toHaveBeenCalledWith('/time/entry-1/link', {
          taskId: 'task-1',
          durationMs: undefined,
        });
        expect(mockOnLinkSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show partial time fields when split mode is partial', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const partialButton = screen.getByRole('button', { name: /vincular parte/i });
      await user.click(partialButton);

      // Assert
      expect(screen.getByText(/duración a vincular/i)).toBeInTheDocument();
      expect(screen.getByText('A Vincular')).toBeInTheDocument();
      expect(screen.getByText('Restará en Proyecto')).toBeInTheDocument();
    });

    it('should throw error when partial duration is 0', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const partialButton = screen.getByRole('button', { name: /vincular parte/i });
      await user.click(partialButton);
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');

      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      expect(screen.getByText('La duración a vincular debe ser mayor que 0')).toBeInTheDocument();
      expect(apiPatch).not.toHaveBeenCalled();
    });

    it('should throw error when partial duration exceeds total active duration', async () => {
      // Arrange
      const user = userEvent.setup();
      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const partialButton = screen.getByRole('button', { name: /vincular parte/i });
      await user.click(partialButton);
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');

      // Set duration to 2 hours (exceeds entry's 1 hour)
      const hoursInput = screen.getByPlaceholderText('HH');
      await user.clear(hoursInput);
      await user.type(hoursInput, '2');

      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      expect(
        screen.getByText(
          /La duración parcial no puede superar ni igualar la duración total de la entrada/i
        )
      ).toBeInTheDocument();
      expect(apiPatch).not.toHaveBeenCalled();
    });

    it('should throw error when remaining time is less than 1 second', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockShortEntry: ProjectTimeEntry = {
        ...mockEntry,
        endTime: '2026-03-30T08:59:00.500Z', // 59m 0.5s duration
      };

      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockShortEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const partialButton = screen.getByRole('button', { name: /vincular parte/i });
      await user.click(partialButton);
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');

      // Set duration to 59 minutes (leaves less than 1 second)
      const minutesInput = screen.getByPlaceholderText('MM');
      await user.clear(minutesInput);
      await user.type(minutesInput, '59');

      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      expect(
        screen.getByText('Debe quedar al menos 1 segundo restante en la entrada original')
      ).toBeInTheDocument();
      expect(apiPatch).not.toHaveBeenCalled();
    });

    it('should link partial time entry on submit', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPatch as jest.Mock).mockResolvedValueOnce({});

      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      const partialButton = screen.getByRole('button', { name: /vincular parte/i });
      await user.click(partialButton);
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');

      // Set duration to 30 minutes (1800000ms)
      const minutesInput = screen.getByPlaceholderText('MM');
      await user.clear(minutesInput);
      await user.type(minutesInput, '30');

      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(apiPatch).toHaveBeenCalledWith('/time/entry-1/link', {
          taskId: 'task-1',
          durationMs: 1800000,
        });
        expect(mockOnLinkSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should display API error messages when link submission fails', async () => {
      // Arrange
      const user = userEvent.setup();
      (apiPatch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      render(
        <LinkTimeModal
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          tasks={mockTasks}
          onLinkSuccess={mockOnLinkSuccess}
        />
      );

      // Act
      await user.selectOptions(screen.getByLabelText(/seleccionar tarea/i), 'task-1');
      const submitButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });
    });
  });
});
