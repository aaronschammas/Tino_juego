import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGet } from '@/lib/api';
import { useMobileSummary } from './useMobileSummary';

jest.mock('@/lib/api', () => ({ apiGet: jest.fn() }));
let auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' }, activeMembership: { role: 'ORG_MEMBER' } };
jest.mock('./useAuth', () => ({ useAuth: () => auth }));
const response = (period = 'week', marker = 1) => ({ period, range: { from: '', to: '' }, timezone: 'America/Argentina/Buenos_Aires', privacy: 'self-only', completedInPeriod: null, completedMetricReason: '', own: { pendingTasks: marker, inProgressTasks: 0, blockedTasks: 0, overdueTasks: 0, confirmedHours: 0, activeProjects: 0 } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((ok) => { resolve = ok; }); return { promise, resolve }; }

describe('useMobileSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' }, activeMembership: { role: 'ORG_MEMBER' } };
    (apiGet as jest.Mock).mockResolvedValue(response());
  });

  it('loads only self scope for a member and includes period in the request', async () => {
    const { result } = renderHook(() => useMobileSummary());
    await waitFor(() => expect(result.current.self).not.toBeNull());
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect((apiGet as jest.Mock).mock.calls[0][0]).toContain('period=week');
    expect((apiGet as jest.Mock).mock.calls[0][0]).toContain('scope=self');
  });

  it('loads self and a separate authorized organization block for an owner', async () => {
    auth = { ...auth, activeMembership: { role: 'ORG_OWNER' } };
    const { result } = renderHook(() => useMobileSummary());
    await waitFor(() => expect(result.current.loading.organization).toBe(false));
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect((apiGet as jest.Mock).mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([expect.stringContaining('scope=self'), expect.stringContaining('scope=organization')]));
  });

  it('discards a late week response after a rapid change to month', async () => {
    const lateWeek = deferred<ReturnType<typeof response>>();
    (apiGet as jest.Mock).mockImplementation((url: string) => url.includes('period=week') ? lateWeek.promise : Promise.resolve(response('month', 9)));
    const { result } = renderHook(() => useMobileSummary());
    act(() => result.current.setPeriod('month'));
    await waitFor(() => expect(result.current.self?.own.pendingTasks).toBe(9));
    await act(async () => lateWeek.resolve(response('week', 1)));
    expect(result.current.period).toBe('month');
    expect(result.current.self?.own.pendingTasks).toBe(9);
  });

  it('clears immediately across A to B to C and ignores pending responses', async () => {
    const lateA = deferred<ReturnType<typeof response>>();
    const lateB = deferred<ReturnType<typeof response>>();
    (apiGet as jest.Mock)
      .mockReturnValueOnce(lateA.promise)
      .mockReturnValueOnce(lateB.promise)
      .mockResolvedValueOnce(response('week', 3));
    const { result, rerender } = renderHook(() => useMobileSummary());
    auth = { ...auth, activeOrganization: { id: 'org-b' } };
    act(() => window.dispatchEvent(new Event('organization:changed'))); rerender();
    auth = { ...auth, activeOrganization: { id: 'org-c' } };
    act(() => window.dispatchEvent(new Event('organization:changed'))); rerender();
    await waitFor(() => expect(result.current.self?.own.pendingTasks).toBe(3));
    await act(async () => { lateA.resolve(response('week', 7)); lateB.resolve(response('week', 8)); });
    expect(result.current.self?.own.pendingTasks).toBe(3);
  });

  it('keeps an organization error independent and retries only that scope', async () => {
    auth = { ...auth, activeMembership: { role: 'ORG_OWNER' } };
    (apiGet as jest.Mock).mockImplementation((url: string) => url.includes('scope=organization') ? Promise.reject(new Error('sin agregado')) : Promise.resolve(response()));
    const { result } = renderHook(() => useMobileSummary());
    await waitFor(() => expect(result.current.errors.organization).toBe('sin agregado'));
    expect(result.current.self).not.toBeNull();
    const before = (apiGet as jest.Mock).mock.calls.length;
    act(() => { void result.current.retry('organization'); });
    await waitFor(() => expect((apiGet as jest.Mock).mock.calls.length).toBe(before + 1));
  });
});
