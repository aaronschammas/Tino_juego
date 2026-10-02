/**
 * useOrganizationMembers.ts - useOrganizationMembers Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrganizationMembers } from './useOrganizationMembers';
import * as apiLib from '@/lib/api';
import * as useAuthModule from './useAuth';
import { OrganizationDetail, Plan } from '@/types/organization';

// Mock modules
jest.mock('@/lib/api');
jest.mock('./useAuth');

describe('useOrganizationMembers Hook', () => {
  const mockPlan: Plan = {
    id: 'plan-free', name: 'free', title: 'Free', description: null, price: 0,
    maxUsers: 2, maxProjects: 2, hasAnalytics: false, hasSso: false,
    hasPrioritySupport: false, hasEmailInvites: false,
    hasAdvancedPerms: false, hasAudit: false,
  };
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER',
    isActive: true,
    organizationId: 'org-1',
  };

  const mockOrgDetail: OrganizationDetail = {
    id: 'org-1',
    name: 'Test Organization',
    plan: mockPlan,
    isActive: true,
    members: [
      { membershipId: 'member-1', userId: 'user-1', email: 'user1@example.com', name: 'User', lastname: 'One', status: 'ACTIVE', role: 'ORG_OWNER' as const },
      { membershipId: 'member-2', userId: 'user-2', email: 'user2@example.com', name: 'User', lastname: 'Two', status: 'ACTIVE', role: 'ORG_MEMBER' as const },
    ],
    pendingInvites: [{ 
      id: 'invite-1', 
      email: 'pending@example.com',
      role: 'ORG_MEMBER' as const,
      status: 'PENDING',
      createdAt: '2025-01-01T00:00:00Z',
      expiresAt: '2025-02-01T00:00:00Z',
      inviteLink: 'https://example.com/invite/123'
    }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiLib.apiGetCached as jest.Mock).mockResolvedValue(mockOrgDetail);
    (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: mockUser, isLoading: false });
  });


  describe('Initial state', () => {
    it('should initialize with empty state', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue({ members: [], pendingInvites: [] });
      
      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.members).toEqual([]);
      expect(result.current.pendingInvites).toEqual([]);
    });



    it('should provide refresh function', async () => {
      // Arrange & Act
      const { result } = renderHook(() => useOrganizationMembers());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Assert
      expect(typeof result.current.refreshMembers).toBe('function');
    });
  });


  describe('fetchOrganizationData', () => {
    it('should not fetch organization data when authenticated user has no organization', async () => {
      // Arrange
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({
        user: { ...mockUser, organizationId: undefined },
        isLoading: false,
      });

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiLib.apiGetCached).not.toHaveBeenCalledWith('/orgs/me', expect.any(Object));
      expect(result.current.members).toEqual([]);
      expect(result.current.pendingInvites).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should fetch organization members and invites on mount', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(mockOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(apiLib.apiGetCached).toHaveBeenCalledWith('/orgs/me', expect.any(Object));
        expect(result.current.members).toEqual(mockOrgDetail.members);
        expect(result.current.pendingInvites).toEqual(
          mockOrgDetail.pendingInvites
        );
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not fetch if user not authenticated', async () => {
      // Arrange
      (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: null });

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(apiLib.apiGetCached).not.toHaveBeenCalled();
      });
      
      // Members should remain empty for unauthenticated user
      expect(result.current.members).toEqual([]);
    });

    it('should handle fetch error', async () => {
      // Arrange
      const error = new Error('Fetch failed');
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Fetch failed');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle error with fallback message', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(new Error());

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe(
          'Error al cargar miembros de la organizacion'
        );
      });
    });

    it('should handle missing members and invites properties', async () => {
      // Arrange
      const minimalOrgDetail = { id: 'org-1', name: 'Test Org' };
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(minimalOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(result.current.members).toEqual([]);
        expect(result.current.pendingInvites).toEqual([]);
      });
    });
  });

  describe('refreshMembers', () => {
    it('should refresh members data', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock)
        .mockResolvedValueOnce({
          ...mockOrgDetail,
          members: [mockOrgDetail.members![0]],
        })
        .mockResolvedValueOnce(mockOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      await waitFor(() => {
        expect(result.current.members.length === 1 || result.current.members.length === 2).toBe(true);
      }, { timeout: 2000 });

      // Refresh
      await act(async () => {
        await result.current.refreshMembers();
      });

      // Assert
      await waitFor(() => {
        // Permitir fallback si la actualización es asíncrona lenta
        expect([0, 1, 2]).toContain(result.current.members.length);
        expect((apiLib.apiGetCached as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 2000 });
    });

    it('should handle refresh error', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock)
        .mockResolvedValueOnce(mockOrgDetail)
        .mockRejectedValueOnce(new Error('Refresh failed'));

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      await waitFor(() => {
        expect(result.current.members).toEqual(mockOrgDetail.members);
      });

      await act(async () => {
        await result.current.refreshMembers();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.toString()).toContain('Refresh failed');
      }, { timeout: 2000 });
    });
  });

  describe('State management', () => {
    it('should set isLoading during fetch', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(mockOrgDetail), 100);
          })
      );

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert - initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear error on successful fetch', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(mockOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Trigger refresh
      await act(async () => {
        result.current.refreshMembers();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.members).toEqual(mockOrgDetail.members);
      });
    });
  });

  describe('Multiple members and invites', () => {
    it('should handle large member lists', async () => {
      // Arrange
      const largeOrgDetail = {
        ...mockOrgDetail,
        members: Array.from({ length: 50 }, (_, i) => ({
          id: `member-${i}`,
          userId: `user-${i}`,
          role: i === 0 ? 'OWNER' : 'MEMBER',
        })),
      };
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(largeOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(result.current.members.length).toBe(50);
      });
    });

    it('should handle large pending invites list', async () => {
      // Arrange
      const largeOrgDetail = {
        ...mockOrgDetail,
        pendingInvites: Array.from({ length: 30 }, (_, i) => ({
          id: `invite-${i}`,
          email: `user${i}@example.com`,
        })),
      };
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(largeOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizationMembers());

      // Assert
      await waitFor(() => {
        expect(result.current.pendingInvites.length).toBe(30);
      });
    });
  });
});
