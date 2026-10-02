import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGet, apiPatch } from '@/lib/api';
import { useMobileTasks } from './useMobileTasks';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';
import type { TaskListItem } from '@/types/task-list';

jest.mock('@/lib/api', () => ({ apiGet: jest.fn(), apiPatch: jest.fn() }));
let auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } };
jest.mock('./useAuth', () => ({ useAuth: () => auth }));

const task: TaskListItem = { id: 't1', projectId: 'p1', project: { id: 'p1', name: 'Proyecto' }, title: 'Tarea real', status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: null, assignedToId: null, assignedTo: null, estimatedHours: null, updatedAt: '2026-01-01', hasSubTasks: false, assignmentSource: 'none' };
const page = (items = [task], current = 1, totalPages = 1) => ({ items, page: current, pageSize: 25, total: items.length, totalPages });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

describe('useMobileTasks', () => {
  beforeEach(() => { jest.clearAllMocks(); auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } }; });

  it('loads authorized tasks and loads another page without mixing results', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce(page([task], 1, 2)).mockResolvedValueOnce(page([{ ...task, id: 't2' }], 2, 2));
    const { result } = renderHook(() => useMobileTasks());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items.map((item) => item.id)).toEqual(['t1', 't2']);
  });

  it('shows an empty list and supports retry after an error', async () => {
    (apiGet as jest.Mock).mockRejectedValueOnce(new Error('Sin conexion')).mockResolvedValueOnce(page([]));
    const { result } = renderHook(() => useMobileTasks());
    await waitFor(() => expect(result.current.error).toBe('Sin conexion'));
    await act(async () => { await result.current.retry(); });
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
  });

  it('discards a late response from organization A after organization B loads', async () => {
    const a = deferred<ReturnType<typeof page>>();
    (apiGet as jest.Mock).mockReturnValueOnce(a.promise).mockResolvedValueOnce(page([{ ...task, id: 'b', title: 'B' }]));
    const { result, rerender } = renderHook(() => useMobileTasks());
    auth = { ...auth, activeOrganization: { id: 'org-b' } };
    act(() => window.dispatchEvent(new Event('organization:changed')));
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe('b'));
    await act(async () => { a.resolve(page([{ ...task, id: 'a', title: 'A' }])); await a.promise; });
    expect(result.current.items[0]?.id).toBe('b');
  });

  it('blocks a double status mutation and rolls back a failed optimistic update', async () => {
    const mutation = deferred<TaskListItem>();
    (apiGet as jest.Mock).mockResolvedValue(page());
    (apiPatch as jest.Mock).mockReturnValue(mutation.promise);
    const { result } = renderHook(() => useMobileTasks());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    let first!: Promise<boolean>; let second!: Promise<boolean>;
    act(() => { first = result.current.changeStatus(task, TaskStatus.DONE); second = result.current.changeStatus(task, TaskStatus.DONE); });
    expect(apiPatch).toHaveBeenCalledTimes(1);
    await act(async () => { mutation.reject(new Error('No permitido')); await Promise.all([first, second]); });
    expect(result.current.items[0].status).toBe(TaskStatus.TODO);
    expect(result.current.error).toBe('No permitido');
  });

  it('resets pagination and sends filters after debounced search', async () => {
    jest.useFakeTimers();
    (apiGet as jest.Mock).mockResolvedValue(page([]));
    const { result } = renderHook(() => useMobileTasks());
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.setFilters({ search: 'login', assignedTo: 'me', priority: Priority.HIGH }));
    act(() => jest.advanceTimersByTime(300));
    await waitFor(() => expect(apiGet).toHaveBeenLastCalledWith(expect.stringContaining('search=login')));
    expect(apiGet).toHaveBeenLastCalledWith(expect.stringContaining('assignedTo=me'));
    jest.useRealTimers();
  });
});
