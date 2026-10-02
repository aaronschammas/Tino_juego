import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateUserMemberDto } from './dto/create-user-member.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get all organizations with their members and plans
   * GET /admin/orgs
   */
  @Get('orgs')
  async getAllOrganizations() {
    return this.adminService.getAllOrganizations();
  }

  /**
   * Create a new organization
   * POST /admin/orgs
   */
  @Post('orgs')
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  /**
   * Update an organization
   * PUT /admin/orgs/:id
   */
  @Put('orgs/:id')
  async updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.adminService.updateOrganization(id, dto);
  }

  /**
   * Delete an organization
   * DELETE /admin/orgs/:id
   */
  @Delete('orgs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(@Param('id') id: string) {
    return this.adminService.deleteOrganization(id);
  }

  /**
   * Create a user and add to organization
   * POST /admin/orgs/:id/members
   */
  @Post('orgs/:id/members')
  async addMemberToOrganization(@Param('id') orgId: string, @Body() dto: CreateUserMemberDto) {
    return this.adminService.addMemberToOrganization(orgId, dto);
  }

  /**
   * Remove a member from an organization
   * DELETE /admin/orgs/:id/members/:userId
   */
  @Delete('orgs/:id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMemberFromOrganization(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeMemberFromOrganization(orgId, userId);
  }

  /**
   * Update a user's data
   * PUT /admin/users/:userId
   */
  @Put('users/:userId')
  async updateUser(@Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(userId, dto);
  }

  /**
   * Get all plans
   * GET /admin/plans
   */
  @Get('plans')
  async getAllPlans() {
    return this.adminService.getAllPlans();
  }

  /**
   * Create a new plan
   * POST /admin/plans
   */
  @Post('plans')
  async createPlan(@Body() dto: any) {
    return this.adminService.createPlan(dto);
  }

  /**
   * Update a plan
   * PUT /admin/plans/:id
   */
  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updatePlan(id, dto);
  }

  /**
   * Delete a plan
   * DELETE /admin/plans/:id
   */
  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }
}
