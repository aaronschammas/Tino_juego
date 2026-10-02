import { act, renderHook, waitFor } from '@testing-library/react';
import { apiPost } from '@/lib/api';
import { useTinoAssistant } from './useTinoAssistant';

jest.mock('@/lib/api', () => ({ apiPost: jest.fn() }));
let auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } };
jest.mock('./useAuth', () => ({ useAuth: () => auth }));
const answer = { intent: 'weekly_summary', confidence: .95, title: 'Resumen', summary: '10 horas', details: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((ok) => { resolve = ok; }); return { promise, resolve }; }

describe('useTinoAssistant', () => {
  beforeEach(() => { jest.clearAllMocks(); auth = { user: { id: 'u1' }, activeOrganization: { id: 'org-a' } }; (apiPost as jest.Mock).mockResolvedValue(answer); });

  it('adds the user message, calls the endpoint and appends the real response', async () => {
    const { result } = renderHook(() => useTinoAssistant());
    await act(async () => { await result.current.send('Resumen semanal'); });
    expect(apiPost).toHaveBeenCalledWith('/mobile/assistant/query', { query: 'Resumen semanal' });
    expect(result.current.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('shows a clear error without inventing an answer', async () => {
    (apiPost as jest.Mock).mockRejectedValue(new Error('Sin conexión'));
    const { result } = renderHook(() => useTinoAssistant());
    await act(async () => { await result.current.send('Timers activos'); });
    expect(result.current.error).toBe('Sin conexión');
    expect(result.current.messages).toHaveLength(1);
  });

  it('clears private history and rejects a late response after organization change', async () => {
    const late = deferred<typeof answer>();
    (apiPost as jest.Mock).mockReturnValue(late.promise);
    const { result, rerender } = renderHook(() => useTinoAssistant());
    act(() => { void result.current.send('Resumen semanal'); });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    auth = { ...auth, activeOrganization: { id: 'org-b' } };
    act(() => window.dispatchEvent(new Event('organization:changed')));
    rerender();
    expect(result.current.messages).toEqual([]);
    await act(async () => late.resolve(answer));
    expect(result.current.messages).toEqual([]);
  });
});
