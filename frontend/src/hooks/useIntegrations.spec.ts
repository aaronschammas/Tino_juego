import { act, renderHook, waitFor } from '@testing-library/react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { useIntegrationAvailability, useProjectIntegration } from './useIntegrations';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
}));

const mockApiGet = apiGet as jest.Mock;
const mockApiDelete = apiDelete as jest.Mock;
const mockApiPost = apiPost as jest.Mock;
const mockApiPatch = apiPatch as jest.Mock;

const connection = {
  id: 'conn-1',
  provider: 'TRELLO',
  status: 'ACTIVE',
  container: { id: 'board-1', name: 'Roadmap', url: null },
  connectedAt: '2026-09-24T10:00:00.000Z',
  connectedBy: null,
  lastSyncedAt: null,
  statusMappings: [],
};

describe('useIntegrationAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the availability once', async () => {
    mockApiGet.mockResolvedValue({ enabled: true, canManage: true, reason: null });
    const { result } = renderHook(() => useIntegrationAvailability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiGet).toHaveBeenCalledWith('/integrations/availability');
    expect(result.current.availability).toEqual({ enabled: true, canManage: true, reason: null });
  });

  it('stays null when the request fails', async () => {
    mockApiGet.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useIntegrationAvailability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.availability).toBeNull();
  });
});

describe('useProjectIntegration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the project connection', async () => {
    mockApiGet.mockResolvedValue({ connection });
    const { result } = renderHook(() => useProjectIntegration('project-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiGet).toHaveBeenCalledWith('/integrations/projects/project-1');
    expect(result.current.connection).toEqual(connection);
  });

  it('does not call the api without a project', () => {
    renderHook(() => useProjectIntegration(undefined));

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('disconnects and notifies the other views', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    mockApiGet.mockResolvedValue({ connection });
    mockApiDelete.mockResolvedValue({ disconnected: true });
    const { result } = renderHook(() => useProjectIntegration('project-1'));
    await waitFor(() => expect(result.current.connection).not.toBeNull());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockApiDelete).toHaveBeenCalledWith('/integrations/projects/project-1');
    expect(result.current.connection).toBeNull();
    expect(dispatchSpy.mock.calls.map(([event]) => event.type)).toContain('projects:updated');
    dispatchSpy.mockRestore();
  });

  it('keeps the error message when loading fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Project not found'));
    const { result } = renderHook(() => useProjectIntegration('project-1'));

    await waitFor(() => expect(result.current.error).toBe('Project not found'));
    expect(result.current.connection).toBeNull();
  });

  it('retries the live sync and reloads the connection', async () => {
    mockApiGet.mockResolvedValue({ connection });
    mockApiPost.mockResolvedValue({ active: true, reason: null });
    const { result } = renderHook(() => useProjectIntegration('project-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockApiGet.mockClear();

    let status: unknown;
    await act(async () => {
      status = await result.current.enableLiveSync();
    });

    expect(mockApiPost).toHaveBeenCalledWith('/integrations/projects/project-1/live-sync');
    expect(status).toEqual({ active: true, reason: null });
    expect(mockApiGet).toHaveBeenCalledWith('/integrations/projects/project-1');
  });

  it('saves status mappings, notifies tasks and reloads', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    mockApiGet.mockResolvedValue({ connection });
    mockApiPatch.mockResolvedValue({ updated: 1, tasksUpdated: 2 });
    const { result } = renderHook(() => useProjectIntegration('project-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const statusMapping = [{ externalGroupId: 'l-qa', status: 'BLOCKED' as never }];

    await act(async () => {
      await result.current.updateStatusMappings(statusMapping);
    });

    expect(mockApiPatch).toHaveBeenCalledWith(
      '/integrations/projects/project-1/status-mappings',
      { statusMapping },
    );
    expect(dispatchSpy.mock.calls.map(([event]) => event.type)).toContain('task:updated');
    dispatchSpy.mockRestore();
  });

  it('runs a manual sync, notifies the other views and reloads', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    mockApiGet.mockResolvedValue({ connection });
    mockApiPost.mockResolvedValue({ created: 2 });
    const { result } = renderHook(() => useProjectIntegration('project-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockApiGet.mockClear();

    let sync: unknown;
    await act(async () => {
      sync = await result.current.syncNow();
    });

    expect(mockApiPost).toHaveBeenCalledWith('/integrations/projects/project-1/sync');
    expect(sync).toEqual({ created: 2 });
    expect(mockApiGet).toHaveBeenCalledWith('/integrations/projects/project-1');
    const events = dispatchSpy.mock.calls.map(([event]) => event.type);
    expect(events).toEqual(expect.arrayContaining(['task:updated', 'projects:updated']));
    dispatchSpy.mockRestore();
  });
});
