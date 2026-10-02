/**
 * Orquesta cada mensaje que llega de WhatsApp y decide qué responder.
 *
 * Es el centro del módulo: recibe la notificación ya validada por el controller,
 * identifica al owner por el `user_id` de Meta, vuelve a comprobar sus permisos y
 * le pide la respuesta al mismo `AssistantService` que usa el chat de Tino
 * Mobile. No duplica ninguna consulta de datos.
 *
 * Qué contiene:
 * - `handleWebhook()`: recorre el lote de mensajes, porque un POST puede traer
 *   varios.
 * - `handleMessage()`: el camino de un mensaje, en orden: descartar repetidos,
 *   resolver remitente, controlar el límite de consultas y enrutar. Cada mensaje
 *   de un owner vinculado anota la hora (`touchWindow()`): la ventana de 24
 *   horas de Meta.
 * - `resolveSender()`: saca el `user_id`; si no viene, no atiende el mensaje.
 * - `isDuplicate()`: usa la huella del id de Meta para no contestar dos veces
 *   cuando Meta reintenta la entrega. Solo el choque de clave única cuenta como
 *   repetido; cualquier otro error de base se registra en el log.
 * - `allowQuery()`: límite de consultas por hora, en memoria.
 * - `handleLinkCommand()`, `handleUnlink()`, `handleSelection()` y
 *   `handleFreeText()`: las cuatro cosas que puede pedir el owner.
 * - `answerIntent()` y `sendMenu()`: la respuesta del asistente y el menú.
 * - `REPLIES`: todos los textos fijos, juntos, para poder revisarlos de un lado.
 *
 * Nunca guarda el teléfono: `sender.replyTo` se usa para contestar en el momento
 * y se descarta. Tampoco registra el texto de las consultas.
 */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { AssistantService } from '../assistant/assistant.service';
import { normalizeAssistantQuery } from '../assistant/assistant-intent';
import { WhatsAppClientService } from './whatsapp-client.service';
import { readWhatsAppConfig } from './whatsapp.config';
import {
  WhatsAppLinkService,
  type LinkedOrganization,
} from './whatsapp-link.service';
import { formatAssistantAnswer } from './whatsapp-formatter';
import {
  buildOrganizationMenuRows,
  buildQueryMenuRows,
  MENU_COMMANDS,
  parseMenuSelection,
  UNLINK_COMMANDS,
  type MenuIntent,
} from './whatsapp-menu';
import type {
  WhatsAppContact,
  WhatsAppInboundMessage,
  WhatsAppSender,
  WhatsAppWebhookPayload,
} from './whatsapp.types';

