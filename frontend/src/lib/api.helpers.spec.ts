import '@testing-library/jest-dom';

describe('api helpers', () => {
  function setupApiModule() {
    jest.resetModules();

    const mockInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    const mockAxiosCreate = jest.fn(() => mockInstance);
    const mockIsAxiosError = jest.fn(() => false);

    jest.doMock('axios', () => ({
      __esModule: true,
      default: {
        create: mockAxiosCreate,
        isAxiosError: mockIsAxiosError,
      },
      isAxiosError: mockIsAxiosError,
    }));

    jest.doMock('./auth', () => ({
      getToken: jest.fn(() => null),
      clearToken: jest.fn(),
      clearStoredUser: jest.fn(),
    }));

    let apiModule: any;
    jest.isolateModules(() => {
      apiModule = require('./api');
    });

    return { apiModule, mockInstance };
  }

  it('apiGet unwraps envelope data', async () => {
    const { apiModule, mockInstance } = setupApiModule();
    mockInstance.get.mockResolvedValue({ data: { data: { ok: true } } });

    const result = await apiModule.apiGet('/health');

    expect(mockInstance.get).toHaveBeenCalledWith('/health');
    expect(result).toEqual({ ok: true });
  });

  it('apiPost sends payload and unwraps data', async () => {
    const { apiModule, mockInstance } = setupApiModule();
    const payload = { name: 'Demo' };
    mockInstance.post.mockResolvedValue({ data: { data: { id: '1', ...payload } } });

    const result = await apiModule.apiPost('/items', payload);

    expect(mockInstance.post).toHaveBeenCalledWith('/items', payload);
    expect(result).toEqual({ id: '1', name: 'Demo' });
  });

  it('apiPatch and apiDelete work with envelope', async () => {
    const { apiModule, mockInstance } = setupApiModule();
    mockInstance.patch.mockResolvedValue({ data: { data: { updated: true } } });
    mockInstance.delete.mockResolvedValue({ data: { data: { deleted: true } } });

    const patchResult = await apiModule.apiPatch('/items/1', { active: false });
    const deleteResult = await apiModule.apiDelete('/items/1');

    expect(patchResult).toEqual({ updated: true });
    expect(deleteResult).toEqual({ deleted: true });
  });

  it('wraps envelope error as ApiClientError', async () => {
    const { apiModule, mockInstance } = setupApiModule();
    mockInstance.get.mockResolvedValue({
      data: {
        error: { code: 'BAD_REQUEST', message: 'Bad request' },
      },
    });

    await expect(apiModule.apiGet('/bad', { silent: true })).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Bad request',
    });
  });
});

