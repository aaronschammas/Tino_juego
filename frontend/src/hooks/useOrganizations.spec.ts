/**
 * useOrganizations.ts - useOrganizations Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, act } from '@testing-library/react';
import { useOrganizations } from './useOrganizations';
import * as apiLib from '@/lib/api';
import * as useAuthModule from './useAuth';
import {
  Organization,
  OrganizationDetail,
  Plan,
  CreateOrganizationDto,
  InviteMembersDto,
} from '@/types/organization';

// Mock modules
jest.mock('@/lib/api');
jest.mock('./useAuth');

describe('useOrganizations Hook', () => {
  const mockPlan: Plan = {
    id: 'plan-free', name: 'free', title: 'Free', description: null, price: 0,
    maxUsers: 2, maxProjects: 2, hasAnalytics: false, hasSso: false,
    hasPrioritySupport: false, hasEmailInvites: false,
    hasAdvancedPerms: false, hasAudit: false,
  };
  let consoleSpy: jest.SpyInstance;

  const mockUser = {

    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER' as const,
    isActive: true,
  };

  const mockOrganization: Organization = {
    id: 'org-1',
    name: 'Test Organization',
    plan: mockPlan,
    isActive: true,
  };

  const mockOrgDetail: OrganizationDetail = {
    id: 'org-1',
    name: 'Test Organization',
    plan: mockPlan,
    isActive: true,
    members: [],
    pendingInvites: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useAuthModule.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });


  describe('createOrganization', () => {
    it('should create organization', async () => {
      // Arrange
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockOrganization);
      const createDto: CreateOrganizationDto = { name: 'New Org' };

      // Act
      const { result } = renderHook(() => useOrganizations());
      let createdOrg: Organization | undefined;
      await act(async () => {
        createdOrg = await result.current.createOrganization(createDto);
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/orgs', createDto);
      expect(createdOrg).toEqual(mockOrganization);
    });

    it('should handle create error', async () => {
      // Arrange
      const error = new Error('Create failed');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      const { result } = renderHook(() => useOrganizations());
      await act(async () => {
        await expect(
          result.current.createOrganization({ name: 'New Org' })
        ).rejects.toThrow('Create failed');
      });
    });
  });

  describe('getMyOrganization', () => {
    it('should fetch organization details', async () => {
      // Arrange
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(mockOrgDetail);

      // Act
      const { result } = renderHook(() => useOrganizations());
      let orgDetail: OrganizationDetail | undefined;
      await act(async () => {
        orgDetail = await result.current.getMyOrganization();
      });

      // Assert
      expect(apiLib.apiGetCached).toHaveBeenCalledWith('/orgs/me', expect.any(Object));
      expect(orgDetail).toEqual(mockOrgDetail);
    });

    it('should handle fetch error', async () => {
      // Arrange
      const error = new Error('Fetch failed');
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      const { result } = renderHook(() => useOrganizations());
      await act(async () => {
        await expect(result.current.getMyOrganization()).rejects.toThrow(
          'Fetch failed'
        );
      });
    });
  });

  describe('getMembers', () => {
    it('should fetch organization members', async () => {
      // Arrange
      const members = [
        { id: 'member-1', userId: 'user-1', role: 'ORG_OWNER' as const },
        { id: 'member-2', userId: 'user-2', role: 'ORG_MEMBER' as const },
      ];
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(members);

      // Act
      const { result } = renderHook(() => useOrganizations());
      let fetchedMembers;
      await act(async () => {
        fetchedMembers = await result.current.getMembers();
      });

      // Assert
      expect(apiLib.apiGetCached).toHaveBeenCalledWith('/orgs/members', expect.any(Object));
      expect(fetchedMembers).toEqual(members);
    });

    it('should handle fetch members error', async () => {
      // Arrange
      const error = new Error('Fetch failed');
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      const { result } = renderHook(() => useOrganizations());
      await act(async () => {
        await expect(result.current.getMembers()).rejects.toThrow(
          'Fetch failed'
        );
      });
    });
  });

  describe('getInvitations', () => {
    it('should fetch organization invitations', async () => {
      // Arrange
      const invites = [{ id: 'invite-1', email: 'user@example.com' }];
      (apiLib.apiGetCached as jest.Mock).mockResolvedValue(invites);

      // Act
      const { result } = renderHook(() => useOrganizations());
      let fetchedInvites;
      await act(async () => {
        fetchedInvites = await result.current.getInvitations();
      });

      // Assert
      expect(apiLib.apiGetCached).toHaveBeenCalledWith('/orgs/invites', expect.any(Object));
      expect(fetchedInvites).toEqual(invites);
    });

    it('should handle fetch invitations error', async () => {
      // Arrange
      const error = new Error('Fetch failed');
      (apiLib.apiGetCached as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      const { result } = renderHook(() => useOrganizations());
      await act(async () => {
        await expect(result.current.getInvitations()).rejects.toThrow(
          'Fetch failed'
        );
      });
    });
  });

  describe('inviteMember', () => {
    it('should invite member to organization', async () => {
      // Arrange
      const inviteDto: InviteMembersDto = {
        email: 'newuser@example.com',
        role: 'ORG_MEMBER',
      };
      const response = { sent: 1, failed: 0 };
      (apiLib.apiPost as jest.Mock).mockResolvedValue(response);

      // Act
      const { result } = renderHook(() => useOrganizations());
      let inviteResult;
      await act(async () => {
        inviteResult = await result.current.inviteMember(inviteDto);
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/orgs/invites', inviteDto);
      expect(inviteResult).toEqual(response);
    });

    it('should handle invite error', async () => {
      // Arrange
      const error = new Error('Invite failed');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      const { result } = renderHook(() => useOrganizations());
      await act(async () => {
        await expect(
          result.current.inviteMember({
            email: 'user@example.com',
            role: 'ORG_MEMBER',
          })
        ).rejects.toThrow('Invite failed');
      });
    });
  });

  describe('resendInvite', () => {
    it('should resend invitation', async () => {
      (apiLib.apiPost as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.resendInvite('invite-123');
      });

      expect(apiLib.apiPost).toHaveBeenCalledWith('/orgs/invites/invite-123/resend', {});
      expect(apiLib.invalidateApiCache).toHaveBeenCalledWith(['/orgs/me', '/orgs/invites']);
    });

    it('should handle resend error', async () => {
      (apiLib.apiPost as jest.Mock).mockRejectedValue(new Error('Resend failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.resendInvite('i1')).rejects.toThrow('Resend failed');
      });
    });
  });

  describe('revokeInvite', () => {
    it('should revoke invitation', async () => {
      (apiLib.apiDelete as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.revokeInvite('invite-123');
      });

      expect(apiLib.apiDelete).toHaveBeenCalledWith('/orgs/invites/invite-123');
    });

    it('should handle revoke error', async () => {
      (apiLib.apiDelete as jest.Mock).mockRejectedValue(new Error('Revoke failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.revokeInvite('i1')).rejects.toThrow('Revoke failed');
      });
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      (apiLib.apiPatch as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.updateMemberRole('u1', 'ORG_ADMIN');
      });

      expect(apiLib.apiPatch).toHaveBeenCalledWith('/orgs/members/u1', { role: 'ORG_ADMIN' });
    });

    it('should handle update role error', async () => {
      (apiLib.apiPatch as jest.Mock).mockRejectedValue(new Error('Update failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.updateMemberRole('u1', 'ADMIN')).rejects.toThrow('Update failed');
      });
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      (apiLib.apiDelete as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.removeMember('u1');
      });

      expect(apiLib.apiDelete).toHaveBeenCalledWith('/orgs/members/u1');
    });

    it('should handle remove member error', async () => {
      (apiLib.apiDelete as jest.Mock).mockRejectedValue(new Error('Remove failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.removeMember('u1')).rejects.toThrow('Remove failed');
      });
    });
  });

  describe('acceptInvite', () => {
    it('should accept invitation', async () => {
      (apiLib.apiPost as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      const acceptDto = { name: 'New', lastname: 'User', password: 'password123' };
      
      await act(async () => {
        await result.current.acceptInvite('token123', acceptDto);
      });

      expect(apiLib.apiPost).toHaveBeenCalledWith('/invites/token123/accept', acceptDto);
    });

    it('should handle accept error', async () => {
      (apiLib.apiPost as jest.Mock).mockRejectedValue(new Error('Accept failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(
          result.current.acceptInvite('t', {
            password: 'valid-password',
            name: 'Test',
            lastname: 'User',
          }),
        ).rejects.toThrow('Accept failed');
      });
    });
  });

  describe('updateMemberProjects', () => {
    it('should update member projects', async () => {
      (apiLib.apiPut as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.updateMemberProjects('u1', ['p1', 'p2']);
      });

      expect(apiLib.apiPut).toHaveBeenCalledWith('/orgs/members/u1/projects', { projectIds: ['p1', 'p2'] });
    });

    it('should handle update projects error', async () => {
      (apiLib.apiPut as jest.Mock).mockRejectedValue(new Error('Update failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.updateMemberProjects('u1', [])).rejects.toThrow('Update failed');
      });
    });
  });

  describe('removeMemberFromProject', () => {
    it('should remove member from project', async () => {
      (apiLib.apiDelete as jest.Mock).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await result.current.removeMemberFromProject('u1', 'p1');
      });

      expect(apiLib.apiDelete).toHaveBeenCalledWith('/orgs/members/u1/projects/p1');
    });

    it('should handle remove from project error', async () => {
      (apiLib.apiDelete as jest.Mock).mockRejectedValue(new Error('Remove failed'));
      const { result } = renderHook(() => useOrganizations());
      
      await act(async () => {
        await expect(result.current.removeMemberFromProject('u1', 'p1')).rejects.toThrow('Remove failed');
      });
    });
  });
});

