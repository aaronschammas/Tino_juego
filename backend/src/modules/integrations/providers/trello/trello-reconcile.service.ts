/**
 * Revision de respaldo de las conexiones con Trello. La dispara Cloud Scheduler
 * una vez por dia (no se usa @Cron porque Cloud Run corre con min-instances 0 y
 * no hay instancia viva para ejecutarlo) o el owner con "Sincronizar ahora".
 *
 * Qué contiene:
 * - `reconcileAll()`: si las integraciones estan apagadas no hace nada. Si no,
 *   toma hasta `MAX_CONNECTIONS_PER_RUN` conexiones activas de Trello, empezando
 *   por las sincronizadas hace mas tiempo, y las revisa de a una. Un error en una
 *   conexion no frena al resto; queda anotado en esa conexion y en el resumen.
 * - `reconcileProject()`: la misma revision para un proyecto, a pedido del owner.
 * - `reconcileConnection()`: descarga el tablero completo (con comentarios), lo
 *   compara con Tino usando `IntegrationReconcileService`, vuelve a activar el
 *   webhook si no estaba activo y guarda la fecha de la ultima sincronizacion.
 *   Si falla, anota `RECONCILE_FAILED` con el nombre del error.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { PermissionUser } from 'src/common/permissions';
import { IntegrationAccessService } from '../../access/integration-access.service';
import { IntegrationConnectionsService } from '../../connections/integration-connections.service';
import { IntegrationsConfig } from '../../integrations.config';
import {
  IntegrationReconcileService,
  ReconcileStats,
} from '../../sync/integration-reconcile.service';
import { TrelloAdapter } from './trello.adapter';
import { TrelloLiveSyncService } from './trello-live-sync.service';

export const MAX_CONNECTIONS_PER_RUN = 50;

export interface ConnectionToReconcile {
  id: string;
  organizationId: string;
  projectId: string;
  externalContainerId: string;
  externalContainerName: string;
  accessTokenEnc: string;
  webhookId: string | null;
}

export interface ConnectionReconcileResult extends ReconcileStats {
  liveSyncActive: boolean;
}

export interface ReconcileRunSummary {
  status: 'DISABLED' | 'OK';
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<
    | {
        connectionId: string;
        projectId: string;
        ok: true;
        stats: ConnectionReconcileResult;
      }
    | { connectionId: string; projectId: string; ok: false; error: string }
  >;
}

@Injectable()
export class TrelloReconcileService {
  private readonly logger = new Logger(TrelloReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: IntegrationsConfig,
    private readonly adapter: TrelloAdapter,
    private readonly reconcile: IntegrationReconcileService,
    private readonly liveSync: TrelloLiveSyncService,
    private readonly connections: IntegrationConnectionsService,
    private readonly access: IntegrationAccessService,
  ) {}

  async reconcileAll(): Promise<ReconcileRunSummary> {
    const summary: ReconcileRunSummary = {
      status: 'OK',
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
    if (this.config.issue()) return { ...summary, status: 'DISABLED' };

    const connections = await this.prisma.integrationConnection.findMany({
      where: { provider: 'TRELLO', status: 'ACTIVE' },
      orderBy: { lastSyncedAt: 'asc' },
      take: MAX_CONNECTIONS_PER_RUN,
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        externalContainerId: true,
        externalContainerName: true,
        accessTokenEnc: true,
        webhookId: true,
      },
    });

    for (const connection of connections) {
      summary.processed += 1;
      try {
        const stats = await this.reconcileConnection(connection);
        summary.succeeded += 1;
        summary.results.push({
          connectionId: connection.id,
          projectId: connection.projectId,
          ok: true,
          stats,
        });
      } catch (error: unknown) {
        summary.failed += 1;
        summary.results.push({
          connectionId: connection.id,
          projectId: connection.projectId,
          ok: false,
          error: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
    return summary;
  }

  async reconcileProject(
    user: PermissionUser,
    organizationId: string,
    projectId: string,
  ): Promise<ConnectionReconcileResult> {
    await this.access.assertCanManage(user, organizationId);
    const connection = await this.connections.findForProject(
      organizationId,
      projectId,
    );
    if (!connection || connection.provider !== 'TRELLO') {
      throw new NotFoundException('Connection not found');
    }
    return this.reconcileConnection(connection);
  }

  async reconcileConnection(
    connection: ConnectionToReconcile,
  ): Promise<ConnectionReconcileResult> {
    try {
      const snapshot = await this.adapter.fetchSnapshot(
        connection.externalContainerId,
        this.liveSync.credentialsFor(connection),
        { includeComments: true },
      );
      const stats = await this.reconcile.reconcileSnapshot(
        {
          connectionId: connection.id,
          organizationId: connection.organizationId,
          projectId: connection.projectId,
          sources: this.adapter.sources,
        },
        snapshot,
      );
      const liveSync = await this.liveSync.register(connection);
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          ...(liveSync.active ? { lastSyncError: null } : {}),
        },
      });
      return { ...stats, liveSyncActive: liveSync.active };
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Trello reconcile failed (connectionId=${connection.id}, error=${errorName})`,
      );
      await this.prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: `RECONCILE_FAILED: ${errorName}` },
      });
      throw error;
    }
  }
}
