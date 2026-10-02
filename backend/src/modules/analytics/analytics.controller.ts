import { Controller, Get, Param, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { AnalyticsReportService } from './analytics-report.service';
import type { PermissionUser } from 'src/common/permissions';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { MobileSummaryDto } from './dto/mobile-summary.dto';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly dashboardService: AnalyticsDashboardService,
    private readonly reportService: AnalyticsReportService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Get('bi')
  async getBIData(
    @CurrentUser() user: PermissionUser,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.analyticsService.getBIData(scopedUser, projectId, startDate, endDate);
  }

  @Get('overview')
  async getOverview(
    @CurrentUser() user: PermissionUser,
    @Query('period') period?: 'week' | 'month' | 'total',
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.analyticsService.getOverview(scopedUser, period);
  }

  @Get('projects/:projectId')
  async getProjectAnalytics(
    @Param('projectId') projectId: string,
    @CurrentUser() user: PermissionUser,
    @Query('period') period?: 'week' | 'month' | 'total',
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.analyticsService.getProjectAnalytics(projectId, scopedUser, period);
  }

  @Get('users/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUserAnalytics(
    @Param('userId') userId: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.analyticsService.getUserAnalytics(userId, scopedUser);
  }

  @Get('dashboard/summary')
  getDashboardSummary(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getSummary(scopedUser, filters));
  }

  @Get('mobile-summary')
  getMobileSummary(
    @CurrentUser() user: PermissionUser,
    @Query() filters: MobileSummaryDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization
      .resolveScopedUser(user, req)
      .then((scopedUser) =>
        this.dashboardService.getMobileSummary(scopedUser, filters),
      );
  }

  @Get('dashboard/tasks')
  getDashboardTasks(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getTasks(scopedUser, filters));
  }

  @Get('dashboard/time')
  getDashboardTime(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getTime(scopedUser, filters));
  }

  @Get('dashboard/heatmap')
  getDashboardHeatmap(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getHeatmap(scopedUser, filters));
  }

  @Get('dashboard/projects')
  getDashboardProjects(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getProjects(scopedUser, filters));
  }

  @Get('dashboard/users')
  getDashboardUsers(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req: Request,
  ) {
    return this.activeOrganization.resolveScopedUser(user, req)
      .then((scopedUser) => this.dashboardService.getUsers(scopedUser, filters));
  }

  @Get('report/preview')
  async getReportPreview(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.reportService.getPreview(scopedUser, filters);
  }

  @Get('report/pdf')
  async getReportPdf(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.reportService.sendPdf(scopedUser, filters, res);
  }

  @Get('report/excel')
  async getReportExcel(
    @CurrentUser() user: PermissionUser,
    @Query() filters: DashboardFiltersDto,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.reportService.sendExcel(scopedUser, filters, res);
  }
}
