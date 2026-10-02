export type OrganizationRole = 'ORG_OWNER' | 'ORG_MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface Plan {
  id: string;
  name: string;
  title: string;
  description: string | null;
  price: number;
  maxUsers: number | null;
  maxProjects: number | null;
  hasAnalytics: boolean;
  hasSso: boolean;
  hasPrioritySupport: boolean;
  hasEmailInvites: boolean;
  hasAdvancedPerms: boolean;
  hasAudit: boolean;
}

export interface Organization {
  id: string;
  name: string;
  planId?: string | null;
  plan?: Plan | null;
  isActive: boolean;
  userRole?: OrganizationRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  lastname: string;
  status: 'ACTIVE' | 'PENDING';
  role: OrganizationRole;
  joinedAt?: string;
  projectIds?: string[];
}

export interface PendingInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  inviteLink: string;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt?: string;
  inviteLink?: string;
}

export interface OrganizationWorkspaceState {
  hasAccessibleProjects: boolean;
  hasAccessibleTasks: boolean;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  plan?: Plan | null;
  isActive: boolean;
  userRole?: OrganizationRole;
  members: OrganizationMember[];
  pendingInvites: PendingInvite[];
  workspaceState?: OrganizationWorkspaceState;
  createdAt?: string;
}

export interface CreateOrganizationDto {
  name: string;
}

export interface InviteMembersDto {
  email: string;
  role?: OrganizationRole;
  projectIds?: string[];
}

export interface InviteResponse {
  id: string;
  email: string;
  token: string;
  inviteLink: string;
  expiresAt: string;
}

export interface AcceptInviteDto {
  password: string;
  name: string;
  lastname: string;
}
