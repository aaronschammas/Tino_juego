/**
 * useUsers.ts - useUsers Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act, waitFor } from '@testing-library/react';

import { useUsers } from './useUsers';
import * as apiLib from '@/lib/api';
import * as useAuthModule from './useAuth';
import { User, CreateUserDto, UpdateUserDto } from '@/types/user';

// Mock modules
jest.mock('@/lib/api');
jest.mock('./useAuth');

describe('useUsers Hook', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER' as const,
    isActive: true,
    organizationId: 'org-123',
  };
  const mockAuthContext = (user: User | null) => ({
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

  const mockUsers: User[] = [
    mockUser,
    {
      id: 'user-456',
      email: 'john@example.com',
      name: 'John',
      lastname: 'Doe',
      role: 'USER' as const,
      isActive: true,
      organizationId: 'org-123',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiLib.apiGetCached as jest.Mock).mockResolvedValue([]);
    jest.spyOn(useAuthModule, 'useAuth').mockReturnValue(mockAuthContext(mockUser));
  });


  describe('Initial state', () => {
    it('should initialize with empty state', async () => {
      // Arrange & Act
      const { result } = renderHook(() => useUsers());

      // Assert
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.users).toEqual([]);
    });
  });


  describe('fetchUsers', () => {
    it('should not fetch users when authenticated user has no organization', async () => {
      // Arrange
      jest
        .spyOn(useAuthModule, 'useAuth')
        .mockReturnValue(mockAuthContext({ ...mockUser, organizationId: undefined }));

      // Act
      const { result } = renderHook(() => useUsers());

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiLib.apiGetCached).not.toHaveBeenCalledWith('/users', expect.any(Object));
      expect(result.current.users).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should fetch users successfully', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(mockUsers);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.refetch();
      });

      // Assert
      expect(apiLib.apiGetCached).toHaveBeenCalledWith('/users', expect.any(Object));
      expect(result.current.users).toEqual(mockUsers);
      expect(result.current.error).toBeNull();
    });


    it('should not fetch if user not authenticated', async () => {
      // Arrange
      jest.spyOn(useAuthModule, 'useAuth').mockReturnValue(mockAuthContext(null));

      // Act
      const { result } = renderHook(() => useUsers());
      await act(async () => {
        if (result.current.refetch) {
          await result.current.refetch();
        }
      });

      // Assert
      expect(apiLib.apiGetCached).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle fetch error', async () => {
      // Arrange
      const error = new Error('Failed to fetch users');
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.refetch();
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Failed to fetch users');
    });

  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      // Arrange
      const newUser: User = {
        id: 'user-789',
        email: 'new@example.com',
        name: 'Jane',
        lastname: 'Smith',
        role: 'USER',
        isActive: true,
      };
      const createDto: CreateUserDto = {
        email: 'new@example.com',
        name: 'Jane',
        lastname: 'Smith',
      };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(newUser);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.createUser(createDto);
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/users', createDto);
    });


    it('should handle create error', async () => {
      // Arrange
      const error = new Error('Creation failed');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.createUser({
            email: 'test@example.com',
            name: 'Test',
            lastname: 'User',
          });
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Creation failed');
    });

  });

  describe('updateUser', () => {
    it('should update user', async () => {
      // Arrange
      const updateDto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      (apiLib.apiPatch as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateUser('user-123', updateDto);
      });

      // Assert
      expect(apiLib.apiPatch).toHaveBeenCalledWith(
        '/users/user-123',
        updateDto
      );
    });


    it('should handle update error', async () => {
      // Arrange
      const error = new Error('Update failed');
      (apiLib.apiPatch as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useUsers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.updateUser('user-123', { name: 'New Name' });
        } catch {
          // Expected
        }
      });

      // Assert
      expect(result.current.error).toBe('Update failed');
    });

  });
});
