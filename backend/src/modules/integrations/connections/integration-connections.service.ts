/**
 * Conexiones guardadas entre un proyecto de Tino y un contenedor externo.
 * Es comun a todos los proveedores; lo especifico de cada uno queda en su
 * servicio de conexion.
 *
 * Qué contiene:
 * - `findConflicts()`: antes de conectar, indica si el contenedor ya esta
 *   conectado a otro proyecto de la organizacion o si el proyecto destino ya
 *   tiene una conexion (hay una sola por proyecto).
 * - `createInTx()`: guarda la conexion con el token cifrado y una fila de
 *   equivalencia por grupo externo, dentro de la transaccion de la importacion.
 * - `findByProject()`: resumen de la conexion de un proyecto (sin token) para
 *   quien tenga acceso al proyecto, con el estado de la actualizacion
 *   automatica; `null` si no esta conectado.
 * - `findForProject()`: la conexion completa (con token cifrado) para uso
 *   interno, por ejemplo para crear o borrar el webhook.
 * - `updateStatusMappings()`: cambia la equivalencia de listas ya registradas.
 *   Las listas que estaban "por definir" pasan su nuevo estado a las tareas que
 *   ya tenian; cambiar una lista que ya tenia estado solo afecta a los proximos
 *   movimientos (asi no se pisa lo editado en Tino).
 * - `disconnect()`: borra la conexion, sus equivalencias y eventos. Las tareas
 *   ya importadas quedan en el proyecto.
 */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { hasProjectAccess, PermissionUser } from 'src/common/permissions';
import { IntegrationsConfig } from '../integrations.config';
import {
  IntegrationProvider,
  NormalizedContainer,
  NormalizedGroup,
} from '../integration.types';
import { StatusMapping } from '../mapping/status-mapping';
import { encryptSecret } from '../security/token-cipher';

export interface CreateConnectionInput {
  organizationId: string;
  projectId: string;
  provider: IntegrationProvider;
  container: NormalizedContainer;
  accessToken: string;
  connectedByUserId: string;
  groups: NormalizedGroup[];
  mapping: StatusMapping;
}

export interface ConnectionConflicts {
  containerProject: { id: string; name: string } | null;
  projectAlreadyConnected: boolean;
}

export interface IntegrationConnectionSummary {
  id: string;
  provider: IntegrationProvider;
  status: string;
  container: { id: string; name: string; url: string | null };
  connectedAt: Date;
  connectedBy: { id: string; name: string } | null;
  lastSyncedAt: Date | null;
  liveSync: {
    active: boolean;
    lastEventAt: Date | null;
    lastSyncError: string | null;
  };
  statusMappings: Array<{
    externalGroupId: string;
    name: string;
    status: TaskStatus | null;
  }>;
}

