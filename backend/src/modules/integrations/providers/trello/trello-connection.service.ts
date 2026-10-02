/**
 * Conexion de un proyecto de Tino con un tablero de Trello (primera importacion
 * completa). Todos los metodos exigen los candados de `IntegrationAccessService`.
 *
 * Flujo: el owner autoriza a Tino en Trello -> elige tablero y destino -> revisa
 * la equivalencia de listas a estados (sugerida automaticamente, las que no
 * tienen equivalencia las completa a mano) -> conecta. Conectar crea proyecto
 * (si es nuevo), conexion, equivalencias, tareas y subtareas en una transaccion.
 *
 * Qué contiene:
 * - `buildAuthorizeUrl()`: URL de autorizacion de Trello (solo lectura, sin
 *   vencimiento, ver `trello-authorize.ts`) que vuelve con el token en el
 *   fragmento de `<origen>/integrations/trello/callback`. El token nunca viaja
 *   por query string.
 * - `listBoards()`: tableros abiertos del usuario.
 * - `preview()`: vista previa con la equivalencia sugerida ya aplicada, la lista
 *   de equivalencias para revisar y `blockedReason` si no se puede conectar.
 * - `connect()`: valida bloqueos, que todas las listas tengan estado y el limite
 *   de proyectos del plan; aplica la equivalencia elegida e importa (con los
 *   comentarios) guardando la conexion dentro de la misma transaccion. Despues
 *   activa la actualizacion automatica (webhook); si no se puede, la conexion
 *   queda igual y la respuesta lo indica en `liveSync`.
 * - `enableLiveSync()`: reintenta activar la actualizacion automatica.
 * - `updateStatusMappings()`: cambia la equivalencia de listas del proyecto.
 * - `disconnect()`: borra el webhook en Trello y despues la conexion.
 * - `buildContext()`: descarga el tablero (y los comentarios si se piden) y
 *   busca en paralelo duplicados, proyecto destino y conexiones existentes.
 * - `requireConnection()`: conexion del proyecto o 404.
 * - `findBlockedReason()`: tablero conectado a otro proyecto, proyecto ya
 *   conectado, o tablero ya importado cuando se pide proyecto nuevo.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionUser } from 'src/common/permissions';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { IntegrationAccessService } from '../../access/integration-access.service';
import {
  ConnectionConflicts,
  IntegrationConnectionsService,
} from '../../connections/integration-connections.service';
import {
  ConnectionTargetMode,
  StatusMappingEntryDto,
  TrelloConnectDto,
  TrelloConnectionPreviewDto,
} from '../../dto/trello-connection.dto';
import { IntegrationsConfig } from '../../integrations.config';
import { NormalizedSnapshot } from '../../integration.types';
import {
  applyStatusMapping,
  findUnmappedGroups,
  StatusMapping,
  suggestStatusMapping,
} from '../../mapping/status-mapping';
import {
  ExistingImportState,
  IntegrationSyncService,
} from '../../sync/integration-sync.service';
import { TrelloAdapter } from './trello.adapter';
import { buildTrelloAuthorizeUrl } from './trello-authorize';
import { TrelloLiveSyncService } from './trello-live-sync.service';
import { buildTrelloPreview } from './trello-preview';
import { TrelloCredentials } from './trello.types';

interface ConnectionContext {
  snapshot: NormalizedSnapshot;
  existing: ExistingImportState;
  targetProject: { id: string; name: string } | null;
  conflicts: ConnectionConflicts;
}

@Injectable()
export class TrelloConnectionService {
  constructor(
    private readonly trello: TrelloAdapter,
    private readonly sync: IntegrationSyncService,
    private readonly connections: IntegrationConnectionsService,
    private readonly access: IntegrationAccessService,
    private readonly planPolicy: PlanPolicyService,
    private readonly config: IntegrationsConfig,
    private readonly liveSync: TrelloLiveSyncService,
  ) {}

  async buildAuthorizeUrl(
    user: PermissionUser,
    organizationId: string,
    returnOrigin: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    return {
      url: buildTrelloAuthorizeUrl(
        this.config.trelloApiKey ?? '',
        returnOrigin,
        'never',
      ),
    };
  }

  async listBoards(
    user: PermissionUser,
    organizationId: string,
    token: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    const boards = await this.trello.listContainers(this.credentials(token));

    return boards.map((board) => ({
      id: board.externalId,
      name: board.name,
      description: board.description,
      url: board.url,
    }));
  }

  async preview(
    dto: TrelloConnectionPreviewDto,
    user: PermissionUser,
    organizationId: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    const context = await this.buildContext(dto, organizationId);
    const suggestions = suggestStatusMapping(context.snapshot);
    const suggested: StatusMapping = new Map(
      suggestions
        .filter((entry) => entry.suggestedStatus)
        .map((entry) => [entry.externalGroupId, entry.suggestedStatus!]),
    );
    const blockedReason = this.findBlockedReason(dto.mode, context);

    return {
      ...buildTrelloPreview(
        dto.mode,
        applyStatusMapping(context.snapshot, suggested),
        context.existing,
        context.targetProject,
      ),
      importDisabled: !!blockedReason,
      blockedReason,
      statusMapping: suggestions,
    };
  }

  async connect(
    dto: TrelloConnectDto,
    user: PermissionUser,
    organizationId: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    const context = await this.buildContext(dto, organizationId, true);
    const blockedReason = this.findBlockedReason(dto.mode, context);
    if (blockedReason) throw new ConflictException(blockedReason);

    const groupIds = new Set(
      context.snapshot.groups.map((group) => group.externalId),
    );
    const mapping: StatusMapping = new Map(
      dto.statusMapping
        .filter((entry) => groupIds.has(entry.externalGroupId))
        .map((entry) => [entry.externalGroupId, entry.status]),
    );
    const unmapped = findUnmappedGroups(context.snapshot.groups, mapping);
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `Falta definir el estado de: ${unmapped.map((group) => group.name).join(', ')}`,
      );
    }

    if (dto.mode === ConnectionTargetMode.NEW_PROJECT) {
      await this.planPolicy.assertCanCreateProject(organizationId, user);
    }

    const snapshot = applyStatusMapping(context.snapshot, mapping);
    const result = await this.sync.importSnapshot({
      provider: this.trello.provider,
      sources: this.trello.sources,
      snapshot,
      organizationId,
      userId: user.id,
      targetProjectId: context.targetProject?.id,
      existing: context.existing,
      failureMessage: 'No se pudo conectar el tablero de Trello.',
      onProjectReady: (tx, projectId) =>
        this.connections.createInTx(tx, {
          organizationId,
          projectId,
          provider: this.trello.provider,
          container: snapshot.container,
          accessToken: dto.token,
          connectedByUserId: user.id,
          groups: snapshot.groups,
          mapping,
        }),
    });

    const project = result.project || context.targetProject;
    const connection = project
      ? await this.connections.findForProject(organizationId, project.id)
      : null;
    const liveSync = connection
      ? await this.liveSync.register(connection)
      : { active: false, reason: null };

    return {
      ...buildTrelloPreview(
        dto.mode,
        snapshot,
        context.existing,
        context.targetProject,
      ),
      result: { ...result, project },
      liveSync,
    };
  }

  async enableLiveSync(
    user: PermissionUser,
    organizationId: string,
    projectId: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    const connection = await this.requireConnection(organizationId, projectId);
    return this.liveSync.register(connection);
  }

  async updateStatusMappings(
    user: PermissionUser,
    organizationId: string,
    projectId: string,
    entries: StatusMappingEntryDto[],
  ) {
    await this.access.assertCanManage(user, organizationId);
    return this.connections.updateStatusMappings(
      organizationId,
      projectId,
      entries,
      this.trello.sources.item,
    );
  }

  async disconnect(
    user: PermissionUser,
    organizationId: string,
    projectId: string,
  ) {
    await this.access.assertCanManage(user, organizationId);
    const connection = await this.connections.findForProject(
      organizationId,
      projectId,
    );
    if (connection) await this.liveSync.unregister(connection);
    return this.connections.disconnect(organizationId, projectId);
  }

  private async requireConnection(organizationId: string, projectId: string) {
    const connection = await this.connections.findForProject(
      organizationId,
      projectId,
    );
    if (!connection) throw new NotFoundException('Connection not found');
    return connection;
  }

  private async buildContext(
    dto: TrelloConnectionPreviewDto,
    organizationId: string,
    includeComments = false,
  ): Promise<ConnectionContext> {
    const isExisting = dto.mode === ConnectionTargetMode.EXISTING_PROJECT;
    if (isExisting && !dto.projectId) {
      throw new BadRequestException('Project target is required');
    }

    const snapshot = await this.trello.fetchSnapshot(
      dto.boardId,
      this.credentials(dto.token),
      { includeComments },
    );
    const [existing, targetProject, conflicts] = await Promise.all([
      this.sync.findExisting(organizationId, this.trello.sources, snapshot),
      isExisting
        ? this.sync.findTargetProject(organizationId, dto.projectId!)
        : Promise.resolve(null),
      this.connections.findConflicts(
        organizationId,
        this.trello.provider,
        snapshot.container.externalId,
        isExisting ? dto.projectId : undefined,
      ),
    ]);

    if (isExisting && !targetProject) {
      throw new NotFoundException('Project target not found');
    }

    return {
      snapshot,
      existing,
      targetProject: targetProject
        ? { id: targetProject.id, name: targetProject.name }
        : null,
      conflicts,
    };
  }

  private findBlockedReason(
    mode: ConnectionTargetMode,
    context: ConnectionContext,
  ): string | null {
    const { conflicts, existing } = context;
    if (conflicts.containerProject) {
      return `Este tablero ya esta conectado al proyecto "${conflicts.containerProject.name}"`;
    }
    if (conflicts.projectAlreadyConnected) {
      return 'Este proyecto ya tiene un tablero de Trello conectado';
    }
    if (
      mode === ConnectionTargetMode.NEW_PROJECT &&
      existing.containerProject
    ) {
      return `Este tablero ya fue importado como "${existing.containerProject.name}". Elegi ese proyecto como destino para conectarlo.`;
    }
    return null;
  }

  private credentials(token: string): TrelloCredentials {
    return { apiKey: this.config.trelloApiKey ?? '', token };
  }
}
