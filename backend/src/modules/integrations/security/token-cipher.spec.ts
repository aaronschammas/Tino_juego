import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret } from './token-cipher';

describe('token-cipher', () => {
  const key = randomBytes(32);

  it('round-trips a secret', () => {
    const encrypted = encryptSecret('trello-token-123', key);

    expect(decryptSecret(encrypted, key)).toBe('trello-token-123');
  });

  it('never stores the plain text and uses a random IV per value', () => {
    const first = encryptSecret('trello-token-123', key);
    const second = encryptSecret('trello-token-123', key);

    expect(first).not.toContain('trello-token-123');
    expect(first.startsWith('v1:')).toBe(true);
    expect(first).not.toBe(second);
  });

  it('fails with a different key', () => {
    const encrypted = encryptSecret('secret', key);

    expect(() => decryptSecret(encrypted, randomBytes(32))).toThrow();
  });

  it('fails when the stored value was tampered with', () => {
    const [version, iv, tag, data] = encryptSecret('secret', key).split(':');
    const tampered = Buffer.from(data, 'base64');
    tampered[0] = tampered[0] ^ 0xff;

    expect(() =>
      decryptSecret(
        [version, iv, tag, tampered.toString('base64')].join(':'),
        key,
      ),
    ).toThrow();
  });

  it('rejects an unknown format', () => {
    expect(() => decryptSecret('plain-token', key)).toThrow(
      'Invalid encrypted secret format',
    );
  });
});
