/**
 * Endpoints de la importacion manual de Trello, solo para SUPERADMIN.
 *
 * - `GET  /trello-import/connection`: si la autorizacion con Trello esta disponible.
 * - `GET  /trello-import/authorize-url`: URL de la ventana de Trello para el
 *   origen del frontend (`returnOrigin`, validado como URL http/https).
 * - `POST /trello-import/boards`: tableros de la cuenta que autorizo (`token`).
 * - `POST /trello-import/preview`: vista previa sin escribir nada.
 * - `POST /trello-import/import`: importa el tablero.
 */
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { PermissionUser } from 'src/common/permissions';
import { TrelloAuthorizeUrlQueryDto } from 'src/modules/integrations/dto/trello-connection.dto';
import { TrelloImportService } from './trello-import.service';
import {
  TrelloExecuteImportDto,
  TrelloImportTokenDto,
  TrelloPreviewDto,
} from './dto/trello-import.dto';

@Controller('trello-import')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class TrelloImportController {
  constructor(private readonly trelloImportService: TrelloImportService) {}

  @Get('connection')
  getConnectionStatus(@CurrentUser() user: PermissionUser) {
    return this.trelloImportService.getConnectionStatus(user);
  }

  @Get('authorize-url')
  authorizeUrl(
    @Query() query: TrelloAuthorizeUrlQueryDto,
    @CurrentUser() user: PermissionUser,
  ) {
    return this.trelloImportService.buildAuthorizeUrl(user, query.returnOrigin);
  }

  @Post('boards')
  async listBoards(
    @Body() dto: TrelloImportTokenDto,
    @CurrentUser() user: PermissionUser,
  ) {
    return this.trelloImportService.listBoards(dto, user);
  }

  @Post('preview')
  async preview(
    @Body() dto: TrelloPreviewDto,
    @CurrentUser() user: PermissionUser,
  ) {
    return this.trelloImportService.preview(dto, user);
  }

  @Post('import')
  async executeImport(
    @Body() dto: TrelloExecuteImportDto,
    @CurrentUser() user: PermissionUser,
  ) {
    return this.trelloImportService.executeImport(dto, user);
  }
}
