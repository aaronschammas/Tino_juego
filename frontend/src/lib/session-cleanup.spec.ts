import { clearClientSession } from './session-cleanup';
import { clearAllAuth } from './auth';
import { clearApiCache } from './api';

jest.mock('./auth', () => ({
  clearAllAuth: jest.fn(),
}));

jest.mock('./api', () => ({
  clearApiCache: jest.fn(),
}));

describe('clearClientSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears api cache before auth state', () => {
    clearClientSession();

    expect(clearApiCache).toHaveBeenCalledTimes(1);
    expect(clearAllAuth).toHaveBeenCalledTimes(1);
    expect((clearApiCache as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (clearAllAuth as jest.Mock).mock.invocationCallOrder[0],
    );
  });
});
