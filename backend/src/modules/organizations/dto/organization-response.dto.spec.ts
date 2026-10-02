import 'reflect-metadata';
import {
  OrganizationResponseDto,
  MemberResponseDto,
  InviteResponseDto,
  OrganizationDetailResponseDto,
  InviteLinkResponseDto,
  AcceptInviteResponseDto,
} from './organization-response.dto';
import { OrganizationRole } from '@prisma/client';

describe('Organization Response DTOs', () => {
  describe('OrganizationResponseDto', () => {
    it('should create an organization response with all fields', () => {
      // Arrange
      const orgData = {
        id: 'org-001',
        name: 'Tech Corp',
        plan: 'PREMIUM',
        isActive: true,
        userRole: OrganizationRole.ORG_OWNER,
        createdAt: new Date('2025-01-01'),
      };

      // Act
      const dto = new OrganizationResponseDto(orgData);

      // Assert
      expect(dto.id).toBe('org-001');
      expect(dto.name).toBe('Tech Corp');
      expect(dto.plan).toBe('PREMIUM');
      expect(dto.isActive).toBe(true);
      expect(dto.userRole).toBe('ORG_OWNER');
      expect(dto.createdAt).toEqual(new Date('2025-01-01'));
    });

    it('should handle missing userRole', () => {
      // Arrange
      const orgData = {
        id: 'org-002',
        name: 'Startup',
        plan: 'FREE',
        isActive: true,
        createdAt: new Date(),
      };

      // Act
      const dto = new OrganizationResponseDto(orgData);

      // Assert
      expect(dto.id).toBe('org-002');
      expect(dto.userRole).toBeUndefined();
    });

    it('should serialize organization data correctly', () => {
      // Arrange
      const orgData = {
        id: 'org-003',
        name: 'Enterprise Inc',
        plan: 'ENTERPRISE',
        isActive: false,
        userRole: OrganizationRole.ORG_MEMBER,
        createdAt: new Date('2024-06-15'),
      };

      // Act
      const dto = new OrganizationResponseDto(orgData);
      const serialized = JSON.stringify(dto);

      // Assert
      expect(serialized).toContain('"id":"org-003"');
      expect(serialized).toContain('"name":"Enterprise Inc"');
      expect(serialized).toContain('"isActive":false');
    });

    it('should support different plan types', () => {
      // Arrange
      const plans = ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'];

      for (const plan of plans) {
        const orgData = {
          id: `org-${plan}`,
          name: `Company ${plan}`,
          plan,
          isActive: true,
          createdAt: new Date(),
        };

        // Act
        const dto = new OrganizationResponseDto(orgData);

        // Assert
        expect(dto.plan).toBe(plan);
      }
    });

    it('should handle active and inactive states', () => {
      // Arrange
      const activeOrg = {
        id: 'org-active',
        name: 'Active Org',
        plan: 'PREMIUM',
        isActive: true,
        createdAt: new Date(),
      };

      const inactiveOrg = {
        id: 'org-inactive',
        name: 'Inactive Org',
        plan: 'PREMIUM',
        isActive: false,
        createdAt: new Date(),
      };

      // Act
      const activeDtо = new OrganizationResponseDto(activeOrg);
      const inactiveDtо = new OrganizationResponseDto(inactiveOrg);

      // Assert
      expect(activeDtо.isActive).toBe(true);
      expect(inactiveDtо.isActive).toBe(false);
    });
  });

  describe('MemberResponseDto', () => {
    it('should create a member response with all fields', () => {
      // Arrange
      const memberData = {
        id: 'mem-001',
        user: {
          id: 'user-001',
          email: 'user@example.com',
          name: 'John',
          lastname: 'Doe',
          status: 'ACTIVE',
        },
        role: OrganizationRole.ORG_MEMBER,
        createdAt: new Date('2025-01-15'),
      };

      // Act
      const dto = new MemberResponseDto(memberData);

      // Assert
      expect(dto.membershipId).toBe('mem-001');
      expect(dto.userId).toBe('user-001');
      expect(dto.email).toBe('user@example.com');
      expect(dto.name).toBe('John');
      expect(dto.lastname).toBe('Doe');
      expect(dto.role).toBe('ORG_MEMBER');
    });

    it('should handle member roles', () => {
      // Arrange
      const roles: OrganizationRole[] = [
        OrganizationRole.ORG_MEMBER,
        OrganizationRole.ORG_OWNER,
      ];

      for (const role of roles) {
        const memberData = {
          id: `mem-${role}`,
          user: {
            id: `user-${role}`,
            email: `user-${role}@example.com`,
            name: 'Test',
            lastname: 'User',
            status: 'ACTIVE',
          },
          role,
          createdAt: new Date(),
        };

        // Act
        const dto = new MemberResponseDto(memberData);

        // Assert
        expect(dto.role).toBe(role);
      }
    });

    it('should serialize member data correctly', () => {
      // Arrange
      const memberData = {
        id: 'mem-002',
        user: {
          id: 'user-002',
          email: 'jane@example.com',
          name: 'Jane',
          lastname: 'Smith',
          status: 'ACTIVE',
        },
        role: OrganizationRole.ORG_MEMBER,
        createdAt: new Date('2025-02-01'),
      };

      // Act
      const dto = new MemberResponseDto(memberData);
      const serialized = JSON.stringify(dto);

      // Assert
      expect(serialized).toContain('"email":"jane@example.com"');
      expect(serialized).toContain('"name":"Jane"');
      expect(serialized).toContain('"role":"ORG_MEMBER"');
    });

    it('should support email formats', () => {
      // Arrange
      const emails = [
        'user@example.com',
        'first.last@company.co.uk',
        'user+tag@example.org',
      ];

      for (const email of emails) {
        const memberData = {
          id: 'mem-test',
          user: {
            id: 'user-test',
            email,
            name: 'Test',
            lastname: 'User',
            status: 'ACTIVE',
          },
          role: OrganizationRole.ORG_MEMBER,
          createdAt: new Date(),
        };

        // Act
        const dto = new MemberResponseDto(memberData);

        // Assert
        expect(dto.email).toBe(email);
      }
    });

    it('should handle unicode names', () => {
      // Arrange
      const memberData = {
        id: 'mem-unicode',
        user: {
          id: 'user-unicode',
          email: 'user@example.com',
          name: 'José',
          lastname: 'García',
          status: 'ACTIVE',
        },
        role: OrganizationRole.ORG_MEMBER,
        createdAt: new Date(),
      };

      // Act
      const dto = new MemberResponseDto(memberData);

      // Assert
      expect(dto.name).toBe('José');
      expect(dto.lastname).toBe('García');
    });
  });

  describe('Response DTO Scenarios', () => {
    it('should support organization with no members yet', () => {
      // Arrange
      const orgData = {
        id: 'org-new',
        name: 'New Organization',
        plan: 'FREE',
        isActive: true,
        createdAt: new Date(),
        members: [],
      };

      // Act
      const dto = new OrganizationResponseDto(orgData);

      // Assert
      expect(dto.name).toBe('New Organization');
    });

    it('should support organization with multiple members', () => {
      // Arrange
      const members = [
        {
          id: 'mem-1',
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            name: 'Owner',
            lastname: 'User',
            status: 'ACTIVE',
          },
          role: OrganizationRole.ORG_OWNER,
          createdAt: new Date(),
        },
        {
          id: 'mem-2',
          user: {
            id: 'user-2',
            email: 'admin@example.com',
            name: 'Admin',
            lastname: 'User',
            status: 'ACTIVE',
          },
          role: OrganizationRole.ORG_MEMBER,
          createdAt: new Date(),
        },
      ];

      const orgData = {
        id: 'org-full',
        name: 'Full Organization',
        plan: 'PREMIUM',
        isActive: true,
        createdAt: new Date(),
        members,
      };

      // Act
      const orgDto = new OrganizationResponseDto(orgData);
      const memberDtos = members.map((m) => new MemberResponseDto(m));

      // Assert
      expect(orgDto.name).toBe('Full Organization');
      expect(memberDtos.length).toBe(2);
      expect(memberDtos[0].role).toBe('ORG_OWNER');
      expect(memberDtos[1].role).toBe('ORG_MEMBER');
    });
  });

  describe('InviteResponseDto', () => {
    it('should create an invite response with all fields', () => {
      // Arrange
      const inviteData = {
        id: 'inv-123',
        email: 'invited@example.com',
        role: OrganizationRole.ORG_MEMBER,
        status: 'PENDING',
        expiresAt: new Date('2026-05-30'),
        createdAt: new Date('2026-05-01'),
        token: 'token-abc',
      };
      process.env.FRONTEND_URL = 'https://tino.app';

      // Act
      const dto = new InviteResponseDto(inviteData);

      // Assert
      expect(dto.id).toBe('inv-123');
      expect(dto.email).toBe('invited@example.com');
      expect(dto.inviteLink).toContain('token-abc');
      expect(dto.inviteLink).toContain('https://tino.app');
    });

    it('uses the safe frontend fallback without duplicating the invite path', () => {
      const previousFrontendUrl = process.env.FRONTEND_URL;
      delete process.env.FRONTEND_URL;

      const dto = new InviteResponseDto({
        id: 'inv-456',
        email: 'invited@example.com',
        role: OrganizationRole.ORG_MEMBER,
        status: 'PENDING',
        expiresAt: new Date('2026-05-30'),
        createdAt: new Date('2026-05-01'),
        token: 'token-safe',
      });

      expect(dto.inviteLink).toBe(
        'https://www.tinotime.com/invite?token=token-safe',
      );
      if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = previousFrontendUrl;
    });
  });

  describe('OrganizationDetailResponseDto', () => {
    it('should create a detail response with members and pending invites', () => {
      // Arrange
      const orgData = {
        id: 'org-123',
        name: 'Detail Org',
        plan: 'pro',
        isActive: true,
        createdAt: new Date(),
        memberships: [
          {
            id: 'mem-1',
            role: OrganizationRole.ORG_OWNER,
            createdAt: new Date(),
            user: { id: 'u1', email: 'e1', name: 'n1', lastname: 'l1' },
          },
        ],
        invites: [
          {
            id: 'inv-1',
            status: 'PENDING',
            token: 't1',
            email: 'e1',
            role: OrganizationRole.ORG_MEMBER,
            expiresAt: new Date(),
            createdAt: new Date(),
          },
          {
            id: 'inv-2',
            status: 'ACCEPTED',
            token: 't2',
            email: 'e2',
            role: OrganizationRole.ORG_MEMBER,
            expiresAt: new Date(),
            createdAt: new Date(),
          },
        ],
      };

      // Act
      const dto = new OrganizationDetailResponseDto(
        orgData,
        OrganizationRole.ORG_OWNER,
      );

      // Assert
      expect(dto.id).toBe('org-123');
      expect(dto.members).toHaveLength(1);
      expect(dto.pendingInvites).toHaveLength(1);
      expect(dto.pendingInvites[0].id).toBe('inv-1');
    });
  });

  describe('InviteLinkResponseDto', () => {
    it('should create an invite link response', () => {
      // Arrange
      const data = {
        message: 'Sent',
        email: 't@t.com',
        role: OrganizationRole.ORG_MEMBER,
        inviteLink: 'http://link',
        expiresAt: new Date(),
      };

      // Act
      const dto = new InviteLinkResponseDto(data);

      // Assert
      expect(dto.message).toBe('Sent');
      expect(dto.inviteLink).toBe('http://link');
    });
  });

  describe('AcceptInviteResponseDto', () => {
    it('should create an accept invite response', () => {
      // Arrange
      const userData = {
        id: 'u-1',
        email: 'u@u.com',
        name: 'User',
        organizationId: 'o-1',
      };

      // Act
      const dto = new AcceptInviteResponseDto(userData);

      // Assert
      expect(dto.message).toBe('Invitation accepted successfully');
      expect(dto.user.id).toBe('u-1');
      expect(dto.user.organizationId).toBe('o-1');
    });
  });
});
