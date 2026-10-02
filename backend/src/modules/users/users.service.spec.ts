import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './Users.Service';
import { PrismaService } from 'src/database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { validateEmailDomain } from 'src/common/utils/email.util';

jest.mock('src/common/utils/email.util');

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      timeEntry: {
        deleteMany: jest.fn(),
      },
      task: {
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      projectMember: {
        deleteMany: jest.fn(),
      },
      project: {
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organizationInvite: {
        deleteMany: jest.fn(),
      },
      organizationMembership: {
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      authSession: {
        deleteMany: jest.fn(),
      },
    };

    // Default implementations
    mockPrismaService.role.findUnique.mockImplementation(({ where }) => {
      if (where.name === 'USER') return Promise.resolve({ id: 'role-user', name: 'USER' });
      if (where.name === 'ADMIN') return Promise.resolve({ id: 'role-admin', name: 'ADMIN' });
      if (where.name === 'SUPERADMIN') return Promise.resolve({ id: 'role-superadmin', name: 'SUPERADMIN' });
      return Promise.resolve(null);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const dto = {
        email: 'newuser@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'hashed-password',
      };
      const mockUser = {
        id: 'user-123',
        ...dto,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.createUser(dto);

      // Assert
      expect(result.id).toBe('user-123');
      expect(result.email).toBe(dto.email);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: dto.email,
          name: dto.name,
          lastname: dto.lastname,
          password: dto.password,
          isActive: true,
        }),
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      const dto = {
        email: 'existing@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'password',
      };
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-456',
        email: dto.email,
      });

      // Act & Assert
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
      await expect(service.createUser(dto)).rejects.toThrow('Email already in use');
    });

    it('should throw NotFoundException when USER role is missing in DB', async () => {
      // Arrange
      const dto = {
        email: 'newuser@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'password',
      };
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue(null); // Role not found

      // Act & Assert
      await expect(service.createUser(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentUser', () => {
    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('user-999')).rejects.toThrow(NotFoundException);
    });

    it('should return user with mapped fields and plans correctly when user has organization', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        googleId: 'g1',
        isEmailVerified: true,
        isActive: true,
        roleId: 'role-user',
        role: { name: ' USER ' },
        organizationId: 'org-1',
        organization: { plan: 'premium' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user-123');

      expect(result.role).toBe('USER');
      expect(result.organizationPlan).toBe('premium');
      expect(result.googleLinked).toBe(true);
    });

    it('should return null plan when user has no organization', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        googleId: null,
        isEmailVerified: false,
        isActive: true,
        roleId: 'role-user',
        role: { name: 'USER' },
        organizationId: null,
        organization: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user-123');

      expect(result.organizationPlan).toBeNull();
      expect(result.googleLinked).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should return user when requesting user is in same organization', async () => {
      // Arrange
      const userId = 'user-123';
      const requestingUser = { id: 'user-456', organizationId: 'org-123', role: 'USER' };
      const orgId = 'org-123';
      const mockUser = {
        id: userId,
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        organizationId: orgId,
        projectMembers: [],
        assignedTasks: [],
        organizationMemberships: [{ id: 'membership-1' }],
        role: { name: 'USER' },
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);

      // Act
      const result = await service.getUserById(userId, requestingUser);

      // Assert
      expect(result.id).toBe(userId);
      expect(result.email).toBe('user@test.com');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            projectMembers: expect.objectContaining({
              where: {
                project: { isActive: true, organizationId: 'org-123' },
              },
            }),
            assignedTasks: expect.objectContaining({
              where: {
                project: { isActive: true, organizationId: 'org-123' },
              },
            }),
            organizationMemberships: expect.objectContaining({
              where: { organizationId: 'org-123' },
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when requesting user not in organization', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getUserById('user-123', { id: 'requesting-user', organizationId: null, role: 'USER' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getUserById('user-999', { id: 'requesting-user', organizationId: 'org-123', role: 'USER' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user in different organization', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        organizationId: 'org-different',
        organizationMemberships: [],
      });

      // Act & Assert
      await expect(
        service.getUserById('user-123', { id: 'requesting-user', organizationId: 'org-123', role: 'USER' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsers', () => {
    it('should return active users from organization', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockUser = { organizationId: orgId };
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          organizationId: orgId,
          projectMembers: [],
          role: { name: 'USER' },
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          organizationId: orgId,
          projectMembers: [],
          role: { name: 'USER' },
        },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      // Act
      const result = await service.getUsers({ id: userId, organizationId: orgId, role: 'USER' });

      // Assert
      expect(result).toHaveLength(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
                organizationMemberships: { some: { organizationId: orgId } },
          }),
          select: expect.objectContaining({
            projectMembers: expect.objectContaining({
              where: {
                project: { isActive: true, organizationId: orgId },
              },
            }),
            assignedTasks: expect.objectContaining({
              where: {
                project: { isActive: true, organizationId: orgId },
              },
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when user not in organization', async () => {
      // Act & Assert
      await expect(service.getUsers({ id: 'user-123', organizationId: null, role: 'USER' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should reject updating another user before reading or writing it', async () => {
      await expect(service.updateUser(
        'user-b', { email: 'changed@test.com' },
        { id: 'user-a', organizationId: 'org-1', role: 'USER' },
      )).rejects.toThrow('You can only update your own account');
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
    it('should update user successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const requestingUser = { id: userId, organizationId: 'org-123', role: 'USER' };
      const orgId = 'org-123';
      const dto = { name: 'Jane' };
      const mockUser = {
        id: userId,
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        organizationId: orgId,
        projectMembers: [],
        assignedTasks: [],
        organizationMemberships: [{ id: 'membership-1' }],
        role: { name: 'USER' },
      };
      const mockUpdatedUser = {
        id: userId,
        email: 'user@test.com',
        name: 'Jane',
        lastname: 'Doe',
        role: { name: 'USER' },
        organization: { plan: 'free' },
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUpdatedUser);
      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.updateUser(userId, dto, requestingUser);

      // Assert
      expect(result.name).toBe('Jane');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: dto,
      });
    });

    it('should reject password changes through the general user update endpoint', async () => {
      const userId = 'user-123';
      const requestingUser = { id: userId, organizationId: 'org-123', role: 'USER' };
      const mockUser = {
        id: userId,
        email: 'user@test.com',
        organizationId: 'org-123',
        projectMembers: [],
        assignedTasks: [],
        organizationMemberships: [{ id: 'membership-1' }],
        role: { name: 'USER' },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updateUser(userId, { password: 'newpassword' }, requestingUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(validateEmailDomain).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUser / activateUser', () => {
    it('should deactivate user isActive to false', async () => {
      const mockUser = { id: 'user-1', email: 'u@test.com', organizationId: 'org-1' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-1', isActive: false });

      const result = await service.deactivateUser('user-1', { id: 'root', role: 'SUPERADMIN' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
    });

    it('should activate user isActive to true', async () => {
      const mockUser = { id: 'user-1', email: 'u@test.com', organizationId: 'org-1' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-1', isActive: true });

      const result = await service.activateUser('user-1', { id: 'root', role: 'SUPERADMIN' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: true },
      });
    });
  });

  describe('linkGoogleAccount', () => {
    it('should reject linking Google through the legacy endpoint for regular users', async () => {
      await expect(service.linkGoogleAccount(
        'user-b', 'google-b', { id: 'user-a', role: 'USER' },
      )).rejects.toThrow('Only SUPERADMIN');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
    it('should set googleId and googleStatus true', async () => {
      // Arrange
      const userId = 'user-123';
      const googleId = 'google-abc';
      const updatedUser = {
        id: userId,
        googleId,
        googleStatus: true,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.linkGoogleAccount(userId, googleId, { id: 'root', role: 'SUPERADMIN' });

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { googleId, googleStatus: true },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('unlinkGoogleAccount', () => {
    it('should reject unlinking another user through the legacy endpoint', async () => {
      await expect(service.unlinkGoogleAccount(
        'user-b', { id: 'user-a', role: 'USER' },
      )).rejects.toThrow('Only SUPERADMIN');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
    it('should set googleStatus false and keep googleId', async () => {
      // Arrange
      const userId = 'user-123';
      const googleId = 'google-abc';
      const updatedUser = {
        id: userId,
        googleId,
        googleStatus: false,
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.unlinkGoogleAccount(userId, { id: 'root', role: 'SUPERADMIN' });

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { googleStatus: false },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('deleteAccount', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('user-999')).rejects.toThrow(NotFoundException);
    });

    it('deletes organization and all its users if user is ADMIN', async () => {
      const mockUser = {
        id: 'user-1',
        role: { name: 'ADMIN' },
        organizationId: 'org-1',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      const result = await service.deleteAccount('user-1');

      expect(mockPrismaService.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(mockPrismaService.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['user-1', 'user-2'] } } });
      expect(result).toEqual({ success: true, message: 'Account deleted successfully' });
    });

    it('deletes organization and all its users if user is SUPERADMIN', async () => {
      const mockUser = {
        id: 'user-1',
        role: { name: 'SUPERADMIN' },
        organizationId: 'org-1',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      const result = await service.deleteAccount('user-1');

      expect(mockPrismaService.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-1' } });
      expect(result.success).toBe(true);
    });

    it('deletes only the user itself if role is USER', async () => {
      const mockUser = {
        id: 'user-3',
        role: { name: 'USER' },
        organizationId: 'org-1',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.deleteAccount('user-3');

      expect(mockPrismaService.organization.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: 'user-3' } });
      expect(result.success).toBe(true);
    });
  });
});
