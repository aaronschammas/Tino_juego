import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { PermissionUser, isSuperAdmin } from 'src/common/permissions';

export const ACTIVE_ORGANIZATION_COOKIE = 'active_organization_id';
export const ACTIVE_ORGANIZATION_HEADER = 'x-organization-id';

export interface ActiveOrganizationContext {
  user: {
    id: string;
    email: string;
    name: string;
    lastname: string;
    role: string;
    googleStatus?: boolean;
    isActive?: boolean;
    organizationId?: string | null;
    organizationPlan?: any;
    hasInternalPassword?: boolean;
    requiresInternalPasswordSetup?: boolean;
  };
  activeOrganization: {
    id: string;
    name: string;
    plan: any | null;
    isActive: boolean;
    createdAt: Date;
  } | null;
  activeMembership: {
    id: string;
    role: string;
  } | null;
  memberships: Array<{
    membershipId: string;
    organizationId: string;
    organizationName: string;
    role: string;
    plan: any | null;
    isActive: boolean;
  }>;
  features: {
    canInviteMembers: boolean;
    maxProjects: number | null;
    maxMembers: number | null;
    hasAnalytics: boolean;
    hasSso: boolean;
    hasPrioritySupport: boolean;
    hasAdvancedPerms: boolean;
    hasAudit: boolean;
    hasWhatsApp: boolean;
    hasIntegrations: boolean;
  };
}

@Injectable()
export class ActiveOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  readRequestedOrganizationId(request?: any): {
    organizationId: string | null;
    explicit: boolean;
  } {
    const headerValue = request?.headers?.[ACTIVE_ORGANIZATION_HEADER];
    const headerOrganizationId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (
      typeof headerOrganizationId === 'string' &&
      headerOrganizationId.trim()
    ) {
      return { organizationId: headerOrganizationId.trim(), explicit: true };
    }

    const cookieOrganizationId = request?.cookies?.[ACTIVE_ORGANIZATION_COOKIE];
    if (
      typeof cookieOrganizationId === 'string' &&
      cookieOrganizationId.trim()
    ) {
      return { organizationId: cookieOrganizationId.trim(), explicit: false };
    }

    return { organizationId: null, explicit: false };
  }

  async getContext(
    user: PermissionUser & {
      email?: string;
      name?: string;
      lastname?: string;
      googleStatus?: boolean;
      isActive?: boolean;
      password?: string | null;
      googleId?: string | null;
    },
    requestedOrganizationId?: string | null,
    options: { rejectInvalidRequested?: boolean } = {},
  ): Promise<ActiveOrganizationContext> {
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: { select: { name: true } },
        organizationMemberships: {
          include: {
            organization: { include: { plan: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!userWithRole) {
      throw new BadRequestException('User not found');
    }

    const roleName = userWithRole.role.name.trim();
    const memberships = userWithRole.organizationMemberships
      .filter((membership) => membership.organization.isActive)
      .map((membership) => ({
        membershipId: membership.id,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
        plan: membership.organization.plan,
        isActive: membership.organization.isActive,
      }));

    const validOrganizationIds = new Set(
      memberships.map((membership) => membership.organizationId),
    );
    let activeOrganizationId: string | null = null;

    if (requestedOrganizationId) {
      if (
        validOrganizationIds.has(requestedOrganizationId) ||
        isSuperAdmin({ ...user, role: roleName })
      ) {
        activeOrganizationId = requestedOrganizationId;
      } else if (options.rejectInvalidRequested) {
        throw new ForbiddenException(
          'You do not belong to the requested organization',
        );
      }
    }

    if (
      !activeOrganizationId &&
      userWithRole.organizationId &&
      validOrganizationIds.has(userWithRole.organizationId)
    ) {
      activeOrganizationId = userWithRole.organizationId;
    }

    if (!activeOrganizationId && memberships.length === 1) {
      activeOrganizationId = memberships[0].organizationId;
    }

    if (!activeOrganizationId && memberships.length > 1) {
      activeOrganizationId = memberships[0].organizationId;
    }

    const activeMembership = activeOrganizationId
      ? (userWithRole.organizationMemberships.find(
          (membership) => membership.organizationId === activeOrganizationId,
        ) ?? null)
      : null;

    const activeOrganization = activeMembership?.organization
      ? {
          id: activeMembership.organization.id,
          name: activeMembership.organization.name,
          plan: activeMembership.organization.plan,
          isActive: activeMembership.organization.isActive,
          createdAt: activeMembership.organization.createdAt,
        }
      : null;

    const plan = activeOrganization?.plan ?? null;

    return {
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        name: userWithRole.name,
        lastname: userWithRole.lastname,
        role: roleName,
        googleStatus: userWithRole.googleStatus,
        isActive: userWithRole.isActive,
        organizationId: activeOrganization?.id ?? null,
        organizationPlan: plan,
        hasInternalPassword: Boolean(userWithRole.password),
        requiresInternalPasswordSetup: Boolean(
          userWithRole.googleId &&
          userWithRole.googleStatus === true &&
          !userWithRole.password,
        ),
      },
      activeOrganization,
      activeMembership: activeMembership
        ? { id: activeMembership.id, role: activeMembership.role }
        : null,
      memberships,
      features: {
        canInviteMembers: plan?.hasEmailInvites ?? false,
        maxProjects: plan?.maxProjects ?? null,
        maxMembers: plan?.maxUsers ?? null,
        hasAnalytics: plan?.hasAnalytics ?? false,
        hasSso: plan?.hasSso ?? false,
        hasPrioritySupport: plan?.hasPrioritySupport ?? false,
        hasAdvancedPerms: plan?.hasAdvancedPerms ?? false,
        hasAudit: plan?.hasAudit ?? false,
        hasWhatsApp: plan?.hasWhatsApp ?? false,
        hasIntegrations: plan?.hasIntegrations ?? false,
      },
    };
  }

  async getContextForRequest(user: PermissionUser, request?: any) {
    const requested = this.readRequestedOrganizationId(request);
    return this.getContext(user, requested.organizationId, {
      rejectInvalidRequested: requested.explicit,
    });
  }

  async resolveScopedUser(user: PermissionUser, request?: any) {
    const context = await this.getContextForRequest(user, request);
    if (!context.activeOrganization) {
      throw new BadRequestException('Active organization is required');
    }

    return {
      ...user,
      organizationId: context.activeOrganization.id,
      orgRole: context.activeMembership?.role ?? null,
      activeOrganization: context.activeOrganization,
      organizationPlan: context.activeOrganization.plan,
    };
  }
}
