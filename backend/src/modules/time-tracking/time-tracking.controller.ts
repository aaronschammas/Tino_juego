import { Controller, Post, Patch, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TimeTrackingService } from './time-tracking.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { StartTimeDto } from './dto/startTimeDto';
import { LinkTimeEntryDto } from './dto/linkTimeEntryDto';
import { StopTimeDto } from './dto/stopTimeDto';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { TimeSummaryDto } from './dto/time-summary.dto';
import type { PermissionUser } from 'src/common/permissions';

@Controller('time')
@UseGuards(AuthGuard)
export class TimeTrackingController {
  constructor(
    private readonly timeService: TimeTrackingService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Post('start')
  async startTime(@Body() dto: StartTimeDto, @CurrentUser() user: any, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    const result = await this.timeService.startTime(dto.projectId, scopedUser, dto.taskId, dto.targetMinutes);
    return { ...result, serverTime: new Date().toISOString() };
  }

  @Post('stop')
  async stopTime(@CurrentUser() user: any, @Req() req: Request, @Body() body?: StopTimeDto) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    const result = await this.timeService.stopTime(scopedUser, body?.endTime);
    return { ...result, serverTime: new Date().toISOString() };
  }

  @Get('now')
  async getNow() {
    return { serverTime: new Date().toISOString() };
  }

  @Get('active')
  async getActive(@CurrentUser() user: any, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    const result = await this.timeService.getActiveTime(scopedUser);
    if (!result) return null;
    return { ...result, serverTime: new Date().toISOString() };
  }

  @Post('acknowledge-expiration')
  async acknowledgeExpiration(@CurrentUser() user: any, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    this.timeService.acknowledgeExpired(scopedUser);
    return { success: true };
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.timeService.getHistory(scopedUser, limit ? Number(limit) : undefined);
  }

  @Get('summary')
  async getSummary(@Query() query: TimeSummaryDto, @CurrentUser() user: PermissionUser, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    return this.timeService.getSummary(scopedUser, query);
  }

  @Patch('heartbeat')
  async heartbeat(@CurrentUser() user: any, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    const result = await this.timeService.heartbeat(scopedUser);
    return { ...result, serverTime: new Date().toISOString() };
  }

  @Patch('pause')
  async pause(@CurrentUser() user: any, @Req() req: Request) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(user, req);
    const result = await this.timeService.pauseTime(scopedUser);
    return { ...result, serverTime: new Date().toISOString() };
  }

  @Patch(':id/link')
  linkTime(
    @Param('id') id: string,
    @Body() dto: LinkTimeEntryDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.activeOrganization
      .resolveScopedUser(user, req)
      .then((scopedUser) => this.timeService.linkTimeEntry(id, dto, scopedUser));
  }
}
