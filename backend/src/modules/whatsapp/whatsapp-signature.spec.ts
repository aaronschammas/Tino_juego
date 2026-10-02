import { createHmac } from 'crypto';
import {
  resolveWebhookChallenge,
  verifyWhatsAppSignature,
} from './whatsapp-signature';

const SECRET = 'app-secret';
const body = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');
const signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

describe('verifyWhatsAppSignature', () => {
  it('accepts a signature generated with the app secret', () => {
    expect(verifyWhatsAppSignature(body, signature, SECRET)).toBe(true);
  });

  it('accepts the same body as a string', () => {
    expect(
      verifyWhatsAppSignature(body.toString('utf8'), signature, SECRET),
    ).toBe(true);
  });

  it('rejects a body that was modified in transit', () => {
    const tampered = Buffer.from('{"object":"otra-cosa"}', 'utf8');
    expect(verifyWhatsAppSignature(tampered, signature, SECRET)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    const forged = `sha256=${createHmac('sha256', 'otro').update(body).digest('hex')}`;
    expect(verifyWhatsAppSignature(body, forged, SECRET)).toBe(false);
  });

  it.each([
    ['sin header', undefined],
    ['sin prefijo sha256', 'abc'],
    ['con firma que no es hexadecimal', `sha256=${'z'.repeat(64)}`],
    ['con firma de largo incorrecto', 'sha256=abcd'],
  ])('rejects requests %s', (_case, header) => {
    expect(verifyWhatsAppSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects when the secret or the raw body are missing', () => {
    expect(verifyWhatsAppSignature(body, signature, undefined)).toBe(false);
    expect(verifyWhatsAppSignature(undefined, signature, SECRET)).toBe(false);
  });
});

describe('resolveWebhookChallenge', () => {
  it('returns the challenge when the verify token matches', () => {
    const challenge = resolveWebhookChallenge(
      {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'token',
        'hub.challenge': '1158201444',
      },
      'token',
    );
    expect(challenge).toBe('1158201444');
  });

  it('rejects a wrong token, another mode or a missing challenge', () => {
    expect(
      resolveWebhookChallenge(
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'malo',
          'hub.challenge': '123',
        },
        'token',
      ),
    ).toBeNull();
    expect(
      resolveWebhookChallenge(
        {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'token',
          'hub.challenge': '123',
        },
        'token',
      ),
    ).toBeNull();
    expect(
      resolveWebhookChallenge(
        { 'hub.mode': 'subscribe', 'hub.verify_token': 'token' },
        'token',
      ),
    ).toBeNull();
  });

  it('rejects when the backend has no verify token configured', () => {
    expect(
      resolveWebhookChallenge(
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token',
          'hub.challenge': '123',
        },
        undefined,
      ),
    ).toBeNull();
  });
});
