import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './Users.Controller';
import { UsersService } from './Users.Service';
import { CreateUserDto } from './dto/CreateUserDto';
import { UpdateUserDto } from './dto/UpdateUserDto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    createUser: jest.fn(),
    getUsers: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    deactivateUser: jest.fn(),
    activateUser: jest.fn(),
    getCurrentUser: jest.fn(),
  };
  const mockActiveOrganization = {
    resolveScopedUser: jest.fn((user) => Promise.resolve({ ...user, organizationId: 'org-123' })),
    getContextForRequest: jest.fn((user) => Promise.resolve({
      user: { ...user, organizationId: 'org-123' },
      activeOrganization: { id: 'org-123', name: 'Tino', plan: { name: 'free' } },
      activeMembership: { id: 'mem-123', role: 'ORG_OWNER' },
      memberships: [],
      features: { canInviteMembers: false, maxProjects: 2, maxMembers: 1 },
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ActiveOrganizationService,
          useValue: mockActiveOrganization,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        name: 'John',
        lastname: 'Doe',
      };

      const expectedUser = {
        id: 'user-123',
        ...createUserDto,
        googleStatus: true,
        createdAt: new Date(),
      };

      mockUsersService.createUser.mockResolvedValue(expectedUser);

      // Act
      const result = await controller.createUser(createUserDto);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(service.createUser).toHaveBeenCalledWith(createUserDto);
      expect(service.createUser).toHaveBeenCalledTimes(1);
    });

    it('should pass through service errors', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'error@example.com',
        name: 'Error',
        lastname: 'User',
      };

      const error = new Error('Email already exists');
      mockUsersService.createUser.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.createUser(createUserDto)).rejects.toThrow(
        'Email already exists',
      );
    });
  });

  describe('GET /users', () => {
    it('should get all users for current user', async () => {
      // Arrange
      const currentUser = { id: 'user-current-123' };
      const expectedUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User',
          lastname: 'One',
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User',
          lastname: 'Two',
        },
      ];

      mockUsersService.getUsers.mockResolvedValue(expectedUsers);

      // Act
      const result = await controller.getUsers(currentUser, {} as any);

      // Assert
      expect(result).toEqual(expectedUsers);
      expect(service.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ id: currentUser.id, organizationId: 'org-123' }),
      );
    });

    it('should return empty array if no users', async () => {
      // Arrange
      const currentUser = { id: 'user-empty-123' };
      mockUsersService.getUsers.mockResolvedValue([]);

      // Act
      const result = await controller.getUsers(currentUser, {} as any);

      // Assert
      expect(result).toEqual([]);
      expect(service.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ id: currentUser.id, organizationId: 'org-123' }),
      );
    });
  });

  describe('GET /users/:id', () => {
    it('should get user by id', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'user-current' };
      const expectedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'John',
        lastname: 'Doe',
        googleStatus: true,
      };

      mockUsersService.getUserById.mockResolvedValue(expectedUser);

      // Act
      const result = await controller.getUserById(userId, currentUser);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(service.getUserById).toHaveBeenCalledWith(userId, currentUser);
    });

    it('should handle non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-123';
      const currentUser = { id: 'user-current' };
      mockUsersService.getUserById.mockResolvedValue(null);

      // Act
      const result = await controller.getUserById(userId, currentUser);

      // Assert
      expect(result).toBeNull();
      expect(service.getUserById).toHaveBeenCalledWith(userId, currentUser);
    });

    it('should pass user context to service', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'user-current-456' };
      mockUsersService.getUserById.mockResolvedValue({});

      // Act
      await controller.getUserById(userId, currentUser);

      // Assert
      expect(service.getUserById).toHaveBeenCalledWith(
        userId,
        currentUser,
      );
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'user-current' };
      const updateUserDto: UpdateUserDto = {
        name: 'Updated',
        lastname: 'Name',
      };

      const updatedUser = {
        id: userId,
        ...updateUserDto,
        email: 'user@example.com',
      };

      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUser(userId, updateUserDto, currentUser);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(service.updateUser).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        currentUser,
      );
    });

    it('should support partial updates', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'user-current' };
      const updateUserDto: UpdateUserDto = {
        name: 'OnlyName',
      };

      const updatedUser = {
        id: userId,
        name: 'OnlyName',
        lastname: 'Original',
        email: 'user@example.com',
      };

      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateUser(userId, updateUserDto, currentUser);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(service.updateUser).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        currentUser,
      );
    });
  });

  describe('PATCH /users/:id/deactivate', () => {
    it('should deactivate user', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'admin-user' };
      const deactivatedUser = {
        id: userId,
        email: 'user@example.com',
        googleStatus: false,
      };

      mockUsersService.deactivateUser.mockResolvedValue(deactivatedUser);

      // Act
      const result = await controller.deactivateUser(userId, currentUser);

      // Assert
      expect(result).toEqual(deactivatedUser);
      expect(service.deactivateUser).toHaveBeenCalledWith(
        userId,
        currentUser,
      );
    });

    it('should pass error from service', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'admin-user' };
      const error = new Error('User not found');

      mockUsersService.deactivateUser.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.deactivateUser(userId, currentUser),
      ).rejects.toThrow('User not found');
    });
  });

  describe('PATCH /users/:id/activate', () => {
    it('should activate user', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'admin-user' };
      const activatedUser = {
        id: userId,
        email: 'user@example.com',
        googleStatus: true,
      };

      mockUsersService.activateUser.mockResolvedValue(activatedUser);

      // Act
      const result = await controller.activateUser(userId, currentUser);

      // Assert
      expect(result).toEqual(activatedUser);
      expect(service.activateUser).toHaveBeenCalledWith(userId, currentUser);
    });

    it('should pass error from service', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'admin-user' };
      const error = new Error('Cannot activate');

      mockUsersService.activateUser.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.activateUser(userId, currentUser),
      ).rejects.toThrow('Cannot activate');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const currentUser = { id: 'user-current' };
      const error = new Error('Database error');

      mockUsersService.getUserById.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getUserById(userId, currentUser),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Integration', () => {
    it('should handle complete user lifecycle', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'lifecycle@example.com',
        name: 'Lifecycle',
        lastname: 'User',
      };

      const newUser = { id: 'lifecycle-123', ...createUserDto, googleStatus: true };
      const currentUser = { id: 'admin-user' };

      // Create user
      mockUsersService.createUser.mockResolvedValue(newUser);
      const created = await controller.createUser(createUserDto);
      expect(created.id).toBe('lifecycle-123');

      // Get user
      mockUsersService.getUserById.mockResolvedValue(newUser);
      const retrieved = await controller.getUserById('lifecycle-123', currentUser);
      expect(retrieved.googleStatus).toBe(true);

      // Update user
      const updateDto: UpdateUserDto = { name: 'Updated' };
      const updated = { ...newUser, name: 'Updated' };
      mockUsersService.updateUser.mockResolvedValue(updated);
      const result = await controller.updateUser('lifecycle-123', updateDto, currentUser);
      expect(result.name).toBe('Updated');

      // Deactivate user
      const deactivated = { ...newUser, googleStatus: false };
      mockUsersService.deactivateUser.mockResolvedValue(deactivated);
      const deactivateResult = await controller.deactivateUser(
        'lifecycle-123',
        currentUser,
      );
      expect(deactivateResult.googleStatus).toBe(false);
    });
  });
});
