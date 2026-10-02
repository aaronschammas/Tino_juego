import { OrgAccessGuard, OrgOwnerGuard, UserMustBeActiveGuard } from './org-access.guard';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

describe('OrgAccessGuard', () => {
  let guard: OrgAccessGuard;
  let prisma: any;
  let mockContext: any;

  beforeEach(() => {
    prisma = {
      organizationMembership: {
        findUnique: jest.fn(),
      },
    };

    guard = new OrgAccessGuard(prisma);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    };
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when no user is present', async () => {
      // Arrange
      const request = { user: null, params: {}, query: {} };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return true when no orgId and no userOrgId', async () => {
      // Arrange
      const request = { user: { id: 'user-123' }, params: {}, query: {} };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should fallback to user.sub when user.id is not present', async () => {
      // Arrange
      const request = { user: { sub: 'sub-123', organizationId: 'org-123' }, params: {}, query: {} };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_MEMBER',
        organization: { id: 'org-123', isActive: true },
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should fallback to query.orgId if params.orgId is not present', async () => {
      // Arrange
      const request = { user: { id: 'user-123' }, params: {}, query: { orgId: 'org-q' } };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_MEMBER',
        organization: { id: 'org-q', isActive: true },
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user is member of organization', async () => {
      // Arrange
      const request: any = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-123' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_MEMBER',
        organization: { id: 'org-123', isActive: true },
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(request.orgId).toBe(request.params.orgId);
      expect(request.orgRole).toBe('ORG_MEMBER');
    });

    it('should throw ForbiddenException when user is not member of organization', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-456' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      prisma.organizationMembership.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when organization is inactive', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-123' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_MEMBER',
        organization: { id: 'org-123', isActive: false },
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

describe('OrgOwnerGuard', () => {
  let guard: OrgOwnerGuard;
  let prisma: any;
  let mockContext: any;

  beforeEach(() => {
    prisma = {
      organizationMembership: {
        findUnique: jest.fn(),
      },
    };

    guard = new OrgOwnerGuard(prisma);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    };
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when no user is present', async () => {
      // Arrange
      const request = { user: null, params: {}, query: {} };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should fallback to user.sub when user.id is missing', async () => {
      // Arrange
      const request = {
        user: { sub: 'sub-123' },
        params: { orgId: 'org-1' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);
      prisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when orgRole is already ORG_OWNER', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123' },
        params: {},
        query: {},
        orgRole: 'ORG_OWNER',
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access when orgRole is not ORG_OWNER', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123' },
        params: {},
        query: {},
        orgRole: 'ORG_MEMBER',
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should fallback to query.orgId if params.orgId is not present', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123' },
        params: {},
        query: { orgId: 'org-q' },
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);
      prisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should fallback to userOrgId if no orgId is present in request', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123', organizationId: 'org-user' },
        params: {},
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);
      prisma.organizationMembership.findUnique.mockResolvedValue({ role: 'ORG_OWNER' });

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if orgId context cannot be resolved', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123' },
        params: {},
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should verify owner status from database', async () => {
      // Arrange
      const request: any = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-123' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_OWNER',
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(request.orgRole).toBe('ORG_OWNER');
    });

    it('should deny access when user is not owner in database', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-123' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const membership = {
        role: 'ORG_MEMBER',
      };
      prisma.organizationMembership.findUnique.mockResolvedValue(membership);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny access when membership is not found', async () => {
      // Arrange
      const request = {
        user: { id: 'user-123', organizationId: 'org-123' },
        params: { orgId: 'org-123' },
        query: {},
      };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);
      prisma.organizationMembership.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

describe('UserMustBeActiveGuard', () => {
  let guard: UserMustBeActiveGuard;
  let prisma: any;
  let mockContext: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    guard = new UserMustBeActiveGuard(prisma);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    };
  });

  describe('canActivate', () => {
    it('should return true when no user is present', async () => {
      // Arrange
      const request = { user: null };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should fallback to user.sub when user.id is missing', async () => {
      // Arrange
      const request = { user: { sub: 'sub-123' } };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);
      prisma.user.findUnique.mockResolvedValue({ id: 'sub-123', isActive: true });

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user not found', async () => {
      // Arrange
      const request = { user: { id: 'user-123' } };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow active user', async () => {
      // Arrange
      const request = { user: { id: 'user-123' } };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const user = { id: 'user-123', isActive: true };
      prisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny disabled user', async () => {
      // Arrange
      const request = { user: { id: 'user-123' } };
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      const user = { id: 'user-123', isActive: false };
      prisma.user.findUnique.mockResolvedValue(user);

      // Act & Assert
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
