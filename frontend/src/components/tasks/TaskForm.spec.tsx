import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskForm from './TaskForm';
import { apiGet } from '@/lib/api';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

const mockUseAuth = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('TaskForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Org owner by default, so existing tests keep exercising the
    // unrestricted edit path (see permissions.ts canEditTaskDetailed).
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'USER' },
      activeMembership: { id: 'mem-1', role: 'ORG_OWNER' },
    });
    (apiGet as jest.Mock).mockResolvedValue([
      {
        user: {
          id: 'u1',
          name: 'Ana',
          lastname: 'Lopez',
          email: 'ana@demo.com',
        },
      },
    ]);
  });

  it('fetches project members and renders assignee options', async () => {
    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/projects/p1/members');
    });

    expect(await screen.findByRole('option', { name: /ana lopez/i })).toBeInTheDocument();
  });

  it('submits minimal payload', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    await user.type(screen.getByLabelText(/nombre/i), 'Tarea 1');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tarea 1',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
      }),
      'p1'
    );
  });

  it('submits due date and assignee when provided', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    await user.type(screen.getByLabelText(/nombre/i), 'Tarea 2');
    // Actualizado para coincidir con la nueva etiqueta corta o flexible
    await user.type(screen.getByLabelText(/vencimiento/i), '2026-04-05');
    await user.selectOptions(screen.getByLabelText(/responsable/i), 'u1');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    const submitted = mockOnSubmit.mock.calls[0][0];
    expect(submitted.assignedToId).toBe('u1');
    expect(submitted.dueDate).toMatch(/^2026-04-05T/);
  });

  it('prefills fields in edit mode', async () => {
    render(
      <TaskForm
        projectId="p1"
        task={{
          id: 't1',
          title: 'Editar tarea',
          description: 'Descripcion base',
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          dueDate: '2026-05-01T00:00:00.000Z',
          projectId: 'p1',
          assignedToId: 'u1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await screen.findByRole('option', { name: /ana lopez/i });

    expect(screen.getByDisplayValue('Editar tarea')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Descripcion base')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-05-01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeInTheDocument();
  });

  it('shows submit error and handles cancel', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Save failed'));

    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    await user.type(screen.getByLabelText(/nombre/i), 'Tarea error');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('clamps the hours input to the maximum allowed estimate', async () => {
    const user = userEvent.setup();

    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    const hoursInput = screen.getByPlaceholderText('HH');
    await user.clear(hoursInput);
    await user.type(hoursInput, '9999');

    expect(hoursInput).toHaveValue(999);
  });

  it('caps the minutes input to the maximum allowed estimate', async () => {
    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    const minutesInput = screen.getByPlaceholderText('MM');
    expect(minutesInput).toHaveAttribute('max', '59');
    expect(minutesInput).toHaveAttribute('min', '0');
  });

  it('allows an estimate exactly at the maximum', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<TaskForm projectId="p1" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await screen.findByRole('option', { name: /ana lopez/i });

    await user.type(screen.getByLabelText(/^nombre/i), 'Tarea al limite');
    const hoursInput = screen.getByPlaceholderText('HH');
    await user.clear(hoursInput);
    await user.type(hoursInput, '999');
    const minutesInput = screen.getByPlaceholderText('MM');
    await user.clear(minutesInput);
    await user.type(minutesInput, '59');

    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    expect(mockOnSubmit.mock.calls[0][0].estimatedHours).toBeCloseTo((999 * 60 + 59) / 60);
  });

  it('scopes the payload to status only for a restricted member editing an assigned task', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'USER' },
      activeMembership: { id: 'mem-1', role: 'ORG_MEMBER' },
    });
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <TaskForm
        projectId="p1"
        task={{
          id: 't1',
          title: 'Tarea existente',
          status: TaskStatus.TODO,
          priority: Priority.HIGH,
          projectId: 'p1',
          assignedToId: 'u1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await screen.findByRole('option', { name: /ana lopez/i });

    expect(screen.getByLabelText(/^nombre/i)).toBeDisabled();
    expect(screen.getByLabelText(/responsable/i)).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/estado/i), TaskStatus.IN_PROGRESS);
    await user.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      { status: TaskStatus.IN_PROGRESS },
      'p1',
    );
  });

  const editableTask = {
    id: 't-edit',
    title: 'Tarea editable',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    projectId: 'p1',
    assignedToId: undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('allows an ORG_MEMBER project owner to edit every field', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'project-owner', role: 'USER' },
      activeMembership: { id: 'mem-1', role: 'ORG_MEMBER' },
    });

    render(
      <TaskForm
        projectId="p1"
        task={editableTask}
        canFullyEdit
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByLabelText(/^nombre/i)).toBeEnabled();
    expect(screen.getByLabelText(/prioridad/i)).toBeEnabled();
    expect(screen.getByLabelText(/responsable/i)).toBeEnabled();
  });

  it.each([
    ['ORG_OWNER', { id: 'owner', role: 'USER' }, 'ORG_OWNER'],
    ['administrador global', { id: 'admin', role: 'SUPERADMIN' }, 'ORG_MEMBER'],
  ])('keeps full editing permissions for %s', (_label, authUser, membershipRole) => {
    mockUseAuth.mockReturnValue({
      user: authUser,
      activeMembership: { id: 'mem-1', role: membershipRole },
    });

    render(
      <TaskForm
        projectId="p1"
        task={editableTask}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByLabelText(/^nombre/i)).toBeEnabled();
    expect(screen.getByLabelText(/responsable/i)).toBeEnabled();
  });

  it('lets a restricted member take an unassigned task only for themselves', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 'current-user', role: 'USER' },
      activeMembership: { id: 'mem-1', role: 'ORG_MEMBER' },
    });
    mockOnSubmit.mockResolvedValue(undefined);
    (apiGet as jest.Mock).mockResolvedValue([
      { user: { id: 'other-user', name: 'Otro', lastname: 'Usuario', email: 'other@test.com' } },
    ]);

    render(
      <TaskForm
        projectId="p1"
        task={editableTask}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.queryByRole('option', { name: /otro usuario/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^tomar tarea$/i }));
    await user.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    expect(mockOnSubmit).toHaveBeenCalledWith(
      { status: TaskStatus.TODO, assignedToId: 'current-user' },
      'p1',
    );
  });

  it('keeps the normal assignee selector for users with full permissions', async () => {
    render(
      <TaskForm
        projectId="p1"
        task={editableTask}
        canFullyEdit
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(await screen.findByRole('option', { name: /ana lopez/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^tomar tarea$/i })).not.toBeInTheDocument();
  });
});
