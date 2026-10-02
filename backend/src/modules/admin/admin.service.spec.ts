import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organization: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    organizationMembership: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    plan: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAllOrganizations', () => {
    test('should return all organizations with inclusions', async () => {
      // Arrange
      const mockOrgs = [{ id: 'org-1', name: 'Org One' }];
      mockPrismaService.organization.findMany.mockResolvedValue(mockOrgs);

      // Act
      const result = await service.getAllOrganizations();

      // Assert
      expect(result).toEqual(mockOrgs);
      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith({
        include: {
          users: true,
          plan: true,
          memberships: {
            include: {
              user: true,
            },
          },
        },
      });
    });
  });

  describe('createOrganization', () => {
    test('should create an organization with provided values', async () => {
      // Arrange
      const dto = { name: 'New Org', planId: 'plan-1', isActive: true };
      const createdOrg = { id: 'org-uuid', ...dto };
      mockPrismaService.organization.create.mockResolvedValue(createdOrg);

      // Act
      const result = await service.createOrganization(dto);

      // Assert
      expect(result).toEqual(createdOrg);
      expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          planId: dto.planId,
          isActive: dto.isActive,
        },
      });
    });

    test('should default isActive to true when not provided', async () => {
      // Arrange
      const dto = { name: 'New Org', planId: 'plan-1' };
      const createdOrg = { id: 'org-uuid', ...dto, isActive: true };
      mockPrismaService.organization.create.mockResolvedValue(createdOrg);

      // Act
      await service.createOrganization(dto);

      // Assert
      expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
        }),
      });
    });
  });

  describe('updateOrganization', () => {
    const id = 'org-123';
    const dto = { name: 'Updated Org', planId: 'plan-2', isActive: false };

    test('should update organization when found', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue({ id });
      mockPrismaService.organization.update.mockResolvedValue({ id, ...dto });

      // Act
      const result = await service.updateOrganization(id, dto);

      // Assert
      expect(result).toEqual({ id, ...dto });
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id },
        data: dto,
      });
    });

    test('should throw NotFoundException when organization not found', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateOrganization(id, dto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteOrganization', () => {
    const id = 'org-123';

    test('should delete organization when found', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue({ id });
      mockPrismaService.organization.delete.mockResolvedValue({ id, name: 'Deleted Org' });

      // Act
      const result = await service.deleteOrganization(id);

      // Assert
      expect(result).toEqual({ id, name: 'Deleted Org' });
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.organization.delete).toHaveBeenCalledWith({ where: { id } });
    });

    test('should throw NotFoundException when organization not found', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteOrganization(id)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.organization.delete).not.toHaveBeenCalled();
    });
  });

  describe('addMemberToOrganization', () => {
    const orgId = 'org-123';
    const dto = {
      email: '  NewMember@example.com  ',
      password: 'password123',
      name: 'John',
      lastname: 'Doe',
      role: 'ORG_OWNER',
    };

    test('should add member successfully', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: orgId });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-user-uuid', name: 'USER' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-uuid',
        email: 'newmember@example.com',
      });
      mockPrismaService.organizationMembership.create.mockResolvedValue({});

      // Act
      const result = await service.addMemberToOrganization(orgId, dto);

      // Assert
      expect(result).toEqual({ id: 'new-user-uuid', email: 'newmember@example.com' });
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({ where: { id: orgId } });
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'newmember@example.com', mode: 'insensitive' } },
      });
      expect(mockPrismaService.role.findUnique).toHaveBeenCalledWith({ where: { name: 'USER' } });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newmember@example.com',
          name: 'John',
          lastname: 'Doe',
          password: 'hashed_password',
          roleId: 'role-user-uuid',
          isActive: true,
          organizationId: orgId,
        }),
      });
      expect(mockPrismaService.organizationMembership.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          userId: expect.any(String),
          role: 'ORG_OWNER',
        },
      });
    });

    test('should throw NotFoundException if organization does not exist', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addMemberToOrganization(orgId, dto)).rejects.toThrow(NotFoundException);
    });

    test('should throw BadRequestException if email already registered', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: orgId });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'existing-user-id' });

      // Act & Assert
      await expect(service.addMemberToOrganization(orgId, dto)).rejects.toThrow(
        new BadRequestException('El email ya está registrado')
      );
    });

    test('should throw BadRequestException if roles not initialized', async () => {
      // Arrange
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: orgId });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addMemberToOrganization(orgId, dto)).rejects.toThrow(
        new BadRequestException('Configuración de roles no inicializada')
      );
    });
  });

  describe('removeMemberFromOrganization', () => {
    const orgId = 'org-123';
    const userId = 'user-456';

    test('should remove member when membership exists', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({
        organizationId: orgId,
        userId,
      });
      mockPrismaService.organizationMembership.delete.mockResolvedValue({
        organizationId: orgId,
        userId,
      });

      // Act
      const result = await service.removeMemberFromOrganization(orgId, userId);

      // Assert
      expect(result).toEqual({ organizationId: orgId, userId });
      expect(mockPrismaService.organizationMembership.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: orgId, userId },
        },
      });
      expect(mockPrismaService.organizationMembership.delete).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: orgId, userId },
        },
      });
    });

    test('should throw NotFoundException when membership does not exist', async () => {
      // Arrange
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeMemberFromOrganization(orgId, userId)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrismaService.organizationMembership.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    const userId = 'user-123';
    const mockUser = { id: userId, email: 'original@example.com', name: 'John', lastname: 'Doe' };

    test('should update basic user details without password or email change', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'John Changed',
      });

      // Act
      const result = await service.updateUser(userId, { name: 'John Changed' });

      // Assert
      expect(result).toEqual({ ...mockUser, name: 'John Changed' });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: 'John Changed' },
      });
    });

    test('should hash new password if provided', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser });

      // Act
      await service.updateUser(userId, { password: 'newpassword' });

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'new_hashed_password' },
      });
    });

    test('should update email if it is new and unique', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, email: 'new@example.com' });

      // Act
      const result = await service.updateUser(userId, { email: '  New@example.com  ' });

      // Assert
      expect(result.email).toBe('new@example.com');
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'new@example.com', mode: 'insensitive' } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: 'new@example.com' },
      });
    });

    test('should throw BadRequestException if new email is already in use by another user', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'other-user-id' });

      // Act & Assert
      await expect(service.updateUser(userId, { email: 'inuse@example.com' })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    test('should throw NotFoundException if user not found', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateUser(userId, { name: 'John' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllPlans', () => {
    test('should return all plans ordered by price', async () => {
      // Arrange
      const mockPlans = [{ id: 'plan-1', price: 0 }, { id: 'plan-2', price: 10 }];
      mockPrismaService.plan.findMany.mockResolvedValue(mockPlans);

      // Act
      const result = await service.getAllPlans();

      // Assert
      expect(result).toEqual(mockPlans);
      expect(mockPrismaService.plan.findMany).toHaveBeenCalledWith({
        orderBy: { price: 'asc' },
      });
    });
  });

  describe('createPlan', () => {
    test('should create a plan with all fields', async () => {
      // Arrange
      const dto = {
        name: 'pro',
        title: 'Plan Pro',
        description: 'Advanced plan',
        price: 15,
        maxUsers: 20,
        maxProjects: 50,
        hasAnalytics: true,
        hasSso: true,
      };
      const createdPlan = { id: 'plan-pro-id', ...dto };
      mockPrismaService.plan.create.mockResolvedValue(createdPlan);

      // Act
      const result = await service.createPlan(dto);

      // Assert
      expect(result).toEqual(createdPlan);
      expect(mockPrismaService.plan.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          title: dto.title,
          description: dto.description,
          price: dto.price,
          maxUsers: dto.maxUsers,
          maxProjects: dto.maxProjects,
          hasAnalytics: true,
          hasSso: true,
          hasPrioritySupport: false,
          hasEmailInvites: false,
          hasAdvancedPerms: false,
          hasAudit: false,
        },
      });
    });
  });

  describe('updatePlan', () => {
    const id = 'plan-pro';
    const dto = {
      name: 'pro-edited',
      title: 'Plan Pro Editado',
      description: 'Edited description',
      price: 20,
      maxUsers: 30,
      maxProjects: 100,
      hasAnalytics: true,
      hasSso: false,
      hasPrioritySupport: true,
      hasEmailInvites: true,
      hasAdvancedPerms: true,
      hasAudit: true,
    };

    test('should update plan when found', async () => {
      // Arrange
      mockPrismaService.plan.findUnique.mockResolvedValue({ id });
      mockPrismaService.plan.update.mockResolvedValue({ id, ...dto });

      // Act
      const result = await service.updatePlan(id, dto);

      // Assert
      expect(result).toEqual({ id, ...dto });
      expect(mockPrismaService.plan.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.plan.update).toHaveBeenCalledWith({
        where: { id },
        data: dto,
      });
    });

    test('should throw NotFoundException when plan not found', async () => {
      // Arrange
      mockPrismaService.plan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updatePlan(id, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePlan', () => {
    const id = 'plan-to-delete';

    test('should delete plan when found and not in use', async () => {
      // Arrange
      mockPrismaService.plan.findUnique.mockResolvedValue({ id });
      mockPrismaService.organization.findFirst.mockResolvedValue(null);
      mockPrismaService.plan.delete.mockResolvedValue({ id, name: 'Deleted Plan' });

      // Act
      const result = await service.deletePlan(id);

      // Assert
      expect(result).toEqual({ id, name: 'Deleted Plan' });
      expect(mockPrismaService.plan.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.organization.findFirst).toHaveBeenCalledWith({
        where: { planId: id },
      });
      expect(mockPrismaService.plan.delete).toHaveBeenCalledWith({ where: { id } });
    });

    test('should throw NotFoundException when plan not found', async () => {
      // Arrange
      mockPrismaService.plan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deletePlan(id)).rejects.toThrow(NotFoundException);
    });

    test('should throw BadRequestException when plan is in use by organizations', async () => {
      // Arrange
      mockPrismaService.plan.findUnique.mockResolvedValue({ id });
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-using-plan' });

      // Act & Assert
      await expect(service.deletePlan(id)).rejects.toThrow(
        new BadRequestException('No se puede eliminar el plan porque está en uso por organizaciones')
      );
      expect(mockPrismaService.plan.delete).not.toHaveBeenCalled();
    });
  });
});
