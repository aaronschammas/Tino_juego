/**
 * useProjects.ts - useProjects Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects, resetProjectsStore } from './useProjects';
import * as apiLib from '@/lib/api';
import * as useAuthModule from './useAuth';
import { Project, CreateProjectDto, UpdateProjectDto, Priority } from '@/types/project';
import { User } from '@/types/user';

// Mock the modules
jest.mock('@/lib/api');
jest.mock('./useAuth');

describe('useProjects Hook', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER' as const,
    isActive: true,
    organizationId: 'org-123',
  };
  const mockAuthContext = (user: typeof mockUser | null) => ({
    user,
    activeOrganization: null,
    activeMembership: null,
    memberships: [],
    features: null,
    isLoading: false,
    login: jest.fn(),
    refreshContext: jest.fn(),
    switchOrganization: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
  });

  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Project Alpha',
      priority: Priority.HIGH,
      ownerId: 'user-123',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'project-2',
      name: 'Project Beta',
      priority: Priority.MEDIUM,
      ownerId: 'user-123',
      isActive: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  const mockNewProject: Project = {
    id: 'project-3',
    name: 'Project Gamma',
    priority: Priority.LOW,
    ownerId: 'user-123',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetProjectsStore();
    (apiLib.apiGet as jest.Mock).mockResolvedValue([]);
    (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue('org-123');
    jest.spyOn(useAuthModule, 'useAuth').mockReturnValue(mockAuthContext(mockUser));
  });

  describe('Initial state', () => {
    it('should initialize with empty projects array', async () => {
      // Arrange - Mock useAuth (although hook doesn't use it yet, we keep it for consistency)
      jest.spyOn(useAuthModule, 'useAuth').mockReturnValue(mockAuthContext(null));
      (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue(null);

      // Act
      const { result } = renderHook(() => useProjects());
      
      // Assert - Check initial state immediately
      expect(result.current.projects).toEqual([]);
      
      // Wait for the automatic fetch to settle to avoid "act" warnings
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('should provide fetchProjects function', async () => {
      // Arrange & Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Assert
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.createProject).toBe('function');
      expect(typeof result.current.updateProject).toBe('function');
    });
  });


  describe('fetchProjects (via refetch)', () => {
    it('should fetch projects successfully', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockProjects);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      expect(apiLib.apiGet).toHaveBeenCalled();
      // Permitir taskStats opcional
      expect(result.current.projects).toHaveLength(2);
    });

    it('should handle fetchProjects error', async () => {
      // Arrange
      const error = new Error('Failed to fetch projects');
      (apiLib.apiGet as jest.Mock).mockRejectedValue(error);
      
      // Act
      const { result } = renderHook(() => useProjects());
      
      // Assert
      await waitFor(() => expect(result.current.error).toBe('Failed to fetch projects'));
      expect(result.current.isLoading).toBe(false);
    });

    it('should not fetch projects when user is null', async () => {
      // Arrange
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue(null);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      // Assert
      expect(result.current.projects).toEqual([]);
      expect(apiLib.apiGet).not.toHaveBeenCalledWith('/projects');
    });

    it('should not fetch projects when authenticated user has no organization', async () => {
      // Arrange
      jest
        .spyOn(useAuthModule, 'useAuth')
        .mockReturnValue(mockAuthContext({ ...mockUser, organizationId: undefined }));
      (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue(null);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Assert
      expect(result.current.projects).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(apiLib.apiGet).not.toHaveBeenCalledWith('/projects');
    });

  });

  describe('organization-scoped cache', () => {
    it('does not reuse cached projects from the previous active organization', async () => {
      const orgOneProjects = [{ ...mockProjects[0], id: 'org-1-project', name: 'Org 1 Project' }];
      const orgTwoProjects = [{ ...mockProjects[1], id: 'org-2-project', name: 'Org 2 Project' }];

      (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue('org-1');
      (apiLib.apiGet as jest.Mock).mockResolvedValueOnce(orgOneProjects);

      const first = renderHook(() => useProjects());
      await waitFor(() => expect(first.result.current.projects).toHaveLength(1));
      expect(first.result.current.projects[0].id).toBe('org-1-project');
      first.unmount();

      (apiLib.getActiveOrganizationId as jest.Mock).mockReturnValue('org-2');
      jest
        .spyOn(useAuthModule, 'useAuth')
        .mockReturnValue(mockAuthContext({ ...mockUser, organizationId: 'org-2' }));
      (apiLib.apiGet as jest.Mock).mockResolvedValueOnce(orgTwoProjects);

      const second = renderHook(() => useProjects());
      await waitFor(() => expect(second.result.current.projects).toHaveLength(1));

      expect(second.result.current.projects[0].id).toBe('org-2-project');
      expect(apiLib.apiGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event-driven refreshes', () => {
    it('should not refetch projects when the timer emits time:updated', async () => {
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.projects).toHaveLength(2));
      (apiLib.apiGet as jest.Mock).mockClear();

      act(() => {
        window.dispatchEvent(new Event('time:updated'));
      });

      expect(apiLib.apiGet).not.toHaveBeenCalled();
    });

    it('should not force a network refetch on task:updated while project cache is fresh', async () => {
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.projects).toHaveLength(2));
      (apiLib.apiGet as jest.Mock).mockClear();

      act(() => {
        window.dispatchEvent(new Event('task:updated'));
      });

      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(apiLib.apiGet).not.toHaveBeenCalled();
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      // Arrange
      const createDto: CreateProjectDto = {
        name: 'Project Gamma',
      };

      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockNewProject);
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Update apiGet mock so the refetch triggered by the event finds the new project
      (apiLib.apiGet as jest.Mock).mockResolvedValue([mockNewProject]);

      await act(async () => {
        await result.current.createProject({ name: 'Project Gamma' });
      });

      // Wait for the background refetch triggered by the event
      await waitFor(() => expect(result.current.isFetching).toBe(false));

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/projects', createDto);
      expect(result.current.projects.length).toBeGreaterThan(0);
    });

    it('should handle createProject error', async () => {
      // Arrange
      const error = new Error('Project creation failed');
      const createDto: CreateProjectDto = { name: 'New Project' };
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.createProject(createDto);
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Project creation failed');
    });

    it('should append new project to existing projects', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockResolvedValue(mockProjects);
      const newProject: Project = {
        id: 'project-3',
        name: 'New Project',
        priority: Priority.MEDIUM,
        ownerId: 'user-123',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(newProject);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      // Update apiGet mock for the refetch
      (apiLib.apiGet as jest.Mock).mockResolvedValue([...mockProjects, newProject]);

      await act(async () => {
        await result.current.refetch();
        await result.current.createProject({ name: 'New Project' });
      });

      // Wait for the background refetch triggered by the event
      await waitFor(() => expect(result.current.isFetching).toBe(false));

      // Assert
      expect(result.current.projects.length).toBe(3);
    });

  });

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      // Arrange
      const updatedProject: Project = {
        ...mockProjects[0],
        name: 'Updated Project Alpha',
      };
      const updateDto: UpdateProjectDto = { name: 'Updated Project Alpha' };
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedProject);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateProject('project-1', updateDto);
      });

      // Wait for the background refetch triggered by the event
      await waitFor(() => expect(result.current.isFetching).toBe(false));

      // Assert
      expect(apiLib.apiPatch).toHaveBeenCalledWith(
        '/projects/project-1',
        updateDto
      );
    });

    it('should handle updateProject error', async () => {
      // Arrange
      const error = new Error('Update failed');
      const updateDto: UpdateProjectDto = { name: 'Updated Name' };
      (apiLib.apiPatch as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.updateProject('project-1', updateDto);
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Update failed');
    });
  });

  describe('Window event dispatching', () => {
    it('should dispatch projects:updated event on create', async () => {
      // Arrange
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      const newProject: Project = {
        id: 'project-3',
        name: 'New Project',
        priority: Priority.LOW,
        ownerId: 'user-123',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(newProject);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.createProject({ name: 'New Project' });
      });


      // Assert
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'projects:updated',
        })
      );

      dispatchEventSpy.mockRestore();
    });
  });

  describe('Error message formatting', () => {
    it('should handle Error object with message', async () => {
      // Arrange
      const error = new Error('Custom error message');
      (apiLib.apiGet as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      expect(result.current.error).toBe('Custom error message');
    });


    it('should handle object with message property', async () => {
      // Arrange
      const errorObj = { message: 'Error from object' };
      (apiLib.apiGet as jest.Mock).mockRejectedValue(errorObj);

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      expect(result.current.error).toBe('Error from object');
    });


    it('should use fallback message for unknown errors', async () => {
      // Arrange
      (apiLib.apiGet as jest.Mock).mockRejectedValue('Unknown error');

      // Act
      const { result } = renderHook(() => useProjects());
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
  
      expect(result.current.error).toBe('Error al cargar proyectos');
    });
  });
});
