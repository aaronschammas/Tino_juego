/**
 * Configuración del canal de WhatsApp, leída de variables de entorno.
 *
 * Todas las credenciales son del servidor: ninguna se expone al navegador. Se
 * leen en cada llamada y no al arrancar, para que los tests puedan cambiarlas y
 * para que el backend siga levantando aunque WhatsApp no esté configurado
 * todavía.
 *
 * Qué contiene:
 * - `readWhatsAppConfig()`: junta las variables en un objeto. Incluye la
 *   plantilla de Meta del resumen diario de Trello (`WHATSAPP_DIGEST_TEMPLATE` y
 *   `WHATSAPP_DIGEST_TEMPLATE_LANGUAGE`, por defecto `es_AR`); sin plantilla el
 *   resumen solo sale cuando la ventana de 24 horas esta abierta.
 * - `isWhatsAppReady()`: dice si están las credenciales mínimas para enviar y
 *   recibir mensajes. Si falta alguna, el módulo responde que no está configurado
 *   en lugar de fallar.
 * - `buildWhatsAppLinkUrl()`: arma el link `wa.me` con el código ya escrito, que
 *   es lo que el perfil muestra como botón o QR. El backend lo devuelve armado
 *   para que el frontend no necesite conocer el número de Tino.
 */

export interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  appSecret?: string;
  verifyToken?: string;
  businessNumber?: string;
  graphVersion: string;
  digestTemplate?: string;
  digestTemplateLanguage: string;
}

export const DEFAULT_GRAPH_VERSION = 'v23.0';
export const DEFAULT_DIGEST_TEMPLATE_LANGUAGE = 'es_AR';

export function readWhatsAppConfig(): WhatsAppConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim(),
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim(),
    businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER?.trim(),
    graphVersion:
      process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    digestTemplate: process.env.WHATSAPP_DIGEST_TEMPLATE?.trim() || undefined,
    digestTemplateLanguage:
      process.env.WHATSAPP_DIGEST_TEMPLATE_LANGUAGE?.trim() ||
      DEFAULT_DIGEST_TEMPLATE_LANGUAGE,
  };
}

export function isWhatsAppReady(config = readWhatsAppConfig()): boolean {
  return Boolean(
    config.phoneNumberId &&
    config.accessToken &&
    config.appSecret &&
    config.verifyToken,
  );
}

export function buildWhatsAppLinkUrl(
  code: string,
  businessNumber = readWhatsAppConfig().businessNumber,
): string | null {
  if (!businessNumber) return null;

  const digits = businessNumber.replace(/[^0-9]/g, '');
  if (!digits) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(`VINCULAR ${code}`)}`;
}
