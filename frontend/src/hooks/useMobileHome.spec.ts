import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGet } from '@/lib/api';
import { useMobileHome } from './useMobileHome';

jest.mock('@/lib/api', () => ({ apiGet: jest.fn() }));
let auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } };
jest.mock('./useAuth', () => ({ useAuth: () => auth }));

const page = (title: string) => ({ items: [{ id: title, title, projectId: 'p1', project: { id: 'p1', name: 'P' }, status: 'TODO', priority: 'MEDIUM', updatedAt: '', hasSubTasks: false, assignmentSource: 'direct' }], page: 1, pageSize: 5, total: 1, totalPages: 1 });
const time = { todayMilliseconds: 1, weekMilliseconds: 2, timezone: 'America/Argentina/Buenos_Aires', items: [], page: 1, pageSize: 1, total: 0, totalPages: 0 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((ok) => { resolve = ok; }); return { promise, resolve }; }

describe('useMobileHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } };
    (apiGet as jest.Mock).mockImplementation((url: string) => Promise.resolve(url.startsWith('/time/') ? time : page(url)));
  });

  it('uses bounded own-task queries and the confirmed time summary', async () => {
    const { result } = renderHook(() => useMobileHome());
    await waitFor(() => expect(result.current.status.time.loading).toBe(false));
    const urls = (apiGet as jest.Mock).mock.calls.map(([url]) => url as string);
    expect(urls).toHaveLength(4);
    expect(urls.filter((url) => url.startsWith('/tasks?'))).toHaveLength(3);
    expect(urls.every((url) => !url.includes('organizationId'))).toBe(true);
    expect(urls.filter((url) => url.startsWith('/tasks?')).every((url) => url.includes('assignedTo=me'))).toBe(true);
    expect(result.current.time?.weekMilliseconds).toBe(2);
  });

  it('clears A immediately and ignores its late responses after A to B', async () => {
    const late = deferred<ReturnType<typeof page>>();
    let taskCalls = 0;
    (apiGet as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/time/')) return Promise.resolve(time);
      taskCalls += 1;
      return taskCalls <= 3 ? late.promise : Promise.resolve(page('B'));
    });
    const { result, rerender } = renderHook(() => useMobileHome());
    auth = { ...auth, activeOrganization: { id: 'org-b' } };
    act(() => window.dispatchEvent(new Event('organization:changed')));
    expect(result.current.tasks.overdue).toEqual([]);
    rerender();
    await waitFor(() => expect(result.current.tasks.overdue[0]?.title).toBe('B'));
    await act(async () => late.resolve(page('A')));
    expect(result.current.tasks.overdue[0]?.title).toBe('B');
  });

  it('keeps stale A and B empty during a rapid A to B to C transition and logout', async () => {
    const pending = Array.from({ length: 9 }, () => deferred<ReturnType<typeof page>>());
    let taskCalls = 0;
    (apiGet as jest.Mock).mockImplementation((url: string) => url.startsWith('/time/') ? Promise.resolve(time) : pending[taskCalls++].promise);
    const { result, rerender } = renderHook(() => useMobileHome());
    auth = { ...auth, activeOrganization: { id: 'org-b' } };
    act(() => window.dispatchEvent(new Event('organization:changed'))); rerender();
    auth = { ...auth, activeOrganization: { id: 'org-c' } };
    act(() => window.dispatchEvent(new Event('organization:changed'))); rerender();
    await act(async () => pending.slice(6, 9).forEach((item) => item.resolve(page('C'))));
    expect(result.current.tasks.overdue[0]?.title).toBe('C');
    act(() => window.dispatchEvent(new Event('auth:cleared')));
    await act(async () => pending.slice(0, 6).forEach((item) => item.resolve(page('old'))));
    expect(result.current.tasks).toEqual({ overdue: [], upcoming: [], inProgress: [] });
    expect(result.current.time).toBeNull();
  });

  it('retries only the failed block', async () => {
    (apiGet as jest.Mock).mockImplementation((url: string) => url.includes('overdue=true') ? Promise.reject(new Error('falló vencidas')) : Promise.resolve(url.startsWith('/time/') ? time : { ...page('ok'), items: [] }));
    const { result } = renderHook(() => useMobileHome());
    await waitFor(() => expect(result.current.status.overdue.error).toBe('falló vencidas'));
    const before = (apiGet as jest.Mock).mock.calls.length;
    await act(async () => { void result.current.retry('overdue'); });
    await waitFor(() => expect((apiGet as jest.Mock).mock.calls.length).toBe(before + 1));
  });
});
