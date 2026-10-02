import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        cookies: {
          access_token: 'valid_token',
        },
      }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('canActivate - Token Validation', () => {
    it('should allow request with valid token', async () => {
      // Arrange
      const userId = 'user-001';
      const payload = { sub: userId };
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        isActive: true,
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: { name: 'USER' },
      });

      const context = mockExecutionContext as any;

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      // Arrange
      const contextWithoutToken = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      };

      // Act & Assert
      await expect(
        guard.canActivate(contextWithoutToken as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject request with invalid token', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('Invalid token'),
      );

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow();
    });

    it('should extract token from access cookie', async () => {
      // Arrange
      const token = 'valid_token_123';
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: {
              access_token: token,
            },
          }),
        }),
      };

      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-001' });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-001',
        isActive: true,
        role: { name: 'USER' },
      });

      // Act
      await guard.canActivate(context as any);

      // Assert
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        token,
        expect.any(Object),
      );
    });
  });

  describe('canActivate - User Verification', () => {
    it('should reject if user not found', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'nonexistent' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow();
    });

    it('should reject if user is inactive', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-001' });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-001',
        isActive: false,
      });

      // Act & Assert
      await expect(
        guard.canActivate(mockExecutionContext as any),
      ).rejects.toThrow();
    });

    it('should attach user to request', async () => {
      // Arrange
      const userId = 'user-auth-001';
      const mockUser = {
        id: userId,
        email: 'auth@example.com',
        isActive: true,
        organizationId: 'org-001',
      };

      const requestWithAuth = {
        cookies: { access_token: 'token' },
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => requestWithAuth,
        }),
      };

      mockJwtService.verifyAsync.mockResolvedValue({ sub: userId });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: { name: 'USER' },
      });

      // Act
      await guard.canActivate(context as any);

      // Assert
      expect(requestWithAuth.user).toBeDefined();
    });
  });

  describe('request.user contract', () => {
    const buildContext = (token = 'valid_token') => {
      const request: any = { cookies: { access_token: token }, user: undefined };
      return {
        request,
        context: {
          switchToHttp: () => ({ getRequest: () => request }),
        } as any,
      };
    };

    const dbUser = {
      id: 'user-777',
      email: 'contract@example.com',
      name: 'Contract',
      lastname: 'User',
      password: 'hashed-password',
      isActive: true,
      organizationId: 'org-777',
      roleId: 'role-1',
      googleId: null,
      googleStatus: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    it('exposes every user column plus sub, role name and sessionId', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: dbUser.id,
        sid: 'session-abc',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: { name: '  SUPERADMIN  ' },
      });
      const { request, context } = buildContext();

      // Act
      await guard.canActivate(context);

      // Assert
      expect(request.user).toEqual({
        ...dbUser,
        sub: dbUser.id,
        role: 'SUPERADMIN',
        sessionId: 'session-abc',
      });
    });

    it('does not leak the nested role relation object', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: dbUser.id,
        sid: 'session-abc',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: { name: 'USER' },
      });
      const { request, context } = buildContext();

      // Act
      await guard.canActivate(context);

      // Assert
      expect(request.user.role).toBe('USER');
      expect(typeof request.user.role).toBe('string');
    });

    it('takes sessionId from the token, not from the database row', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: dbUser.id,
        sid: 'session-from-token',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: { name: 'USER' },
      });
      const { request, context } = buildContext();

      // Act
      await guard.canActivate(context);

      // Assert
      expect(request.user.sessionId).toBe('session-from-token');
    });
  });

  describe('user cache', () => {
    const buildContext = (token = 'valid_token') => {
      const request: any = { cookies: { access_token: token }, user: undefined };
      return {
        request,
        context: {
          switchToHttp: () => ({ getRequest: () => request }),
        } as any,
      };
    };

    const activeUser = (id: string) => ({
      id,
      email: `${id}@example.com`,
      isActive: true,
      organizationId: 'org-1',
      role: { name: 'USER' },
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('hits the database once for repeated requests of the same user', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-cache-1',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(
        activeUser('user-cache-1'),
      );

      // Act
      await guard.canActivate(buildContext().context);
      await guard.canActivate(buildContext().context);
      await guard.canActivate(buildContext().context);
      await guard.canActivate(buildContext().context);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('does not share cached identities between different users', async () => {
      // Arrange
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(activeUser('user-a'))
        .mockResolvedValueOnce(activeUser('user-b'));

      // Act
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-a',
        sid: 'session-a',
      });
      const first = buildContext();
      await guard.canActivate(first.context);

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-b',
        sid: 'session-b',
      });
      const second = buildContext();
      await guard.canActivate(second.context);

      // Assert
      expect(first.request.user.id).toBe('user-a');
      expect(second.request.user.id).toBe('user-b');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('keeps sessionId per request even when the identity is cached', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(
        activeUser('user-multi-session'),
      );

      // Act
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-multi-session',
        sid: 'session-device-1',
      });
      const first = buildContext();
      await guard.canActivate(first.context);

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-multi-session',
        sid: 'session-device-2',
      });
      const second = buildContext();
      await guard.canActivate(second.context);

      // Assert
      expect(first.request.user.sessionId).toBe('session-device-1');
      expect(second.request.user.sessionId).toBe('session-device-2');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('queries the database again once the cache entry expires', async () => {
      // Arrange
      const start = 1_800_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(start);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-ttl',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(
        activeUser('user-ttl'),
      );

      // Act
      await guard.canActivate(buildContext().context);
      nowSpy.mockReturnValue(start + 61_000);
      await guard.canActivate(buildContext().context);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('rejects a user deactivated after the cache entry expires', async () => {
      // Arrange
      const start = 1_800_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(start);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-revoked',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValueOnce(
        activeUser('user-revoked'),
      );

      // Act
      await expect(
        guard.canActivate(buildContext().context),
      ).resolves.toBe(true);

      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        ...activeUser('user-revoked'),
        isActive: false,
      });
      nowSpy.mockReturnValue(start + 61_000);

      // Assert
      await expect(
        guard.canActivate(buildContext().context),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('still serves a deactivated user until the cache entry expires', async () => {
      // Arrange
      const start = 1_800_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(start);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-window',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(
        activeUser('user-window'),
      );

      // Act
      await guard.canActivate(buildContext().context);
      nowSpy.mockReturnValue(start + 30_000);
      const result = await guard.canActivate(buildContext().context);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('does not cache a rejected user', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-inactive',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...activeUser('user-inactive'),
        isActive: false,
      });

      // Act
      await expect(
        guard.canActivate(buildContext().context),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        guard.canActivate(buildContext().context),
      ).rejects.toThrow(UnauthorizedException);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('drops a cached identity when explicitly invalidated', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-invalidate',
        sid: 'session-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(
        activeUser('user-invalidate'),
      );

      // Act
      await guard.canActivate(buildContext().context);
      guard.invalidateCachedUser('user-invalidate');
      await guard.canActivate(buildContext().context);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Extraction', () => {
    it('should handle missing access cookie', async () => {
      // Arrange
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: {},
          }),
        }),
      };

      // Act & Assert
      await expect(
        guard.canActivate(context as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject missing access token when Authorization header exists', async () => {
      // Arrange
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer token',
            },
          }),
        }),
      };

      // Act & Assert
      await expect(
        guard.canActivate(context as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JWT Verification Security', () => {
    it('should use correct secret for verification', async () => {
      // Arrange
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-001' });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-001',
        isActive: true,
        role: { name: 'USER' },
      });

      // Act
      await guard.canActivate(mockExecutionContext as any);

      // Assert
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid_token',
        {
          secret: expect.any(String),
        },
      );
    });
  });
  describe('Feria demo mode (DEMO_MODE=true)', () => {
    const contextWith = (cookies: Record<string, string>) => {
      const request: Record<string, any> = { cookies };
      return {
        request,
        context: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext,
      };
    };
    const demoUser = { id: 'demo-1', email: 'demo@tino-demo.local', isActive: true, role: { name: 'USER' } };

    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
      process.env.DEMO_USER_EMAIL = 'Demo@Tino-Demo.local';
    });

    afterEach(() => {
      delete process.env.DEMO_MODE;
      delete process.env.DEMO_USER_EMAIL;
    });

    it('acts as the demo user when there is no session cookie', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'demo-1' })
        .mockResolvedValueOnce(demoUser);
      const { request, context } = contextWith({});

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(mockPrismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { email: 'demo@tino-demo.local' },
        select: { id: true },
      });
      expect(request.user).toMatchObject({ id: 'demo-1', sub: 'demo-1', role: 'USER' });
    });

    it('falls back to the demo user when the token is invalid', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('expired'));
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'demo-1' })
        .mockResolvedValueOnce(demoUser);
      const { request, context } = contextWith({ access_token: 'expired' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user.id).toBe('demo-1');
    });

    it('keeps a valid session user instead of the demo user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-7', sid: 'session-7' });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-7', isActive: true, role: { name: 'ADMIN' } });
      const { request, context } = contextWith({ access_token: 'valid' });

      await guard.canActivate(context);

      expect(request.user).toMatchObject({ id: 'user-7', sessionId: 'session-7' });
    });

    it('caches the demo user id between requests', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'demo-1' })
        .mockResolvedValueOnce(demoUser);

      await guard.canActivate(contextWith({}).context);
      await guard.canActivate(contextWith({}).context);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('fails clearly when the demo user was not seeded', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(contextWith({}).context)).rejects.toThrow('seed-feria');
    });

    it('still requires a session when DEMO_MODE is off', async () => {
      process.env.DEMO_MODE = 'false';

      await expect(guard.canActivate(contextWith({}).context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
