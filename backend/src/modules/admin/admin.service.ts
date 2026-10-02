import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        users: true,
        plan: true,
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async createOrganization(dto: any) {
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        planId: dto.planId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateOrganization(id: string, dto: any) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name,
        planId: dto.planId,
        isActive: dto.isActive,
      },
    });
  }

  async deleteOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    // Podríamos hacer soft-delete si es necesario
    return this.prisma.organization.delete({ where: { id } });
  }

  async addMemberToOrganization(orgId: string, dto: any) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    
    // Validar unicidad de email
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Obtener rol USER por defecto
    const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new BadRequestException('Configuración de roles no inicializada');

    const hash = await bcrypt.hash(dto.password, 10);
    const userId = randomUUID();

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: normalizedEmail,
        name: dto.name,
        lastname: dto.lastname,
        password: hash,
        roleId: userRole.id,
        isActive: true,
        organizationId: orgId, // Vincular a la org
      },
    });

    // Crear membresía
    await this.prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: userId,
        role: dto.role || 'ORG_MEMBER',
      },
    });

    return user;
  }

  async removeMemberFromOrganization(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Miembro no encontrado en la organización');
    }

    return this.prisma.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: userId,
        },
      },
    });
  }

  async updateUser(userId: string, dto: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.lastname) data.lastname = dto.lastname;
    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      // Validar unicidad si cambia el email
      if (normalizedEmail !== user.email.toLowerCase()) {
        const existing = await this.prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existing) {
          throw new BadRequestException('El email ya está registrado');
        }
      }
      data.email = normalizedEmail;
    }
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getAllPlans() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async createPlan(dto: any) {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        maxUsers: dto.maxUsers,
        maxProjects: dto.maxProjects,
        hasAnalytics: dto.hasAnalytics ?? false,
        hasSso: dto.hasSso ?? false,
        hasPrioritySupport: dto.hasPrioritySupport ?? false,
        hasEmailInvites: dto.hasEmailInvites ?? false,
        hasAdvancedPerms: dto.hasAdvancedPerms ?? false,
        hasAudit: dto.hasAudit ?? false,
      },
    });
  }

  async updatePlan(id: string, dto: any) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        maxUsers: dto.maxUsers,
        maxProjects: dto.maxProjects,
        hasAnalytics: dto.hasAnalytics,
        hasSso: dto.hasSso,
        hasPrioritySupport: dto.hasPrioritySupport,
        hasEmailInvites: dto.hasEmailInvites,
        hasAdvancedPerms: dto.hasAdvancedPerms,
        hasAudit: dto.hasAudit,
      },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    const orgs = await this.prisma.organization.findFirst({ where: { planId: id } });
    if (orgs) {
      throw new BadRequestException('No se puede eliminar el plan porque está en uso por organizaciones');
    }

    return this.prisma.plan.delete({ where: { id } });
  }
}
