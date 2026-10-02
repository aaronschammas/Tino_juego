/**
 * Tests del hook del cartel de novedades de Trello: cuando se muestra, cuando
 * queda oculto y que cerrarlo avise al backend.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGet, apiPost } from '@/lib/api';
import { useIntegrationActivity } from './useIntegrationActivity';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

const mockApiGet = apiGet as jest.Mock;
const mockApiPost = apiPost as jest.Mock;

const summary = {
  since: '2026-09-28T09:00:00.000Z',
  until: '2026-09-29T09:00:00.000Z',
  created: [{ taskId: 't1', title: 'Login', projectName: 'Web' }],
  statusChanges: [],
  archived: [],
  work: [],
  totalMinutes: 0,
  isEmpty: false,
};

describe('useIntegrationActivity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the banner when there is news', async () => {
    mockApiGet.mockResolvedValue({ available: true, summary });
    const { result } = renderHook(() => useIntegrationActivity());

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/integrations/activity');
    expect(result.current.summary).toEqual(summary);
  });

  it('stays hidden without news, without integrations or on errors', async () => {
    mockApiGet.mockResolvedValueOnce({ available: true, summary: { ...summary, isEmpty: true } });
    const empty = renderHook(() => useIntegrationActivity());
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(empty.result.current.visible).toBe(false);

    mockApiGet.mockResolvedValueOnce({ available: false, summary: null });
    const unavailable = renderHook(() => useIntegrationActivity());
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(unavailable.result.current.visible).toBe(false);

    mockApiGet.mockRejectedValueOnce(new Error('403'));
    const failed = renderHook(() => useIntegrationActivity());
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
    expect(failed.result.current.visible).toBe(false);
  });

  it('hides the banner and tells the backend it was seen', async () => {
    mockApiGet.mockResolvedValue({ available: true, summary });
    mockApiPost.mockResolvedValue({ seenAt: '2026-09-29T10:00:00.000Z' });
    const { result } = renderHook(() => useIntegrationActivity());
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(async () => {
      await result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    expect(mockApiPost).toHaveBeenCalledWith('/integrations/activity/seen');
  });

  it('keeps the banner closed even if saving the dismiss fails', async () => {
    mockApiGet.mockResolvedValue({ available: true, summary });
    mockApiPost.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useIntegrationActivity());
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(async () => {
      await result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
  });
});
