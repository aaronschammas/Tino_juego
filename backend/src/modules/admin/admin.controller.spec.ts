import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateUserMemberDto } from './dto/create-user-member.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    getAllOrganizations: jest.fn(),
    createOrganization: jest.fn(),
    updateOrganization: jest.fn(),
    deleteOrganization: jest.fn(),
    addMemberToOrganization: jest.fn(),
    removeMemberFromOrganization: jest.fn(),
    updateUser: jest.fn(),
    getAllPlans: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    deletePlan: jest.fn(),
  };

  const mockAuthGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  describe('getAllOrganizations', () => {
    test('should call adminService.getAllOrganizations', async () => {
      // Arrange
      const expectedResult = [{ id: '1', name: 'Org 1' }];
      mockAdminService.getAllOrganizations.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getAllOrganizations();

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.getAllOrganizations).toHaveBeenCalledTimes(1);
    });
  });

  describe('createOrganization', () => {
    test('should call adminService.createOrganization with dto', async () => {
      // Arrange
      const dto: CreateOrganizationDto = { name: 'Org 1', planId: 'plan-1', isActive: true };
      const expectedResult = { id: 'org-1', ...dto };
      mockAdminService.createOrganization.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createOrganization(dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.createOrganization).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateOrganization', () => {
    test('should call adminService.updateOrganization with id and dto', async () => {
      // Arrange
      const id = 'org-123';
      const dto: UpdateOrganizationDto = { name: 'Org 1 Updated', planId: 'plan-2', isActive: false };
      const expectedResult = { id, ...dto };
      mockAdminService.updateOrganization.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateOrganization(id, dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.updateOrganization).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('deleteOrganization', () => {
    test('should call adminService.deleteOrganization with id', async () => {
      // Arrange
      const id = 'org-123';
      mockAdminService.deleteOrganization.mockResolvedValue({ id });

      // Act
      const result = await controller.deleteOrganization(id);

      // Assert
      expect(result).toEqual({ id });
      expect(mockAdminService.deleteOrganization).toHaveBeenCalledWith(id);
    });
  });

  describe('addMemberToOrganization', () => {
    test('should call adminService.addMemberToOrganization with id and dto', async () => {
      // Arrange
      const id = 'org-123';
      const dto: CreateUserMemberDto = {
        email: 'member@test.com',
        password: 'pass',
        name: 'John',
        lastname: 'Doe',
        role: 'ORG_MEMBER',
      };
      const expectedResult = { id: 'user-1', email: dto.email };
      mockAdminService.addMemberToOrganization.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.addMemberToOrganization(id, dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.addMemberToOrganization).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('removeMemberFromOrganization', () => {
    test('should call adminService.removeMemberFromOrganization with id and userId', async () => {
      // Arrange
      const id = 'org-123';
      const userId = 'user-456';
      mockAdminService.removeMemberFromOrganization.mockResolvedValue({ id, userId });

      // Act
      const result = await controller.removeMemberFromOrganization(id, userId);

      // Assert
      expect(result).toEqual({ id, userId });
      expect(mockAdminService.removeMemberFromOrganization).toHaveBeenCalledWith(id, userId);
    });
  });

  describe('updateUser', () => {
    test('should call adminService.updateUser with userId and dto', async () => {
      // Arrange
      const userId = 'user-123';
      const dto: UpdateUserDto = {
        name: 'New Name',
        lastname: 'New Last',
        email: 'new@test.com',
        password: 'newpass',
      };
      const expectedResult = { id: userId, ...dto };
      mockAdminService.updateUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateUser(userId, dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.updateUser).toHaveBeenCalledWith(userId, dto);
    });
  });

  describe('getAllPlans', () => {
    test('should call adminService.getAllPlans', async () => {
      // Arrange
      const expectedResult = [{ id: 'p1', title: 'Plan 1' }];
      mockAdminService.getAllPlans.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getAllPlans();

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.getAllPlans).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPlan', () => {
    test('should call adminService.createPlan with dto', async () => {
      // Arrange
      const dto = { name: 'pro', title: 'Plan Pro', price: 10 };
      const expectedResult = { id: 'p2', ...dto };
      mockAdminService.createPlan.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createPlan(dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.createPlan).toHaveBeenCalledWith(dto);
    });
  });

  describe('updatePlan', () => {
    test('should call adminService.updatePlan with id and dto', async () => {
      // Arrange
      const id = 'plan-1';
      const dto = { title: 'Plan Pro Edited', price: 15 };
      const expectedResult = { id, ...dto };
      mockAdminService.updatePlan.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updatePlan(id, dto);

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockAdminService.updatePlan).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('deletePlan', () => {
    test('should call adminService.deletePlan with id', async () => {
      // Arrange
      const id = 'plan-1';
      mockAdminService.deletePlan.mockResolvedValue({ id });

      // Act
      const result = await controller.deletePlan(id);

      // Assert
      expect(result).toEqual({ id });
      expect(mockAdminService.deletePlan).toHaveBeenCalledWith(id);
    });
  });
});
