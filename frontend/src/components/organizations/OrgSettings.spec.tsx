import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrgSettings } from './OrgSettings';
import { OrganizationDetail } from '@/types/organization';

const mockGetMyOrganization = jest.fn();
const mockRemoveMember = jest.fn();

jest.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    getMyOrganization: mockGetMyOrganization,
    removeMember: mockRemoveMember,
  }),
}));

jest.mock('@/lib/user-display', () => ({
  formatUserDisplayName: jest.fn((name, lastname) => `${name} ${lastname}`.trim()),
}));

global.confirm = jest.fn();

describe('OrgSettings', () => {
  const mockOrgData: OrganizationDetail = {
    id: '1',
    name: 'Acme Corp',
    plan: {
      id: 'plan-1',
      name: 'pro',
      title: 'Pro',
      price: 29,
      maxUsers: 10,
      maxProjects: null,
      hasAnalytics: true,
      hasSso: false,
      hasPrioritySupport: false,
      hasEmailInvites: true,
      hasAdvancedPerms: false,
      hasAudit: false,
      description: 'Pro plan',
    },
    userRole: 'ORG_OWNER',
    isActive: true,
    members: [
      {
        membershipId: '1',
        userId: 'user1',
        name: 'Juan',
        lastname: 'Pérez',
        email: 'juan@example.com',
        role: 'ORG_OWNER',
        status: 'ACTIVE',
      },
      {
        membershipId: '2',
        userId: 'user2',
        name: 'María',
        lastname: 'García',
        email: 'maria@example.com',
        role: 'ORG_MEMBER',
        status: 'ACTIVE',
      },
    ],
    pendingInvites: [
      {
        id: 'invite1',
        email: 'pending@example.com',
        role: 'ORG_MEMBER',
        status: 'PENDING',
        inviteLink: 'https://example.com/invite?token=abc',
        createdAt: new Date('2024-01-01').toISOString(),
          expiresAt: new Date('2024-01-15').toISOString(),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display loading state initially', () => {
      mockGetMyOrganization.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockOrgData), 100))
      );

      render(<OrgSettings />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should display organization information when loaded', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText(/pro/i)).toBeInTheDocument();
      });
    });

    it('should display error message on load failure', async () => {
      mockGetMyOrganization.mockRejectedValue(new Error('Network error'));

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should display organization not found message', async () => {
      mockGetMyOrganization.mockResolvedValue(null);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/organization not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Organization Info Section', () => {
    it('should display organization name', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('should display organization plan and user role', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/plan/i)).toBeInTheDocument();
        expect(screen.getByText(/your role/i)).toBeInTheDocument();
      });
    });
  });

  describe('Members Section', () => {
    it('should display members count', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should display all members with email', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/juan pérez/i)).toBeInTheDocument();
        expect(screen.getByText(/maria@example.com/i)).toBeInTheDocument();
      });
    });

    it('should display empty members message', async () => {
      const emptyOrgData = { ...mockOrgData, members: [] };
      mockGetMyOrganization.mockResolvedValue(emptyOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
      });
    });

    it('should show remove button only for org owner', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.queryAllByRole('button', { name: /remove/i });
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it('should not show remove button for non-owner users', async () => {
      const memberOrgData = { ...mockOrgData, userRole: 'ORG_MEMBER' };
      mockGetMyOrganization.mockResolvedValue(memberOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Remove Member', () => {
    it('should show confirmation dialog when remove button is clicked', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);
      mockRemoveMember.mockResolvedValue({});

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);
      });

      expect(global.confirm).toHaveBeenCalled();
    });

    it('should call removeMember when confirmed', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);
      mockRemoveMember.mockResolvedValue({});
      (global.confirm as jest.Mock).mockReturnValue(true);

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[1]); // Click on second member (María, user2)
      });

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith('user2');
      });
    });

    it('should not call removeMember when cancelled', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);
      mockRemoveMember.mockClear();
      (global.confirm as jest.Mock).mockReturnValue(false);

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);
      });

      expect(mockRemoveMember).not.toHaveBeenCalled();
    });

    it('should display error on removal failure', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);
      mockRemoveMember.mockRejectedValue(new Error('Cannot remove member'));
      (global.confirm as jest.Mock).mockReturnValue(true);

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/cannot remove member/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pending Invites Section', () => {
    it('should display pending invites count', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/pending invitations \(1\)/i)).toBeInTheDocument();
      });
    });

    it('should display all pending invites', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/pending@example.com/i)).toBeInTheDocument();
      });
    });

    it('should not display pending invites section when empty', async () => {
      const noPendingOrgData = { ...mockOrgData, pendingInvites: [] };
      mockGetMyOrganization.mockResolvedValue(noPendingOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.queryByText(/pending invitations/i)).not.toBeInTheDocument();
      });
    });

    it('should have copy button for pending invites', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      render(<OrgSettings />);

      await waitFor(() => {
        const copyButtons = screen.queryAllByRole('button', { name: /copiar link/i });
        expect(copyButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Copy Invite Link', () => {
    it('should copy invite link to clipboard', async () => {
      mockGetMyOrganization.mockResolvedValue(mockOrgData);

      const mockClipboard = {
        writeText: jest.fn(() => Promise.resolve()),
      };
      Object.assign(global.navigator, { clipboard: mockClipboard });

      render(<OrgSettings />);

      await waitFor(() => {
        const copyButtons = screen.getAllByRole('button', { name: /copiar link/i });
        fireEvent.click(copyButtons[0]);
      });

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          'https://example.com/invite?token=abc'
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle organization load error gracefully', async () => {
      mockGetMyOrganization.mockRejectedValue(new Error('API Error'));

      render(<OrgSettings />);

      await waitFor(() => {
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
      });
    });

    it('should handle member removal error without crashing', async () => {
      mockGetMyOrganization
        .mockResolvedValueOnce(mockOrgData)
        .mockResolvedValueOnce(mockOrgData);
      mockRemoveMember.mockRejectedValue(new Error('Server error'));
      (global.confirm as jest.Mock).mockReturnValue(true);

      render(<OrgSettings />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /remove/i });
        fireEvent.click(removeButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });
});
