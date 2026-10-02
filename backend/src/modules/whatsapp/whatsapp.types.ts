/**
 * Tipos del webhook de WhatsApp Cloud API y de los mensajes que Tino envía.
 *
 * Meta notifica en lotes con la forma `entry[] -> changes[] -> value.messages[]`,
 * así que un solo POST puede traer varios mensajes de varias personas.
 *
 * Qué contiene:
 * - `WhatsAppWebhookPayload`, `WhatsAppChangeValue` y `WhatsAppInboundMessage`:
 *   los campos de la notificación entrante que Tino realmente usa.
 * - `WhatsAppContact`: el bloque donde Meta informa el `user_id`.
 * - `WhatsAppSender`: el remitente ya resuelto. `userId` es el identificador de
 *   Meta que se guarda; `replyTo` solo se usa para contestar en el momento y
 *   nunca se persiste.
 * - `WhatsAppMenuRow` y `WhatsAppOutboundText`: lo que Tino manda de vuelta.
 *
 * Son interfaces y no clases de class-validator a propósito: el ValidationPipe
 * global usa `forbidNonWhitelisted` y rechazaría los campos nuevos que Meta
 * agregue, lo que haría que Meta reintentara la entrega durante días.
 */

export interface WhatsAppTextBody {
  body?: string;
}

export interface WhatsAppReply {
  id?: string;
  title?: string;
}

export interface WhatsAppInteractive {
  type?: string;
  list_reply?: WhatsAppReply;
  button_reply?: WhatsAppReply;
}

export interface WhatsAppInboundMessage {
  id?: string;
  from?: string;
  from_user_id?: string;
  type?: string;
  text?: WhatsAppTextBody;
  interactive?: WhatsAppInteractive;
}

export interface WhatsAppContact {
  wa_id?: string;
  user_id?: string;
  profile?: { name?: string };
}

export interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  messaging_product?: string;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
}

export interface WhatsAppChange {
  field?: string;
  value?: WhatsAppChangeValue;
}

export interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

export interface WhatsAppSender {
  /** `user_id` de Meta (business-scoped user ID). Es lo único que se guarda. */
  userId: string;
  /** Destinatario para la respuesta inmediata. No se persiste. */
  replyTo: string;
  name?: string;
}

export interface WhatsAppMenuRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppWebhookQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}
