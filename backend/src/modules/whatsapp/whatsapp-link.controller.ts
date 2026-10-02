/**
 * Endpoints que usa la app para conectar y desconectar WhatsApp.
 *
 * Son los que consume la tarjeta "WhatsApp" del perfil. Todos pasan por
 * `AuthGuard` y resuelven la organización activa igual que el resto del backend,
 * con `resolveScopedUser`. El control de owner y de plan Max lo hace
 * `WhatsAppLinkService.assertCanManage()`, así que vale tanto acá como cuando
 * llega un mensaje.
 *
 * Qué contiene:
 * - `createCode()`: devuelve un código nuevo y el link `wa.me` ya armado, que es
 *   lo que el perfil muestra como botón o QR. El frontend no necesita conocer el
 *   número de Tino.
 * - `status()`: el "Sí / No" con la fecha y quién activó la función.
 * - `unlink()`: corta el acceso al instante.
 */
import { Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';
import {
  WhatsAppLinkService,
  type WhatsAppLinkCodeResult,
  type WhatsAppLinkStatus,
} from './whatsapp-link.service';

@Controller('whatsapp')
@UseGuards(AuthGuard)
export class WhatsAppLinkController {
  constructor(
    private readonly links: WhatsAppLinkService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Post('link-code')
  async createCode(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ): Promise<WhatsAppLinkCodeResult> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      request,
    );
    return this.links.createLinkCode(scopedUser, scopedUser.organizationId);
  }

  @Get('link')
  async status(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ): Promise<WhatsAppLinkStatus> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      request,
    );
    await this.links.assertCanManage(scopedUser, scopedUser.organizationId);
    return this.links.getStatus(scopedUser.organizationId);
  }

  @Delete('link')
  async unlink(
    @CurrentUser() user: PermissionUser,
    @Req() request: Request,
  ): Promise<WhatsAppLinkStatus> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      request,
    );
    await this.links.assertCanManage(scopedUser, scopedUser.organizationId);
    await this.links.unlink(scopedUser.organizationId);
    return { linked: false, linkedAt: null, linkedBy: null };
  }
}
