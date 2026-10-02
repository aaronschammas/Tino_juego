import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiClientError, apiGet, apiPatch } from '@/lib/api';
import MobileTaskDetail from './MobileTaskDetail';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';

jest.mock('@/lib/api', () => { const actual = jest.requireActual('@/lib/api'); return { ...actual, apiGet: jest.fn(), apiPatch: jest.fn() }; });
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, activeOrganization: { id: 'org-1' } }) }));
jest.mock('@/components/task-comments/TaskCommentsSection', () => function MockComments() { return <section aria-label="Comentarios">Comentarios reales</section>; });

const task = { id: 't1', projectId: 'p1', project: { id: 'p1', name: 'Proyecto' }, title: 'Resolver incidente', description: 'Descripcion', status: TaskStatus.TODO, priority: Priority.HIGH, dueDate: null, assignedToId: null, assignedTo: null, estimatedHours: 2, actualHours: 1, subTasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' };

describe('MobileTaskDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows real detail, navigation, comments and accessible actions', async () => {
    (apiGet as jest.Mock).mockResolvedValue(task);
    render(<MobileTaskDetail projectId="p1" taskId="t1" />);
    expect(await screen.findByRole('heading', { name: task.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a tareas/i })).toHaveAttribute('href', '/mobile/tasks');
    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tomar tarea/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Comentarios')).toBeInTheDocument();
  });

  it('distinguishes inaccessible tasks from recoverable server errors', async () => {
    (apiGet as jest.Mock).mockRejectedValueOnce(new ApiClientError('private detail', 404));
    const { unmount } = render(<MobileTaskDetail projectId="p1" taskId="missing" />);
    expect(await screen.findByRole('heading', { name: /tarea no disponible/i })).toBeInTheDocument();
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
    unmount();
    (apiGet as jest.Mock).mockRejectedValueOnce(new ApiClientError('Servidor temporalmente no disponible', 500)).mockResolvedValueOnce(task);
    render(<MobileTaskDetail projectId="p1" taskId="t1" />);
    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: task.title })).toBeInTheDocument();
  });

  it('blocks double take taps until the mutation finishes', async () => {
    let resolve!: (value: unknown) => void;
    (apiGet as jest.Mock).mockResolvedValue(task);
    (apiPatch as jest.Mock).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<MobileTaskDetail projectId="p1" taskId="t1" />);
    const button = await screen.findByRole('button', { name: /tomar tarea/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(apiPatch).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ...task, assignedToId: 'u1' }));
  });
});
