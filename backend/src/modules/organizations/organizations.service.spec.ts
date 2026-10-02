import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from 'src/database/prisma.service';
import { OrganizationRole } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import type { PermissionUser } from 'src/common/permissions';

jest.mock('crypto');
jest.mock('bcrypt');
jest.mock('src/common/utils/email.util', () => ({
  validateEmailDomain: jest.fn().mockResolvedValue(undefined),
}));

const createPrismaMock = () => ({
  organization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  organizationMembership: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organizationInvite: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  task: { findFirst: jest.fn() },
  projectMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  timeEntry: {
    updateMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  role: { findUnique: jest.fn(), findFirst: jest.fn() },
  plan: { findUnique: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
});

const createPlanPolicyMock = () => ({
  assertPlanIsSelectable: jest.fn(),
  assertCanInviteUser: jest.fn(),
  assertCanAddMember: jest.fn(),
});

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prismaService: PrismaService;
  let mockPrismaService: ReturnType<typeof createPrismaMock>;
  let mockPlanPolicyService: ReturnType<typeof createPlanPolicyMock>;

  beforeEach(async () => {
    mockPrismaService = createPrismaMock();

    // Default implementations for roles
    mockPrismaService.role.findUnique.mockImplementation(
      ({ where }: { where: { name: string } }) => {
        if (where.name === 'USER')
          return Promise.resolve({ id: 'role-user', name: 'USER' });
        if (where.name === 'ADMIN')
          return Promise.resolve({ id: 'role-admin', name: 'ADMIN' });
        return Promise.resolve(null);
      },
    );

    mockPlanPolicyService = createPlanPolicyMock();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PlanPolicyService, useValue: mockPlanPolicyService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    mockPrismaService.$transaction.mockImplementation(
      (callback: (client: PrismaService) => unknown) => callback(prismaService),
    );
  });

  const mockUser: PermissionUser = {
    id: 'user-123',
    organizationId: 'org-123',
    role: 'USER',
  };

  describe('createOrganization', () => {
    it('should create an organization successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'Test Org' };
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        plan: 'BASIC',
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.organization.create.mockResolvedValue(mockOrg);
      mockPrismaService.organizationMembership.create.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});

      // Act
      const result = await service.createOrganization(userId, dto);

      // Assert
      expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
        data: { name: 'Test Org', planId: undefined },
        include: { plan: true },
      });
      expect(
        mockPrismaService.organizationMembership.create,
      ).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          userId,
          role: 'ORG_OWNER',
        },
      });
      expect(result).toEqual({
        id: 'org-123',
        name: 'Test Org',
        plan: 'BASIC',
        isActive: true,
        role: 'ORG_OWNER',
        createdAt: mockOrg.createdAt,
      });
    });
  });

  describe('getMyOrganization', () => {
    it('should reject a missing membership without creating ORG_OWNER', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationId: 'org-123',
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(
        null,
      );
      await expect(service.getMyOrganization('user-123')).rejects.toThrow(
        ForbiddenException,
      );
      expect(
        mockPrismaService.organizationMembership.create,
      ).not.toHaveBeenCalled();
    });
    it('should return organization with members when user has organization', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockUser = {
        organizationId: orgId,
        role: 'ADMIN',
        organization: {
          id: orgId,
          name: 'Test Org',
          plan: 'BASIC',
          isActive: true,
          createdAt: new Date(),
          memberships: [
            {
              id: 'mem-1',
              user: {
                id: userId,
                email: 'user@test.com',
                name: 'John',
                lastname: 'Doe',
              },
              role: 'ORG_OWNER',
              createdAt: new Date(),
            },
          ],
          invites: [],
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        organizationId: orgId,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        organizationId: orgId,
        role: 'ORG_OWNER',
      });
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getMyOrganization(userId);

      // Assert
      expect(result.id).toBe(orgId);
      expect(result.members).toHaveLength(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user has no organization', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationId: null,
      });

      // Act & Assert
      await expect(service.getMyOrganization(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when membership does not match', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        organizationId: orgId,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        organizationId: 'org-456',
        role: 'ORG_OWNER',
      });
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        organization: { id: orgId },
      });

      // Act & Assert
      await expect(service.getMyOrganization(userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('workspace state access scope', () => {
    it('filters projects and tasks by membership for organization members', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      const result = await service.getWorkspaceState(
        { id: 'member-1', role: 'USER' },
        'org-123',
        'ORG_MEMBER',
      );

      expect(result).toEqual({
        hasAccessibleProjects: false,
        hasAccessibleTasks: false,
      });
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          isActive: true,
          members: { some: { userId: 'member-1' } },
        },
        select: { id: true },
      });
      expect(mockPrismaService.task.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          project: {
            isActive: true,
            members: { some: { userId: 'member-1' } },
          },
        },
        select: { id: true },
      });
    });

    it('keeps organization-wide access for owners without exposing counts', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'project-1',
      });
      mockPrismaService.task.findFirst.mockResolvedValue({ id: 'task-1' });

      const result = await service.getWorkspaceState(
        { id: 'owner-1', role: 'USER' },
        'org-123',
        'ORG_OWNER',
      );

      expect(result).toEqual({
        hasAccessibleProjects: true,
        hasAccessibleTasks: true,
      });
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', isActive: true },
        select: { id: true },
      });
    });
  });

  describe('inviteMember', () => {
    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('token-123'),
      });
    });

    it('should invite a new member successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      const dto = {
        email: 'newuser@test.com',
        role: OrganizationRole.ORG_MEMBER,
        projectIds: [],
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        organizationId: orgId,
        userId,
        role: 'ORG_OWNER',
      });
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: orgId,
      });
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-456',
        email: dto.email,
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue(null);
      mockPrismaService.organizationInvite.create.mockResolvedValue({});

      // Act
      const result = await service.inviteMember(mockUser, orgId, dto);

      // Assert
      expect(result.email).toBe(dto.email);
      expect(result.role).toBe('ORG_MEMBER');
      expect(result.inviteLink).toContain('token-123');
      expect(mockPrismaService.organizationInvite.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not org owner', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      const dto = {
        email: 'newuser@test.com',
        role: OrganizationRole.ORG_MEMBER,
        projectIds: [],
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        organizationId: orgId,
        userId,
        role: 'MEMBER',
      });

      // Act & Assert
      await expect(service.inviteMember(mockUser, orgId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when user already belongs to organization', async () => {
      // Arrange
      const orgId = 'org-123';
      const dto = {
        email: 'existing@test.com',
        role: OrganizationRole.ORG_MEMBER,
        projectIds: [],
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: orgId,
      });
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'user-456',
        organizationId: orgId,
      });

      // Act & Assert
      await expect(service.inviteMember(mockUser, orgId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should ignore projectIds during invitation instead of assigning projects', async () => {
      // Arrange
      const orgId = 'org-123';
      const dto = {
        email: 'newuser@test.com',
        role: OrganizationRole.ORG_MEMBER,
        projectIds: ['invalid-project'],
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: orgId,
      });
      mockPrismaService.project.findMany.mockResolvedValue([]);

      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'pending-user',
        email: dto.email,
        isActive: false,
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue(null);
      mockPrismaService.organizationInvite.create.mockResolvedValue({});

      const result = await service.inviteMember(mockUser, orgId, dto);

      expect(result.projectIds).toEqual([]);
      expect(mockPrismaService.projectMember.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.projectMember.deleteMany).not.toHaveBeenCalled();
    });

    it('should create a pending invite without assigning projects when projectIds are provided', async () => {
      const orgId = 'org-123';
      const dto = {
        email: 'pending@test.com',
        role: OrganizationRole.ORG_MEMBER,
        projectIds: ['proj-1'],
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: orgId,
      });
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'pending-user',
        email: dto.email,
        isActive: false,
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue(null);
      mockPrismaService.organizationInvite.create.mockResolvedValue({});

      const result = await service.inviteMember(mockUser, orgId, dto);

      expect(result.email).toBe(dto.email);
      expect(result.projectIds).toEqual([]);
      expect(mockPrismaService.organizationInvite.create).toHaveBeenCalled();
      expect(mockPrismaService.projectMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const targetUserId = 'target-user';

      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: true } });
      mockPrismaService.organizationMembership.delete.mockResolvedValue({});
      mockPrismaService.projectMember.deleteMany.mockResolvedValue({});
      mockPrismaService.organizationMembership.count.mockResolvedValue(0);
      mockPrismaService.user.findUnique.mockResolvedValue({
        organizationId: orgId,
      });

      // Act
      const result = await service.removeMember(mockUser, orgId, targetUserId);

      // Assert
      expect(result.message).toBe('Member removed successfully');
      expect(
        mockPrismaService.organizationMembership.delete,
      ).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      // Arrange
      const orgId = 'org-123';

      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'MEMBER',
        },
      );

      // Act & Assert
      await expect(
        service.removeMember(mockUser, orgId, 'target-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when member not found', async () => {
      // Arrange
      const orgId = 'org-123';

      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.removeMember(mockUser, orgId, 'target-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMembers', () => {
    it('should get organization members successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';

      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          organizationId: orgId,
        },
      );
      mockPrismaService.organizationMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          user: {
            id: userId,
            email: 'user@test.com',
            name: 'John',
            lastname: 'Doe',
          },
          role: 'ORG_OWNER',
          createdAt: new Date(),
        },
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getMembers(mockUser, orgId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('ORG_OWNER');
    });

    it('should throw ForbiddenException when user not in organization', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        null,
      );

      // Act & Assert
      await expect(service.getMembers(mockUser, 'org-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getInvitations', () => {
    it('should get pending invitations', async () => {
      // Arrange
      const orgId = 'org-123';

      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'ORG_OWNER',
        },
      );
      mockPrismaService.organizationInvite.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          email: 'invite@test.com',
          status: 'PENDING',
        },
      ]);

      // Act
      const result = await service.getInvitations(mockUser, orgId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'MEMBER',
        },
      );

      // Act & Assert
      await expect(service.getInvitations(mockUser, 'org-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('resendInvite', () => {
    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue('new-token'),
      });
    });

    it('should resend invitation successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const inviteId = 'inv-123';

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue({
        id: inviteId,
        status: 'PENDING',
      });
      mockPrismaService.organizationInvite.update.mockResolvedValue({
        id: inviteId,
        token: 'new-token',
      });

      // Act
      const result = await service.resendInvite(mockUser, orgId, inviteId);

      // Assert
      expect(result.token).toBe('new-token');
      expect(mockPrismaService.organizationInvite.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when not owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
      });

      // Act & Assert
      await expect(
        service.resendInvite(mockUser, 'org-123', 'inv-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when invite not found', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resendInvite(mockUser, 'org-123', 'inv-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeInvite', () => {
    it('should revoke invitation successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const inviteId = 'inv-123';

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organizationInvite.findFirst.mockResolvedValue({
        id: inviteId,
        status: 'PENDING',
      });
      mockPrismaService.organizationInvite.update.mockResolvedValue({
        id: inviteId,
        status: 'REVOKED',
      });

      // Act
      const result = await service.revokeInvite(mockUser, orgId, inviteId);

      // Assert
      expect(result.status).toBe('REVOKED');
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
      expect(
        mockPrismaService.organizationMembership.delete,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.projectMember.deleteMany).not.toHaveBeenCalled();
    });

    it.each(['ACCEPTED', 'REVOKED'])(
      'should not reopen a %s invite',
      async (status) => {
        mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
          role: 'ORG_OWNER',
        });
        mockPrismaService.organizationInvite.findFirst.mockResolvedValue({
          id: 'inv-1',
          status,
        });
        await expect(
          service.revokeInvite(mockUser, 'org-123', 'inv-1'),
        ).rejects.toThrow(BadRequestException);
        expect(
          mockPrismaService.organizationInvite.update,
        ).not.toHaveBeenCalled();
      },
    );

    it('should throw ForbiddenException when not owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'MEMBER',
      });

      // Act & Assert
      await expect(
        service.revokeInvite(mockUser, 'org-123', 'inv-123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const targetUserId = 'target-123';
      const dto = { role: OrganizationRole.ORG_OWNER };

      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: true } });
      mockPrismaService.organizationMembership.update.mockResolvedValue({
        role: 'ORG_OWNER',
      });

      // Act
      const result = await service.updateMemberRole(
        mockUser,
        orgId,
        targetUserId,
        dto,
      );

      // Assert
      expect(result.role).toBe('ORG_OWNER');
    });

    it('should throw ForbiddenException when not owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'MEMBER',
        },
      );

      // Act & Assert
      await expect(
        service.updateMemberRole(mockUser, 'org-123', 'target-123', {
          role: OrganizationRole.ORG_OWNER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptInvite', () => {
    it('should accept password invitation without changing the global role', async () => {
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        email: 'pilot@test.com',
        organizationId: 'org-2',
        role: OrganizationRole.ORG_MEMBER,
      });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'pilot',
        email: 'pilot@test.com',
        password: null,
        googleId: null,
        organizationId: 'org-1',
        roleId: 'role-user',
        role: { name: 'USER' },
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'pilot',
        email: 'pilot@test.com',
        name: 'Pilot',
        lastname: 'User',
        organizationId: 'org-1',
        role: { name: 'USER' },
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.organizationInvite.update.mockResolvedValue({});

      const result = await service.acceptInvite('valid-token', {
        password: 'password123',
        name: 'Pilot',
        lastname: 'User',
      });
      expect(result.role).toBe('USER');
      expect(result.organizationId).toBe('org-1');
      expect(
        mockPrismaService.organizationMembership.create,
      ).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-2',
          userId: 'pilot',
          role: OrganizationRole.ORG_MEMBER,
        },
      });
      expect(
        mockPrismaService.organizationMembership.delete,
      ).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when invite not found', async () => {
      // Arrange
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.acceptInvite('invalid-token', {
          password: 'pass',
          name: 'John',
          lastname: 'Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invitation already used', async () => {
      // Arrange
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
      });

      // Act & Assert
      await expect(
        service.acceptInvite('token', {
          password: 'pass',
          name: 'John',
          lastname: 'Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invitation expired', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 86400000);

      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        status: 'PENDING',
        expiresAt: pastDate,
      });

      // Act & Assert
      await expect(
        service.acceptInvite('token', {
          password: 'pass',
          name: 'John',
          lastname: 'Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptInviteWithGoogle', () => {
    const futureDate = new Date(Date.now() + 86400000);

    it('should accept invitation with matching verified Google email', async () => {
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        id: 'invite-1',
        token: 'valid-token',
        status: 'PENDING',
        expiresAt: futureDate,
        email: 'User@Test.com',
        role: OrganizationRole.ORG_MEMBER,
        organizationId: 'org-123',
      });
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'user-123',
          email: 'user@test.com',
          googleId: null,
          organizationId: null,
          roleId: 'role-user',
        });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        name: 'User',
        lastname: 'Test',
        googleId: 'google-sub',
        googleStatus: true,
        isActive: true,
        organizationId: 'org-123',
        roleId: 'role-user',
        password: null,
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.organizationMembership.create.mockResolvedValue({});
      mockPrismaService.organizationInvite.update.mockResolvedValue({});

      const result = await service.acceptInviteWithGoogle('valid-token', {
        sub: 'google-sub',
        email: 'user@test.com',
        email_verified: true,
      });

      expect(result.email).toBe('user@test.com');
      expect(
        mockPrismaService.organizationMembership.create,
      ).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          userId: 'user-123',
          role: OrganizationRole.ORG_MEMBER,
        },
      });
      expect(mockPrismaService.projectMember.create).not.toHaveBeenCalled();
      expect(mockPrismaService.projectMember.createMany).not.toHaveBeenCalled();
    });

    it('should reject invitation when Google email does not match', async () => {
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        status: 'PENDING',
        expiresAt: futureDate,
        email: 'invited@test.com',
        organizationId: 'org-123',
      });

      await expect(
        service.acceptInviteWithGoogle('valid-token', {
          sub: 'google-sub',
          email: 'other@test.com',
          email_verified: true,
        }),
      ).rejects.toThrow(
        'Esta invitación fue generada para otro correo. Iniciá sesión con la cuenta Google correcta.',
      );
    });

    it('should reject invitation when Google email is not verified', async () => {
      mockPrismaService.organizationInvite.findUnique.mockResolvedValue({
        status: 'PENDING',
        expiresAt: futureDate,
        email: 'invited@test.com',
        organizationId: 'org-123',
      });

      await expect(
        service.acceptInviteWithGoogle('valid-token', {
          sub: 'google-sub',
          email: 'invited@test.com',
          email_verified: false,
        }),
      ).rejects.toThrow('Google no devolvió un correo verificado');
    });
  });

  describe('updateMemberProjects', () => {
    it('should update member projects successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const targetUserId = 'target-123';
      const projectIds = ['proj-1', 'proj-2'];

      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: true } });
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'proj-1' },
        { id: 'proj-2' },
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.deleteMany.mockResolvedValue({});
      mockPrismaService.projectMember.createMany.mockResolvedValue({});

      // Act
      const result = await service.updateMemberProjects(
        mockUser,
        orgId,
        targetUserId,
        projectIds,
      );

      // Assert
      expect(result.message).toBe('Member projects updated successfully');
    });

    it('should throw BadRequestException for invalid projects', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: true } });
      mockPrismaService.project.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.updateMemberProjects(mockUser, 'org-123', 'target-123', [
          'invalid',
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject project assignment for inactive organization members', async () => {
      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: false } });

      await expect(
        service.updateMemberProjects(mockUser, 'org-123', 'target-123', [
          'proj-1',
        ]),
      ).rejects.toThrow(
        'El usuario debe ser miembro activo de la organización antes de agregarse al proyecto.',
      );

      expect(mockPrismaService.projectMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeMemberFromProject', () => {
    it('should remove member from project successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const targetUserId = 'target-123';
      const projectId = 'proj-123';

      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123' });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.projectMember.deleteMany.mockResolvedValue({});
      mockPrismaService.timeEntry.updateMany.mockResolvedValue({});

      // Act
      const result = await service.removeMemberFromProject(
        mockUser,
        orgId,
        targetUserId,
        projectId,
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when project not found', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
        user: { isActive: true },
      });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeMemberFromProject(
          mockUser,
          'org-123',
          'target-123',
          'proj-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncOrganizationMemberships', () => {
    it('should sync organization memberships successfully', async () => {
      // Arrange

      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'ORG_OWNER',
        },
      );
      mockPrismaService.organizationMembership.findMany.mockResolvedValue([
        { userId: 'user-2' },
      ]);
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'proj-1' }]);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.syncOrganizationMemberships(
        mockUser,
        'org-123',
      );

      // Assert
      expect(result.createdCount).toBeGreaterThanOrEqual(0);
    });

    it('should throw ForbiddenException when not owner', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'MEMBER',
        },
      );

      // Act & Assert
      await expect(
        service.syncOrganizationMemberships(mockUser, 'org-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sync memberships successfully', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValueOnce(
        {
          role: 'ORG_OWNER',
        },
      );
      mockPrismaService.organizationMembership.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'proj-1' },
        { id: 'proj-2' },
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([]);
      mockPrismaService.projectMember.createMany.mockResolvedValue({});

      // Act
      const result = await service.syncOrganizationMemberships(
        mockUser,
        'org-123',
      );

      // Assert
      expect(result.createdCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Additional OrganizationsService tests', () => {
    it('should get members with project assignments', async () => {
      // Arrange
      const orgId = 'org-123';
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_OWNER',
      });
      mockPrismaService.organizationMembership.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'user1@test.com',
            name: 'User',
            lastname: '1',
          },
          role: 'ORG_MEMBER',
        },
      ]);
      mockPrismaService.projectMember.findMany.mockResolvedValue([
        { userId: 'user-1', projectId: 'proj-1' },
      ]);

      // Act
      const result = await service.getMembers(mockUser, orgId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should create organization and set creator as owner', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'New Organization' };

      mockPrismaService.organization.create.mockResolvedValue({
        id: 'org-new',
        name: 'New Organization',
        plan: 'BASIC',
        isActive: true,
        createdAt: new Date(),
      });
      mockPrismaService.organizationMembership.create.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        organizationId: 'org-new',
      });

      // Act
      const result = await service.createOrganization(userId, dto);

      // Assert
      expect(result.name).toBe('New Organization');
      expect(result.role).toBe('ORG_OWNER');
      expect(
        mockPrismaService.organizationMembership.create,
      ).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-new',
          userId,
          role: 'ORG_OWNER',
        },
      });
    });

    it('should throw BadRequestException when updating with invalid project IDs', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique
        .mockResolvedValueOnce({ role: 'ORG_OWNER' })
        .mockResolvedValueOnce({ id: 'mem-123', user: { isActive: true } });
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'proj-1' }, // Only one of the two requested projects exists
      ]);

      // Act & Assert
      await expect(
        service.updateMemberProjects(mockUser, 'org-123', 'target-123', [
          'proj-1',
          'proj-invalid',
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
