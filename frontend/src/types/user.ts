export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type UserStatus = 'ACTIVE' | 'PENDING';

export interface Project {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  project: Project;
}

export interface AssignedTask {
  id: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
}

export interface User {
    /** Indica si este usuario es el usuario autenticado actual (solo frontend, no persistente) */
    isCurrentUser?: boolean;
  id: string;
  email: string;
  name: string;
  lastname: string;
  googleId?: string | null;
  googleStatus?: boolean;
  isEmailVerified?: boolean;
  role: UserRole;
  status?: UserStatus;
  isActive: boolean;
  organizationId?: string;
  organizationPlan?: {
    id: string;
    name: string;
    title: string;
    maxUsers: number | null;
    maxProjects: number | null;
  } | null;
  hasInternalPassword?: boolean;
  requiresInternalPasswordSetup?: boolean;
  projectMembers?: ProjectMember[];
  assignedTasks?: AssignedTask[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ActiveOrganization {
  id: string;
  name: string;
  plan: User['organizationPlan'] | null;
  isActive?: boolean;
}

export interface ActiveMembership {
  id: string;
  role: 'ORG_OWNER' | 'ORG_MEMBER' | string;
}

export interface OrganizationMembershipSummary {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: 'ORG_OWNER' | 'ORG_MEMBER' | string;
  plan: User['organizationPlan'] | null;
  isActive: boolean;
}

export interface ActiveOrganizationFeatures {
  canInviteMembers: boolean;
  maxProjects: number | null;
  maxMembers: number | null;
  hasAnalytics?: boolean;
  hasSso?: boolean;
  hasPrioritySupport?: boolean;
  hasAdvancedPerms?: boolean;
  hasAudit?: boolean;
  hasWhatsApp?: boolean;
  hasIntegrations?: boolean;
}

export interface AuthContextResponse {
  user: User;
  activeOrganization: ActiveOrganization | null;
  activeMembership: ActiveMembership | null;
  memberships: OrganizationMembershipSummary[];
  features: ActiveOrganizationFeatures;
}

export interface LoginResponse {
  user: User;
}

export interface CreateUserDto {
  email: string;
  name: string;
  lastname: string;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  lastname?: string;
}
