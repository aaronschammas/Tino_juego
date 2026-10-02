import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/prisma.service';
import { ActiveOrganizationService } from 'src/common/active-organization/active-organization.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  beforeEach(async () => {
    const mockService = {
      login: jest.fn(),
      registerInit: jest.fn(),
      registerComplete: jest.fn(),
      createGoogleLoginUrl: jest.fn(),
      createGoogleRegisterUrl: jest.fn(),
      handleGoogleLoginCallback: jest.fn(),
      handleGoogleRegisterCallback: jest.fn(),
      createGoogleLinkUrl: jest.fn(),
      handleGoogleLinkCallback: jest.fn(),
      unlinkGoogleAccount: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      setInternalPassword: jest.fn(),
      changePassword: jest.fn(),
      setAuthCookies: jest.fn(),
      clearAuthCookies: jest.fn(),
      setActiveOrganizationCookie: jest.fn(),
    };
    const mockActiveOrganization = {
      getContextForRequest: jest.fn().mockResolvedValue({ activeOrganization: null }),
      getContext: jest.fn().mockResolvedValue({ activeOrganization: { id: 'org-123' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockService },
        { provide: ActiveOrganizationService, useValue: mockActiveOrganization },
        { provide: AuthGuard, useValue: { canActivate: jest.fn(() => true) } },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'user@test.com',
        password: 'password123',
      };
      const response = {
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        user: {
          id: 'user-123',
          email: 'user@test.com',
        },
      };
      service.login.mockResolvedValue(response);

      const reqMock = { cookies: {} } as any;
      const resMock = {} as any;
      const result = await controller.login(loginDto, reqMock, resMock);

      expect(result).toEqual({ user: response.user });
      expect(service.login).toHaveBeenCalledWith(loginDto, reqMock);
      expect(service.setAuthCookies).toHaveBeenCalledWith(resMock, response);
    });

    it('should handle login failure', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'user@test.com',
        password: 'wrongpassword',
      };
      service.login.mockRejectedValue(new Error('Invalid credentials'));

      // Act & Assert
      await expect(controller.login(loginDto, {} as any, {} as any)).rejects.toThrow('Invalid credentials');
    });

    it('should handle user not found', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'nonexistent@test.com',
        password: 'password123',
      };
      service.login.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(controller.login(loginDto, {} as any, {} as any)).rejects.toThrow('User not found');
    });
  });

  describe('password endpoints', () => {
    it('should call changePassword for the authenticated user', async () => {
      service.changePassword.mockResolvedValue({ message: 'Contraseña actualizada correctamente' });

      const result = await controller.changePassword(
        { id: 'user-123' },
        'current-password',
        'newpassword123',
        'newpassword123',
      );

      expect(service.changePassword).toHaveBeenCalledWith(
        'user-123',
        'current-password',
        'newpassword123',
        'newpassword123',
      );
      expect(result).toEqual({ message: 'Contraseña actualizada correctamente' });
    });

    it('should call setInternalPassword for the authenticated user', async () => {
      service.setInternalPassword.mockResolvedValue({ user: { id: 'user-123' } });

      const result = await controller.setInternalPassword({ id: 'user-123' }, 'password123');

      expect(service.setInternalPassword).toHaveBeenCalledWith('user-123', 'password123');
      expect(result).toEqual({ user: { id: 'user-123' } });
    });
  });

  describe('register', () => {
    it('should call registerInit', async () => {
      const payload = {
        nombre: 'Juan',
        apellido: 'Perez',
        email: 'juan@test.com',
        password: '123456',
      };
      const response = { userId: 'user-1' };
      service.registerInit.mockResolvedValue(response);

      const result = await controller.registerInit(payload as any);

      expect(service.registerInit).toHaveBeenCalledWith(payload);
      expect(result).toEqual(response);
    });

    it('should call registerComplete', async () => {
      const payload = {
        userId: 'user-1',
        organizationName: 'Org Demo',
        plan: 'pro',
      };
      const response = { accessToken: 'jwt-token', refreshToken: 'refresh-token', user: { id: 'user-1' } };
      service.registerComplete.mockResolvedValue(response);

      const reqMock = { cookies: {} } as any;
      const resMock = {} as any;
      const result = await controller.registerComplete(payload as any, reqMock, resMock);

      expect(service.registerComplete).toHaveBeenCalledWith(payload, reqMock);
      expect(result).toEqual({ user: response.user });
      expect(service.setAuthCookies).toHaveBeenCalledWith(resMock, response);
    });
  });

  describe('google oauth', () => {
    it('should call createGoogleLoginUrl', async () => {
      service.createGoogleLoginUrl.mockResolvedValue({ url: 'https://google/login' });

      const result = await controller.createGoogleLoginUrl('/dashboard');

      expect(service.createGoogleLoginUrl).toHaveBeenCalledWith('/dashboard');
      expect(result).toEqual({ url: 'https://google/login' });
    });

    it('should call createGoogleRegisterUrl', async () => {
      service.createGoogleRegisterUrl.mockResolvedValue({ url: 'https://google/register' });

      const result = await controller.createGoogleRegisterUrl('/register');

      expect(service.createGoogleRegisterUrl).toHaveBeenCalledWith('/register');
      expect(result).toEqual({ url: 'https://google/register' });
    });

    it('should redirect on google login callback', async () => {
      const responseMock = { redirect: jest.fn() } as any;
      service.handleGoogleLoginCallback.mockResolvedValue({ 
        url: 'https://frontend/login?google=success',
        authResponse: { accessToken: 'tk', refreshToken: 'rt', user: {} }
      });

      const reqMock = { cookies: {} } as any;
      await controller.googleLoginCallback('code', 'state', undefined, reqMock, responseMock);

      expect(service.handleGoogleLoginCallback).toHaveBeenCalledWith('code', 'state', reqMock, undefined);
      expect(service.setAuthCookies).toHaveBeenCalledWith(
        responseMock,
        expect.objectContaining({ accessToken: 'tk', refreshToken: 'rt' }),
      );
      expect(responseMock.redirect).toHaveBeenCalledWith('https://frontend/login?google=success');
    });

    it('should redirect on google register callback', async () => {
      const responseMock = { redirect: jest.fn() } as any;
      service.handleGoogleRegisterCallback.mockResolvedValue({ 
        url: 'https://frontend/register?google=success',
        authResponse: { accessToken: 'tk', refreshToken: 'rt', user: {} }
      });

      const reqMock = { cookies: {} } as any;
      await controller.googleRegisterCallback('code', 'state', undefined, reqMock, responseMock);

      expect(service.handleGoogleRegisterCallback).toHaveBeenCalledWith('code', 'state', reqMock, undefined);
      expect(service.setAuthCookies).toHaveBeenCalledWith(
        responseMock,
        expect.objectContaining({ accessToken: 'tk', refreshToken: 'rt' }),
      );
      expect(responseMock.redirect).toHaveBeenCalledWith('https://frontend/register?google=success');
    });

    it('should call createGoogleLinkUrl with current user id', async () => {
      const currentUser = { id: 'user-123' };
      service.createGoogleLinkUrl.mockResolvedValue({ url: 'https://google/link' });

      const result = await controller.createGoogleLinkUrl(currentUser, '/profile');

      expect(service.createGoogleLinkUrl).toHaveBeenCalledWith('user-123', '/profile');
      expect(result).toEqual({ url: 'https://google/link' });
    });

    it('should redirect on google link callback', async () => {
      const responseMock = { redirect: jest.fn() } as any;
      service.handleGoogleLinkCallback.mockResolvedValue('https://frontend/profile?google=linked');

      await controller.googleCallback('code', 'state', responseMock);

      expect(service.handleGoogleLinkCallback).toHaveBeenCalledWith('code', 'state');
      expect(responseMock.redirect).toHaveBeenCalledWith('https://frontend/profile?google=linked');
    });

    it('should unlink google account for current user', async () => {
      const currentUser = { id: 'user-999' };
      const response = { success: true, message: 'Cuenta de Google desvinculada correctamente' };
      service.unlinkGoogleAccount.mockResolvedValue(response);

      const result = await controller.unlinkGoogle(currentUser);

      expect(service.unlinkGoogleAccount).toHaveBeenCalledWith('user-999');
      expect(result).toEqual(response);
    });
  });
});
