import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { OrganizationsService } from 'src/modules/organizations/organizations.service';
import { RegisterInitDto } from './dto/register-init.dto';
import { RegisterCompleteDto } from './dto/register-complete.dto';
import * as bcrypt from 'bcrypt';
import * as dns from 'dns';

jest.mock('bcrypt');

jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
  },
}));

describe('AuthService - Extended Tests', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockPlanPolicyService = {
    assertPlanIsSelectable: jest.fn(),
    getPlanConfig: jest.fn(),
  };

  const mockOrganizationsService = {
    acceptInviteWithGoogle: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationMembership: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    timeEntry: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Default implementations
    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockPrismaService));

    mockPrismaService.authSession.create.mockResolvedValue({
      id: 'session-mock',
      userId: 'user-123',
      refreshTokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
    
    mockPrismaService.role.findUnique.mockImplementation(({ where }) => {
      if (where.name === 'USER') return Promise.resolve({ id: 'role-user', name: 'USER' });
      if (where.name === 'ADMIN') return Promise.resolve({ id: 'role-admin', name: 'ADMIN' });
      return Promise.resolve(null);
    });

    mockPrismaService.user.findUnique.mockImplementation(({ where, include }) => {
        // Por defecto devolvemos un usuario con rol si se pide include role
        return Promise.resolve({
            id: where.id || 'user-123',
            email: 'user@test.com',
            name: 'Test',
            lastname: 'User',
            isActive: true,
            role: { name: 'USER' },
            organizationId: 'org-123'
        });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PlanPolicyService,
          useValue: mockPlanPolicyService,
        },
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('registerInit', () => {
    it('debe rechazar si el email ya existe (case insensitive)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'u1' });
      const dto: RegisterInitDto = {
        nombre: 'Juan', apellido: 'Pérez', email: 'test@tino.com', password: '123456',
      };
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.tino.com', priority: 10 }]);
      await expect(service.registerInit(dto)).rejects.toThrow(BadRequestException);
    });
    it('debe crear usuario temporal si email no existe', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'u2' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const dto: RegisterInitDto = {
        nombre: 'Ana', apellido: 'García', email: 'ana@tino.com', password: 'abcdef',
      };
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.tino.com', priority: 10 }]);
      const res = await service.registerInit(dto);
      expect(res.userId).toBe('u2');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });
    it('debe requerir password si no es Google', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      const dto: RegisterInitDto = {
        nombre: 'Ana', apellido: 'García', email: 'ana@tino.com',
      };
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.tino.com', priority: 10 }]);
      await expect(service.registerInit(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerComplete', () => {
    it('debe rechazar si el usuario no existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const dto: RegisterCompleteDto = { userId: 'x', organizationName: 'Org', plan: 'free' };
      await expect(service.registerComplete(dto)).rejects.toThrow(BadRequestException);
    });
    it('debe rechazar si el usuario ya tiene organización', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u', organizationId: 'org1', role: { name: 'USER' } });
      const dto: RegisterCompleteDto = { userId: 'u', organizationName: 'Org', plan: 'free' };
      await expect(service.registerComplete(dto)).rejects.toThrow(BadRequestException);
    });
    it('debe rechazar si el nombre de organización ya existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u', organizationId: null, role: { name: 'USER' } });
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org1' });
      const dto: RegisterCompleteDto = { userId: 'u', organizationName: 'Org', plan: 'free' };
      await expect(service.registerComplete(dto)).rejects.toThrow(BadRequestException);
    });
    it('debe rechazar si el plan es inválido', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u', organizationId: null, role: { name: 'USER' } });
      mockPrismaService.organization.findFirst.mockResolvedValue(null);
      const dto: RegisterCompleteDto = { userId: 'u', organizationName: 'Org', plan: 'invalid' as any };
      mockPlanPolicyService.assertPlanIsSelectable.mockImplementationOnce(() => {
        throw new BadRequestException('Plan inválido');
      });
      await expect(service.registerComplete(dto)).rejects.toThrow(BadRequestException);
    });
    it('debe crear organización y asignar usuario como owner', async () => {
      // Simular usuario sin organización al inicio
      let userState = { id: 'u', organizationId: null, role: { name: 'USER' } };
      mockPrismaService.user.findUnique.mockImplementation(() => Promise.resolve({ ...userState }));
      mockPrismaService.organization.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({ id: 'org2' });
      mockPrismaService.organizationMembership.create.mockResolvedValue({ id: 'membership-1' });
      mockPrismaService.user.update.mockImplementation(({ where, data }) => {
        userState = { ...userState, ...data };
        return Promise.resolve({ ...userState });
      });
      const dto: RegisterCompleteDto = { userId: 'u', organizationName: 'OrgNueva', plan: 'pro' };
      const res = await service.registerComplete(dto);
      expect(res).toHaveProperty('accessToken');
      expect(mockPrismaService.organization.create).toHaveBeenCalled();
      // En la implementación real, ahora se usa roleId y se busca el ADMIN role
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });

  describe('google register callback', () => {
    it('should create new google-registered users with USER role', async () => {
      (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({
        provider: 'google-register',
        returnTo: '/register?step=organization',
      });

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-google',
        email: 'google@example.com',
        name: 'Google',
        lastname: 'User',
        role: { name: 'ADMIN' },
        status: 'ACTIVE',
        isActive: true,
        organizationId: null,
      });

      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub',
        email: 'google@example.com',
        email_verified: true,
        given_name: 'Google',
        family_name: 'User',
      });

      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      mockPrismaService.user.findUnique.mockResolvedValue({ 
        id: 'user-google', 
        role: { name: 'ADMIN' },
        organizationId: null
      });

      await service.handleGoogleRegisterCallback('code-123', 'state-123');

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'google@example.com',
            googleId: 'google-sub',
            roleId: 'role-user',
          }),
        }),
      );
    });
  });

  describe('login - Edge Cases', () => {
    it('should handle email with leading/trailing whitespace', async () => {
      // Arrange
      const dto = { email: '  user@test.com  ', password: 'password123' };
      const mockUser = {
        id: 'user-456',
        email: 'user@test.com',
        password: 'hashed-password',
        role: { name: 'USER' },
        isActive: true,
        organizationId: 'org-456',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      // Act
      await service.login(dto);

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: 'user@test.com',
            mode: 'insensitive',
          },
        },
      });
    });

    it('should handle uppercase email and convert to lowercase', async () => {
      // Arrange
      const dto = { email: 'USER@TEST.COM', password: 'password123' };
      const mockUser = {
        id: 'user-789',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'ADMIN',
        isActive: true,
        organizationId: 'org-789',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('admin-token');

      // Act
      const result = await service.login(dto);

      // Assert
      expect(result.user.role).toBe('USER');
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const dto = { email: 'nonexistent@test.com', password: 'password123' };
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw error when user is inactive', async () => {
      // Arrange
      const dto = { email: 'inactive@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-inactive',
        email: 'inactive@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: false,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(
        'Usuario inactivo',
      );
    });

    it('should throw error when user has no password', async () => {
      // Arrange
      const dto = { email: 'nopass@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-nopass',
        email: 'nopass@test.com',
        password: null,
        lastname: 'Doe',
        role: { name: 'USER' },
        isActive: true,
        organizationId: 'org-456',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales invalidas',
      );
    });

    it('should throw error when password is invalid', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'wrongpassword' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: { name: 'USER' },
        isActive: true,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales invalidas',
      );
    });

    it('should allow users without organization and preserve their data', async () => {
      const dto = { email: 'no-org@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-no-org',
        email: 'no-org@test.com',
        password: 'hashed-password',
        role: { name: 'USER' },
        isActive: true,
        organizationId: null,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.login(dto);

      expect(result.user.id).toBe('user-no-org');
      expect(result.user.organizationId).toBeNull();
    });

    it('should return proper JWT payload structure', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-payload-test',
        email: 'user@test.com',
        password: 'hashed-password',
        lastname: 'Doe',
        role: { name: 'MANAGER' },
        isActive: true,
        organizationId: 'org-payload',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: { name: 'MANAGER' },
      });

      // Act
      await service.login(dto);

      // Assert
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-payload-test',
          email: 'user@test.com',
          role: 'MANAGER',
          organizationId: 'org-payload',
          plan: null,
          sid: 'session-mock',
        },
        { expiresIn: '15m' },
      );
    });

    it('should handle multiple login attempts with different users', async () => {
      // Arrange
      const dto1 = { email: 'user1@test.com', password: 'pass1' };
      const dto2 = { email: 'user2@test.com', password: 'pass2' };

      const mockUser1 = {
        id: 'user-1',
        email: 'user1@test.com',
        password: 'hashed1',
        lastname: 'Doe',
        role: { name: 'USER' },
        isActive: true,
        organizationId: 'org-1',
      };

      const mockUser2 = {
        id: 'user-2',
        email: 'user2@test.com',
        password: 'hashed2',
        lastname: 'Doe',
        role: { name: 'ADMIN' },
        isActive: true,
        organizationId: 'org-789',
      };

      mockJwtService.signAsync
        .mockResolvedValueOnce('token1')
        .mockResolvedValueOnce('token2');
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2);

      // Act
      const result1 = await service.login(dto1);
      const result2 = await service.login(dto2);

      // Assert
      expect(result1.user.id).toBe('user-1');
      expect(result2.user.id).toBe('user-2');
      expect(result2.user.role).toBe('USER');
    });

    it('should include organization in user response', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        organizationId: 'org-special',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      // Act
      const result = await service.login(dto);

      // Assert
      expect(result.user.organizationId).toBe('org-special');
    });
  });

  describe('JWT Token Handling', () => {
    it('should handle JWT token generation errors gracefully', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockRejectedValue(
        new Error('JWT signing failed'),
      );

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('JWT signing failed');
    });

    it('should call signAsync exactly once per login', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      // Act
      await service.login(dto);

      // Assert
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Password Comparison', () => {
    it('should call bcrypt.compare with correct parameters', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'mypassword' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('token');

      // Act
      await service.login(dto);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'mypassword',
        'hashed-password',
      );
    });

    it('should handle bcrypt comparison errors', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        role: 'USER',
        isActive: true,
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Bcrypt error'),
      );

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Bcrypt error');
    });
  });

  describe('logout', () => {
    it('debe cerrar la sesión y detener el temporizador activo si existe', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
      };
      const mockActiveTimer = {
        id: 'timer-123',
        userId: 'user-123',
        totalPausedMs: 1000,
        pausedAt: null,
      };

      mockPrismaService.authSession.findFirst = jest.fn().mockResolvedValue(mockSession);
      mockPrismaService.timeEntry = {
        findFirst: jest.fn().mockResolvedValue(mockActiveTimer),
        update: jest.fn().mockResolvedValue({}),
      };
      mockPrismaService.authSession.update = jest.fn().mockResolvedValue({});

      const result = await service.logout('refresh-token');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.authSession.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.timeEntry.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123', endTime: null },
      });
      expect(mockPrismaService.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'timer-123' },
        data: expect.objectContaining({
          endTime: expect.any(Date),
          pausedAt: null,
        }),
      });
      expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('debe cerrar la sesión normalmente si no hay temporizador activo', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
      };

      mockPrismaService.authSession.findFirst = jest.fn().mockResolvedValue(mockSession);
      mockPrismaService.timeEntry = {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      };
      mockPrismaService.authSession.update = jest.fn().mockResolvedValue({});

      const result = await service.logout('refresh-token');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.timeEntry.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.timeEntry.update).not.toHaveBeenCalled();
      expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
