import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { CreateProjectDto } from './dto/create-project';
import { UpdateProjectDto } from './dto/update-project';
import { AddMemberDto } from './dto/add-member.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectMembers: ProjectMembersService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Post()
  async createProject(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectsService.createProject(dto, scopedUser);
  }

  @Get()
  async getProjects(@CurrentUser() user: PermissionUser, @Req() req?: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectsService.getProjects(
      scopedUser,
      scopedUser.organizationId,
    );
  }

  @Get(':id')
  async getProjectById(
    @Param('id') id: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectsService.getProjectById(id, scopedUser);
  }

  @Patch(':id')
  async updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectsService.updateProject(id, dto, scopedUser);
  }

  @Delete(':id')
  async deleteProject(
    @Param('id') id: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectsService.deleteProject(id, scopedUser);
  }

  // =========================
  // PROJECT MEMBERS ENDPOINTS
  // =========================

  @Get(':id/members')
  async getProjectMembers(
    @Param('id') id: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    // Validates membership internally before returning members
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectMembers.getProjectMembers(id, scopedUser);
  }

  @Post(':id/members')
  async addMemberToProject(
    @Param('id') projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectMembers.addMemberToProject(
      projectId,
      dto.userIdToAdd,
      scopedUser,
    );
  }

  @Delete(':id/members/:userId')
  async removeMemberFromProject(
    @Param('id') projectId: string,
    @Param('userId') userIdToRemove: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.projectMembers.removeMemberFromProject(
      projectId,
      userIdToRemove,
      scopedUser,
    );
  }
}
