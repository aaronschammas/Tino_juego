import { ProjectMembersService } from './project-members.service';
import { ProjectRole } from '@prisma/client';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;
  let mockPrismaService: any;
  const scopedUser = { id: 'user-123', organizationId: 'org-123', role: 'USER' } as any;
  const projectOwner = { id: 'owner-1', organizationId: 'org-123', role: 'USER' } as any;

  beforeEach(() => {
    mockPrismaService = {
      project: {
        findUnique: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      timeEntry: {
        updateMany: jest.fn(),
      },
      organizationMembership: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrismaService)),
    };

    service = new ProjectMembersService(mockPrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isMemberOfProject', () => {
    it('should return true if user is member of project', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
      });

      // Act
      const result = await service.isMemberOfProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user is not member of project', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.isMemberOfProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isOrgOwner', () => {
    it('should return true if user is org owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      // Act
      const result = await service.isOrgOwner({ id: 'user-123', organizationId: 'org-123', role: 'USER' } as any, 'org-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user is not org owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      // Act
      const result = await service.isOrgOwner({ id: 'user-123', organizationId: 'org-123', role: 'USER' } as any, 'org-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('hasProjectAccess', () => {
    it('should return false if project not found', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.hasProjectAccess(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if project is inactive', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: false,
      });

      // Act
      const result = await service.hasProjectAccess(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true if user is org owner', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      // Act
      const result = await service.hasProjectAccess(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true if user is project member', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
      });

      // Act
      const result = await service.hasProjectAccess(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('canManageProject', () => {
    it('should return false if project not found', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.canManageProject(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true if user is org owner', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      // Act
      const result = await service.canManageProject(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true if user is project owner', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
        role: ProjectRole.OWNER,
      });

      // Act
      const result = await service.canManageProject(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user is not owner or org owner', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
        role: ProjectRole.MEMBER,
      });

      // Act
      const result = await service.canManageProject(scopedUser, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserRoleInProject', () => {
    it('should return user role in project', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
        role: ProjectRole.OWNER,
      });

      // Act
      const result = await service.getUserRoleInProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBe(ProjectRole.OWNER);
    });

    it('should return null if user not member', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getUserRoleInProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isOwnerOfProject', () => {
    it('should return true if user is project owner', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
        role: ProjectRole.OWNER,
      });

      // Act
      const result = await service.isOwnerOfProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user is member but not owner', async () => {
      // Arrange
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-123',
        role: ProjectRole.MEMBER,
      });

      // Act
      const result = await service.isOwnerOfProject({ id: 'user-123', role: 'USER' } as any, 'proj-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getProjectMembers', () => {
    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getProjectMembers('proj-123', scopedUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user active org does not match project org', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });

      // Act & Assert
      await expect(
        service.getProjectMembers('proj-123', {
          id: 'user-123',
          organizationId: 'org-456',
          role: 'USER',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMemberToProject', () => {
    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.addMemberToProject('proj-123', 'user-456', projectOwner),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow an owner/admin to add a user outside the project organization', async () => {
      jest.spyOn(service, 'canManageProject').mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'external-user',
        organizationId: 'org-456',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.addMemberToProject(
          'proj-123',
          'external-user',
          projectOwner,
        ),
      ).rejects.toThrow(
        'El usuario debe ser miembro activo de la organización antes de agregarse al proyecto.',
      );

      expect(mockPrismaService.projectMember.create).not.toHaveBeenCalled();
    });

    it('should add an active organization member to the project', async () => {
      jest.spyOn(service, 'canManageProject').mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-456',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        organizationId: 'org-123',
        userId: 'user-456',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-456',
        role: ProjectRole.MEMBER,
      });

      const result = await service.addMemberToProject(
        'proj-123',
        'user-456',
        projectOwner,
      );

      expect(result.userId).toBe('user-456');
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            projectId: 'proj-123',
            userId: 'user-456',
            role: ProjectRole.MEMBER,
          },
        }),
      );
    });

    it('should not allow a regular member to add project members', async () => {
      jest.spyOn(service, 'canManageProject').mockResolvedValue(false);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });

      await expect(
        service.addMemberToProject(
          'proj-123',
          'user-456',
          { id: 'member-1', organizationId: 'org-123', role: 'USER' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user to add does not exist', async () => {
      jest.spyOn(service, 'canManageProject').mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMemberToProject(
          'proj-123',
          'missing-user',
          projectOwner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate project members', async () => {
      jest.spyOn(service, 'canManageProject').mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-456',
        organizationId: 'org-123',
        isActive: true,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-456',
      });

      await expect(
        service.addMemberToProject(
          'proj-123',
          'user-456',
          projectOwner,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMemberFromProject', () => {
    it('should close active timer when removing member from project', async () => {
      // Arrange - Mock canManageProject to return true
      jest.spyOn(service, 'canManageProject').mockResolvedValue(true);
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-123',
      });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-456',
        role: ProjectRole.MEMBER,
      });
      mockPrismaService.projectMember.delete.mockResolvedValue({
        projectId: 'proj-123',
        userId: 'user-456',
        user: { id: 'user-456', email: 'user456@test.com', name: 'User', lastname: 'Four' },
      });
      mockPrismaService.timeEntry.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.removeMemberFromProject('proj-123', 'user-456', projectOwner);

      // Assert
      expect(mockPrismaService.timeEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: 'proj-123',
            userId: 'user-456',
            endTime: null,
          },
          data: {
            endTime: expect.any(Date),
          },
        }),
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      // Arrange
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeMemberFromProject('proj-123', 'user-456', projectOwner),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
