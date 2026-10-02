import { Test, TestingModule } from '@nestjs/testing';
import { PlanPolicyService } from './plan-policy.service';
import { PrismaService } from 'src/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('PlanPolicyService', () => {
  let service: PlanPolicyService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      organization: {
        findUnique: jest.fn(),
      },
      project: {
        count: jest.fn(),
      },
      organizationMembership: {
        count: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanPolicyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PlanPolicyService>(PlanPolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  describe('assertPlanIsSelectable', () => {
    it('should pass if plan exists', async () => {
      mockPrismaService.plan.findUnique.mockResolvedValue({ id: '1', name: 'free' });
      await expect(service.assertPlanIsSelectable('free')).resolves.not.toThrow();
    });

    it('should throw if plan does not exist', async () => {
      mockPrismaService.plan.findUnique.mockResolvedValue(null);
      await expect(service.assertPlanIsSelectable('invalid')).rejects.toThrow();
    });
  });

  describe('canCreateProject', () => {
    it('should return true for free plan with 0 projects', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.project.count.mockResolvedValue(0);

      const result = await service.canCreateProject('org-123');
      expect(result).toBe(true);
    });

    it('should return false for free plan with 2 projects', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.project.count.mockResolvedValue(2);

      const result = await service.canCreateProject('org-123');
      expect(result).toBe(false);
    });

    it('should return true for pro plan even with many projects', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'pro', maxUsers: 10, maxProjects: null, hasEmailInvites: true } });
      mockPrismaService.project.count.mockResolvedValue(100);

      const result = await service.canCreateProject('org-123');
      expect(result).toBe(true);
    });
  });

  describe('assertCanCreateProject', () => {
    it('should not throw if limit not reached', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.project.count.mockResolvedValue(1);

      await expect(service.assertCanCreateProject('org-123')).resolves.not.toThrow();
    });

    it('should throw if limit reached', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.project.count.mockResolvedValue(2);

      await expect(service.assertCanCreateProject('org-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('canInviteUser', () => {
    it('should return false for free plan', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      const result = await service.canInviteUser('org-123');
      expect(result).toBe(false);
    });

    it('should return true for pro plan', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'pro', maxUsers: 10, maxProjects: null, hasEmailInvites: true } });
      const result = await service.canInviteUser('org-123');
      expect(result).toBe(true);
    });
  });

  describe('assertCanInviteUser', () => {
    it('should throw for free plan', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      await expect(service.assertCanInviteUser('org-123')).rejects.toThrow(BadRequestException);
    });

    it('should not throw for pro plan', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'pro', maxUsers: 10, maxProjects: null, hasEmailInvites: true } });
      await expect(service.assertCanInviteUser('org-123')).resolves.not.toThrow();
    });
  });

  describe('canAddMember', () => {
    it('should return true for free plan with 0 members', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.organizationMembership.count.mockResolvedValue(0);

      const result = await service.canAddMember('org-123');
      expect(result).toBe(true);
    });

    it('should return false for free plan with 1 member', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.organizationMembership.count.mockResolvedValue(1);

      const result = await service.canAddMember('org-123');
      expect(result).toBe(false);
    });

    it('should return true for pro plan with many members', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'pro', maxUsers: null, maxProjects: null, hasEmailInvites: true } });
      mockPrismaService.organizationMembership.count.mockResolvedValue(100);

      const result = await service.canAddMember('org-123');
      expect(result).toBe(true);
    });
  });

  describe('assertCanAddMember', () => {
    it('should not throw if limit not reached', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.organizationMembership.count.mockResolvedValue(0);

      await expect(service.assertCanAddMember('org-123')).resolves.not.toThrow();
    });

    it('should throw if limit reached', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: { name: 'free', maxUsers: 1, maxProjects: 2, hasEmailInvites: false } });
      mockPrismaService.organizationMembership.count.mockResolvedValue(1);

      await expect(service.assertCanAddMember('org-123')).rejects.toThrow(BadRequestException);
    });
  });
});
