/**
 * Importacion manual de Trello para SUPERADMIN. Es la herramienta interna previa
 * a la conexion de proyectos; reutiliza el adaptador de Trello y el motor de
 * sincronizacion del modulo de integraciones.
 *
 * Ya no se pegan API key ni token: el SUPERADMIN autoriza a Tino en la ventana
 * de Trello (donde puede entrar con su cuenta de Google u otra) y el frontend
 * manda solo el token. La API key es la de la app de Tino (`TRELLO_API_KEY`).
 * No depende de `INTEGRATIONS_ENABLED`: es una herramienta interna.
 *
 * Qué contiene:
 * - `getConnectionStatus()`: si la autorizacion con Trello esta disponible (hay
 *   API key configurada en el servidor).
 * - `buildAuthorizeUrl()`: URL de la ventana de Trello; el token pedido vence en
 *   una hora porque se usa solo para esta importacion y no se guarda.
 * - `listBoards()`: tableros abiertos de la cuenta que autorizo.
 * - `preview()`: arma el contexto (snapshot + lo ya importado + destino) y
 *   devuelve la vista previa sin escribir nada.
 * - `executeImport()`: bloquea un tablero ya importado como proyecto nuevo,
 *   valida el limite de proyectos del plan e importa todo en una transaccion.
 * - `buildContext()`: valida SUPERADMIN y destino, descarga el tablero y busca
 *   duplicados y proyecto destino en paralelo.
 * - `credentials()`: API key del servidor + token recibido; sin API key
 *   configurada responde 503 con un mensaje claro.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PermissionUser } from 'src/common/permissions';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { IntegrationsConfig } from 'src/modules/integrations/integrations.config';
import { NormalizedSnapshot } from 'src/modules/integrations/integration.types';
import { TrelloAdapter } from 'src/modules/integrations/providers/trello/trello.adapter';
import { buildTrelloAuthorizeUrl } from 'src/modules/integrations/providers/trello/trello-authorize';
import { buildTrelloPreview } from 'src/modules/integrations/providers/trello/trello-preview';
import { TrelloCredentials } from 'src/modules/integrations/providers/trello/trello.types';
import {
  ExistingImportState,
  IntegrationSyncService,
} from 'src/modules/integrations/sync/integration-sync.service';
import {
  TrelloExecuteImportDto,
  TrelloImportMode,
  TrelloImportTokenDto,
  TrelloPreviewDto,
} from './dto/trello-import.dto';

const NOT_CONFIGURED_MESSAGE =
  'La autorizacion con Trello no esta configurada en el servidor (falta TRELLO_API_KEY).';

interface ImportContext {
  snapshot: NormalizedSnapshot;
  existing: ExistingImportState;
  targetProject: { id: string; name: string; organizationId: string } | null;
}

@Injectable()
export class TrelloImportService {
  constructor(
    private readonly trello: TrelloAdapter,
    private readonly sync: IntegrationSyncService,
    private readonly planPolicy: PlanPolicyService,
    private readonly config: IntegrationsConfig,
  ) {}

  getConnectionStatus(user: PermissionUser) {
    this.assertSuperAdmin(user);
    const ready = Boolean(this.config.trelloApiKey);
    return {
      authorizationReady: ready,
      status: ready ? 'READY' : 'NOT_CONFIGURED',
      message: ready
        ? 'Autoriza a Tino en Trello para ver tus tableros.'
        : NOT_CONFIGURED_MESSAGE,
    };
  }

  buildAuthorizeUrl(user: PermissionUser, returnOrigin: string) {
    this.assertSuperAdmin(user);
    const { apiKey } = this.credentials('');
    return { url: buildTrelloAuthorizeUrl(apiKey, returnOrigin, '1hour') };
  }

  async listBoards(dto: TrelloImportTokenDto, user: PermissionUser) {
    this.assertSuperAdmin(user);
    const boards = await this.trello.listContainers(
      this.credentials(dto.token),
    );

    return boards.map((board) => ({
      id: board.externalId,
      name: board.name,
      description: board.description,
      url: board.url,
    }));
  }

  async preview(dto: TrelloPreviewDto, user: PermissionUser) {
    const context = await this.buildContext(dto, user);
    return this.buildPreview(dto, context);
  }

  async executeImport(dto: TrelloExecuteImportDto, user: PermissionUser) {
    const context = await this.buildContext(dto, user);
    const organizationId = this.getOrganizationId(user);

    if (
      dto.mode === TrelloImportMode.NEW_PROJECT &&
      context.existing.containerProject
    ) {
      throw new ConflictException('Este tablero de Trello ya fue importado');
    }

    if (dto.mode === TrelloImportMode.NEW_PROJECT) {
      await this.planPolicy.assertCanCreateProject(organizationId, user);
    }

    const result = await this.sync.importSnapshot({
      provider: this.trello.provider,
      sources: this.trello.sources,
      snapshot: context.snapshot,
      organizationId,
      userId: user.id,
      targetProjectId: context.targetProject?.id,
      existing: context.existing,
      failureMessage: 'No se pudo completar la importación desde Trello.',
    });

    return {
      ...this.buildPreview(dto, context),
      result: {
        ...result,
        project: result.project || context.targetProject,
      },
    };
  }

  private async buildContext(
    dto: TrelloPreviewDto,
    user: PermissionUser,
  ): Promise<ImportContext> {
    this.assertSuperAdmin(user);
    const organizationId = this.getOrganizationId(user);

    if (dto.mode === TrelloImportMode.EXISTING_PROJECT && !dto.projectId) {
      throw new BadRequestException('Project target is required');
    }

    const snapshot = await this.trello.fetchSnapshot(
      dto.boardId,
      this.credentials(dto.token),
    );
    const [existing, targetProject] = await Promise.all([
      this.sync.findExisting(organizationId, this.trello.sources, snapshot),
      dto.mode === TrelloImportMode.EXISTING_PROJECT
        ? this.sync.findTargetProject(organizationId, dto.projectId as string)
        : Promise.resolve(null),
    ]);

    if (dto.mode === TrelloImportMode.EXISTING_PROJECT && !targetProject) {
      throw new NotFoundException('Project target not found');
    }

    return { snapshot, existing, targetProject };
  }

  private buildPreview(dto: TrelloPreviewDto, context: ImportContext) {
    return buildTrelloPreview(
      dto.mode,
      context.snapshot,
      context.existing,
      context.targetProject,
    );
  }

  private credentials(token: string): TrelloCredentials {
    const apiKey = this.config.trelloApiKey;
    if (!apiKey) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    return { apiKey, token };
  }

  private assertSuperAdmin(user: PermissionUser) {
    if (user.role?.trim() !== 'SUPERADMIN') {
      throw new ForbiddenException('Only super admins can import from Trello');
    }
  }

  private getOrganizationId(user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    return user.organizationId;
  }
}
