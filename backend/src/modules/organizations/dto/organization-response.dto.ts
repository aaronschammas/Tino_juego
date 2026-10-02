/**
 * Organization DTOs and Mappers
 * Ensure consistent, safe serialization of organization data
 */

import { OrganizationRole } from '@prisma/client';

interface OrganizationResponseData {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  userRole?: OrganizationRole;
  createdAt: Date;
}

interface MemberResponseData {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    lastname: string;
    googleStatus?: boolean;
  };
  role: OrganizationRole;
  createdAt: Date;
}

interface OrganizationDetailData extends OrganizationResponseData {
  memberships?: MemberResponseData[];
  invites?: InviteResponseData[];
}

interface InviteResponseData {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  token: string;
}

interface InviteLinkResponseData {
  message: string;
  email: string;
  role: OrganizationRole;
  inviteLink: string;
  expiresAt: Date;
}

interface AcceptedInviteUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export class OrganizationResponseDto {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  userRole?: OrganizationRole;
  createdAt: Date;

  constructor(data: OrganizationResponseData) {
    this.id = data.id;
    this.name = data.name;
    this.plan = data.plan;
    this.isActive = data.isActive;
    this.userRole = data.userRole;
    this.createdAt = data.createdAt;
  }
}

export class MemberResponseDto {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  lastname: string;
  googleStatus: boolean;
  role: OrganizationRole;
  joinedAt: Date;

  constructor(data: MemberResponseData) {
    this.membershipId = data.id;
    this.userId = data.user.id;
    this.email = data.user.email;
    this.name = data.user.name;
    this.lastname = data.user.lastname;
    this.googleStatus = data.user.googleStatus ?? false;
    this.role = data.role;
    this.joinedAt = data.createdAt;
  }
}

export class InviteResponseDto {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviteLink: string;

  constructor(data: InviteResponseData) {
    this.id = data.id;
    this.email = data.email;
    this.role = data.role;
    this.status = data.status;
    this.expiresAt = data.expiresAt;
    this.createdAt = data.createdAt;
    const frontendUrl = (
      process.env.FRONTEND_URL || 'https://www.tinotime.com'
    ).replace(/\/+$/, '');
    this.inviteLink = `${frontendUrl}/invite?token=${data.token}`;
  }
}

export class OrganizationDetailResponseDto {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  userRole: OrganizationRole;
  members: MemberResponseDto[];
  pendingInvites: InviteResponseDto[];
  createdAt: Date;

  constructor(org: OrganizationDetailData, userRole: OrganizationRole) {
    this.id = org.id;
    this.name = org.name;
    this.plan = org.plan;
    this.isActive = org.isActive;
    this.userRole = userRole;
    this.members =
      org.memberships?.map((membership) => new MemberResponseDto(membership)) ||
      [];
    this.pendingInvites =
      org.invites
        ?.filter((invite) => invite.status === 'PENDING')
        .map((invite) => new InviteResponseDto(invite)) || [];
    this.createdAt = org.createdAt;
  }
}

export class InviteLinkResponseDto {
  message: string;
  email: string;
  role: OrganizationRole;
  inviteLink: string;
  expiresAt: Date;

  constructor(data: InviteLinkResponseData) {
    this.message = data.message;
    this.email = data.email;
    this.role = data.role;
    this.inviteLink = data.inviteLink;
    this.expiresAt = data.expiresAt;
  }
}

export class AcceptInviteResponseDto {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
  };

  constructor(user: AcceptedInviteUser) {
    this.message = 'Invitation accepted successfully';
    this.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    };
  }
}
