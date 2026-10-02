import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectMembersService } from './project-members.service';
import { CreateProjectDto } from './dto/create-project';
import { UpdateProjectDto } from './dto/update-project';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { canCreateProject, isOrgOwner, PermissionUser } from 'src/common/permissions';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectMembers: ProjectMembersService,
    private readonly planPolicy: PlanPolicyService,
  ) {}

  async createProject(dto: CreateProjectDto, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const canCreate = await canCreateProject(
      user,
      user.organizationId,
      this.prisma,
    );

    if (!canCreate) {
      throw new ForbiddenException(
        'Only organization owners can create projects'
      );
    }

    const organizationId = user.organizationId;
    await this.planPolicy.assertCanCreateProject(organizationId);

    // Evitar duplicados "en mi universo": si ya soy miembro de un proyecto activo con ese nombre
    const existingProject = await this.prisma.project.findFirst({
      where: {
        name: dto.name,
        isActive: true,
        organizationId,
        members: { some: { userId: user.id } },
      },
    });

    if (existingProject) {
      throw new ConflictException('You already have a project with this name');
    }

    // ATOMIC: Create project and add creator as project OWNER
    const project = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          ...dto,
          ownerId: user.id,
          organizationId,
        },
      });

      // Add project owner as OWNER
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return newProject;
    });

    return project;
  }

  async getProjects(user: PermissionUser, userOrgId: string) {
    if (!userOrgId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const isOrgOwnerUser = await isOrgOwner(user, userOrgId, this.prisma);

    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        organizationId: userOrgId,
        ...(isOrgOwnerUser
          ? {}
          : { members: { some: { userId: user.id } } }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        dueDate: true,
        priority: true,
        ownerId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (projects.length === 0) {
      return [];
    }

    const taskCounts = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: {
        organizationId: userOrgId,
        projectId: { in: projects.map((project) => project.id) },
        archivedAt: null,
      },
      _count: { _all: true },
    });

    const statsByProject = new Map<string, { total: number; completed: number }>();
    for (const row of taskCounts) {
      const stats = statsByProject.get(row.projectId) ?? { total: 0, completed: 0 };
      stats.total += row._count._all;
      if (row.status === 'DONE') {
        stats.completed += row._count._all;
      }
      statsByProject.set(row.projectId, stats);
    }

    return projects.map((project) => ({
      ...project,
      taskStats: statsByProject.get(project.id) ?? { total: 0, completed: 0 },
    }));
  }

  async getProjectById(id: string, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const organizationId = user.organizationId;
    const hasAccess = await this.projectMembers.hasProjectAccess(user, id);
    if (!hasAccess) throw new NotFoundException('Project not found');

    const project = await this.prisma.project.findFirst({
      where: { id, isActive: true, organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, lastname: true },
            },
          },
        },
        timeEntries: {
          where: { taskId: null, endTime: { not: null } },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            totalPausedMs: true,
            userId: true,
            user: {
              select: { name: true, lastname: true, email: true },
            },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async updateProject(id: string, dto: UpdateProjectDto, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const organizationId = user.organizationId;
    const canManage = await this.projectMembers.canManageProject(user, id);
    if (!canManage) {
      throw new ForbiddenException('Only project owner can update the project');
    }

    const project = await this.prisma.project.findFirst({
      where: { id, isActive: true, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async deleteProject(id: string, user: PermissionUser) {
    if (!user.organizationId) {
      throw new BadRequestException('User must belong to an organization');
    }
    const organizationId = user.organizationId;
    const canManage = await this.projectMembers.canManageProject(user, id);
    if (!canManage) {
      throw new ForbiddenException('Only project owner can delete the project');
    }

    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.delete({
      where: { id },
    });
  }
}