const LINK_COMMAND = /^vincular\s+([a-z0-9]{6,32})$/;
const QUERY_LIMIT_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export const REPLIES = {
  notLinked:
    'Este WhatsApp no está conectado a Tino. Entrá a tu perfil en Tino, tocá "Conectar WhatsApp" y mandá el mensaje que te propone.',
  linkInvalid:
    'Ese código no es válido o ya venció. Generá uno nuevo desde tu perfil en Tino.',
  linked: (organization: string) =>
    `Listo, ya podés consultar sobre ${organization}. Elegí una opción del menú.`,
  notOwner:
    'Esta función es solo para dueños de la organización. Podés consultar desde la app de Tino.',
  unlinked:
    'Desconecté este WhatsApp de Tino. Podés volver a conectarlo desde tu perfil.',
  unsupportedMedia:
    'Por ahora solo leo mensajes de texto. Elegí una opción del menú.',
  notUnderstood:
    'No entendí la consulta. Elegí una opción del menú y te la respondo.',
  rateLimited:
    'Recibí muchas consultas seguidas. Probá de nuevo en unos minutos.',
  failed:
    'No pude consultar los datos en este momento. Probá de nuevo en un rato.',
  chooseOrganization:
    'Tenés varias organizaciones. ¿Sobre cuál querés consultar?',
  menuBody: (organization: string) => `¿Qué querés saber de ${organization}?`,
  menuButton: 'Ver consultas',
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly recentQueries = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly links: WhatsAppLinkService,
    private readonly client: WhatsAppClientService,
    private readonly assistant: AssistantService,
  ) {}

  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    const phoneNumberId = readWhatsAppConfig().phoneNumberId;
    if (!phoneNumberId) {
      throw new ServiceUnavailableException(
        'WhatsApp channel is not configured',
      );
    }
    for (const entry of payload?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        // Fail closed per change, including missing metadata. Never use tenant
        // identifiers, cookies or request headers to select the linked company.
        if (value?.metadata?.phone_number_id !== phoneNumberId) continue;
        for (const message of value?.messages ?? []) {
          try {
            await this.handleMessage(message, value?.contacts);
          } catch (error) {
            this.logger.error(
              `Error procesando un mensaje: ${
                error instanceof Error ? error.message : 'error desconocido'
              }`,
            );
          }
        }
      }
    }
  }

  private async handleMessage(
    message: WhatsAppInboundMessage,
    contacts: WhatsAppContact[] | undefined,
  ): Promise<void> {
    const sender = this.resolveSender(message, contacts);
    if (!sender) {
      this.logger.warn('Mensaje sin user_id de Meta: no se puede identificar');
      return;
    }
    if (await this.isDuplicate(message.id)) return;

    if (!this.allowQuery(sender.userId)) {
      await this.client.sendText(sender.replyTo, REPLIES.rateLimited);
      return;
    }

    const text = message.text?.body ?? '';
    const normalized = normalizeAssistantQuery(text);
    const selectionId =
      message.interactive?.list_reply?.id ??
      message.interactive?.button_reply?.id;

    if (!selectionId && !text) {
      await this.client.sendText(sender.replyTo, REPLIES.unsupportedMedia);
      return;
    }

    const linkMatch = LINK_COMMAND.exec(normalized);
    if (linkMatch) {
      await this.handleLinkCommand(sender, linkMatch[1]);
      return;
    }

    const organizations = await this.links.findLinkedOrganizations(
      sender.userId,
    );
    if (organizations.length === 0) {
      await this.client.sendText(sender.replyTo, REPLIES.notLinked);
      return;
    }
    await this.touchWindow(
      organizations.map((organization) => organization.id),
    );

    if (UNLINK_COMMANDS.includes(normalized)) {
      await this.handleUnlink(sender, organizations);
      return;
    }

    if (selectionId) {
      await this.handleSelection(sender, organizations, selectionId);
      return;
    }

    await this.handleFreeText(sender, organizations, text, normalized);
  }

  private resolveSender(
    message: WhatsAppInboundMessage,
    contacts: WhatsAppContact[] | undefined,
  ): WhatsAppSender | null {
    // A contact must match this message, regardless of its position in a batch.
    const matches = (contacts ?? []).filter(
      (candidate) =>
        (message.from && candidate.wa_id === message.from) ||
        (message.from_user_id && candidate.user_id === message.from_user_id),
    );
    if (matches.length > 1) return null;
    const contact = matches[0];
    if (
      message.from_user_id &&
      contact?.user_id &&
      message.from_user_id !== contact.user_id
    )
      return null;
    if (message.from && contact?.wa_id && message.from !== contact.wa_id)
      return null;
    // Persistent identity remains Meta's business-scoped user_id. Phone/wa_id
    // only correlate the contact and provide an ephemeral reply destination.
    const userId = message.from_user_id ?? contact?.user_id;
    if (!userId) return null;

    return {
      userId,
      replyTo: message.from ?? contact?.wa_id ?? userId,
      name: contact?.profile?.name,
    };
  }

  private async isDuplicate(messageId: string | undefined): Promise<boolean> {
    if (!messageId) return false;

    const idHash = createHash('sha256').update(messageId, 'utf8').digest('hex');
    try {
      await this.prisma.whatsAppProcessedMessage.create({ data: { idHash } });
      return false;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return true;
      }
      throw error;
    }
  }

  private allowQuery(userId: string): boolean {
    const now = Date.now();
    const recent = (this.recentQueries.get(userId) ?? []).filter(
      (timestamp) => now - timestamp < HOUR_MS,
    );

    if (recent.length >= QUERY_LIMIT_PER_HOUR) {
      this.recentQueries.set(userId, recent);
      return false;
    }

    recent.push(now);
    this.recentQueries.set(userId, recent);
    return true;
  }

  private async handleLinkCommand(
    sender: WhatsAppSender,
    code: string,
  ): Promise<void> {
    const organization = await this.links.consumeCode(code, sender.userId);
    if (!organization) {
      await this.client.sendText(sender.replyTo, REPLIES.linkInvalid);
      return;
    }
    await this.touchWindow([organization.id]);

    await this.client.sendText(
      sender.replyTo,
      REPLIES.linked(organization.name),
    );
    await this.sendMenu(sender, organization, false);
  }

  private async handleUnlink(
    sender: WhatsAppSender,
    organizations: LinkedOrganization[],
  ): Promise<void> {
    for (const organization of organizations) {
      await this.links.unlink(organization.id);
    }
    await this.client.sendText(sender.replyTo, REPLIES.unlinked);
  }

  private async handleSelection(
    sender: WhatsAppSender,
    organizations: LinkedOrganization[],
    selectionId: string,
  ): Promise<void> {
    const selection = parseMenuSelection(selectionId);

    if (!selection || selection.kind === 'switch') {
      await this.askOrganization(sender, organizations);
      return;
    }

    const organization = organizations.find(
      (candidate) => candidate.id === selection.organizationId,
    );
    if (!organization) {
      await this.client.sendText(sender.replyTo, REPLIES.notOwner);
      return;
    }

    if (selection.kind === 'organization') {
      await this.sendMenu(sender, organization, organizations.length > 1);
      return;
    }

    await this.answerIntent(sender, organization, selection.intent);
  }

  private async handleFreeText(
    sender: WhatsAppSender,
    organizations: LinkedOrganization[],
    text: string,
    normalized: string,
  ): Promise<void> {
    if (organizations.length > 1) {
      await this.askOrganization(sender, organizations);
      return;
    }

    const organization = organizations[0];

    if (MENU_COMMANDS.includes(normalized)) {
      await this.sendMenu(sender, organization, false);
      return;
    }

    try {
      const answer = await this.assistant.query(
        { id: organization.ownerId, organizationId: organization.id },
        { query: text },
      );

      if (answer.intent === 'unknown') {
        await this.sendMenu(sender, organization, false, REPLIES.notUnderstood);
        return;
      }

      await this.client.sendText(sender.replyTo, formatAssistantAnswer(answer));
    } catch (error) {
      this.logger.error(
        `El asistente falló: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      await this.client.sendText(sender.replyTo, REPLIES.failed);
    }
  }

  private async touchWindow(organizationIds: string[]): Promise<void> {
    await this.prisma.organization.updateMany({
      where: { id: { in: organizationIds } },
      data: { whatsappLastInboundAt: new Date() },
    });
  }

  private async answerIntent(
    sender: WhatsAppSender,
    organization: LinkedOrganization,
    intent: MenuIntent,
  ): Promise<void> {
    try {
      const answer = await this.assistant.answerIntent(
        { id: organization.ownerId, organizationId: organization.id },
        intent,
      );
      await this.client.sendText(sender.replyTo, formatAssistantAnswer(answer));
    } catch (error) {
      this.logger.error(
        `El asistente falló: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      await this.client.sendText(sender.replyTo, REPLIES.failed);
    }
  }

  private async askOrganization(
    sender: WhatsAppSender,
    organizations: LinkedOrganization[],
  ): Promise<void> {
    if (organizations.length === 1) {
      await this.sendMenu(sender, organizations[0], false);
      return;
    }

    await this.client.sendMenu(sender.replyTo, {
      body: REPLIES.chooseOrganization,
      button: 'Elegir empresa',
      rows: buildOrganizationMenuRows(organizations),
    });
  }

  private async sendMenu(
    sender: WhatsAppSender,
    organization: LinkedOrganization,
    includeSwitch: boolean,
    body?: string,
  ): Promise<void> {
    await this.client.sendMenu(sender.replyTo, {
      body: body ?? REPLIES.menuBody(organization.name),
      button: REPLIES.menuButton,
      rows: buildQueryMenuRows(organization.id, includeSwitch),
    });
  }
}
