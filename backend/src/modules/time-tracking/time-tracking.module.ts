import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingScheduler } from './time-tracking.scheduler';
import { ProjectMembersService } from '../projects/project-members.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService, TimeTrackingScheduler, ProjectMembersService],
})
export class TimeTrackingModule {}
