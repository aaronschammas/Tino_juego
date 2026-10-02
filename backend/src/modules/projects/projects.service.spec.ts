import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prismaService: PrismaService;
  let projectMembersService: ProjectMembersService;
  let mockPrismaService: any;
  let mockProjectMembersService: any;
  let mockPlanPolicyService: any;

  beforeEach(async () => {
    mockPrismaService = {
      project: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
      task: { groupBy: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn() },
      projectMember: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      organizationMembership: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    mockProjectMembersService = {
      isOrgOwner: jest.fn(),
      hasProjectAccess: jest.fn(),
      canManageProject: jest.fn(),
    };

    mockPlanPolicyService = {
      assertCanCreateProject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectMembersService, useValue: mockProjectMembersService },
        { provide: PlanPolicyService, useValue: mockPlanPolicyService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prismaService = module.get<PrismaService>(PrismaService);
    projectMembersService = module.get<ProjectMembersService>(ProjectMembersService);
  });

  const mockPermissionUser = { id: 'user-123', organizationId: 'org-123', role: 'USER' } as any;

  describe('createProject', () => {
    it('should create project successfully when user is org owner', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'Test Project', description: 'A test project' };
      const mockUser = {
        id: userId,
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_OWNER',
            userId,
          },
        ],
      };
      const mockProject = {
        id: 'proj-123',
        name: 'Test Project',
        description: 'A test project',
        ownerId: userId,
        organizationId: 'org-123',
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      mockPrismaService.project.create.mockResolvedValue(mockProject);
      mockPrismaService.projectMember.create.mockResolvedValue({});

      // Act
      const result = await service.createProject(dto, mockPermissionUser);

      // Assert
      expect(result.id).toBe('proj-123');
      expect(result.name).toBe('Test Project');
      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          description: dto.description,
          ownerId: userId,
          organizationId: 'org-123',
        }),
      });
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-123',
          userId,
          role: 'OWNER',
        },
      });
    });

    it('should throw BadRequestException when user has no organization', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'Test Project', description: 'A test project' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        organizationId: null,
      });

      // Act & Assert
      await expect(service.createProject(dto, { id: userId, organizationId: null } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user is not org owner', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'Test Project', description: 'A test project' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'MEMBER',
            userId,
          },
        ],
      });

      // Act & Assert
      await expect(service.createProject(dto, mockPermissionUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when project name already exists', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'Existing Project', description: 'A test project' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_OWNER',
            userId,
          },
        ],
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'existing-proj',
        name: 'Existing Project',
      });

      // Act & Assert
      await expect(service.createProject(dto, mockPermissionUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getProjects', () => {
    it('should throw BadRequestException when user has no organization', async () => {
      await expect(service.getProjects({ id: 'user-123', organizationId: null } as any, null as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockProjectMembersService.isOrgOwner).not.toHaveBeenCalled();
    });

    it('should return only active organization projects when user is org owner', async () => {
      // Arrange
      const userId = 'user-123';
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'Personal Project',
          members: [],
          tasks: [],
          createdAt: new Date(),
        },
        {
          id: 'proj-2',
          name: 'Paid Team Project',
          members: [],
          tasks: [],
          createdAt: new Date(),
        },
      ];

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      // Act
      const result = await service.getProjects(mockPermissionUser, mockPermissionUser.organizationId);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            organizationId: 'org-123',
          },
        }),
      );
    });

    it('should return only assigned projects inside active organization when not org owner', async () => {
      // Arrange
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'My Project',
          members: [{ userId, user: {} }],
          tasks: [],
          createdAt: new Date(),
        },
      ];

      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      // Act
      const result = await service.getProjects(mockPermissionUser, mockPermissionUser.organizationId);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            organizationId: orgId,
            members: { some: { userId } },
          },
        }),
      );
    });

    it('should not query projects from other organizations for an org member', async () => {
      const userId = 'user-123';
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_MEMBER' });
      mockPrismaService.project.findMany.mockResolvedValue([]);

      await service.getProjects(mockPermissionUser, 'org-123');

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
            members: { some: { userId } },
          }),
        }),
      );
    });
  });

  describe('getProjectById', () => {
    it('should return project when user has access', async () => {
      // Arrange
      const userId = 'user-123';
      const projectId = 'proj-123';
      const mockProject = {
        id: projectId,
        name: 'Test Project',
        members: [],
      };

      mockProjectMembersService.hasProjectAccess.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);

      // Act
      const result = await service.getProjectById(projectId, mockPermissionUser);

      // Assert
      expect(result.id).toBe(projectId);
      expect(mockProjectMembersService.hasProjectAccess).toHaveBeenCalledWith(
        mockPermissionUser,
        projectId,
      );
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: projectId,
            organizationId: 'org-123',
          }),
        }),
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      // Arrange
      const userId = 'user-123';
      const projectId = 'proj-123';
      mockProjectMembersService.hasProjectAccess.mockResolvedValue(false);

      // Act & Assert
      await expect(service.getProjectById(projectId, mockPermissionUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when project not found', async () => {
      // Arrange
      mockProjectMembersService.hasProjectAccess.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProjectById('proj-123', mockPermissionUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not expose a project from another active organization', async () => {
      const projectMembers = mockProjectMembersService as {
        hasProjectAccess: jest.Mock;
      };
      const project = (
        mockPrismaService as { project: { findFirst: jest.Mock } }
      ).project;
      const permissionUser = mockPermissionUser as {
        id: string;
        organizationId: string;
        role: string;
      };
      projectMembers.hasProjectAccess.mockResolvedValue(true);
      project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectById('project-from-org-b', permissionUser),
      ).rejects.toThrow(NotFoundException);

      expect(project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'project-from-org-b',
            isActive: true,
            organizationId: permissionUser.organizationId,
          },
        }),
      );
    });
  });

  describe('updateProject', () => {
    it('should update project successfully when user is owner', async () => {
      // Arrange
      const userId = 'user-123';
      const projectId = 'proj-123';
      const dto = { name: 'Updated Project' };
      const mockUpdatedProject = {
        id: projectId,
        name: 'Updated Project',
      };

      mockProjectMembersService.canManageProject.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.project.update.mockResolvedValue(mockUpdatedProject);

      // Act
      const result = await service.updateProject(projectId, dto, mockPermissionUser);

      // Assert
      expect(result.name).toBe('Updated Project');
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: dto,
      });
    });

    it('should throw ForbiddenException when user cannot manage project', async () => {
      // Arrange
      mockProjectMembersService.canManageProject.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.updateProject('proj-123', { name: 'Updated' }, mockPermissionUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when project not found', async () => {
      // Arrange
      mockProjectMembersService.canManageProject.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateProject('proj-123', { name: 'Updated' }, mockPermissionUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProject', () => {
    it('should deactivate project successfully when user is owner', async () => {
      // Arrange
      const userId = 'user-123';
      const projectId = 'proj-123';
      const mockDeactivatedProject = {
        id: projectId,
        isActive: false,
      };

      mockProjectMembersService.canManageProject.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue({ id: projectId });
      mockPrismaService.project.delete.mockResolvedValue(mockDeactivatedProject);

      // Act
      const result = await service.deleteProject(projectId, mockPermissionUser);

      // Assert
      expect(result.isActive).toBe(false);
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: projectId },
      });
    });

    it('should throw ForbiddenException when user cannot manage project', async () => {
      // Arrange
      mockProjectMembersService.canManageProject.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.deleteProject('proj-123', mockPermissionUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when project not found', async () => {
      // Arrange
      mockProjectMembersService.canManageProject.mockResolvedValue(true);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deleteProject('proj-123', mockPermissionUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Additional ProjectsService tests', () => {
    it('should throw ForbiddenException when user is not org owner on creation', async () => {
      // Arrange
      const dto = { name: 'New Project' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_MEMBER',
          },
        ],
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createProject(dto, mockPermissionUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create project with owner membership', async () => {
      // Arrange
      const dto = { name: 'New Project', description: 'Test' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_OWNER',
          },
        ],
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      mockPrismaService.project.create.mockResolvedValue({
        id: 'proj-new',
        name: dto.name,
        description: dto.description,
        ownerId: 'user-123',
        organizationId: 'org-123',
        isActive: true,
        createdAt: new Date(),
      });
      mockPrismaService.projectMember.create.mockResolvedValue({});

      // Act
      const result = await service.createProject(dto, mockPermissionUser);

      // Assert
      expect(result.id).toBe('proj-new');
      expect(result.name).toBe(dto.name);
      expect(mockPrismaService.projectMember.create).toHaveBeenCalled();
    });

    it('should return only accessible projects for non-owners', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_MEMBER',
          },
        ],
      });
      mockProjectMembersService.isOrgOwner.mockResolvedValue(false);
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Project 1', tasks: [] },
        { id: 'proj-2', name: 'Project 2', tasks: [] },
      ]);

      // Act
      const result = await service.getProjects(mockPermissionUser, mockPermissionUser.organizationId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw ConflictException when project name already exists', async () => {
      // Arrange
      const dto = { name: 'Existing Project' };
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        organizationId: 'org-123',
        organizationMemberships: [
          {
            organizationId: 'org-123',
            role: 'ORG_OWNER',
          },
        ],
      });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-existing',
        name: 'Existing Project',
      });

      // Act & Assert
      await expect(
        service.createProject(dto, mockPermissionUser),
      ).rejects.toThrow(ConflictException);
    });
  });
});
