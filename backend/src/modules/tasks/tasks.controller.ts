import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/createTaskDto';
import { UpdateTaskDto } from './dto/updateTaskDto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import type { PermissionUser } from 'src/common/permissions';

@Controller('projects/:projectId/tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly activeOrganization: ActiveOrganizationService,
  ) {}

  // Crear tarea
  @Post()
  async createTask(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.createTask(projectId, dto, scopedUser);
  }

  // Listar tareas del proyecto
  @Get()
  async getTasksByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.getTasksByProject(projectId, scopedUser);
  }

  // Obtener tarea por ID
  @Get(':taskId')
  async getTaskById(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.getTaskById(projectId, taskId, scopedUser);
  }

  // Actualizar tarea
  @Patch(':taskId')
  async updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.updateTask(projectId, taskId, dto, scopedUser);
  }

  @Patch(':taskId/status')
  async updateTaskStatus(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.updateTaskStatus(
      projectId,
      taskId,
      dto.status,
      scopedUser,
    );
  }

  @Delete(':taskId')
  async deleteTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: PermissionUser,
    @Req() req?: Request,
  ): Promise<unknown> {
    const scopedUser = await this.activeOrganization.resolveScopedUser(
      user,
      req,
    );
    return this.tasksService.deleteTask(projectId, taskId, scopedUser);
  }
}
