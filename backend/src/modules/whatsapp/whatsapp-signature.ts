/**
 * Verificación de que un webhook viene realmente de Meta.
 *
 * Meta firma cada POST con HMAC-SHA256 del cuerpo original usando el secreto de
 * la app, y lo envía en el header `X-Hub-Signature-256` con el prefijo `sha256=`.
 * Si la firma no coincide, el mensaje se descarta: es el único control que separa
 * un mensaje real de uno inventado por cualquiera que conozca la URL.
 *
 * Qué contiene:
 * - `verifyWhatsAppSignature()`: compara la firma recibida contra la calculada,
 *   con `timingSafeEqual` para no filtrar información por el tiempo de respuesta.
 * - `resolveWebhookChallenge()`: responde el desafío de la verificación inicial,
 *   donde Meta hace un GET con `hub.mode`, `hub.verify_token` y `hub.challenge`.
 *
 * La firma se calcula sobre el cuerpo tal como llegó, por eso la app se crea con
 * `rawBody: true` en `main.ts`. Si se usara el JSON ya parseado, cualquier
 * diferencia de formato daría una firma distinta.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { WhatsAppWebhookQuery } from './whatsapp.types';

const SIGNATURE_PREFIX = 'sha256=';
const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function verifyWhatsAppSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

  const received = signatureHeader
    .slice(SIGNATURE_PREFIX.length)
    .trim()
    .toLowerCase();
  if (!HEX_SHA256.test(received)) return false;

  const body =
    typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', appSecret).update(body).digest('hex');

  return timingSafeEqual(
    Buffer.from(received, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

export function resolveWebhookChallenge(
  query: WhatsAppWebhookQuery | undefined,
  verifyToken: string | undefined,
): string | null {
  if (!query || !verifyToken) return null;
  if (query['hub.mode'] !== 'subscribe') return null;
  if (query['hub.verify_token'] !== verifyToken) return null;

  const challenge = query['hub.challenge'];
  return challenge ? String(challenge) : null;
}