@Injectable()
export class IntegrationConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: IntegrationsConfig,
  ) {}

  async findConflicts(
    organizationId: string,
    provider: IntegrationProvider,
    containerId: string,
    projectId?: string,
  ): Promise<ConnectionConflicts> {
    const [containerConnection, projectConnection] = await Promise.all([
      this.prisma.integrationConnection.findUnique({
        where: {
          organizationId_provider_externalContainerId: {
            organizationId,
            provider,
            externalContainerId: containerId,
          },
        },
        select: { project: { select: { id: true, name: true } } },
      }),
      projectId
        ? this.prisma.integrationConnection.findUnique({
            where: { projectId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      containerProject: containerConnection?.project ?? null,
      projectAlreadyConnected: !!projectConnection,
    };
  }

  async createInTx(
    tx: Prisma.TransactionClient,
    input: CreateConnectionInput,
  ): Promise<void> {
    const key = this.config.encryptionKey();
    if (!key) {
      throw new InternalServerErrorException(
        'Integrations encryption key is not configured',
      );
    }

    await tx.integrationConnection.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        provider: input.provider,
        externalContainerId: input.container.externalId,
        externalContainerName: input.container.name,
        externalContainerUrl: input.container.url,
        accessTokenEnc: encryptSecret(input.accessToken, key),
        connectedByUserId: input.connectedByUserId,
        lastSyncedAt: new Date(),
        statusMappings: {
          create: input.groups.map((group) => ({
            externalGroupId: group.externalId,
            externalGroupName: group.name,
            status: input.mapping.get(group.externalId) ?? null,
          })),
        },
      },
    });
  }

  async findByProject(
    user: PermissionUser,
    organizationId: string,
    projectId: string,
  ): Promise<IntegrationConnectionSummary | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, organizationId: true, isActive: true },
    });
    if (!project || !(await hasProjectAccess(user, project, this.prisma))) {
      throw new NotFoundException('Project not found');
    }

    const connection = await this.prisma.integrationConnection.findUnique({
      where: { projectId },
      include: {
        statusMappings: { orderBy: { externalGroupName: 'asc' } },
      },
    });
    if (!connection) return null;

    const connectedBy = await this.prisma.user.findUnique({
      where: { id: connection.connectedByUserId },
      select: { id: true, name: true, lastname: true },
    });

    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      container: {
        id: connection.externalContainerId,
        name: connection.externalContainerName,
        url: connection.externalContainerUrl,
      },
      connectedAt: connection.createdAt,
      connectedBy: connectedBy
        ? {
            id: connectedBy.id,
            name: `${connectedBy.name} ${connectedBy.lastname}`.trim(),
          }
        : null,
      lastSyncedAt: connection.lastSyncedAt,
      liveSync: {
        active: !!connection.webhookId,
        lastEventAt: connection.lastEventAt,
        lastSyncError: connection.lastSyncError,
      },
      statusMappings: connection.statusMappings.map((mapping) => ({
        externalGroupId: mapping.externalGroupId,
        name: mapping.externalGroupName,
        status: mapping.status,
      })),
    };
  }

  findForProject(organizationId: string, projectId: string) {
    return this.prisma.integrationConnection.findFirst({
      where: { organizationId, projectId },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        status: true,
        provider: true,
        externalContainerId: true,
        externalContainerName: true,
        accessTokenEnc: true,
        webhookId: true,
      },
    });
  }

  async updateStatusMappings(
    organizationId: string,
    projectId: string,
    entries: Array<{ externalGroupId: string; status: TaskStatus }>,
    itemSource: string,
  ): Promise<{ updated: number; tasksUpdated: number }> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { organizationId, projectId },
      select: {
        id: true,
        statusMappings: { select: { externalGroupId: true, status: true } },
      },
    });
    if (!connection) throw new NotFoundException('Connection not found');

    const current = new Map(
      connection.statusMappings.map((mapping) => [
        mapping.externalGroupId,
        mapping.status,
      ]),
    );
    if (entries.some((entry) => !current.has(entry.externalGroupId))) {
      throw new BadRequestException('Unknown list in status mapping');
    }
    const changed = entries.filter(
      (entry) => current.get(entry.externalGroupId) !== entry.status,
    );
    const newlyDefined = changed.filter(
      (entry) => current.get(entry.externalGroupId) === null,
    );

    const mappingUpdates = changed.map((entry) =>
      this.prisma.integrationStatusMapping.update({
        where: {
          connectionId_externalGroupId: {
            connectionId: connection.id,
            externalGroupId: entry.externalGroupId,
          },
        },
        data: { status: entry.status },
      }),
    );
    const taskUpdates = newlyDefined.map((entry) =>
      this.prisma.task.updateMany({
        where: {
          organizationId,
          projectId,
          externalSource: itemSource,
          externalGroupId: entry.externalGroupId,
          parentTaskId: null,
          archivedAt: null,
        },
        data: { status: entry.status },
      }),
    );

    const results = await this.prisma.$transaction([
      ...taskUpdates,
      ...mappingUpdates,
    ]);
    const tasksUpdated = results
      .slice(0, taskUpdates.length)
      .reduce(
        (total, result) => total + (result as { count: number }).count,
        0,
      );

    return { updated: changed.length, tasksUpdated };
  }

  async disconnect(
    organizationId: string,
    projectId: string,
  ): Promise<{ disconnected: boolean }> {
    const { count } = await this.prisma.integrationConnection.deleteMany({
      where: { organizationId, projectId },
    });
    return { disconnected: count > 0 };
  }
}
