/**
 * Verificacion de que un webhook viene realmente de Trello.
 *
 * Trello firma cada POST con HMAC-SHA1 usando el secreto de la app de Trello
 * sobre el cuerpo original concatenado con la URL de callback registrada, y lo
 * envia en base64 en el header `X-Trello-Webhook`. Si no coincide, el evento se
 * descarta: es lo que separa un aviso real de uno inventado por quien conozca la URL.
 *
 * - `computeTrelloSignature()`: calcula la firma esperada.
 * - `verifyTrelloSignature()`: compara con `timingSafeEqual` para no filtrar
 *   informacion por el tiempo de respuesta. La firma se calcula sobre el cuerpo
 *   tal como llego (`rawBody`), nunca sobre el JSON ya parseado.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export function computeTrelloSignature(
  rawBody: Buffer | string,
  callbackUrl: string,
  appSecret: string,
): string {
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  return createHmac('sha1', appSecret)
    .update(body + callbackUrl, 'utf8')
    .digest('base64');
}

export function verifyTrelloSignature(
  rawBody: Buffer | string | undefined,
  callbackUrl: string,
  signatureHeader: string | undefined,
  appSecret: string | null,
): boolean {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const expected = Buffer.from(
    computeTrelloSignature(rawBody, callbackUrl, appSecret),
    'utf8',
  );
  const received = Buffer.from(signatureHeader.trim(), 'utf8');

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
