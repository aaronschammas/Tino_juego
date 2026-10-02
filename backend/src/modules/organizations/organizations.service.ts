import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMembersDto } from './dto/invite-members.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { validateEmailDomain } from 'src/common/utils/email.util';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import {
  canUpdateOrgPlan,
  canInviteMember,
  canManageOrgMembers,
  PermissionUser,
  isAdmin,
} from 'src/common/permissions';

export interface WorkspaceState {
  hasAccessibleProjects: boolean;
  hasAccessibleTasks: boolean;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planPolicy: PlanPolicyService,
  ) {}

  async getWorkspaceState(
    user: PermissionUser,
    organizationId: string,
    organizationRole?: string | null,
  ): Promise<WorkspaceState> {
    const hasGlobalOrganizationAccess =
      isAdmin(user) || organizationRole === 'ORG_OWNER';
    const accessibleProjectFilter = hasGlobalOrganizationAccess
      ? {}
      : { members: { some: { userId: user.id } } };

    const [accessibleProject, accessibleTask] = await Promise.all([
      this.prisma.project.findFirst({
        where: {
          organizationId,
          isActive: true,
          ...accessibleProjectFilter,
        },
        select: { id: true },
      }),
      this.prisma.task.findFirst({
        where: {
          organizationId,
          project: {
            isActive: true,
            ...accessibleProjectFilter,
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      hasAccessibleProjects: Boolean(accessibleProject),
      hasAccessibleTasks: Boolean(accessibleTask),
    };
  }

  /**
   * Updates the organization plan for onboarding continuation scenarios.
   */
  async updateOrganizationPlan(
    user: PermissionUser,
    organizationId: string,
    dto: UpdateOrganizationPlanDto,
  ) {
    await this.planPolicy.assertPlanIsSelectable(dto.plan);

    const canUpdatePlan = await canUpdateOrgPlan(
      user,
      organizationId,
      this.prisma,
    );

    if (!canUpdatePlan) {
      throw new ForbiddenException(
        'Only organization owners can update organization plan',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { name: dto.plan },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${dto.plan} not found`);
    }

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { planId: plan.id },
      select: {
        id: true,
        name: true,
        plan: true,
        isActive: true,
      },
    });

    return organization;
  }

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const freePlan = await this.prisma.plan.findUnique({
      where: { name: 'free' },
    });

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        planId: freePlan?.id,
      },
      include: {
        plan: true,
      },
    });

    await this.prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId,
        role: 'ORG_OWNER',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: organization.id },
    });

    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      isActive: organization.isActive,
      role: 'ORG_OWNER',
      createdAt: organization.createdAt,
    };
  }

  async getMyOrganization(userId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
      },
    });

    if (!currentUser?.organizationId) {
      throw new NotFoundException('No organization found for this user');
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          userId,
          organizationId: currentUser.organizationId,
        },
      },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!membership?.organizationId) {
      throw new ForbiddenException(
        'Organization membership is required for the active organization',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            plan: true,
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    lastname: true,
                    googleStatus: true,
                  },
                },
              },
            },
            invites: true,
          },
        },
      },
    });

    const organization = user?.organization;
    if (!organization) {
      throw new NotFoundException('No organization found for this user');
    }

    if (organization.id !== membership.organizationId) {
      throw new ForbiddenException('Organization membership mismatch');
    }

    const canViewInviteLinks = isAdmin(user) || membership.role === 'ORG_OWNER';

    const memberProjects = await this.prisma.projectMember.findMany({
      where: {
        user: {
          organizationMemberships: {
            some: { organizationId: organization.id },
          },
        },
        project: { organizationId: organization.id },
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    const userProjectMap = new Map<string, string[]>();

    memberProjects.forEach((mp) => {
      if (!userProjectMap.has(mp.userId)) {
        userProjectMap.set(mp.userId, []);
      }
      userProjectMap.get(mp.userId)!.push(mp.projectId);
    });

    const workspaceState = await this.getWorkspaceState(
      { id: userId, organizationId: organization.id },
      organization.id,
      membership.role,
    );

    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      isActive: organization.isActive,
      userRole: membership.role || null,
      members: organization.memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        lastname: m.user.lastname,
        role: m.role,
        googleStatus: m.user.googleStatus,
        joinedAt: m.createdAt,
        projectIds: userProjectMap.get(m.user.id) || [],
      })),
      pendingInvites: organization.invites
        .filter((i) => i.status === 'PENDING')
        .map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          ...(canViewInviteLinks
            ? {
                inviteLink: `${
                  process.env.FRONTEND_URL || 'https://tinotime.com'
                }/invite?token=${i.token}`,
              }
            : {}),
        })),
      workspaceState,
      createdAt: organization.createdAt,
    };
  }

  async getOrganizationById(user: PermissionUser, organizationId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { userId: user.id, organizationId } },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!membership?.organizationId && !isAdmin(user)) {
      throw new ForbiddenException(
        'Organization membership is required for the active organization',
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        plan: true,
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                lastname: true,
                googleStatus: true,
              },
            },
          },
        },
        invites: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('No organization found for this user');
    }

    const canViewInviteLinks =
      isAdmin(user) || membership?.role === 'ORG_OWNER';

    const memberProjects = await this.prisma.projectMember.findMany({
      where: {
        user: {
          organizationMemberships: {
            some: { organizationId: organization.id },
          },
        },
        project: { organizationId: organization.id },
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    const userProjectMap = new Map<string, string[]>();

    memberProjects.forEach((mp) => {
      if (!userProjectMap.has(mp.userId)) {
        userProjectMap.set(mp.userId, []);
      }
      userProjectMap.get(mp.userId)!.push(mp.projectId);
    });

    const workspaceState = await this.getWorkspaceState(
      user,
      organization.id,
      membership?.role,
    );

    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      isActive: organization.isActive,
      userRole: membership?.role || null,
      members: organization.memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        lastname: m.user.lastname,
        role: m.role,
        googleStatus: m.user.googleStatus,
        joinedAt: m.createdAt,
        projectIds: userProjectMap.get(m.user.id) || [],
      })),
      pendingInvites: organization.invites
        .filter((i) => i.status === 'PENDING')
        .map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          ...(canViewInviteLinks
            ? {
                inviteLink: `${
                  process.env.FRONTEND_URL || 'https://tinotime.com'
                }/invite?token=${i.token}`,
              }
            : {}),
        })),
      workspaceState,
      createdAt: organization.createdAt,
    };
  }

  async inviteMember(
    user: PermissionUser,
    organizationId: string,
    dto: InviteMembersDto,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    await validateEmailDomain(normalizedEmail);

    await this.planPolicy.assertCanInviteUser(organizationId, user);
    await this.planPolicy.assertCanAddMember(organizationId, user);

    const canInvite = await canInviteMember(user, organizationId, this.prisma);

    if (!canInvite) {
      throw new ForbiddenException(
        'Only organization owners can invite members',
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (existingUser) {
      const existingMembership =
        await this.prisma.organizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: existingUser.id,
            },
          },
        });

      if (existingMembership) {
        throw new ConflictException(
          'User already belongs to this organization',
        );
      }
    }

    const existingInvite = await this.prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingInvite && existingInvite.expiresAt > new Date()) {
      return {
        id: existingInvite.id,
        email: existingInvite.email,
        role: existingInvite.role,
        inviteLink: this.buildInviteLink(existingInvite.token),
        expiresAt: existingInvite.expiresAt,
        projectIds: [],
        reused: true,
      };
    }

    let targetUser = existingUser;

    if (!targetUser) {
      const userRole = await this.prisma.role.findUnique({
        where: { name: 'USER' },
      });
      if (!userRole) throw new BadRequestException('USER role not found');

      targetUser = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          name: 'Pending User',
          lastname: 'Pending',
          roleId: userRole.id,
          isActive: false,
        },
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.$transaction(async (tx) => {
      if (existingInvite) {
        await tx.organizationInvite.update({
          where: { id: existingInvite.id },
          data: {
            token,
            expiresAt,
            status: 'PENDING',
          },
        });
      } else {
        await tx.organizationInvite.create({
          data: {
            organizationId,
            email: normalizedEmail,
            role: dto.role,
            token,
            expiresAt,
            status: 'PENDING',
          },
        });
      }

      // Project assignment happens only after the invite is accepted.
      // TODO: fase 2 - aceptar invitaciones exclusivamente con Google.
    });

    const inviteLink = this.buildInviteLink(token);

    return {
      email: normalizedEmail,
      role: dto.role,
      inviteLink,
      expiresAt,
      projectIds: [],
    };
  }

  async getInvitePreview(token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (
      !invite ||
      invite.status !== 'PENDING' ||
      invite.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invite token');
    }

    return {
      email: invite.email,
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt,
    };
  }

  async removeMember(
    user: PermissionUser,
    organizationId: string,
    targetUserId: string,
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can remove members',
      );
    }

    const targetMembership =
      await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in organization');
    }

    await this.prisma.organizationMembership.delete({
      where: { id: targetMembership.id },
    });

    await this.prisma.projectMember.deleteMany({
      where: {
        userId: targetUserId,
        project: {
          organizationId,
        },
      },
    });

    const remainingMembershipsInOrg =
      await this.prisma.organizationMembership.count({
        where: {
          userId: targetUserId,
          organizationId,
        },
      });

    if (remainingMembershipsInOrg === 0) {
      const userFromDb = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { organizationId: true },
      });

      if (userFromDb?.organizationId === organizationId) {
        const anotherMembership =
          await this.prisma.organizationMembership.findFirst({
            where: { userId: targetUserId },
            select: { organizationId: true },
            orderBy: { createdAt: 'desc' },
          });

        await this.prisma.user.update({
          where: { id: targetUserId },
          data: { organizationId: anotherMembership?.organizationId ?? null },
        });
      }
    }

    return { message: 'Member removed successfully' };
  }

  async getMembers(user: PermissionUser, organizationId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (!membership && !isAdmin(user)) {
      throw new ForbiddenException('You do not belong to this organization');
    }

    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastname: true,
            googleStatus: true,
          },
        },
      },
    });

    const memberProjects = await this.prisma.projectMember.findMany({
      where: {
        project: { organizationId },
      },
      select: {
        userId: true,
        projectId: true,
      },
    });

    const userProjectMap = new Map<string, string[]>();
    memberProjects.forEach((mp) => {
      if (!userProjectMap.has(mp.userId)) {
        userProjectMap.set(mp.userId, []);
      }
      userProjectMap.get(mp.userId)!.push(mp.projectId);
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      lastname: m.user.lastname,
      role: m.role,
      googleStatus: m.user.googleStatus,
      joinedAt: m.createdAt,
      projectIds: userProjectMap.get(m.user.id) || [],
    }));
  }

  async getInvitations(user: PermissionUser, organizationId: string) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can view invitations',
      );
    }

    return this.prisma.organizationInvite.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
    });
  }

  async resendInvite(
    user: PermissionUser,
    organizationId: string,
    inviteId: string,
  ) {
    await this.planPolicy.assertCanInviteUser(organizationId, user);

    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can resend invitations',
      );
    }

    const invite = await this.prisma.organizationInvite.findFirst({
      where: {
        id: inviteId,
        organizationId,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: {
        token: newToken,
        expiresAt,
        status: 'PENDING',
      },
    });
  }

  async revokeInvite(
    user: PermissionUser,
    organizationId: string,
    inviteId: string,
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can revoke invitations',
      );
    }

    const invite = await this.prisma.organizationInvite.findFirst({
      where: {
        id: inviteId,
        organizationId,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be revoked');
    }
    return this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: 'REVOKED' },
    });
  }

  async updateMemberRole(
    user: PermissionUser,
    organizationId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can update member roles',
      );
    }

    const targetMembership =
      await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in organization');
    }

    return this.prisma.organizationMembership.update({
      where: { id: targetMembership.id },
      data: { role: dto.role },
    });
  }

  async updateMemberProjects(
    user: PermissionUser,
    organizationId: string,
    targetUserId: string,
    projectIds: string[],
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can update member projects',
      );
    }

    const targetMembership =
      await this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
        include: {
          user: {
            select: { isActive: true },
          },
        },
      });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in organization');
    }

    if (!targetMembership.user?.isActive) {
      throw new BadRequestException(
        'El usuario debe ser miembro activo de la organización antes de agregarse al proyecto.',
      );
    }

    if (projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          organizationId,
          isActive: true,
        },
        select: { id: true },
      });

      if (projects.length !== projectIds.length) {
        throw new BadRequestException(
          'Some project IDs are invalid or do not belong to this organization',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const currentMemberships = await tx.projectMember.findMany({
        where: {
          userId: targetUserId,
          project: { organizationId },
        },
        select: { projectId: true },
      });

      const removedProjectIds = currentMemberships
        .map((membership) => membership.projectId)
        .filter((projectId) => !projectIds.includes(projectId));

      await tx.projectMember.deleteMany({
        where: {
          userId: targetUserId,
          project: { organizationId },
        },
      });

      if (removedProjectIds.length > 0) {
        await tx.timeEntry.updateMany({
          where: {
            userId: targetUserId,
            projectId: { in: removedProjectIds },
            endTime: null,
          },
          data: { endTime: new Date() },
        });
      }

      if (projectIds.length > 0) {
        await tx.projectMember.createMany({
          data: projectIds.map((projectId) => ({
            projectId,
            userId: targetUserId,
            role: 'MEMBER',
          })),
        });
      }

      return { message: 'Member projects updated successfully' };
    });
  }

  async removeMemberFromProject(
    user: PermissionUser,
    organizationId: string,
    targetUserId: string,
    projectId: string,
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can remove members from projects',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.projectMember.deleteMany({
        where: {
          userId: targetUserId,
          projectId,
          project: { organizationId },
        },
      });

      if (removed.count === 0) {
        throw new NotFoundException('Project member not found');
      }

      await tx.timeEntry.updateMany({
        where: {
          userId: targetUserId,
          projectId,
          endTime: null,
        },
        data: { endTime: new Date() },
      });

      return { success: true };
    });
  }

  async syncOrganizationMemberships(
    user: PermissionUser,
    organizationId: string,
  ) {
    const canManage = await canManageOrgMembers(
      user,
      organizationId,
      this.prisma,
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Only organization owners can sync memberships',
      );
    }

    const projects = await this.prisma.project.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        user: { isActive: true },
      },
      select: { userId: true },
    });

    const userIds = memberships.map((m) => m.userId);

    let createdCount = 0;

    for (const userId of userIds) {
      for (const projectId of projectIds) {
        const exists = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId, userId },
          },
        });

        if (!exists) {
          await this.prisma.projectMember.create({
            data: {
              projectId,
              userId,
              role: 'MEMBER',
            },
          });
          createdCount++;
        }
      }
    }

    return { createdCount };
  }

  async acceptInvite(token: string, dto: AcceptInviteDto) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
    });
    if (
      !invite ||
      invite.status !== 'PENDING' ||
      invite.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invite token');
    }
    await this.planPolicy.assertCanAddMember(invite.organizationId);
    const normalizedEmail = invite.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { role: true },
      });

      if (user?.password) {
        if (!(await bcrypt.compare(dto.password, user.password))) {
          throw new BadRequestException('Credenciales invalidas');
        }
      } else if (user?.googleId && user.googleStatus) {
        throw new BadRequestException(
          'Esta cuenta debe aceptar la invitación mediante Google',
        );
      }

      if (user) {
        const data: Record<string, unknown> = { isActive: true };
        if (!user.password) {
          Object.assign(data, {
            password: await bcrypt.hash(dto.password, 12),
            name: dto.name.trim(),
            lastname: dto.lastname.trim(),
            isEmailVerified: true,
          });
        }
        if (!user.organizationId) data.organizationId = invite.organizationId;
        user = await tx.user.update({
          where: { id: user.id },
          data,
          include: { role: true },
        });
      } else {
        const userRole = await tx.role.findUnique({ where: { name: 'USER' } });
        if (!userRole) throw new BadRequestException('USER role not found');
        user = await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            email: normalizedEmail,
            name: dto.name.trim(),
            lastname: dto.lastname.trim(),
            password: await bcrypt.hash(dto.password, 12),
            roleId: userRole.id,
            isActive: true,
            isEmailVerified: true,
            organizationId: invite.organizationId,
          },
          include: { role: true },
        });
      }

      const membership = await tx.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: user.id,
          },
        },
      });
      if (!membership) {
        await tx.organizationMembership.create({
          data: {
            organizationId: invite.organizationId,
            userId: user.id,
            role: invite.role,
          },
        });
      }
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        lastname: user.lastname,
        organizationId: user.organizationId,
        role: user.role?.name?.trim() || 'USER',
      };
    });
  }

  async acceptInviteWithGoogle(
    token: string,
    profile: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
    },
  ) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
    });

    if (
      !invite ||
      invite.status !== 'PENDING' ||
      invite.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invite token');
    }

    await this.planPolicy.assertCanAddMember(invite.organizationId);

    if (!profile.email || !profile.sub || profile.email_verified !== true) {
      throw new BadRequestException('Google no devolvió un correo verificado');
    }

    const inviteEmail = invite.email.trim().toLowerCase();
    const googleEmail = profile.email.trim().toLowerCase();

    if (inviteEmail !== googleEmail) {
      throw new BadRequestException(
        'Esta invitación fue generada para otro correo. Iniciá sesión con la cuenta Google correcta.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingByGoogle = await tx.user.findFirst({
        where: { googleId: profile.sub },
      });

      if (
        existingByGoogle &&
        existingByGoogle.email.toLowerCase() !== googleEmail
      ) {
        throw new BadRequestException(
          'Esta cuenta de Google ya está vinculada a otro usuario',
        );
      }

      let userResult = await tx.user.findFirst({
        where: { email: { equals: googleEmail, mode: 'insensitive' } },
      });

      if (userResult?.googleId && userResult.googleId !== profile.sub) {
        throw new BadRequestException(
          'El usuario ya tiene otra cuenta de Google vinculada',
        );
      }

      if (userResult) {
        userResult = await tx.user.update({
          where: { id: userResult.id },
          data: {
            googleId: profile.sub,
            googleStatus: true,
            isEmailVerified: true,
            isActive: true,
            ...(userResult.organizationId
              ? {}
              : { organizationId: invite.organizationId }),
          },
        });
      } else {
        const userRole = await tx.role.findUnique({ where: { name: 'USER' } });
        if (!userRole) throw new BadRequestException('USER role not found');

        const names = this.extractGoogleNames(profile);
        userResult = await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            email: googleEmail,
            name: names.name,
            lastname: names.lastname,
            googleId: profile.sub,
            googleStatus: true,
            isEmailVerified: true,
            isActive: true,
            roleId: userRole.id,
            organizationId: invite.organizationId,
          },
        });
      }

      const existingMembership = await tx.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: userResult.id,
          },
        },
      });

      if (!existingMembership) {
        await tx.organizationMembership.create({
          data: {
            organizationId: invite.organizationId,
            userId: userResult.id,
            role: invite.role,
          },
        });
      }

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      return {
        id: userResult.id,
        email: userResult.email,
        name: userResult.name,
        lastname: userResult.lastname,
        roleId: userResult.roleId,
        googleStatus: userResult.googleStatus,
        isActive: userResult.isActive,
        organizationId: userResult.organizationId,
        password: userResult.password,
      };
    });
  }

  private buildInviteLink(token: string) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'https://www.tinotime.com'
    ).replace(/\/+$/, '');
    return `${frontendUrl}/invite?token=${token}`;
  }

  private extractGoogleNames(profile: {
    given_name?: string;
    family_name?: string;
    name?: string;
  }) {
    const fallbackName = profile.name?.trim() || 'Usuario';
    const parts = fallbackName.split(/\s+/).filter(Boolean);

    return {
      name: profile.given_name?.trim() || parts[0] || 'Usuario',
      lastname:
        profile.family_name?.trim() || parts.slice(1).join(' ') || 'Google',
    };
  }
}
