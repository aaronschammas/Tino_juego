import { Task, ProjectRole, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

export interface PermissionUser {
  id: string;
  role?: string;
  organizationId?: string | null;
}

export interface PermissionProject {
  id: string;
  organizationId: string;
  isActive: boolean;
}

/**
 * System level admin check
 */
export function isAdmin(user: PermissionUser): boolean {
  return isSuperAdmin(user);
}

/** Only SUPERADMIN may bypass tenant-level authorization. */
export function isSuperAdmin(user: PermissionUser): boolean {
  const role = user.role?.trim();
  return role === 'SUPERADMIN';
}

/**
 * Organization level owner check
 */
export async function isOrgOwner(
  user: PermissionUser,
  organizationId: string | null | undefined,
  prisma: PrismaService,
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!organizationId) return false;

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  return membership?.role === 'ORG_OWNER';
}

/**
 * Project level member check
 */
export async function isProjectMember(
  user: PermissionUser,
  projectId: string,
  prisma: PrismaService,
): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  return !!member;
}

/**
 * Project level owner check
 */
export async function isProjectOwner(
  user: PermissionUser,
  projectId: string,
  prisma: PrismaService,
): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  return member?.role === ProjectRole.OWNER;
}

/**
 * Check if user can manage project (Org Owner or Project Owner)
 */
export async function canManageProject(
  user: PermissionUser,
  projectId: string,
  prisma: PrismaService,
): Promise<boolean> {
  if (isAdmin(user)) return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, isActive: true },
  });

  if (!project || !project.isActive) return false;

  const orgOwner = await isOrgOwner(user, project.organizationId, prisma);
  if (orgOwner) return true;

  return isProjectOwner(user, projectId, prisma);
}

/**
 * Check if user has access to project (Member or Org Owner)
 */
export async function hasProjectAccess(
  user: PermissionUser,
  project: PermissionProject,
  prisma: PrismaService,
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!project.isActive) return false;

  const orgOwner = await isOrgOwner(user, project.organizationId, prisma);
  if (orgOwner) return true;

  return isProjectMember(user, project.id, prisma);
}

// --- Specific Actions ---

export async function canCreateProject(
  user: PermissionUser,
  organizationId: string,
  prisma: PrismaService,
): Promise<boolean> {
  return isOrgOwner(user, organizationId, prisma);
}

export async function canUpdateOrgPlan(
  user: PermissionUser,
  organizationId: string,
  prisma: PrismaService,
): Promise<boolean> {
  return isOrgOwner(user, organizationId, prisma);
}

export async function canInviteMember(
  user: PermissionUser,
  organizationId: string,
  prisma: PrismaService,
): Promise<boolean> {
  return isOrgOwner(user, organizationId, prisma);
}

export async function canManageOrgMembers(
  user: PermissionUser,
  organizationId: string,
  prisma: PrismaService,
): Promise<boolean> {
  return isOrgOwner(user, organizationId, prisma);
}

export async function canViewUser(
  user: PermissionUser,
  targetUserOrgId: string | null,
): Promise<boolean> {
  if (isAdmin(user)) return true;
  return user.organizationId === targetUserOrgId;
}

export async function canCreateTask(
  user: PermissionUser,
  project: PermissionProject,
  prisma: PrismaService,
): Promise<boolean> {
  return hasProjectAccess(user, project, prisma);
}

export async function canAssignTask(
  user: PermissionUser,
  project: PermissionProject,
  prisma: PrismaService,
): Promise<boolean> {
  return hasProjectAccess(user, project, prisma);
}

export async function canEditTask(
  user: PermissionUser,
  task: Task & { project: PermissionProject },
  prisma: PrismaService,
): Promise<boolean> {
  return hasProjectAccess(user, task.project, prisma);
}

/**
 * Detailed task edit permission (handles member vs owner restrictions)
 */
export async function canEditTaskDetailed(
  user: PermissionUser,
  task: Task & {
    project: { organizationId: string; isActive: boolean; ownerId?: string };
  },
  dto: {
    status?: TaskStatus;
    assignedToId?: string | null;
    title?: string;
    description?: string;
    priority?: string;
    dueDate?: Date;
    estimatedHours?: number;
  },
  prisma: PrismaService,
): Promise<{ canEdit: boolean; restricted: boolean }> {
  if (isAdmin(user)) return { canEdit: true, restricted: false };

  const isOrgOwnerUser = await isOrgOwner(
    user,
    task.project.organizationId,
    prisma,
  );
  if (isOrgOwnerUser) return { canEdit: true, restricted: false };

  if (task.project.ownerId === user.id)
    return { canEdit: true, restricted: false };

  const isMember = await isProjectMember(user, task.projectId, prisma);
  if (!isMember) return { canEdit: false, restricted: false };

  // If we are here, user is a member but not Org Owner
  // Check for restricted changes
  const hasStatusUpdate = dto.status !== undefined;
  const hasTakeTask =
    dto.assignedToId !== undefined &&
    dto.assignedToId === user.id &&
    task.assignedToId === null;

  const hasOtherChanges =
    dto.title !== undefined ||
    dto.description !== undefined ||
    dto.priority !== undefined ||
    dto.dueDate !== undefined ||
    dto.estimatedHours !== undefined ||
    (dto.assignedToId !== undefined && !hasTakeTask);

  if (hasOtherChanges || (!hasStatusUpdate && !hasTakeTask)) {
    return { canEdit: true, restricted: true };
  }

  return { canEdit: true, restricted: false };
}

export async function canTrackTime(
  user: PermissionUser,
  project: PermissionProject,
  prisma: PrismaService,
): Promise<boolean> {
  return hasProjectAccess(user, project, prisma);
}
