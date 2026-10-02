import axios from 'axios';

jest.mock('axios', () => {
  const m = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    __esModule: true,
    default: {
      ...m,
      create: jest.fn(() => m),
      isAxiosError: jest.fn((err: any) => err?.isAxiosError === true),
    },
    create: jest.fn(() => m),
    isAxiosError: jest.fn((err: any) => err?.isAxiosError === true),
    ...m,
  };
});

// We require the API after mocking axios to ensure it uses the mock
const { 
  apiGet, apiPost, apiPut, apiPatch, apiDelete, 
  apiGetCached, apiGetAuthContext, invalidateAuthContextRequest,
  invalidateApiCache, clearApiCache, setActiveOrganizationId,
} = require('./api');

describe('API Functional Tests', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  // We need to get the instance that ApiClient is using
  const mockInstance = (axios.create as jest.Mock)();
  const { get, post, put, patch, delete: del } = mockInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clearApiCache();
    invalidateAuthContextRequest();
    setActiveOrganizationId(null);
    (get as jest.Mock).mockResolvedValue({ data: { data: 'test-data' } });
    (post as jest.Mock).mockResolvedValue({ data: { data: 'post-data' } });
    (put as jest.Mock).mockResolvedValue({ data: { data: 'put-data' } });
    (patch as jest.Mock).mockResolvedValue({ data: { data: 'patch-data' } });
    (del as jest.Mock).mockResolvedValue({ data: { data: 'delete-data' } });
  });

  it('apiGet calls axios.get', async () => {
    const data = await apiGet('/test');
    expect(data).toBe('test-data');
    expect(get).toHaveBeenCalledWith('/test');
  });

  it('apiPost calls axios.post', async () => {
    const data = await apiPost('/test', { foo: 'bar' });
    expect(data).toBe('post-data');
    expect(post).toHaveBeenCalledWith('/test', { foo: 'bar' });
  });

  describe('apiGetCached', () => {
    it('caches subsequent calls', async () => {
      await apiGetCached('/cache', { staleTime: 1000 });
      await apiGetCached('/cache', { staleTime: 1000 });
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('forces fetch when requested', async () => {
      await apiGetCached('/cache', { staleTime: 1000 });
      await apiGetCached('/cache', { force: true });
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('rejects and does not cache a response from the previous organization', async () => {
      let resolveRequest!: (value: unknown) => void;
      get.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );
      setActiveOrganizationId('org-a');

      const staleRequest = apiGetCached('/projects', { staleTime: 1000 });
      setActiveOrganizationId('org-b');
      resolveRequest({ data: { data: ['project-a'] } });

      await expect(staleRequest).rejects.toThrow(
        'Request superseded by an authentication context change',
      );

      get.mockResolvedValueOnce({ data: { data: ['project-b'] } });
      await expect(apiGetCached('/projects', { staleTime: 1000 })).resolves.toEqual([
        'project-b',
      ]);
      expect(get).toHaveBeenCalledTimes(2);
    });
  });

  describe('apiGetAuthContext', () => {
    it('deduplicates simultaneous session bootstrap requests and resets afterward', async () => {
      let resolveRequest!: (value: unknown) => void;
      get.mockReturnValueOnce(new Promise((resolve) => {
        resolveRequest = resolve;
      }));

      const first = apiGetAuthContext();
      const second = apiGetAuthContext();
      expect(first).toBe(second);
      expect(get).toHaveBeenCalledTimes(1);

      resolveRequest({ data: { data: { user: { id: 'u1' } } } });
      await expect(first).resolves.toEqual({ user: { id: 'u1' } });

      get.mockResolvedValueOnce({ data: { data: { user: { id: 'u2' } } } });
      await apiGetAuthContext();
      expect(get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('throws error when response contains error object', async () => {
      get.mockResolvedValue({ data: { error: { message: 'Server error' } } });
      await expect(apiGet('/error')).rejects.toThrow('Server error');
    });

    it('handles axios errors', async () => {
      const axiosError = new Error('Network Error');
      (axiosError as any).isAxiosError = true;
      (axiosError as any).response = { 
        status: 500, 
        data: { error: { message: 'Backend failed' } } 
      };
      get.mockRejectedValue(axiosError);

      await expect(apiGet('/fail')).rejects.toThrow('Backend failed');
    });
  });
});
