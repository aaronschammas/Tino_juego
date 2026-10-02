import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';
import { CommentContentDto } from './dto/comment-content.dto';
import { ListCommentsDto } from './dto/list-comments.dto';
import { TaskCommentsService } from './task-comments.service';

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(AuthGuard)
export class TaskCommentsController {
  constructor(
    private readonly comments: TaskCommentsService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  private scoped(user: PermissionUser, req?: Request) {
    return this.activeOrganization.resolveScopedUser(user, req);
  }

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Query() query: ListCommentsDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    return this.comments.list(
      projectId,
      taskId,
      query.cursor,
      await this.scoped(user, req),
    );
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CommentContentDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    return this.comments.create(
      projectId,
      taskId,
      dto,
      await this.scoped(user, req),
    );
  }

  @Patch(':commentId')
  async update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CommentContentDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    return this.comments.update(
      projectId,
      taskId,
      commentId,
      dto,
      await this.scoped(user, req),
    );
  }

  @Delete(':commentId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ) {
    return this.comments.remove(
      projectId,
      taskId,
      commentId,
      await this.scoped(user, req),
    );
  }
}
