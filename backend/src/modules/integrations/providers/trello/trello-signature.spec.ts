import { createHmac } from 'crypto';
import {
  computeTrelloSignature,
  verifyTrelloSignature,
} from './trello-signature';

describe('trello-signature', () => {
  const secret = 'app-secret';
  const callbackUrl =
    'https://api.tino.test/integrations/trello/webhook/conn-1';
  const body = '{"action":{"id":"a1","type":"updateCard"}}';
  const valid = createHmac('sha1', secret)
    .update(body + callbackUrl)
    .digest('base64');

  it('signs body + callback url with HMAC-SHA1 in base64', () => {
    expect(computeTrelloSignature(body, callbackUrl, secret)).toBe(valid);
    expect(computeTrelloSignature(Buffer.from(body), callbackUrl, secret)).toBe(
      valid,
    );
  });

  it('accepts the valid signature', () => {
    expect(
      verifyTrelloSignature(Buffer.from(body), callbackUrl, valid, secret),
    ).toBe(true);
  });

  it.each([
    ['a different body', '{"action":{"id":"a2"}}', callbackUrl, valid],
    ['a different callback url', body, `${callbackUrl}-other`, valid],
    ['a wrong signature', body, callbackUrl, 'bm9wZQ=='],
    ['an empty signature', body, callbackUrl, ''],
  ])('rejects %s', (_label, rawBody, url, signature) => {
    expect(verifyTrelloSignature(rawBody, url, signature, secret)).toBe(false);
  });

  it('rejects when the secret or the body is missing', () => {
    expect(verifyTrelloSignature(body, callbackUrl, valid, null)).toBe(false);
    expect(verifyTrelloSignature(undefined, callbackUrl, valid, secret)).toBe(
      false,
    );
  });
});
