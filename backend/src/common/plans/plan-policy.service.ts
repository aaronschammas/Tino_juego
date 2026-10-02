import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { isAdmin, PermissionUser } from 'src/common/permissions';

@Injectable()
export class PlanPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanForOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { plan: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization.plan;
  }

  async assertPlanIsSelectable(planName: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planName} not found`);
    }
  }

  async canCreateProject(organizationId: string, user?: PermissionUser): Promise<boolean> {
    if (user && isAdmin(user)) return true;

    const plan = await this.getPlanForOrganization(organizationId);
    if (!plan) return true;

    if (plan.maxProjects === null) return true;

    const activeProjects = await this.prisma.project.count({
      where: {
        organizationId,
        isActive: true,
      },
    });

    return activeProjects < plan.maxProjects;
  }

  async assertCanCreateProject(organizationId: string, user?: PermissionUser) {
    const plan = await this.getPlanForOrganization(organizationId);
    const canCreate = await this.canCreateProject(organizationId, user);

    if (!canCreate) {
      throw new BadRequestException(
        `Tu plan ${plan?.title || 'actual'} permite hasta ${plan?.maxProjects} proyectos`,
      );
    }
  }

  async canInviteUser(organizationId: string, user?: PermissionUser): Promise<boolean> {
    if (user && isAdmin(user)) return true;

    const plan = await this.getPlanForOrganization(organizationId);
    return plan?.hasEmailInvites ?? false;
  }

  async assertCanInviteUser(organizationId: string, user?: PermissionUser) {
    const canInvite = await this.canInviteUser(organizationId, user);

    if (!canInvite) {
      throw new BadRequestException(
        'Las invitaciones no están disponibles en tu plan actual',
      );
    }
  }

  async canAddMember(organizationId: string, user?: PermissionUser): Promise<boolean> {
    if (user && isAdmin(user)) return true;

    const plan = await this.getPlanForOrganization(organizationId);
    if (!plan) return true;

    if (plan.maxUsers === null) return true;

    const memberCount = await this.prisma.organizationMembership.count({
      where: { organizationId },
    });

    return memberCount < plan.maxUsers;
  }

  async assertCanAddMember(organizationId: string, user?: PermissionUser) {
    const plan = await this.getPlanForOrganization(organizationId);
    const canAdd = await this.canAddMember(organizationId, user);

    if (!canAdd) {
      throw new BadRequestException(
        `Tu plan ${plan?.title || 'actual'} permite hasta ${plan?.maxUsers} usuarios por organización`,
      );
    }
  }
}
