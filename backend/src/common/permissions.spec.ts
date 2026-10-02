import {
  hasProjectAccess,
  isOrgOwner,
  isProjectMember,
  canCreateTask,
  canAssignTask,
  canEditTask,
  canTrackTime,
  isAdmin,
  isSuperAdmin,
  isProjectOwner,
  canManageProject,
  canCreateProject,
  canUpdateOrgPlan,
  canInviteMember,
  canManageOrgMembers,
  canViewUser,
  canEditTaskDetailed,
} from './permissions';
import { ProjectRole, TaskStatus } from '@prisma/client';

describe('permissions', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      organizationMembership: {
        findUnique: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
    };
  });

  describe('isAdmin', () => {
    it('should return true only for SUPERADMIN', () => {
      expect(isAdmin({ id: 'u1', role: 'ADMIN' })).toBe(false);
      expect(isAdmin({ id: 'u1', role: 'SUPERADMIN' })).toBe(true);
      expect(isSuperAdmin({ id: 'u1', role: ' SUPERADMIN ' })).toBe(true);
    });

    it('should return false for regular users or undefined role', () => {
      expect(isAdmin({ id: 'u1', role: 'USER' })).toBe(false);
      expect(isAdmin({ id: 'u1' })).toBe(false);
    });
  });

  describe('isOrgOwner', () => {
    it('should return true when user is admin', async () => {
      const result = await isOrgOwner({ id: 'u1', role: 'SUPERADMIN' }, 'org-1', mockPrisma);
      expect(result).toBe(true);
    });

    it('should return false when organizationId is empty', async () => {
      const result = await isOrgOwner({ id: 'u1' }, null, mockPrisma);
      expect(result).toBe(false);
    });

    it('should return true when user is org owner in DB', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await isOrgOwner(
        { id: 'user-1' },
        'org-1',
        mockPrisma,
      );

      expect(result).toBe(true);
    });

    it('should return false when user is not org owner', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      const result = await isOrgOwner(
        { id: 'user-1' },
        'org-1',
        mockPrisma,
      );

      expect(result).toBe(false);
    });

    it('should return false when membership not found', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue(null);

      const result = await isOrgOwner(
        { id: 'user-1' },
        'org-1',
        mockPrisma,
      );

      expect(result).toBe(false);
    });
  });

  describe('isProjectMember', () => {
    it('should return true when user is project member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });

      const result = await isProjectMember(
        { id: 'user-1' },
        'project-1',
        mockPrisma,
      );

      expect(result).toBe(true);
    });

    it('should return false when user is not project member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const result = await isProjectMember(
        { id: 'user-1' },
        'project-1',
        mockPrisma,
      );

      expect(result).toBe(false);
    });
  });

  describe('isProjectOwner', () => {
    it('should return true when member has OWNER role', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.OWNER });
      const result = await isProjectOwner({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(true);
    });

    it('should return false when member is not owner', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.MEMBER });
      const result = await isProjectOwner({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(false);
    });

    it('should return false when project member not found', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      const result = await isProjectOwner({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(false);
    });
  });

  describe('canManageProject', () => {
    it('should allow admin users', async () => {
      const result = await canManageProject({ id: 'u1', role: 'SUPERADMIN' }, 'p1', mockPrisma);
      expect(result).toBe(true);
    });

    it('should deny legacy ADMIN cross-org without membership', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org-b', isActive: true });
      mockPrisma.organizationMembership.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      expect(await canManageProject(
        { id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' }, 'project-b', mockPrisma,
      )).toBe(false);
    });

    it('should return false when project does not exist or is inactive', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      let result = await canManageProject({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(false);

      mockPrisma.project.findUnique.mockResolvedValue({ isActive: false });
      result = await canManageProject({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(false);
    });

    it('should allow org owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org-1', isActive: true });
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      const result = await canManageProject({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(true);
    });

    it('should allow project owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org-1', isActive: true });
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.OWNER });

      const result = await canManageProject({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(true);
    });

    it('should deny regular project member', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org-1', isActive: true });
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.MEMBER });

      const result = await canManageProject({ id: 'u1' }, 'p1', mockPrisma);
      expect(result).toBe(false);
    });
  });

  describe('hasProjectAccess', () => {
    it('should allow admin users', async () => {
      const canAccess = await hasProjectAccess(
        { id: 'u1', role: 'SUPERADMIN' },
        { id: 'p1', organizationId: 'org-1', isActive: false },
        mockPrisma,
      );
      expect(canAccess).toBe(true);
    });

    it('member cannot access project when not org owner and not project member', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const canAccess = await hasProjectAccess(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(canAccess).toBe(false);
    });

    it('org owner can access any active project', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const canAccess = await hasProjectAccess(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(canAccess).toBe(true);
    });

    it('project member can access project', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });

      const canAccess = await hasProjectAccess(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(canAccess).toBe(true);
    });

    it('user cannot access inactive project', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const canAccess = await hasProjectAccess(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: false },
        mockPrisma,
      );

      expect(canAccess).toBe(false);
    });
  });

  describe('canCreateProject / canUpdateOrgPlan / canInviteMember / canManageOrgMembers', () => {
    it('delegates to isOrgOwner', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      expect(await canCreateProject({ id: 'u1' }, 'org-1', mockPrisma)).toBe(true);
      expect(await canUpdateOrgPlan({ id: 'u1' }, 'org-1', mockPrisma)).toBe(true);
      expect(await canInviteMember({ id: 'u1' }, 'org-1', mockPrisma)).toBe(true);
      expect(await canManageOrgMembers({ id: 'u1' }, 'org-1', mockPrisma)).toBe(true);
    });
  });

  describe('canViewUser', () => {
    it('allows admin users', async () => {
      expect(await canViewUser({ id: 'u1', role: 'SUPERADMIN' }, 'org-2')).toBe(true);
    });

    it('allows users in the same organization', async () => {
      expect(await canViewUser({ id: 'u1', organizationId: 'org-1' }, 'org-1')).toBe(true);
    });

    it('denies users from different organizations', async () => {
      expect(await canViewUser({ id: 'u1', organizationId: 'org-1' }, 'org-2')).toBe(false);
    });
  });

  describe('canCreateTask', () => {
    it('should allow org owner to create task', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      const result = await canCreateTask(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(result).toBe(true);
    });
  });

  describe('canAssignTask', () => {
    it('should allow project member to assign task', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });

      const result = await canAssignTask(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(result).toBe(true);
    });
  });

  describe('canEditTask', () => {
    it('should allow project member to edit task', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });

      const result = await canEditTask(
        { id: 'user-1' },
        {
          id: 'task-1',
          project: { id: 'project-1', organizationId: 'org-1', isActive: true },
        } as any,
        mockPrisma,
      );

      expect(result).toBe(true);
    });
  });

  describe('canTrackTime', () => {
    it('should allow project member to track time', async () => {
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-1' });

      const result = await canTrackTime(
        { id: 'user-1' },
        { id: 'project-1', organizationId: 'org-1', isActive: true },
        mockPrisma,
      );

      expect(result).toBe(true);
    });
  });

  describe('canEditTaskDetailed', () => {
    it('should allow admin users directly without restrictions', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true } } as any;
      const result = await canEditTaskDetailed({ id: 'u1', role: 'SUPERADMIN' }, task, {}, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: false });
    });

    it('should deny legacy ADMIN editing a cross-org task', async () => {
      const task = { projectId: 'p-b', project: { organizationId: 'org-b', isActive: true } } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      expect(await canEditTaskDetailed(
        { id: 'admin-a', role: 'ADMIN', organizationId: 'org-a' }, task, { title: 'x' }, mockPrisma,
      )).toEqual({ canEdit: false, restricted: false });
    });

    it('should allow org owners directly without restrictions', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true } } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      const result = await canEditTaskDetailed({ id: 'u1' }, task, {}, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: false });
    });

    it('should allow the project owner directly without restrictions', async () => {
      const task = {
        projectId: 'p1',
        project: { organizationId: 'org-1', isActive: true, ownerId: 'u1' },
      } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });

      const result = await canEditTaskDetailed(
        { id: 'u1' }, task, { title: 'Updated title' }, mockPrisma,
      );

      expect(result).toEqual({ canEdit: true, restricted: false });
    });

    it('should deny non-members of the project', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true } } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const result = await canEditTaskDetailed({ id: 'u1' }, task, {}, mockPrisma);
      expect(result).toEqual({ canEdit: false, restricted: false });
    });

    it('should mark restricted true when member makes restricted changes', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true }, assignedToId: 'u2' } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      const result = await canEditTaskDetailed({ id: 'u1' }, task, { title: 'New title' }, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: true });
    });

    it('should mark restricted true when member makes no changes but tries to save without status or takeTask', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true }, assignedToId: 'u2' } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      const result = await canEditTaskDetailed({ id: 'u1' }, task, {}, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: true });
    });

    it('should allow member to change status or take unassigned task without restriction', async () => {
      const task = { projectId: 'p1', project: { organizationId: 'org-1', isActive: true }, assignedToId: null } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      // Change status only
      let result = await canEditTaskDetailed({ id: 'u1' }, task, { status: TaskStatus.IN_PROGRESS }, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: false });

      // Take unassigned task only
      result = await canEditTaskDetailed({ id: 'u1' }, task, { assignedToId: 'u1' }, mockPrisma);
      expect(result).toEqual({ canEdit: true, restricted: false });
    });

    it('should restrict a member assigning an unassigned task to another user', async () => {
      const task = {
        projectId: 'p1',
        project: { organizationId: 'org-1', isActive: true },
        assignedToId: null,
      } as any;
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      const result = await canEditTaskDetailed(
        { id: 'u1' }, task, { assignedToId: 'u2' }, mockPrisma,
      );

      expect(result).toEqual({ canEdit: true, restricted: true });
    });
  });
});
