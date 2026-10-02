import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';
import { ListTasksDto } from './dto/list-tasks.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksQueryController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  @Get()
  async list(
    @Query() query: ListTasksDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.listAccessibleTasks(query, scopedUser);
  }
}
