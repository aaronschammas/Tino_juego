/**
 * Endpoints de integraciones. Todos pasan por `AuthGuard` y resuelven la
 * organizacion activa con `resolveScopedUser`, igual que el resto del backend.
 * Los permisos (flag, Plan Max, owner) los controlan los servicios.
 *
 * Qué contiene:
 * - `GET  /integrations/availability`: si la organizacion puede usar integraciones y por que no.
 * - `GET  /integrations/trello/authorize-url`: URL para autorizar a Tino en Trello.
 * - `POST /integrations/trello/boards`: tableros del usuario con su token.
 * - `POST /integrations/trello/preview`: vista previa + equivalencia sugerida.
 * - `POST /integrations/trello/connect`: primera importacion y alta de la conexion.
 * - `GET  /integrations/projects/:projectId`: conexion del proyecto (o `null`).
 * - `DELETE /integrations/projects/:projectId`: borra el webhook y desconecta (solo owner).
 * - `POST /integrations/projects/:projectId/live-sync`: reintenta activar la
 *   actualizacion automatica (solo owner).
 * - `PATCH /integrations/projects/:projectId/status-mappings`: cambia la
 *   equivalencia de listas (solo owner).
 * - `POST /integrations/projects/:projectId/sync`: "Sincronizar ahora", corre la
 *   revision de respaldo de ese proyecto (solo owner).
 * - `GET  /integrations/activity`: novedades de Trello para el cartel de quien
 *   mira (owner: toda la organizacion; resto: sus tareas asignadas). Si las
 *   integraciones no estan disponibles para la organizacion devuelve
 *   `available: false` sin resumen, para que la app no muestre nada.
 * - `POST /integrations/activity/seen`: cierra el cartel hasta nuevas novedades.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';
import { IntegrationAccessService } from './access/integration-access.service';
import { IntegrationActivityService } from './activity/integration-activity.service';
import { IntegrationConnectionsService } from './connections/integration-connections.service';
import {
  TrelloAuthorizeUrlQueryDto,
  TrelloConnectDto,
  TrelloConnectionPreviewDto,
  TrelloTokenDto,
  UpdateStatusMappingsDto,
} from './dto/trello-connection.dto';
import { TrelloConnectionService } from './providers/trello/trello-connection.service';
import { TrelloReconcileService } from './providers/trello/trello-reconcile.service';

@Controller('integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(
    private readonly activeOrganization: ActiveOrganizationService,
    private readonly access: IntegrationAccessService,
    private readonly connections: IntegrationConnectionsService,
    private readonly trello: TrelloConnectionService,
    private readonly reconcile: TrelloReconcileService,
    private readonly activity: IntegrationActivityService,
  ) {}

  @Get('availability')
  async availability(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.access.getAvailability(scoped, scoped.organizationId);
  }

  @Get('trello/authorize-url')
  async trelloAuthorizeUrl(
    @Query() query: TrelloAuthorizeUrlQueryDto,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.buildAuthorizeUrl(
      scoped,
      scoped.organizationId,
      query.returnOrigin,
    );
  }

  @Post('trello/boards')
  async trelloBoards(
    @Body() dto: TrelloTokenDto,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.listBoards(scoped, scoped.organizationId, dto.token);
  }

  @Post('trello/preview')
  async trelloPreview(
    @Body() dto: TrelloConnectionPreviewDto,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.preview(dto, scoped, scoped.organizationId);
  }

  @Post('trello/connect')
  async trelloConnect(
    @Body() dto: TrelloConnectDto,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.connect(dto, scoped, scoped.organizationId);
  }

  @Get('projects/:projectId')
  async projectConnection(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    const connection = await this.connections.findByProject(
      scoped,
      scoped.organizationId,
      projectId,
    );
    return { connection };
  }

  @Delete('projects/:projectId')
  async disconnect(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.disconnect(scoped, scoped.organizationId, projectId);
  }

  @Post('projects/:projectId/live-sync')
  async enableLiveSync(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.enableLiveSync(scoped, scoped.organizationId, projectId);
  }

  @Post('projects/:projectId/sync')
  async syncNow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.reconcile.reconcileProject(
      scoped,
      scoped.organizationId,
      projectId,
    );
  }

  @Patch('projects/:projectId/status-mappings')
  async updateStatusMappings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateStatusMappingsDto,
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.trello.updateStatusMappings(
      scoped,
      scoped.organizationId,
      projectId,
      dto.statusMapping,
    );
  }

  @Get('activity')
  async activitySummary(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    const availability = await this.access.getAvailability(
      scoped,
      scoped.organizationId,
    );
    if (!availability.enabled) return { available: false, summary: null };
    const summary = await this.activity.summarizeForViewer(
      scoped,
      scoped.organizationId,
    );
    return { available: true, summary };
  }

  @Post('activity/seen')
  async activitySeen(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ) {
    const scoped = await this.scope(user, request);
    return this.activity.markSeen(scoped, scoped.organizationId);
  }

  private scope(user: PermissionUser, request: Request) {
    return this.activeOrganization.resolveScopedUser(user, request);
  }
}
