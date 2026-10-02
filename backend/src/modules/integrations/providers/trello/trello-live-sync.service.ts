/**
 * Alta y baja del webhook de Trello de una conexion (la "actualizacion
 * automatica"). Nunca hace fallar la conexion: si el webhook no se puede crear,
 * la conexion queda igual y el motivo se guarda para mostrarlo y reintentar.
 *
 * Qué contiene:
 * - `register()`: si falta configuracion (secreto o URL publica) devuelve el
 *   motivo sin llamar a Trello. Si no, crea el webhook sobre el tablero con la
 *   URL de callback de la conexion y guarda su id. Si Trello lo rechaza (por
 *   ejemplo porque no pudo hacer el HEAD a la URL) anota el error en la conexion.
 * - `unregister()`: borra el webhook en Trello si existe. Es de mejor esfuerzo:
 *   si falla igual se sigue, porque el webhook de una conexion borrada recibe
 *   410 y Trello lo da de baja solo.
 * - `credentialsFor()`: descifra el token guardado de la conexion (tambien lo usa
 *   la revision diaria).
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  IntegrationsConfig,
  LiveSyncConfigIssue,
} from '../../integrations.config';
import { decryptSecret } from '../../security/token-cipher';
import { TrelloClient } from './trello.client';
import { TrelloCredentials } from './trello.types';

export interface LiveSyncStatus {
  active: boolean;
  reason: LiveSyncConfigIssue | 'REGISTRATION_FAILED' | null;
}

interface ConnectionForWebhook {
  id: string;
  externalContainerId: string;
  externalContainerName: string;
  accessTokenEnc: string;
  webhookId: string | null;
}

@Injectable()
export class TrelloLiveSyncService {
  private readonly logger = new Logger(TrelloLiveSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trello: TrelloClient,
    private readonly config: IntegrationsConfig,
  ) {}

  async register(connection: ConnectionForWebhook): Promise<LiveSyncStatus> {
    if (connection.webhookId) return { active: true, reason: null };

    const configIssue = this.config.liveSyncIssue();
    const callbackURL = this.config.webhookUrl(connection.id);
    if (configIssue || !callbackURL) {
      return { active: false, reason: configIssue ?? 'WEBHOOK_URL_MISSING' };
    }

    try {
      const webhook = await this.trello.createWebhook(
        this.credentialsFor(connection),
        {
          callbackURL,
          idModel: connection.externalContainerId,
          description: `Tino - ${connection.externalContainerName}`.slice(
            0,
            250,
          ),
        },
      );
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { webhookId: webhook.id, lastSyncError: null },
      });
      return { active: true, reason: null };
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Trello webhook registration failed (connectionId=${connection.id}, error=${errorName})`,
      );
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: 'WEBHOOK_REGISTRATION_FAILED' },
      });
      return { active: false, reason: 'REGISTRATION_FAILED' };
    }
  }

  async unregister(connection: ConnectionForWebhook): Promise<void> {
    if (!connection.webhookId) return;
    try {
      await this.trello.deleteWebhook(
        connection.webhookId,
        this.credentialsFor(connection),
      );
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Trello webhook removal failed (connectionId=${connection.id}, error=${errorName})`,
      );
    }
  }

  credentialsFor(
    connection: Pick<ConnectionForWebhook, 'accessTokenEnc'>,
  ): TrelloCredentials {
    const key = this.config.encryptionKey();
    if (!key) throw new Error('Integrations encryption key is not configured');
    return {
      apiKey: this.config.trelloApiKey ?? '',
      token: decryptSecret(connection.accessTokenEnc, key),
    };
  }
}
