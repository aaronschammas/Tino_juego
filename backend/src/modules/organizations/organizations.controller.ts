import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMembersDto } from './dto/invite-members.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateMemberProjectsDto } from './dto/update-member-projects.dto';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  /**
   * Create a new organization
   * POST /orgs
   */
  @Post()
  async createOrganization(
    @CurrentUser() user: PermissionUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(user.id, dto);
  }

  /**
   * Get current organization info
   * GET /orgs/me
   */
  @Get('me')
  async getMyOrganization(
    @CurrentUser() user: PermissionUser,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.getOrganizationById(
      scopedUser,
      scopedUser.organizationId,
    );
  }

  /**
   * Get organization members
   * GET /orgs/members
   */
  @Get('members')
  async getMembers(@CurrentUser() user: PermissionUser, @Req() req?: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.getMembers(
      scopedUser,
      scopedUser.organizationId,
    );
  }

  /**
   * Invite a member
   * POST /orgs/invites
   */
  @Post('invites')
  async inviteMember(
    @CurrentUser() user: PermissionUser,
    @Body() dto: InviteMembersDto,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.inviteMember(
      scopedUser,
      scopedUser.organizationId,
      dto,
    );
  }

  /**
   * List invitations for organization
   * GET /orgs/invites
   */
  @Get('invites')
  async getInvitations(
    @CurrentUser() user: PermissionUser,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.getInvitations(
      scopedUser,
      scopedUser.organizationId,
    );
  }

  /**
   * Resend invitation
   * POST /orgs/invites/:inviteId/resend
   */
  @Post('invites/:inviteId/resend')
  async resendInvite(
    @CurrentUser() user: PermissionUser,
    @Param('inviteId') inviteId: string,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.resendInvite(
      scopedUser,
      scopedUser.organizationId,
      inviteId,
    );
  }

  /**
   * Revoke invitation
   * DELETE /orgs/invites/:inviteId
   */
  @Delete('invites/:inviteId')
  async revokeInvite(
    @CurrentUser() user: PermissionUser,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.revokeInvite(
      scopedUser,
      scopedUser.organizationId,
      inviteId,
    );
  }

  /**
   * Update member role
   * PATCH /orgs/members/:userId
   */
  @Patch('members/:userId')
  async updateMemberRole(
    @CurrentUser() user: PermissionUser,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.updateMemberRole(
      scopedUser,
      scopedUser.organizationId,
      targetUserId,
      dto,
    );
  }

  /**
   * Update current organization plan
   * PATCH /orgs/plan
   * @param user Authenticated user from request context.
   * @param dto Payload containing the selected plan.
   * @returns Organization summary with the persisted plan.
   */
  @Patch('plan')
  async updateOrganizationPlan(
    @CurrentUser() user: PermissionUser,
    @Body() dto: UpdateOrganizationPlanDto,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.updateOrganizationPlan(
      scopedUser,
      scopedUser.organizationId,
      dto,
    );
  }

  /**
   * Remove member
   * DELETE /orgs/members/:userId
   */
  @Delete('members/:userId')
  async removeMember(
    @CurrentUser() user: PermissionUser,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.removeMember(
      scopedUser,
      scopedUser.organizationId,
      targetUserId,
    );
  }

  /**
   * Update member project assignments
   * PUT /orgs/members/:userId/projects
   */
  @Put('members/:userId/projects')
  async updateMemberProjects(
    @CurrentUser() user: PermissionUser,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberProjectsDto,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.updateMemberProjects(
      scopedUser,
      scopedUser.organizationId,
      targetUserId,
      dto.projectIds,
    );
  }

  /**
   * Remove member from a specific project
   * DELETE /orgs/members/:userId/projects/:projectId
   */
  @Delete('members/:userId/projects/:projectId')
  async removeMemberFromProject(
    @CurrentUser() user: PermissionUser,
    @Param('userId') targetUserId: string,
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.removeMemberFromProject(
      scopedUser,
      scopedUser.organizationId,
      targetUserId,
      projectId,
    );
  }

  /**
   * Sync organization memberships
   * Ensures all org members have project membership (fixes task assignment bug)
   * POST /orgs/sync-memberships
   */
  @Post('sync-memberships')
  async syncMemberships(
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.organizationsService.syncOrganizationMemberships(
      scopedUser,
      scopedUser.organizationId,
    );
  }
}

/**
 * Public endpoint for accepting invites
 * This is separated so it doesn't require JWT auth
 */
@Controller('invites')
export class InvitesPublicController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':token')
  async getInvitePreview(@Param('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.organizationsService.getInvitePreview(token);
  }

  /**
   * Accept an invitation
   * POST /invites/:token/accept
   */
  @Post(':token/accept')
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.organizationsService.acceptInvite(token, dto);
  }
}
