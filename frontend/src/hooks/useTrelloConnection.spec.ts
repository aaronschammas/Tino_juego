import { act, renderHook } from '@testing-library/react';
import { apiGet, apiPost } from '@/lib/api';
import { requestTrelloToken } from '@/lib/trelloAuthPopup';
import { ConnectionTargetMode } from '@/types/integration';
import { TaskStatus } from '@/types/task';
import { useTrelloConnection } from './useTrelloConnection';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));
jest.mock('@/lib/trelloAuthPopup', () => ({
  requestTrelloToken: jest.fn(),
}));

const mockApiGet = apiGet as jest.Mock;
const mockApiPost = apiPost as jest.Mock;
const mockRequestToken = requestTrelloToken as jest.Mock;

describe('useTrelloConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authorizes with the current origin and loads the boards', async () => {
    mockApiGet.mockResolvedValue({ url: 'https://trello.com/1/authorize?x' });
    mockRequestToken.mockResolvedValue('user-token');
    mockApiPost.mockResolvedValue([{ id: 'board-1', name: 'Roadmap' }]);
    const { result } = renderHook(() => useTrelloConnection());

    await act(async () => {
      await result.current.authorize();
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      `/integrations/trello/authorize-url?returnOrigin=${encodeURIComponent(window.location.origin)}`,
    );
    expect(mockRequestToken).toHaveBeenCalledWith('https://trello.com/1/authorize?x');
    expect(mockApiPost).toHaveBeenCalledWith('/integrations/trello/boards', { token: 'user-token' });
    expect(result.current.token).toBe('user-token');
    expect(result.current.boards).toEqual([{ id: 'board-1', name: 'Roadmap' }]);
  });

  it('keeps the error message when the popup fails', async () => {
    mockApiGet.mockResolvedValue({ url: 'u' });
    mockRequestToken.mockRejectedValue(new Error('Se cerro la ventana de Trello antes de autorizar.'));
    const { result } = renderHook(() => useTrelloConnection());

    await act(async () => {
      await expect(result.current.authorize()).rejects.toThrow();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe('Se cerro la ventana de Trello antes de autorizar.');
    expect(result.current.isLoading).toBe(false);
  });

  it('previews and connects, notifying the other views', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    const request = {
      token: 't',
      boardId: 'board-1',
      mode: ConnectionTargetMode.NEW_PROJECT,
    };
    mockApiPost
      .mockResolvedValueOnce({ statusMapping: [], blockedReason: null })
      .mockResolvedValueOnce({ result: { createdTasks: 2 } });
    const { result } = renderHook(() => useTrelloConnection());

    await act(async () => {
      await result.current.preview(request);
    });
    expect(mockApiPost).toHaveBeenCalledWith('/integrations/trello/preview', request);
    expect(result.current.previewData).toEqual({ statusMapping: [], blockedReason: null });

    const connectRequest = {
      ...request,
      statusMapping: [{ externalGroupId: 'l1', status: TaskStatus.DONE }],
    };
    await act(async () => {
      await result.current.connect(connectRequest);
    });

    expect(mockApiPost).toHaveBeenLastCalledWith('/integrations/trello/connect', connectRequest);
    expect(result.current.result).toEqual({ result: { createdTasks: 2 } });
    const events = dispatchSpy.mock.calls.map(([event]) => event.type);
    expect(events).toEqual(expect.arrayContaining(['projects:updated', 'task:updated']));
    dispatchSpy.mockRestore();
  });

  it('clears the preview and resets everything', async () => {
    mockApiPost.mockResolvedValue({ statusMapping: [] });
    const { result } = renderHook(() => useTrelloConnection());

    await act(async () => {
      await result.current.preview({ token: 't', boardId: 'b', mode: ConnectionTargetMode.NEW_PROJECT });
    });
    act(() => result.current.clearPreview());
    expect(result.current.previewData).toBeNull();

    act(() => result.current.reset());
    expect(result.current.token).toBeNull();
    expect(result.current.boards).toEqual([]);
  });
});
