import { validateEmailDomain } from './email.util';
import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns';

jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
  },
}));

describe('validateEmailDomain', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException when email format is invalid', async () => {
    await expect(validateEmailDomain('invalid-email')).rejects.toThrow(
      BadRequestException,
    );
    await expect(validateEmailDomain('invalid-email@')).rejects.toThrow(
      BadRequestException,
    );
    await expect(validateEmailDomain('@invalid.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should allow valid email domain with correct MX records', async () => {
    (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.test.com', priority: 10 }]);

    await expect(validateEmailDomain('user@test.com')).resolves.not.toThrow();
    expect(dns.promises.resolveMx).toHaveBeenCalledWith('test.com');
  });

  it('should throw BadRequestException when MX records are empty', async () => {
    (dns.promises.resolveMx as jest.Mock).mockResolvedValue([]);

    await expect(validateEmailDomain('user@test.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when dns throws an error', async () => {
    (dns.promises.resolveMx as jest.Mock).mockRejectedValue(new Error('DNS Error'));

    await expect(validateEmailDomain('user@test.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on timeout', async () => {
    jest.useFakeTimers();
    const dnsPromise = new Promise<never>(() => {}); // Never resolves to force timeout
    (dns.promises.resolveMx as jest.Mock).mockReturnValue(dnsPromise);

    const validationPromise = validateEmailDomain('user@test.com');

    // Fast-forward time
    jest.advanceTimersByTime(6000);

    await expect(validationPromise).rejects.toThrow(BadRequestException);
    jest.useRealTimers();
  });
});
