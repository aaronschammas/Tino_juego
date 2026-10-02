/**
 * Tests del hook de importacion manual de Trello (SUPERADMIN): autorizacion en
 * la ventana de Trello, llamadas con solo el token y manejo de errores.
 */
import { act, renderHook } from '@testing-library/react';
import { apiGet, apiPost } from '@/lib/api';
import { requestTrelloToken } from '@/lib/trelloAuthPopup';
import { Priority } from '@/types/project';
import { TaskStatus } from '@/types/task';
import { TrelloImportMode, TrelloImportPreview, TrelloImportResult } from '@/types/trello-import';
import { useTrelloImport } from './useTrelloImport';

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

const request = {
  token: 'test-token',
  boardId: 'board-1',
  mode: TrelloImportMode.NEW_PROJECT,
};

const previewData: TrelloImportPreview = {
  board: { id: 'board-1', name: 'Roadmap' },
  mode: TrelloImportMode.NEW_PROJECT,
  alreadyImported: false,
  importDisabled: false,
  totals: {
    lists: 1,
    cards: 1,
    checklists: 0,
    subtasks: 0,
    newTasks: 1,
    duplicateTasks: 0,
    newSubtasks: 0,
    duplicateSubtasks: 0,
    warnings: 0,
  },
  warnings: [],
  tasks: [
    {
      id: 'card-1',
      title: 'Prepare release',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      listName: 'Backlog',
      duplicate: false,
      subtasks: [],
    },
  ],
};

const importResult: TrelloImportResult = {
  ...previewData,
  result: {
    createdProject: true,
    createdTasks: 1,
    createdSubtasks: 0,
    skippedTasks: 0,
    skippedSubtasks: 0,
  },
};

describe('useTrelloImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authorizes in the Trello window and loads the boards with that token', async () => {
    const boards = [{ id: 'board-1', name: 'Roadmap' }];
    mockApiGet.mockResolvedValueOnce({ url: 'https://trello.com/1/authorize?key=k' });
    mockRequestToken.mockResolvedValueOnce('popup-token');
    mockApiPost.mockResolvedValueOnce(boards);
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await expect(result.current.authorize()).resolves.toEqual(boards);
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      `/trello-import/authorize-url?returnOrigin=${encodeURIComponent(window.location.origin)}`,
    );
    expect(mockRequestToken).toHaveBeenCalledWith('https://trello.com/1/authorize?key=k');
    expect(mockApiPost).toHaveBeenCalledWith('/trello-import/boards', { token: 'popup-token' });
    expect(result.current.token).toBe('popup-token');
    expect(result.current.boards).toEqual(boards);
  });

  it('keeps no token when the authorization window is closed', async () => {
    mockApiGet.mockResolvedValueOnce({ url: 'https://trello.com/1/authorize' });
    mockRequestToken.mockRejectedValueOnce(new Error('Se cerro la ventana de Trello antes de autorizar.'));
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await expect(result.current.authorize()).rejects.toThrow('Se cerro la ventana');
    });

    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe('Se cerro la ventana de Trello antes de autorizar.');
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('lists boards with only the token', async () => {
    const boards = [{ id: 'board-1', name: 'Roadmap' }];
    mockApiPost.mockResolvedValueOnce(boards);
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await result.current.listBoards('test-token');
    });

    expect(mockApiPost).toHaveBeenCalledWith('/trello-import/boards', { token: 'test-token' });
    expect(result.current.boards).toEqual(boards);
    expect(result.current.isLoading).toBe(false);
  });

  it('generates and stores a preview', async () => {
    mockApiPost.mockResolvedValueOnce(previewData);
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await result.current.preview(request);
    });

    expect(mockApiPost).toHaveBeenCalledWith('/trello-import/preview', request);
    expect(result.current.previewData).toEqual(previewData);
  });

  it('executes an import, stores the result, and notifies project/task listeners', async () => {
    mockApiPost.mockResolvedValueOnce(importResult);
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await result.current.executeImport(request);
    });

    expect(mockApiPost).toHaveBeenCalledWith('/trello-import/import', request);
    expect(result.current.result).toEqual(importResult);
    expect(result.current.previewData).toEqual(importResult);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'projects:updated' }));
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'task:updated' }));
    dispatchEvent.mockRestore();
  });

  it('loads whether the Trello authorization is available', async () => {
    const connectionStatus = {
      authorizationReady: true,
      status: 'READY' as const,
      message: 'Autoriza a Tino en Trello para ver tus tableros.',
    };
    mockApiGet.mockResolvedValueOnce(connectionStatus);
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await result.current.getConnectionStatus();
    });

    expect(mockApiGet).toHaveBeenCalledWith('/trello-import/connection');
    expect(result.current.connectionStatus).toEqual(connectionStatus);
  });

  it.each([
    ['preview', 'preview request failed'],
    ['executeImport', 'import request failed'],
  ] as const)('stores safe API errors from %s', async (method, message) => {
    mockApiPost.mockRejectedValueOnce(new Error(message));
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await expect(result.current[method](request)).rejects.toThrow(message);
    });

    expect(result.current.error).toBe(message);
    expect(result.current.error).not.toContain(request.token);
    expect(result.current.isLoading).toBe(false);
  });

  it('uses a safe fallback for non-Error failures and reset clears the token', async () => {
    mockApiGet.mockResolvedValueOnce({ url: 'https://trello.com/1/authorize' });
    mockRequestToken.mockResolvedValueOnce('popup-token');
    mockApiPost.mockRejectedValueOnce({ status: 500 });
    const { result } = renderHook(() => useTrelloImport());

    await act(async () => {
      await expect(result.current.authorize()).rejects.toEqual({ status: 500 });
    });
    expect(result.current.error).toBe('No se pudo autorizar Trello');
    expect(result.current.token).toBe('popup-token');

    act(() => {
      result.current.reset();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.boards).toEqual([]);
    expect(result.current.previewData).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.connectionStatus).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
