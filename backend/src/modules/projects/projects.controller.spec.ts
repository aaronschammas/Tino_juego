import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { CreateProjectDto } from './dto/create-project';
import { UpdateProjectDto } from './dto/update-project';
import { AddMemberDto } from './dto/add-member.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let membersService: ProjectMembersService;

  const mockProjectsService = {
    createProject: jest.fn(),
    getProjects: jest.fn(),
    getProjectById: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  };

  const mockProjectMembersService = {
    addMember: jest.fn(),
    getMembers: jest.fn(),
    removeMember: jest.fn(),
  };

  const mockActiveOrganization = {
    resolveScopedUser: jest.fn((user) => Promise.resolve(user)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: ProjectMembersService,
          useValue: mockProjectMembersService,
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
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get<ProjectsService>(ProjectsService);
    membersService = module.get<ProjectMembersService>(ProjectMembersService);
  });

  describe('POST /projects', () => {
    it('should create a new project', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        description: 'Project description',
      };

      const expectedProject = {
        id: 'project-123',
        ...createProjectDto,
        isActive: true,
        createdAt: new Date(),
      };

      mockProjectsService.createProject.mockResolvedValue(expectedProject);

      // Act
      const result = await controller.createProject(createProjectDto, currentUser, {} as any);

      // Assert
      expect(result).toEqual(expectedProject);
      expect(projectsService.createProject).toHaveBeenCalledWith(
        createProjectDto,
        currentUser,
      );
    });

    it('should handle project creation errors', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const createProjectDto: CreateProjectDto = {
        name: 'Error Project',
      };

      const error = new Error('Project name already exists');
      mockProjectsService.createProject.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createProject(createProjectDto, currentUser, {} as any),
      ).rejects.toThrow('Project name already exists');
    });
  });

  describe('GET /projects', () => {
    it('should get all projects for user', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };
      const expectedProjects = [
        { id: 'project-1', name: 'Project 1', isActive: true },
        { id: 'project-2', name: 'Project 2', isActive: true },
      ];

      mockProjectsService.getProjects.mockResolvedValue(expectedProjects);

      // Act
      const result = await controller.getProjects(currentUser, {} as any);

      // Assert
      expect(result).toEqual(expectedProjects);
      expect(projectsService.getProjects).toHaveBeenCalledWith(
        currentUser,
        currentUser.organizationId,
      );
    });

    it('should return empty array if no projects', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      mockProjectsService.getProjects.mockResolvedValue([]);

      // Act
      const result = await controller.getProjects(currentUser, {} as any);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('GET /projects/:id', () => {
    it('should get project by id', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const expectedProject = {
        id: projectId,
        name: 'Detailed Project',
        description: 'With details',
        isActive: true,
      };

      mockProjectsService.getProjectById.mockResolvedValue(expectedProject);

      // Act
      const result = await controller.getProjectById(projectId, currentUser);

      // Assert
      expect(result).toEqual(expectedProject);
      expect(projectsService.getProjectById).toHaveBeenCalledWith(
        projectId,
        currentUser,
      );
    });

    it('should handle non-existent project', async () => {
      // Arrange
      const projectId = 'non-existent';
      const currentUser = { id: 'user-123' };

      mockProjectsService.getProjectById.mockResolvedValue(null);

      // Act
      const result = await controller.getProjectById(projectId, currentUser);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('PATCH /projects/:id', () => {
    it('should update project', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      const updatedProject = {
        id: projectId,
        ...updateProjectDto,
        isActive: true,
      };

      mockProjectsService.updateProject.mockResolvedValue(updatedProject);

      // Act
      const result = await controller.updateProject(
        projectId,
        updateProjectDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(updatedProject);
      expect(projectsService.updateProject).toHaveBeenCalledWith(
        projectId,
        updateProjectDto,
        currentUser,
      );
    });

    it('should support partial updates', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const updateProjectDto: UpdateProjectDto = {
        name: 'Only Name Updated',
      };

      const updatedProject = {
        id: projectId,
        name: 'Only Name Updated',
        description: 'Original description',
        isActive: true,
      };

      mockProjectsService.updateProject.mockResolvedValue(updatedProject);

      // Act
      const result = await controller.updateProject(
        projectId,
        updateProjectDto,
        currentUser,
      );

      // Assert
      expect(result).toEqual(updatedProject);
    });
  });

  describe('PATCH /projects/:id/deactivate', () => {
    it('should deactivate project', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const deactivatedProject = {
        id: projectId,
        name: 'Inactive Project',
        isActive: false,
      };

      mockProjectsService.deleteProject.mockResolvedValue(deactivatedProject);

      // Act
      const result = await controller.deleteProject(projectId, currentUser);

      // Assert
      expect(result.isActive).toBe(false);
      expect(projectsService.deleteProject).toHaveBeenCalledWith(
        projectId,
        currentUser,
      );
    });

    it('should handle deactivation errors', async () => {
      // Arrange
      const projectId = 'project-123';
      const currentUser = { id: 'user-123' };
      const error = new Error('Project not found');

      mockProjectsService.deleteProject.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.deleteProject(projectId, currentUser),
      ).rejects.toThrow('Project not found');
    });
  });

  describe('Integration', () => {
    it('should handle complete project lifecycle', async () => {
      // Arrange
      const currentUser = { id: 'user-123', organizationId: 'org-123' };

      // Create project
      const createDto: CreateProjectDto = {
        name: 'Lifecycle Project',
      };

      const newProject = {
        id: 'project-123',
        ...createDto,
        isActive: true,
      };

      mockProjectsService.createProject.mockResolvedValue(newProject);
      const created = await controller.createProject(createDto, currentUser, {} as any);
      expect(created.id).toBe('project-123');

      // Get project
      mockProjectsService.getProjectById.mockResolvedValue(newProject);
      const retrieved = await controller.getProjectById('project-123', currentUser);
      expect(retrieved.isActive).toBe(true);

      // Update project
      const updateDto: UpdateProjectDto = {
        name: 'Updated Lifecycle Project',
      };
      const updated = { ...newProject, name: 'Updated Lifecycle Project' };
      mockProjectsService.updateProject.mockResolvedValue(updated);
      const updateResult = await controller.updateProject(
        'project-123',
        updateDto,
        currentUser,
      );
      expect(updateResult.name).toBe('Updated Lifecycle Project');

      // Deactivate project
      const deactivated = { ...newProject, isActive: false };
      mockProjectsService.deleteProject.mockResolvedValue(deactivated);
      const deactivateResult = await controller.deleteProject(
        'project-123',
        currentUser,
      );
      expect(deactivateResult.isActive).toBe(false);
    });
  });
});
