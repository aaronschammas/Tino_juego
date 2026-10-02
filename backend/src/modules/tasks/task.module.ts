import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksQueryController } from './tasks-query.controller';
import { ProjectMembersService } from '../projects/project-members.service';

@Module({
  controllers: [TasksController, TasksQueryController],
  providers: [TasksService, ProjectMembersService],
})
export class TasksModule {}
