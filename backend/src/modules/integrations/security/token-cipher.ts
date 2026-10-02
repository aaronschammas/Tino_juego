/**
 * Cifrado de los tokens de proveedores externos antes de guardarlos en la base.
 *
 * Usa AES-256-GCM: cada valor lleva un IV aleatorio de 12 bytes y el tag de
 * autenticacion, asi que un dato alterado en la base no se puede descifrar.
 * Formato guardado: `v1:<iv>:<tag>:<cifrado>`, las tres partes en base64.
 *
 * Qué contiene:
 * - `encryptSecret()`: cifra un texto con la clave de 32 bytes.
 * - `decryptSecret()`: valida el formato, descifra y falla si la clave no
 *   coincide o el dato fue modificado.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encryptSecret(plainText: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv, tag, encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
    .join(':');
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [version, iv, tag, encrypted] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error('Invalid encrypted secret format');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
