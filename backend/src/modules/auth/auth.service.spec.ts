import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PlanPolicyService } from 'src/common/plans/plan-policy.service';
import { OrganizationsService } from 'src/modules/organizations/organizations.service';
import * as bcrypt from 'bcrypt';
import * as dns from 'dns';

jest.mock('bcrypt');

jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    organizationMembership: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockPlanPolicyService = {
    getPlanConfig: jest.fn(),
    assertPlanIsSelectable: jest.fn(),
  };

  const mockOrganizationsService = {
    acceptInviteWithGoogle: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Default implementations
    mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockPrismaService));
    mockPrismaService.authSession.create.mockResolvedValue({ id: 'session-123' });
    
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
    it('should successfully register a user when email format and DNS MX are valid', async () => {
      // Arrange
      const dto = {
        nombre: 'Test',
        apellido: 'User',
        email: 'test@juana.com',
        password: 'password123',
      };
      const mockMxRecords = [{ exchange: 'mx.juana.com', priority: 10 }];
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue(mockMxRecords);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'new-user-id' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      // Act
      const result = await service.registerInit(dto);

      // Assert
      expect(dns.promises.resolveMx).toHaveBeenCalledWith('juana.com');
      expect(mockPrismaService.user.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(result).toEqual({ userId: 'new-user-id' });
    });

    it('should throw BadRequestException when email format is invalid', async () => {
      // Arrange
      const dto = {
        nombre: 'Test',
        apellido: 'User',
        email: 'invalid-email-without-domain',
        password: 'password123',
      };

      // Act & Assert
      await expect(service.registerInit(dto)).rejects.toThrow(BadRequestException);
      await expect(service.registerInit(dto)).rejects.toThrow('El formato del correo electrónico es inválido');
      expect(dns.promises.resolveMx).not.toHaveBeenCalled();
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when DNS MX resolution fails or returns no records', async () => {
      // Arrange
      const dto = {
        nombre: 'Test',
        apellido: 'User',
        email: 'test@invalid-domain-12345.com',
        password: 'password123',
      };
      (dns.promises.resolveMx as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'));

      // Act & Assert
      await expect(service.registerInit(dto)).rejects.toThrow(BadRequestException);
      await expect(service.registerInit(dto)).rejects.toThrow('El dominio del email no es válido o no está configurado para recibir correos');
      expect(dns.promises.resolveMx).toHaveBeenCalledWith('invalid-domain-12345.com');
      expect(mockPrismaService.user.findFirst).not.toHaveBeenCalled();
    });

    it('should reject a client-provided Google token', async () => {
      // Arrange
      const dto = {
        nombre: 'Google',
        apellido: 'User',
        email: 'google@test.com',
        googleToken: 'google-123',
      };
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.test.com' }]);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 'google-user-id' });

      // Act
      await expect(service.registerInit(dto)).rejects.toThrow(
        'El registro con Google debe completarse mediante OAuth',
      );
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if googleToken already exists', async () => {
      // Arrange
      const dto = {
        nombre: 'Google',
        apellido: 'User',
        email: 'google@test.com',
        googleToken: 'existing-google-123',
      };
      (dns.promises.resolveMx as jest.Mock).mockResolvedValue([{ exchange: 'mx.test.com' }]);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.registerInit(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should reject when current password is incorrect', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        password: 'hashed-current-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrong-password', 'newpassword123', 'newpassword123'),
      ).rejects.toThrow('La contraseña actual es incorrecta.');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-current-password');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should update password when current password is correct', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        password: 'hashed-current-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      const result = await service.changePassword(
        'user-123',
        'current-password',
        'newpassword123',
        'newpassword123',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith('current-password', 'hashed-current-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'hashed-new-password' },
      });
      expect(result).toEqual({ message: 'Contraseña actualizada correctamente' });
    });

    it('should store the hash and never the plaintext new password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        password: 'hashed-current-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

      await service.changePassword('user-123', 'current-password', 'newpassword123');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'hashed-new-password' },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: 'newpassword123' }),
        }),
      );
    });

    it('should reject short new passwords', async () => {
      await expect(
        service.changePassword('user-123', 'current-password', 'short'),
      ).rejects.toThrow('La contraseña debe tener al menos 8 caracteres');
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject existing password changes without currentPassword', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        password: 'hashed-current-password',
      });

      await expect(
        service.changePassword('user-123', undefined, 'newpassword123'),
      ).rejects.toThrow('La contraseña actual es requerida.');

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should reject Google users without internal password from change password flow', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        password: null,
      });

      await expect(
        service.changePassword('user-123', undefined, 'newpassword123'),
      ).rejects.toThrow('Usá el flujo de crear contraseña interna');

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('setInternalPassword', () => {
    it('should create an internal password for Google users without currentPassword', async () => {
      const updatedUser = {
        id: 'user-123',
        email: 'google@test.com',
        name: 'Google',
        lastname: 'User',
        roleId: 'role-user',
        googleStatus: true,
        isActive: true,
        organizationId: 'org-123',
      };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'user-123', password: null })
        .mockResolvedValueOnce({
          ...updatedUser,
          googleId: 'google-sub',
          password: 'hashed-internal-password',
          role: { name: 'USER' },
        });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org-123', plan: null });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-internal-password');

      const result = await service.setInternalPassword('user-123', 'password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'hashed-internal-password' },
      });
      expect(result.user.hasInternalPassword).toBe(true);
    });
  });

  describe('registerComplete', () => {
    it('should complete registration successfully', async () => {
      const dto = { userId: 'user-123', organizationName: 'Test Org', plan: 'pro' };
      const user = { id: 'user-123', organizationId: null };
      const org = { id: 'org-123', name: 'Test Org', plan: 'pro', isActive: true };

      mockPlanPolicyService.assertPlanIsSelectable = jest.fn();
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ ...user, role: { name: 'USER' } }).mockResolvedValueOnce({ 
        id: 'u-123',
        email: 'test@tino.com',
        role: { name: 'ADMIN' },
        organizationId: org.id,
      });
      mockPrismaService.organization.findFirst.mockResolvedValue(null);
      mockPrismaService.$transaction = jest.fn().mockImplementation(async (cb) => cb({
        ...mockPrismaService,
        organization: { create: jest.fn().mockResolvedValue(org) },
        organizationMembership: { create: jest.fn() },
        user: { update: jest.fn().mockResolvedValue({ ...user, organizationId: org.id }) },
        role: { 
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.name === 'USER') return Promise.resolve({ id: 'role-user', name: 'USER' });
            if (where.name === 'ADMIN') return Promise.resolve({ id: 'role-admin', name: 'ADMIN' });
            return Promise.resolve(null);
          }),
        },
      }));
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.registerComplete(dto as any);
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.organizationId).toBe(org.id);
    });

    it('should throw BadRequestException if user already in org', async () => {
      const dto = { userId: 'user-123', organizationName: 'Test Org', plan: 'pro' };
      const user = { id: 'user-123', organizationId: 'org-1', role: { name: 'USER' } };
      mockPlanPolicyService.assertPlanIsSelectable = jest.fn();
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.registerComplete(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user already has an organization', async () => {
      const user = { id: 'u-123', organizationId: 'org-123', role: { name: 'USER' } };
      mockPlanPolicyService.assertPlanIsSelectable = jest.fn();
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.registerComplete({ userId: 'u-123', organizationName: 'Test Org', plan: 'pro' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when organization name is already taken', async () => {
      const user = { id: 'u-123', organizationId: null, role: { name: 'USER' } };
      mockPlanPolicyService.assertPlanIsSelectable = jest.fn();
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });

      await expect(service.registerComplete({ userId: 'u-123', organizationName: 'Test Org', plan: 'pro' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-payload-test',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'hashed-password',
        role: { name: 'USER' },
        status: 'ACTIVE',
        isActive: true,
        organizationId: 'org-payload',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: 'pro' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      // Act
      const result = await service.login(dto);

      // Assert
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe(dto.email);
      expect(result.user.id).toBe('user-payload-test');
      expect(result.user.organizationPlan).toBe('pro');
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: {
            equals: dto.email.toLowerCase(),
            mode: 'insensitive',
          },
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        dto.password,
        mockUser.password,
      );
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-payload-test',
        email: 'user@test.com',
        role: 'USER',
        organizationId: 'org-payload',
        plan: null,
        sid: 'session-123',
      }, {
        expiresIn: '15m',
      });
    });

    it('should normalize email by trimming and lowercasing', async () => {
      // Arrange
      const dto = { email: '  USER@TEST.COM  ', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        isActive: true,
        role: { name: 'USER' },
        status: 'ACTIVE',
        name: 'John',
        lastname: 'Doe',
        organizationId: 'org-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: 'free' });
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

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      const dto = { email: 'nonexistent@test.com', password: 'password123' };
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales invalidas');
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        isActive: false,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Usuario inactivo');
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: null,
        isActive: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales invalidas',
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'wrong-password' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        password: 'hashed-password',
        isActive: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales invalidas');
    });

    it('should return user data with all required fields', async () => {
      // Arrange
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'hashed-password',
        role: { name: 'USER' },
        status: 'ACTIVE',
        isActive: true,
        organizationId: 'org-456',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.organization.findUnique.mockResolvedValue({ plan: 'max' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      // Act
      const result = await service.login(dto);

      // Assert
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        role: 'USER',
        googleStatus: false,
        isActive: true,
        organizationId: 'org-456',
        organizationPlan: 'max',
        hasInternalPassword: true,
        requiresInternalPasswordSetup: false,
      });
    });

    it('should set organizationPlan as null for users without organization', async () => {
      const dto = { email: 'user@test.com', password: 'password123' };
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
        name: 'John',
        lastname: 'Doe',
        password: 'hashed-password',
        role: { name: 'USER' },
        status: 'ACTIVE',
        isActive: true,
        organizationId: null,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.login(dto);

      expect(result.user.organizationPlan).toBeNull();
      expect(mockPrismaService.organization.findUnique).not.toHaveBeenCalled();
    });

    it('should login with Google if googleId exists and googleStatus is true', async () => {
      // Arrange
      const dto = { googleToken: 'google-abc', email: 'user@test.com', password: undefined };
      const user = {
        id: 'user-123',
        email: 'user@test.com',
        googleId: 'google-abc',
        googleStatus: true,
        isActive: true,
        role: { name: 'USER' }
      };
      mockPrismaService.user.findFirst.mockResolvedValue(user);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Credenciales invalidas');

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'user@test.com', mode: 'insensitive' } },
      });
    });

    it('should throw if googleId not found or googleStatus is false', async () => {
      // Arrange
      const dto = { googleToken: 'google-xyz', email: 'user@test.com', password: undefined };
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        googleId: 'google-xyz',
        googleStatus: false,
        role: { name: 'USER' }
      });

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow('Usuario inactivo');
    });
  });

  describe('google oauth helpers', () => {
    it('should reuse an internal user by email without changing its global role', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ provider: 'google-register' });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-new', email: 'existing@test.com', email_verified: true,
      });
      const existing = {
        id: 'existing', email: 'existing@test.com', name: 'Existing', lastname: 'User',
        googleId: null, googleStatus: false, roleId: 'role-user', isActive: true, organizationId: 'org-1',
      };
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      mockPrismaService.user.update.mockResolvedValue({ ...existing, googleId: 'google-new', googleStatus: true });
      mockPrismaService.user.findUnique.mockResolvedValue({ ...existing, role: { name: 'USER' } });
      mockJwtService.signAsync.mockResolvedValue('token');

      await service.handleGoogleRegisterCallback('code', 'state');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'existing' },
        data: { googleId: 'google-new', googleStatus: true, isEmailVerified: true },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
    it.each(['google-register', 'google-continue'])(
      'should reject unverified email for %s',
      async (provider) => {
        mockJwtService.verifyAsync.mockResolvedValue({ provider });
        jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
          sub: 'unverified-sub', email: 'unverified@test.com', email_verified: false,
        });
        const result = provider === 'google-register'
          ? await service.handleGoogleRegisterCallback('code', 'state')
          : await service.handleGoogleContinueCallback('code', 'state');
        expect(result.url).toContain('reason=email_not_verified');
        expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      },
    );
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_LOGIN_REDIRECT_URI: 'https://api.example.com/auth/google/login/callback',
        FRONTEND_URL: 'https://frontend.example.com',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should generate google login url with signed state', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed-state');

      const result = await service.createGoogleLoginUrl('/dashboard');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('state=signed-state');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          returnTo: '/dashboard',
          provider: 'google-login',
        },
        {
          expiresIn: '10m',
        },
      );
    });

    it('should return error redirect when google login callback has missing params', async () => {
      const result = await service.handleGoogleLoginCallback(undefined, undefined);
      const redirectUrl = result.url;

      expect(redirectUrl).toContain('https://frontend.example.com/login');
      expect(redirectUrl).toContain('google=error');
      expect(redirectUrl).toContain('reason=missing_params');
    });

    it('should return error redirect when google login callback has invalid state', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid state'));

      const result = await service.handleGoogleLoginCallback('code-123', 'invalid-state');
      const redirectUrl = result.url;

      expect(redirectUrl).toContain('https://frontend.example.com/login');
      expect(redirectUrl).toContain('google=error');
      expect(redirectUrl).toContain('reason=invalid_state');
    });

    it('should auto-link and login when googleId is missing but email matches an existing user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-login',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-123',
        email: 'user@test.com',
        email_verified: true,
      });
      
      const mockUser = { 
        id: 'user-123', 
        email: 'user@test.com', 
        name: 'John', 
        lastname: 'Doe',
        role: { name: 'USER' },
        isActive: true,
        googleId: null,
        googleStatus: false,
        organizationId: null
      };

      // Primera llamada (googleId): null, Segunda llamada (email): mockUser
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, role: { name: 'USER' } });
      
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, googleId: 'google-sub-123', googleStatus: true });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleLoginCallback('code-123', 'state-123');
      const redirectUrl = result.url;

      expect(redirectUrl).toContain('google=success');
      // El token ya no se pasa por URL por seguridad (ahora es por cookie en el controlador)
      // expect(redirectUrl).toContain('token=jwt-token');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { googleId: 'google-sub-123', googleStatus: true },
      });
    });

    it('should still reject google login when neither googleId nor email match any user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-login',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-not-found',
        email: 'unknown@test.com',
        email_verified: true,
      });
      
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.handleGoogleLoginCallback('code-123', 'state-123');
      const redirectUrl = result.url;

      expect(redirectUrl).toContain('google=error');
      expect(redirectUrl).toContain('reason=account_not_registered');
    });

    it('should unlink google account successfully', async () => {
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-123', googleStatus: false });

      const result = await service.unlinkGoogleAccount('user-123');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { googleStatus: false },
      });
      expect(result).toEqual({
        success: true,
        message: 'Cuenta de Google desvinculada correctamente',
      });
    });

    it('should create new user if googleId does not exist, even if email exists', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-register',
        returnTo: '/register?step=organization',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-999',
        email: 'existing@email.com',
        email_verified: true,
        given_name: 'Google',
        family_name: 'User',
      });
      // No usuario con ese googleId
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      // Pero sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ existe uno con ese email
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-exists', email: 'existing@email.com', googleId: null, isActive: true }
      ]);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-google',
        email: 'existing@email.com',
        name: 'Google',
        lastname: 'User',
        role: { name: 'ADMIN' },
        status: 'ACTIVE',
        isActive: true,
        organizationId: null,
      });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
      mockPrismaService.user.findUnique.mockResolvedValue({ 
        id: 'user-123',
        email: 'test@example.com',
        role: { name: 'USER' },
        organizationId: 'org-123'
      });

      await service.handleGoogleRegisterCallback('code-123', 'state-123');

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'existing@email.com',
            googleId: 'google-sub-999',
            roleId: 'role-admin',
          }),
        }),
      );
    });

    it('should generate google register url', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed-state-reg');

      const result = await service.createGoogleRegisterUrl('/onboarding');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(result.url).toContain('state=signed-state-reg');
    });

    it('should generate google continue url with signed state', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed-state-continue');

      const result = await service.createGoogleContinueUrl('/dashboard');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('state=signed-state-continue');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          returnTo: '/dashboard',
          provider: 'google-continue',
        },
        {
          expiresIn: '10m',
        },
      );
    });

    it('should continue with Google when user exists by googleId', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-existing',
        email: 'linked@test.com',
        email_verified: true,
      });
      const linkedUser = {
        id: 'user-linked',
        email: 'linked@test.com',
        name: 'Linked',
        lastname: 'User',
        roleId: 'role-user',
        googleId: 'google-sub-existing',
        googleStatus: true,
        isActive: true,
        organizationId: 'org-123',
      };
      mockPrismaService.user.findFirst.mockResolvedValueOnce(linkedUser);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...linkedUser, role: { name: 'USER' } });
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org-123', plan: { name: 'free' } });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=success');
      expect((result as any).authResponse.user.id).toBe('user-linked');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should continue with Google by linking an existing email without googleId', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-link',
        email: 'email@test.com',
        email_verified: true,
      });
      const emailUser = {
        id: 'user-email',
        email: 'email@test.com',
        name: 'Email',
        lastname: 'User',
        roleId: 'role-user',
        googleId: null,
        googleStatus: false,
        isActive: true,
        organizationId: 'org-123',
      };
      const linkedUser = { ...emailUser, googleId: 'google-sub-link', googleStatus: true };
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(emailUser);
      mockPrismaService.user.update.mockResolvedValue(linkedUser);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...linkedUser, role: { name: 'USER' } });
      mockPrismaService.organization.findUnique.mockResolvedValue({ id: 'org-123', plan: { name: 'free' } });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=success');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-email' },
        data: {
          googleId: 'google-sub-link',
          googleStatus: true,
          isEmailVerified: true,
        },
      });
      expect((result as any).authResponse.user.id).toBe('user-email');
    });

    it('should continue with Google by creating a new user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-new',
        email: 'new@test.com',
        email_verified: true,
        given_name: 'New',
        family_name: 'User',
      });
      const createdUser = {
        id: 'user-new',
        email: 'new@test.com',
        name: 'New',
        lastname: 'User',
        roleId: 'role-user',
        googleId: 'google-sub-new',
        googleStatus: true,
        isActive: true,
        organizationId: null,
      };
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-user', name: 'USER' });
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...createdUser, role: { name: 'USER' } });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=success');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@test.com',
            googleId: 'google-sub-new',
            googleStatus: true,
          }),
        }),
      );
      expect((result as any).authResponse.user.organizationId).toBeNull();
    });

    it('should authenticate an existing Google user without organization', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-no-org',
        email: 'no-org@test.com',
        email_verified: true,
      });
      const userWithoutOrg = {
        id: 'user-no-org',
        email: 'no-org@test.com',
        name: 'No',
        lastname: 'Org',
        roleId: 'role-user',
        googleId: 'google-sub-no-org',
        googleStatus: true,
        isActive: true,
        organizationId: null,
      };
      mockPrismaService.user.findFirst.mockResolvedValueOnce(userWithoutOrg);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...userWithoutOrg, role: { name: 'USER' } });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=success');
      expect((result as any).authResponse.user.organizationId).toBeNull();
      expect(mockPrismaService.organization.findUnique).not.toHaveBeenCalled();
    });

    it('should reject an inactive Google continue user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-inactive',
        email: 'inactive@test.com',
        email_verified: true,
      });
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'user-inactive',
        email: 'inactive@test.com',
        googleId: 'google-sub-inactive',
        googleStatus: true,
        isActive: false,
      });

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=error');
      expect(result.url).toContain('reason=inactive_user');
      expect(mockPrismaService.authSession.create).not.toHaveBeenCalled();
    });

    it('should treat a hard-deleted Google user as new', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-deleted',
        email: 'deleted@test.com',
        email_verified: true,
        given_name: 'Deleted',
        family_name: 'Recreated',
      });
      const recreatedUser = {
        id: 'user-recreated',
        email: 'deleted@test.com',
        name: 'Deleted',
        lastname: 'Recreated',
        roleId: 'role-user',
        googleId: 'google-sub-deleted',
        googleStatus: true,
        isActive: true,
        organizationId: null,
      };
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-user', name: 'USER' });
      mockPrismaService.user.create.mockResolvedValue(recreatedUser);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...recreatedUser, role: { name: 'USER' } });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.handleGoogleContinueCallback('code-123', 'state-123');

      expect(result.url).toContain('/login?google=success');
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect((result as any).authResponse.user.id).toBe('user-recreated');
    });

    it('should handle google register callback errors', async () => {
      const frontendBaseUrl = 'https://frontend.example.com';
      
      // Missing params
      let res = await service.handleGoogleRegisterCallback(undefined, undefined);
      expect(res.url).toContain('register?google=error&reason=missing_params');

      // Invalid state
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
      res = await service.handleGoogleRegisterCallback('code', 'bad-state');
      expect(res.url).toContain('register?google=error&reason=invalid_state');

      // Invalid provider
      mockJwtService.verifyAsync.mockResolvedValue({ provider: 'wrong' });
      const result = await service.handleGoogleRegisterCallback('code', 'state');
      expect(result.url).toContain('register?google=error&reason=invalid_state');
    });

    it('should generate google link url', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_REDIRECT_URI = 'https://api.example.com/auth/google/callback';
      mockJwtService.signAsync.mockResolvedValue('signed-state-link');

      const result = await service.createGoogleLinkUrl('user-123', '/settings');

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(result.url).toContain('state=signed-state-link');
    });

    it('should handle google link callback successfully', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        provider: 'google-link',
        returnTo: '/profile',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-456',
        email: 'user@test.com',
        email_verified: true,
      });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-123' });

      const res = await service.handleGoogleLinkCallback('code', 'state');

      expect(res).toContain('/profile?google=linked');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          googleId: 'google-sub-456',
          googleStatus: true,
        }),
      });
    });

    it('should fail google link if already linked to another user', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        provider: 'google-link',
      });
      jest.spyOn(service as any, 'fetchGoogleProfile').mockResolvedValue({
        sub: 'google-sub-456',
        email: 'user@test.com',
        email_verified: true,
      });
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'other-user' });

      const res = await service.handleGoogleLinkCallback('code', 'state');

      expect(res).toContain('google=error&reason=google_already_linked');
    });

    it('validates state before reporting provider cancellation', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google-continue',
        returnTo: '/dashboard',
      });

      const result = await service.handleGoogleContinueCallback(
        undefined,
        'signed-state',
        undefined,
        'access_denied',
      );

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('signed-state');
      expect(result.url).toContain('reason=provider_cancelled');
    });
  });

  describe('first-party cookie contract', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it.each([
      ['production', true],
      ['development', false],
    ])('sets HttpOnly SameSite=Lax cookies in %s', (environment, secure) => {
      process.env.NODE_ENV = environment;
      const response = { cookie: jest.fn(), clearCookie: jest.fn() } as any;

      service.setAuthCookies(response, {
        accessToken: 'access-test',
        refreshToken: 'refresh-test',
      });

      expect(response.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-test',
        expect.objectContaining({ httpOnly: true, secure, sameSite: 'lax', path: '/' }),
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-test',
        expect.objectContaining({ httpOnly: true, secure, sameSite: 'lax', path: '/' }),
      );
    });

    it('clears every auth cookie with matching attributes', () => {
      process.env.NODE_ENV = 'production';
      const response = { cookie: jest.fn(), clearCookie: jest.fn() } as any;

      service.clearAuthCookies(response);

      expect(response.clearCookie).toHaveBeenCalledTimes(5);
      for (const [, options] of response.clearCookie.mock.calls) {
        expect(options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
      }
    });
  });
});
