/**
 * Procesa cada aviso que Trello envia al webhook de una conexion.
 *
 * Qué contiene:
 * - `handle()`: en este orden:
 *   1. Si las integraciones estan apagadas, ignora el aviso sin tocar nada.
 *   2. Verifica la firma de Trello (401 si no coincide).
 *   3. Busca la conexion; si ya no existe responde 410, y Trello da de baja el
 *      webhook por su cuenta.
 *   4. Descarta los avisos repetidos (Trello reintenta) usando `IntegrationEvent`;
 *      un evento que fallo antes si se vuelve a procesar.
 *   5. Traduce la accion y aplica cada cambio, pasando el nombre de quien lo
 *      hizo para que quede en las novedades. El evento queda PROCESSED si algo
 *      se aplico o IGNORED si no correspondia, junto con quien hizo el cambio
 *      (para el timer automatico futuro).
 *   6. Si algo falla, guarda el evento como FAILED, anota el error en la conexion
 *      y responde 500 para que Trello reintente.
 * - `recordEvent()`: crea o actualiza el registro del evento.
 */
import {
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { IntegrationEventStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../../integrations.config';
import { decryptSecret } from '../../security/token-cipher';
import { IntegrationChangeService } from '../../sync/integration-change.service';
import { TrelloAdapter } from './trello.adapter';
import { TrelloAction, TrelloWebhookPayload } from './trello.types';
import { TrelloWebhookTranslator } from './trello-webhook-translator';
import { verifyTrelloSignature } from './trello-signature';

export type TrelloWebhookResult =
  | 'DISABLED'
  | 'NO_ACTION'
  | 'DUPLICATE'
  | IntegrationEventStatus;

interface ConnectionForEvent {
  id: string;
  organizationId: string;
  projectId: string;
  status: string;
  accessTokenEnc: string;
}

@Injectable()
export class TrelloWebhookService {
  private readonly logger = new Logger(TrelloWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: IntegrationsConfig,
    private readonly translator: TrelloWebhookTranslator,
    private readonly changes: IntegrationChangeService,
    private readonly adapter: TrelloAdapter,
  ) {}

  async handle(
    connectionId: string,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    payload: TrelloWebhookPayload,
  ): Promise<TrelloWebhookResult> {
    if (!this.config.enabled) return 'DISABLED';

    const callbackUrl = this.config.webhookUrl(connectionId);
    if (
      !callbackUrl ||
      !verifyTrelloSignature(
        rawBody,
        callbackUrl,
        signature,
        this.config.trelloApiSecret,
      )
    ) {
      throw new UnauthorizedException('Invalid Trello signature');
    }

    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id: connectionId, provider: 'TRELLO' },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        status: true,
        accessTokenEnc: true,
      },
    });
    if (!connection) throw new GoneException('Connection not found');

    const action = payload?.action;
    if (!action?.id || !action.type) return 'NO_ACTION';

    const previous = await this.prisma.integrationEvent.findUnique({
      where: {
        connectionId_externalEventId: {
          connectionId,
          externalEventId: action.id,
        },
      },
      select: { status: true },
    });
    if (previous && previous.status !== IntegrationEventStatus.FAILED) {
      return 'DUPLICATE';
    }

    if (connection.status !== 'ACTIVE') {
      await this.recordEvent(
        connection,
        action,
        IntegrationEventStatus.IGNORED,
      );
      return IntegrationEventStatus.IGNORED;
    }

    try {
      const status = await this.process(connection, action);
      await this.recordEvent(connection, action, status);
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastEventAt: new Date(), lastSyncError: null },
      });
      return status;
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Trello webhook failed (connectionId=${connection.id}, action=${action.type}, error=${errorName})`,
      );
      await this.recordEvent(
        connection,
        action,
        IntegrationEventStatus.FAILED,
        errorName,
      );
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: `${action.type}: ${errorName}` },
      });
      throw new InternalServerErrorException('Trello webhook failed');
    }
  }

  private async process(
    connection: ConnectionForEvent,
    action: TrelloAction,
  ): Promise<IntegrationEventStatus> {
    const key = this.config.encryptionKey();
    if (!key) throw new Error('Integrations encryption key is not configured');

    const credentials = {
      apiKey: this.config.trelloApiKey ?? '',
      token: decryptSecret(connection.accessTokenEnc, key),
    };
    const changes = await this.translator.translate(action, credentials);
    const context = {
      connectionId: connection.id,
      organizationId: connection.organizationId,
      projectId: connection.projectId,
      sources: this.adapter.sources,
      actorName: this.translator.actorOf(action).name,
    };

    let applied = false;
    for (const change of changes) {
      const outcome = await this.changes.apply(context, change);
      applied = applied || outcome === 'APPLIED';
    }
    return applied
      ? IntegrationEventStatus.PROCESSED
      : IntegrationEventStatus.IGNORED;
  }

  private async recordEvent(
    connection: ConnectionForEvent,
    action: TrelloAction,
    status: IntegrationEventStatus,
    error?: string,
  ) {
    const actor = this.translator.actorOf(action);
    const data = {
      type: action.type,
      itemExternalId: action.data?.card?.id ?? null,
      actorExternalId: actor.id,
      actorName: actor.name,
      status,
      error: error ?? null,
      occurredAt: action.date ? new Date(action.date) : null,
    };

    await this.prisma.integrationEvent.upsert({
      where: {
        connectionId_externalEventId: {
          connectionId: connection.id,
          externalEventId: action.id,
        },
      },
      create: {
        connectionId: connection.id,
        externalEventId: action.id,
        ...data,
      },
      update: data,
    });
  }
}
