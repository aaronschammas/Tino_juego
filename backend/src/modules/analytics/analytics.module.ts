import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ProjectMembersService } from '../projects/project-members.service';
import { AnalyticsDashboardService } from './analytics-dashboard.service';
import { AnalyticsReportService } from './analytics-report.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsDashboardService,
    AnalyticsReportService,
    ProjectMembersService,
  ],
})
export class AnalyticsModule {}
