import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { PlanPolicyModule } from 'src/common/plans/plan-policy.module';

@Module({
  imports: [PlanPolicyModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
