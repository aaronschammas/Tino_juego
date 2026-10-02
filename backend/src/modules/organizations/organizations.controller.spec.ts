import { Test, TestingModule } from '@nestjs/testing';
import {
  OrganizationsController,
  InvitesPublicController,
} from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';
import { OrganizationRole } from '@prisma/client';
import type { InviteMembersDto } from './dto/invite-members.dto';
import type { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import type { AcceptInviteDto } from './dto/accept-invite.dto';

const createOrganizationsServiceMock = () => ({
  createOrganization: jest.fn(),
  getMyOrganization: jest.fn(),
  getMembers: jest.fn(),
  inviteMember: jest.fn(),
  getInvitations: jest.fn(),
  resendInvite: jest.fn(),
  revokeInvite: jest.fn(),
  updateMemberRole: jest.fn(),
  updateOrganizationPlan: jest.fn(),
  removeMember: jest.fn(),
  updateMemberProjects: jest.fn(),
  removeMemberFromProject: jest.fn(),
  syncOrganizationMemberships: jest.fn(),
  getOrganizationById: jest.fn(),
  getInviteByToken: jest.fn(),
  acceptInvite: jest.fn(),
});

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let mockOrganizationsService: ReturnType<
    typeof createOrganizationsServiceMock
  >;

  beforeEach(async () => {
    mockOrganizationsService = createOrganizationsServiceMock();
    const mockActiveOrganization = {
      resolveScopedUser: jest.fn((user) =>
        Promise.resolve({ ...user, organizationId: 'org-123' }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockOrganizationsService },
        {
          provide: ActiveOrganizationService,
          useValue: mockActiveOrganization,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  describe('createOrganization', () => {
    it('should call organizationsService.createOrganization', async () => {
      // Arrange
      const user = { id: 'user-123' };
      const dto = { name: 'New Org' };
      mockOrganizationsService.createOrganization.mockResolvedValue({
        id: 'org-123',
        ...dto,
      });

      // Act
      const result = await controller.createOrganization(user, dto);

      // Assert
      expect(result.id).toBe('org-123');
      expect(mockOrganizationsService.createOrganization).toHaveBeenCalledWith(
        user.id,
        dto,
      );
    });
  });

  describe('getMembers', () => {
    it('should get org first then members', async () => {
      // Arrange
      const user = { id: 'user-123' };
      mockOrganizationsService.getMembers.mockResolvedValue([]);

      // Act
      await controller.getMembers(user);

      // Assert
      expect(mockOrganizationsService.getMembers).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, organizationId: 'org-123' }),
        'org-123',
      );
    });
  });

  describe('inviteMember', () => {
    it('should call organizationsService.inviteMember', async () => {
      // Arrange
      const user = { id: 'user-123' };
      const dto: InviteMembersDto = {
        email: 'test@example.com',
        role: OrganizationRole.ORG_MEMBER,
      };
      mockOrganizationsService.inviteMember.mockResolvedValue({
        inviteLink: 'http://link',
        email: dto.email,
      });

      // Act
      const result = await controller.inviteMember(user, dto);

      // Assert
      expect(result.inviteLink).toBe('http://link');
      expect(mockOrganizationsService.inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, organizationId: 'org-123' }),
        'org-123',
        dto,
      );
    });
  });

  describe('updateOrganizationPlan', () => {
    it('should call organizationsService.updateOrganizationPlan', async () => {
      // Arrange
      const user = { id: 'user-123' };
      const dto: UpdateOrganizationPlanDto = { plan: 'pro' };
      mockOrganizationsService.updateOrganizationPlan.mockResolvedValue({
        id: 'org-123',
        plan: 'pro',
      });

      // Act
      const result = await controller.updateOrganizationPlan(user, dto);

      // Assert
      expect(result.plan).toBe('pro');
      expect(
        mockOrganizationsService.updateOrganizationPlan,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, organizationId: 'org-123' }),
        'org-123',
        dto,
      );
    });
  });

  describe('syncMemberships', () => {
    it('should call syncOrganizationMemberships', async () => {
      // Arrange
      const user = { id: 'user-123' };
      mockOrganizationsService.syncOrganizationMemberships.mockResolvedValue({
        createdCount: 1,
      });

      // Act
      const result = await controller.syncMemberships(user);

      // Assert
      expect(result.createdCount).toBe(1);
      expect(
        mockOrganizationsService.syncOrganizationMemberships,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, organizationId: 'org-123' }),
        'org-123',
      );
    });
  });
});

describe('InvitesPublicController', () => {
  let controller: InvitesPublicController;
  let mockOrganizationsService: ReturnType<
    typeof createOrganizationsServiceMock
  >;

  beforeEach(async () => {
    mockOrganizationsService = createOrganizationsServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitesPublicController],
      providers: [
        { provide: OrganizationsService, useValue: mockOrganizationsService },
      ],
    }).compile();

    controller = module.get<InvitesPublicController>(InvitesPublicController);
  });

  describe('acceptInvite', () => {
    it('should call organizationsService.acceptInvite', async () => {
      // Arrange
      const token = 'token-123';
      const dto: AcceptInviteDto = {
        password: 'password',
        name: 'User',
        lastname: 'Test',
      };
      const acceptedUser = {
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        lastname: 'Test',
        organizationId: 'org-1',
        role: 'USER',
      };
      mockOrganizationsService.acceptInvite.mockResolvedValue(acceptedUser);

      // Act
      const result = await controller.acceptInvite(token, dto);

      // Assert
      expect(result).toEqual(acceptedUser);
      expect(mockOrganizationsService.acceptInvite).toHaveBeenCalledWith(
        token,
        dto,
      );
    });

    it('should throw BadRequestException if token is missing', async () => {
      // Arrange
      const token = '';
      const dto: AcceptInviteDto = {
        password: '',
        name: '',
        lastname: '',
      };

      // Act & Assert
      await expect(controller.acceptInvite(token, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
