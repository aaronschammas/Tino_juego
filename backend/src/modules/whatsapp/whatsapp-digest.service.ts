/**
 * Resumen diario de las novedades de Trello para el owner, por WhatsApp.
 *
 * Lo dispara Cloud Scheduler una vez por dia (`POST /integrations/digest`), no
 * un `@Cron`, porque Cloud Run corre con `min-instances 0`. Se manda al mismo
 * `user_id` de Meta con el que el owner vinculo su WhatsApp: el telefono nunca
 * se guarda.
 *
 * Qué contiene:
 * - `sendDailyDigests()`: recorre las organizaciones activas con WhatsApp
 *   vinculado, plan con WhatsApp e integraciones y al menos un proyecto conectado.
 *   Para cada una:
 *   1. Si ya se evaluo hace menos de 20 horas, la saltea (asi un reintento de
 *      Cloud Scheduler no manda el resumen dos veces).
 *   2. Si quien vinculo ya no es owner, la saltea.
 *   3. Resume desde el ultimo resumen (o las ultimas 24 horas), con un maximo
 *      de 7 dias hacia atras.
 *   4. Sin novedades no manda nada (para no molestar) y marca el dia como
 *      evaluado.
 *   5. Con la ventana de 24 horas abierta manda el texto completo gratis. Si
 *      esta cerrada y hay plantilla configurada, manda la plantilla con el
 *      nombre de la organizacion y una linea con los numeros. Si no hay
 *      plantilla, no manda nada y no marca el dia: el proximo resumen incluye
 *      estas novedades.
 *   Devuelve cuantas organizaciones proceso y como termino cada una.
 * - `buildDigestText()`: el texto completo de un periodo, o `null` si no hubo
 *   novedades. Lo usa tambien el comando "novedades" del chat.
 * - `isWindowOpen()`: la ventana de Meta dura 24 horas desde el ultimo mensaje
 *   del owner; se deja media hora de margen.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { isOrgOwner } from 'src/common/permissions';
import {
  ACTIVITY_MAX_LOOKBACK_MS,
  IntegrationActivityService,
} from '../integrations/activity/integration-activity.service';
import { WhatsAppClientService } from './whatsapp-client.service';
import { readWhatsAppConfig } from './whatsapp.config';
import {
  formatDigestHeadline,
  formatDigestMessage,
  toTemplateParam,
} from './whatsapp-digest-format';

const HOUR_MS = 60 * 60 * 1000;
export const DIGEST_PERIOD_MS = 24 * HOUR_MS;
export const DIGEST_MIN_INTERVAL_MS = 20 * HOUR_MS;
export const WHATSAPP_WINDOW_MS = 23.5 * HOUR_MS;

export type DigestOutcome =
  | 'SENT_TEXT'
  | 'SENT_TEMPLATE'
  | 'NO_NEWS'
  | 'NO_CHANNEL'
  | 'ALREADY_SENT'
  | 'NOT_OWNER'
  | 'FAILED';

export interface DigestRunSummary {
  processed: number;
  results: { organizationId: string; outcome: DigestOutcome }[];
}

interface DigestOrganization {
  id: string;
  name: string;
  whatsappUserId: string | null;
  whatsappLinkedByUserId: string | null;
  whatsappLastInboundAt: Date | null;
  whatsappDigestSentAt: Date | null;
}

@Injectable()
export class WhatsAppDigestService {
  private readonly logger = new Logger(WhatsAppDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: IntegrationActivityService,
    private readonly client: WhatsAppClientService,
  ) {}

  static isWindowOpen(lastInboundAt: Date | null, now: Date): boolean {
    return (
      lastInboundAt !== null &&
      now.getTime() - lastInboundAt.getTime() < WHATSAPP_WINDOW_MS
    );
  }

  async sendDailyDigests(now = new Date()): Promise<DigestRunSummary> {
    const organizations = await this.prisma.organization.findMany({
      where: {
        isActive: true,
        whatsappUserId: { not: null },
        whatsappLinkedByUserId: { not: null },
        plan: { hasWhatsApp: true, hasIntegrations: true },
        integrationConnections: { some: {} },
      },
      select: {
        id: true,
        name: true,
        whatsappUserId: true,
        whatsappLinkedByUserId: true,
        whatsappLastInboundAt: true,
        whatsappDigestSentAt: true,
      },
    });

    const results: DigestRunSummary['results'] = [];
    for (const organization of organizations) {
      let outcome: DigestOutcome;
      try {
        outcome = await this.digestFor(organization, now);
      } catch (error) {
        this.logger.error(
          `Resumen de Trello fallido (organizationId=${organization.id}): ${
            error instanceof Error ? error.name : 'error desconocido'
          }`,
        );
        outcome = 'FAILED';
      }
      results.push({ organizationId: organization.id, outcome });
    }
    return { processed: organizations.length, results };
  }

  async buildDigestText(
    organizationId: string,
    organizationName: string,
    since: Date,
    until: Date,
  ): Promise<string | null> {
    const summary = await this.activity.summarize({
      organizationId,
      since,
      until,
    });
    return summary.isEmpty
      ? null
      : formatDigestMessage(organizationName, summary);
  }

  private async digestFor(
    organization: DigestOrganization,
    now: Date,
  ): Promise<DigestOutcome> {
    const sentAt = organization.whatsappDigestSentAt;
    if (sentAt && now.getTime() - sentAt.getTime() < DIGEST_MIN_INTERVAL_MS) {
      return 'ALREADY_SENT';
    }

    const ownerId = organization.whatsappLinkedByUserId;
    const to = organization.whatsappUserId;
    if (
      !ownerId ||
      !to ||
      !(await isOrgOwner({ id: ownerId }, organization.id, this.prisma))
    ) {
      return 'NOT_OWNER';
    }

    const since = new Date(
      Math.max(
        sentAt?.getTime() ?? now.getTime() - DIGEST_PERIOD_MS,
        now.getTime() - ACTIVITY_MAX_LOOKBACK_MS,
      ),
    );
    const summary = await this.activity.summarize({
      organizationId: organization.id,
      since,
      until: now,
    });
    if (summary.isEmpty) {
      await this.markSent(organization.id, now);
      return 'NO_NEWS';
    }

    if (
      WhatsAppDigestService.isWindowOpen(
        organization.whatsappLastInboundAt,
        now,
      )
    ) {
      const sent = await this.client.sendText(
        to,
        formatDigestMessage(organization.name, summary),
      );
      if (!sent) return 'FAILED';
      await this.markSent(organization.id, now);
      return 'SENT_TEXT';
    }

    const config = readWhatsAppConfig();
    if (!config.digestTemplate) return 'NO_CHANNEL';

    const sent = await this.client.sendTemplate(
      to,
      config.digestTemplate,
      config.digestTemplateLanguage,
      [
        toTemplateParam(organization.name),
        toTemplateParam(formatDigestHeadline(summary)),
      ],
    );
    if (!sent) return 'FAILED';
    await this.markSent(organization.id, now);
    return 'SENT_TEMPLATE';
  }

  private async markSent(organizationId: string, now: Date): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { whatsappDigestSentAt: now },
    });
  }
}
