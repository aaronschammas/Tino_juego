import { Module } from '@nestjs/common';
import { ProjectMembersService } from '../projects/project-members.service';
import { TaskCommentsController } from './task-comments.controller';
import { TaskCommentsService } from './task-comments.service';

@Module({
  controllers: [TaskCommentsController],
  providers: [TaskCommentsService, ProjectMembersService],
})
export class TaskCommentsModule {}
