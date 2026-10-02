/**
 * Envío de mensajes a la Graph API de Meta.
 *
 * Es la única parte del módulo que sale a internet. Las respuestas a consultas
 * van siempre dentro de la ventana de 24 horas que abre el owner al escribir,
 * así que no usan plantillas ni tienen costo por mensaje. La única excepción es
 * el resumen diario de Trello cuando la ventana está cerrada.
 *
 * Qué contiene:
 * - `sendText()`: un mensaje de texto simple.
 * - `sendMenu()`: la lista interactiva con las consultas disponibles, que es la
 *   forma pensada para que el jefe toque en lugar de escribir.
 * - `sendTemplate()`: una plantilla aprobada por Meta con sus variables de
 *   cuerpo en orden (`{{1}}`, `{{2}}`...). Es lo único que Meta deja mandar
 *   fuera de la ventana de 24 horas y se cobra por mensaje.
 * - `send()`: el POST común a `/{phoneNumberId}/messages`.
 *
 * Los errores se registran sin el destinatario y sin el texto del mensaje: solo
 * el código de estado y el error que devuelve Meta. Nunca lanza excepción hacia
 * el webhook, porque un fallo al responder no debe provocar que Meta reintente
 * la entrega y el owner reciba la misma respuesta dos veces.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  isWhatsAppReady,
  readWhatsAppConfig,
  type WhatsAppConfig,
} from './whatsapp.config';
import { truncateForWhatsApp } from './whatsapp-formatter';
import type { WhatsAppMenuRow } from './whatsapp.types';

export interface WhatsAppMenu {
  body: string;
  button: string;
  rows: WhatsAppMenuRow[];
  header?: string;
}

@Injectable()
export class WhatsAppClientService {
  private readonly logger = new Logger(WhatsAppClientService.name);

  async sendText(to: string, body: string): Promise<boolean> {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: truncateForWhatsApp(body) },
    });
  }

  async sendMenu(to: string, menu: WhatsAppMenu): Promise<boolean> {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(menu.header ? { header: { type: 'text', text: menu.header } } : {}),
        body: { text: truncateForWhatsApp(menu.body) },
        action: {
          button: menu.button,
          sections: [{ title: 'Consultas', rows: menu.rows }],
        },
      },
    });
  }

  async sendTemplate(
    to: string,
    name: string,
    language: string,
    bodyParams: string[],
  ): Promise<boolean> {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    });
  }

  private async send(payload: Record<string, unknown>): Promise<boolean> {
    const config: WhatsAppConfig = readWhatsAppConfig();
    if (!isWhatsAppReady(config)) {
      this.logger.warn('WhatsApp no está configurado: mensaje no enviado');
      return false;
    }

    const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(
          `Meta rechazó el envío (${response.status}): ${detail.slice(0, 300)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `No se pudo contactar la Graph API: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return false;
    }
  }
}
