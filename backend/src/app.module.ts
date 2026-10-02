import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/Projects.module';
import { TasksModule } from './modules/tasks/task.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PlansModule } from './modules/plans/plans.module';
import { AdminModule } from './modules/admin/admin.module';
import { TrelloImportModule } from './modules/trello-import/trello-import.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { HealthController } from './health.controller';
import { ActiveOrganizationModule } from './common/active-organization/active-organization.module';
import { TaskCommentsModule } from './modules/task-comments/task-comments.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ActiveOrganizationModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    TaskCommentsModule,
    TimeTrackingModule,
    AnalyticsModule,
    OrganizationsModule,
    PlansModule,
    AdminModule,
    TrelloImportModule,
    IntegrationsModule,
    AssistantModule,
    WhatsAppModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
})
export class AppModule {}
