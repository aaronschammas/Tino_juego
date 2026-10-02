import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ProjectRole } from '@prisma/client';
import {
  canManageProject,
  hasProjectAccess,
  isOrgOwner,
  isProjectMember,
  isSuperAdmin,
  PermissionUser,
} from 'src/common/permissions';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica si un usuario es miembro de un proyecto
   */
  async isMemberOfProject(
    user: PermissionUser,
    projectId: string,
  ): Promise<boolean> {
    return isProjectMember(user, projectId, this.prisma);
  }

  async isOrgOwner(user: PermissionUser, organizationId: string): Promise<boolean> {
    return isOrgOwner(user, organizationId, this.prisma);
  }

  async hasProjectAccess(user: PermissionUser, projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!project) {
      return false;
    }

    if (!isSuperAdmin(user) && user.organizationId !== project.organizationId) {
      return false;
    }

    return hasProjectAccess(user, project, this.prisma);
  }

  async canManageProject(user: PermissionUser, projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      return false;
    }

    if (!isSuperAdmin(user) && user.organizationId !== project.organizationId) {
      return false;
    }

    return canManageProject(user, projectId, this.prisma);
  }

  /**
   * Obtiene el rol de un usuario en un proyecto
   */
  async getUserRoleInProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectRole | null> {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return member?.role || null;
  }

  /**
   * Verifica si un usuario es OWNER de un proyecto
   */
  async isOwnerOfProject(userId: string, projectId: string): Promise<boolean> {
    const role = await this.getUserRoleInProject(userId, projectId);
    return role === ProjectRole.OWNER;
  }

  /**
   * Obtiene todos los miembros de un proyecto
   * Valida que el requester sea miembro del proyecto
   */
  async getProjectMembers(projectId: string, user: PermissionUser) {
    // Validar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!isSuperAdmin(user) && user.organizationId !== project.organizationId) {
      throw new NotFoundException('Project not found');
    }

    // SECURITY: Validar acceso por membresía o por rol owner de la organización o admin
    const hasAccess = await this.hasProjectAccess(user, projectId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastname: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Agrega un miembro a un proyecto
   * Solo OWNER puede hacer esto
   */
  async addMemberToProject(
    projectId: string,
    userIdToAdd: string,
    user: PermissionUser,
  ) {
    // Validar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!isSuperAdmin(user) && user.organizationId !== project.organizationId) {
      throw new NotFoundException('Project not found');
    }

    // Validar que el que invita es OWNER
    const canManage = await this.canManageProject(user, projectId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project owner can add members',
      );
    }

    // Validar que el usuario a agregar existe
    const userToAdd = await this.prisma.user.findUnique({
      where: { id: userIdToAdd },
      select: { id: true, isActive: true, organizationId: true }
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found');
    }

    if (!userToAdd.isActive) {
      throw new BadRequestException('Cannot add inactive user');
    }

    const targetMembership =
      await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: project.organizationId,
            userId: userIdToAdd,
          },
        },
      });

    if (!targetMembership) {
      throw new ForbiddenException(
        'El usuario debe ser miembro activo de la organización antes de agregarse al proyecto.',
      );
    }

    // Validar que no sea miembro ya
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userIdToAdd,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member');
    }

    // Agregar miembro
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: userIdToAdd,
        role: ProjectRole.MEMBER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastname: true,
          },
        },
      },
    });
  }

  /**
   * Quita un miembro de un proyecto
   * Solo OWNER puede hacer esto
   * No se puede quitar al último OWNER
   */
  async removeMemberFromProject(
    projectId: string,
    userIdToRemove: string,
    user: PermissionUser,
  ) {
    // Validar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!isSuperAdmin(user) && user.organizationId !== project.organizationId) {
      throw new NotFoundException('Project not found');
    }

    // Validar que el que quita es OWNER
    const canManage = await this.canManageProject(user, projectId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project owner can remove members',
      );
    }

    // Validar que el miembro existe
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userIdToRemove,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in project');
    }

    // Validar que no sea el último OWNER
    if (member.role === ProjectRole.OWNER) {
      const ownerCount = await this.prisma.projectMember.count({
        where: {
          projectId,
          role: ProjectRole.OWNER,
        },
      });

      if (ownerCount === 1) {
        throw new BadRequestException(
          'Cannot remove the last owner of the project',
        );
      }
    }

    // Quitar miembro
    return this.prisma.$transaction(async (tx) => {
      const removedMember = await tx.projectMember.delete({
        where: {
          projectId_userId: {
            projectId,
            userId: userIdToRemove,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              lastname: true,
            },
          },
        },
      });

      await tx.timeEntry.updateMany({
        where: {
          projectId,
          userId: userIdToRemove,
          endTime: null,
        },
        data: {
          endTime: new Date(),
        },
      });

      return removedMember;
    });
  }
}
