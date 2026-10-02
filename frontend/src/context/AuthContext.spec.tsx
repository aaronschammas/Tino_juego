/**
 * AuthContext.tsx - Authentication Context Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext } from './AuthContext';
import * as authLib from '@/lib/auth';
import * as apiLib from '@/lib/api';
import { AuthContextResponse, User, LoginResponse } from '@/types/user';
import { usePathname, useRouter } from 'next/navigation';

// Mock the modules
jest.mock('@/lib/auth');
jest.mock('@/lib/api');
jest.mock('next/navigation');

describe('AuthContext and AuthProvider', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER',
    isActive: true,
    status: 'ACTIVE',
    organizationId: 'org-123',
    organizationPlan: { name: 'free' } as any,
  };

  const mockLoginResponse: LoginResponse = {
    user: mockUser,
  };

  const mockContext: AuthContextResponse = {
    user: mockUser,
    activeOrganization: {
      id: 'org-123',
      name: 'Tino',
      plan: mockUser.organizationPlan ?? null,
    },
    activeMembership: {
      id: 'membership-123',
      role: 'ORG_OWNER',
    },
    memberships: [
      {
        membershipId: 'membership-123',
        organizationId: 'org-123',
        organizationName: 'Tino',
        role: 'ORG_OWNER',
        plan: mockUser.organizationPlan ?? null,
        isActive: true,
      },
    ],
    features: {
      canInviteMembers: false,
      maxProjects: 2,
      maxMembers: 1,
    },
  };

  const contextFor = (organizationId: string): AuthContextResponse => ({
    ...mockContext,
    user: { ...mockUser, organizationId },
    activeOrganization: {
      ...mockContext.activeOrganization!,
      id: organizationId,
      name: organizationId,
    },
    activeMembership: {
      ...mockContext.activeMembership!,
      id: `membership-${organizationId}`,
    },
  });

  let mockRouter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    };
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue(mockRouter);
    jest.spyOn(require('next/navigation'), 'usePathname').mockReturnValue('/dashboard');
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);
    (apiLib.apiPost as jest.Mock).mockResolvedValue(mockLoginResponse);
    (apiLib.invalidateApiCache as jest.Mock).mockImplementation(() => undefined);
    (apiLib.setActiveOrganizationId as jest.Mock).mockImplementation(() => undefined);
  });

  describe('AuthProvider initialization', () => {
    it('should initialize with loading state', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));

      // Act
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      expect(result.current).toBeDefined();
      await waitFor(() => {
        expect(result.current?.isLoading).toBe(false);
        expect(result.current?.user).toBeNull();
      });
    });

    it('should restore user from localStorage on mount', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('stored_token');
      (authLib.getStoredUser as jest.Mock).mockReturnValue(mockUser);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      // Act
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      await waitFor(() => {
        expect(result.current?.user).toMatchObject(mockUser);
        expect(result.current?.activeOrganization?.id).toBe('org-123');
        expect(result.current?.isLoading).toBe(false);
      });
    });

    it('should handle missing token in localStorage', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));

      // Act
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      await waitFor(() => {
        expect(result.current?.user).toBeNull();
        expect(result.current?.isLoading).toBe(false);
      });
    });

    it('should handle missing user even with token', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('token_without_user');
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));

      // Act
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      await waitFor(() => {
        expect(result.current?.user).toBeNull();
        expect(result.current?.isLoading).toBe(false);
      });
    });

    it('should redirect orgless users on protected routes', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('stored_token');
      (authLib.getStoredUser as jest.Mock).mockReturnValue({
        ...mockUser,
        organizationId: null,
      });
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue({
        ...mockContext,
        user: { ...mockUser, organizationId: undefined, organizationPlan: null },
        activeOrganization: null,
        activeMembership: null,
        memberships: [],
        features: { canInviteMembers: false, maxProjects: null, maxMembers: null },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          '/register?step=organization&userId=user-123',
        );
      });
    });
  });

  describe('Login functionality', () => {
    it('should successfully login with email and password', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockLoginResponse);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act
      await act(async () => {
        await result.current!.login('test@example.com', 'password123');
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(apiLib.apiGetAuthContext).toHaveBeenCalledWith();
      expect(result.current?.user).toMatchObject(mockUser);
    });

    it('should handle login error gracefully', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));
      const loginError = new Error('Invalid credentials');
      (apiLib.apiPost as jest.Mock).mockRejectedValue(loginError);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current!.login('test@example.com', 'wrongpassword')
        ).rejects.toThrow('Invalid credentials');
      });

      expect(result.current?.user).toBeNull();
    });

    it('should throw error with custom message on login failure', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));
      (apiLib.apiPost as jest.Mock).mockRejectedValue(new Error());

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current!.login('test@example.com', 'password')
        ).rejects.toThrow('Error al iniciar sesión');
      });
    });

    it('should handle login with custom error message', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));
      const customError = { message: 'Network timeout' };
      (apiLib.apiPost as jest.Mock).mockRejectedValue(customError);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current!.login('test@example.com', 'password')
        ).rejects.toThrow('Network timeout');
      });
    });
  });

  describe('Logout functionality', () => {
    it('should clear auth state on logout', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('token');
      (authLib.getStoredUser as jest.Mock).mockReturnValue(mockUser);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Wait for initial user load
      await waitFor(() => {
        expect(result.current?.user).toMatchObject(mockUser);
      });

      // Act
      await act(async () => {
        result.current!.logout();
      });

      // Assert
      expect(authLib.clearAllAuth).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
      expect(result.current?.user).toBeNull();
    });

    it('should navigate to login on logout', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiGetAuthContext as jest.Mock).mockRejectedValue(new Error('No session'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act
      await act(async () => {
        result.current!.logout();
      });

      // Assert
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });

  describe('Context provider value', () => {
    it('should provide correct context value', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('token');
      (authLib.getStoredUser as jest.Mock).mockReturnValue(mockUser);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Assert
      await waitFor(() => {
        expect(result.current).toMatchObject({
          user: expect.objectContaining({ id: mockUser.id }),
          isLoading: false,
          login: expect.any(Function),
          logout: expect.any(Function),
        });
      });
    });

    it('should throw error when useAuth is used outside AuthProvider', () => {
      // Arrange & Act
      const { result } = renderHook(() => React.useContext(AuthContext));

      // Assert
      expect(result.current).toBeUndefined();
    });
  });

  describe('Multiple login/logout cycles', () => {
    it('should handle multiple login attempts', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue(null);
      (authLib.getStoredUser as jest.Mock).mockReturnValue(null);
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockLoginResponse);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      // Act - First login
      await act(async () => {
        await result.current!.login('test1@example.com', 'pass1');
      });

      expect(result.current?.user).toMatchObject(mockUser);

      // Act - Second login
      await act(async () => {
        await result.current!.login('test2@example.com', 'pass2');
      });

      // Assert
      expect(apiLib.apiPost).toHaveBeenCalledTimes(2);
      expect(result.current?.user).toMatchObject(mockUser);
    });

    it('should handle logout followed by login', async () => {
      // Arrange
      (authLib.getToken as jest.Mock).mockReturnValue('token');
      (authLib.getStoredUser as jest.Mock).mockReturnValue(mockUser);
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockLoginResponse);
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValue(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current?.user).toMatchObject(mockUser);
      });

      // Act - Logout
      await act(async () => {
        result.current!.logout();
      });

      expect(result.current?.user).toBeNull();

      // Act - Login again
      await act(async () => {
        await result.current!.login('test@example.com', 'password');
      });

      // Assert
      expect(result.current?.user).toMatchObject(mockUser);
    });
  });

  describe('Organization context', () => {
    it('should switch organization and clear tenant cache', async () => {
      const proContext: AuthContextResponse = {
        ...mockContext,
        user: { ...mockUser, organizationId: 'org-pro' },
        activeOrganization: {
          id: 'org-pro',
          name: 'Grido',
          plan: { id: 'plan-pro', name: 'pro', title: 'Pro', maxUsers: 10, maxProjects: null },
        },
        activeMembership: { id: 'membership-pro', role: 'ORG_MEMBER' },
        memberships: [
          ...mockContext.memberships,
          {
            membershipId: 'membership-pro',
            organizationId: 'org-pro',
            organizationName: 'Grido',
            role: 'ORG_MEMBER',
            plan: { id: 'plan-pro', name: 'pro', title: 'Pro', maxUsers: 10, maxProjects: null },
            isActive: true,
          },
        ],
        features: { canInviteMembers: true, maxProjects: null, maxMembers: 10 },
      };

      (apiLib.apiPost as jest.Mock).mockResolvedValue(proContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      await act(async () => {
        await result.current!.switchOrganization('org-pro');
      });

      expect(apiLib.apiPost).toHaveBeenCalledWith('/auth/switch-organization', {
        organizationId: 'org-pro',
      });
      expect(apiLib.invalidateApiCache).toHaveBeenCalled();
      expect(apiLib.setActiveOrganizationId).toHaveBeenCalledWith('org-pro');
      expect(result.current?.activeOrganization?.name).toBe('Grido');
      expect(result.current?.features?.canInviteMembers).toBe(true);
    });

    it('serializes rapid switches and sends only the latest pending selection', async () => {
      const first = deferred<AuthContextResponse>();
      const last = deferred<AuthContextResponse>();
      (apiLib.apiPost as jest.Mock)
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => last.promise);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      let firstSwitch!: Promise<void>;
      let secondSwitch!: Promise<void>;
      let thirdSwitch!: Promise<void>;
      act(() => {
        firstSwitch = result.current!.switchOrganization('org-a');
        secondSwitch = result.current!.switchOrganization('org-b');
        thirdSwitch = result.current!.switchOrganization('org-c');
      });

      expect(apiLib.apiPost).toHaveBeenCalledTimes(1);
      expect(apiLib.apiPost).toHaveBeenLastCalledWith('/auth/switch-organization', {
        organizationId: 'org-a',
      });

      await act(async () => {
        first.resolve(contextFor('org-a'));
        await Promise.resolve();
      });

      expect(result.current?.activeOrganization?.id).toBe('org-123');
      expect(result.current?.isSwitchingOrganization).toBe(true);
      expect(apiLib.apiPost).toHaveBeenCalledTimes(2);
      expect(apiLib.apiPost).toHaveBeenLastCalledWith('/auth/switch-organization', {
        organizationId: 'org-c',
      });

      await act(async () => {
        last.resolve(contextFor('org-c'));
        await Promise.all([firstSwitch, secondSwitch, thirdSwitch]);
      });

      expect(result.current?.activeOrganization?.id).toBe('org-c');
      expect(result.current?.isSwitchingOrganization).toBe(false);
      expect(apiLib.setActiveOrganizationId).toHaveBeenLastCalledWith('org-c');
    });

    it('serializes two rapid successful selections so the second wins on server and client', async () => {
      const first = deferred<AuthContextResponse>();
      const second = deferred<AuthContextResponse>();
      (apiLib.apiPost as jest.Mock)
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      let switching!: Promise<void>;
      act(() => {
        switching = result.current!.switchOrganization('org-a');
        void result.current!.switchOrganization('org-b');
      });
      await act(async () => {
        first.resolve(contextFor('org-a'));
        await Promise.resolve();
      });
      expect(apiLib.apiPost).toHaveBeenLastCalledWith('/auth/switch-organization', {
        organizationId: 'org-b',
      });
      expect(result.current?.activeOrganization?.id).toBe('org-123');

      await act(async () => {
        second.resolve(contextFor('org-b'));
        await switching;
      });
      expect(result.current?.activeOrganization?.id).toBe('org-b');
    });

    it('continues with the latest pending selection when an intermediate switch fails', async () => {
      const first = deferred<AuthContextResponse>();
      const last = deferred<AuthContextResponse>();
      (apiLib.apiPost as jest.Mock)
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => last.promise);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      let switching!: Promise<void>;
      act(() => {
        switching = result.current!.switchOrganization('org-a');
        void result.current!.switchOrganization('org-b');
      });

      await act(async () => {
        first.reject(new Error('org-a failed'));
        await Promise.resolve();
      });
      expect(apiLib.apiPost).toHaveBeenLastCalledWith('/auth/switch-organization', {
        organizationId: 'org-b',
      });

      await act(async () => {
        last.resolve(contextFor('org-b'));
        await switching;
      });
      expect(result.current?.activeOrganization?.id).toBe('org-b');
      expect(result.current?.organizationSwitchError).toBeNull();
    });

    it('restores the last confirmed context when the definitive switch fails', async () => {
      (apiLib.apiPost as jest.Mock).mockRejectedValueOnce(new Error('Switch denied'));
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      await act(async () => {
        await expect(result.current!.switchOrganization('org-b')).rejects.toThrow('Switch denied');
      });

      expect(result.current?.activeOrganization?.id).toBe('org-123');
      expect(result.current?.organizationSwitchError).toBe('Switch denied');
      expect(result.current?.isSwitchingOrganization).toBe(false);
      expect(apiLib.setActiveOrganizationId).toHaveBeenLastCalledWith('org-123');
    });

    it('restores the server organization when an intermediate success precedes a definitive failure', async () => {
      const first = deferred<AuthContextResponse>();
      const last = deferred<AuthContextResponse>();
      (apiLib.apiPost as jest.Mock)
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => last.promise)
        .mockResolvedValueOnce(contextFor('org-123'));
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      let switching!: Promise<void>;
      act(() => {
        switching = result.current!.switchOrganization('org-a');
        void result.current!.switchOrganization('org-b');
      });
      await act(async () => {
        first.resolve(contextFor('org-a'));
        await Promise.resolve();
      });
      await act(async () => {
        last.reject(new Error('Switch denied'));
        await expect(switching).rejects.toThrow('Switch denied');
      });

      expect(apiLib.apiPost).toHaveBeenNthCalledWith(3, '/auth/switch-organization', {
        organizationId: 'org-123',
      });
      expect(result.current?.activeOrganization?.id).toBe('org-123');
      expect(result.current?.organizationSwitchError).toBe('Switch denied');
      expect(result.current?.isSwitchingOrganization).toBe(false);
      expect(apiLib.setActiveOrganizationId).toHaveBeenLastCalledWith('org-123');
    });

    it('replaces a project detail route after the definitive switch succeeds', async () => {
      (usePathname as jest.Mock).mockReturnValue('/projects/project-a');
      (apiLib.apiPost as jest.Mock).mockResolvedValueOnce(contextFor('org-b'));
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

      await act(async () => {
        await result.current!.switchOrganization('org-b');
      });

      expect(mockRouter.replace).toHaveBeenCalledWith('/projects');
      expect(result.current?.activeOrganization?.id).toBe('org-b');
    });
  });

  describe('Authentication request ordering', () => {
    it('finishes loading when a context refresh supersedes the shared bootstrap', async () => {
      const sharedContext = deferred<AuthContextResponse>();
      (apiLib.apiGetAuthContext as jest.Mock).mockImplementation(
        () => sharedContext.promise,
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      let refreshing!: Promise<AuthContextResponse | null>;
      act(() => {
        refreshing = result.current!.refreshContext();
      });

      await act(async () => {
        sharedContext.resolve(contextFor('org-google'));
        await refreshing;
      });

      expect(result.current?.activeOrganization?.id).toBe('org-google');
      expect(result.current?.isLoading).toBe(false);
    });

    it('does not let a late bootstrap response overwrite a successful login', async () => {
      const bootstrap = deferred<AuthContextResponse>();
    (apiLib.apiGetAuthContext as jest.Mock)
        .mockImplementationOnce(() => bootstrap.promise)
        .mockResolvedValueOnce(contextFor('org-login'));
      (apiLib.apiPost as jest.Mock).mockResolvedValue(mockLoginResponse);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await act(async () => {
        await result.current!.login('test@example.com', 'password');
      });
      expect(result.current?.activeOrganization?.id).toBe('org-login');

      await act(async () => {
        bootstrap.resolve(contextFor('org-bootstrap'));
        await Promise.resolve();
      });
      expect(result.current?.activeOrganization?.id).toBe('org-login');
    });

    it('clears immediately and ignores a pending context response after logout', async () => {
      const refresh = deferred<AuthContextResponse>();
    (apiLib.apiGetAuthContext as jest.Mock)
        .mockResolvedValueOnce(mockContext)
        .mockImplementationOnce(() => refresh.promise);
      (apiLib.apiPost as jest.Mock).mockResolvedValue({ success: true });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.activeOrganization?.id).toBe('org-123'));

      let pendingRefresh!: Promise<AuthContextResponse | null>;
      act(() => {
        pendingRefresh = result.current!.refreshContext();
      });
      let logoutPromise!: Promise<void>;
      act(() => {
        logoutPromise = result.current!.logout();
      });
      expect(result.current?.user).toBeNull();
      await act(async () => {
        await logoutPromise;
      });

      await act(async () => {
        refresh.resolve(contextFor('org-late'));
        await pendingRefresh;
      });
      expect(result.current?.user).toBeNull();
      expect(apiLib.setActiveOrganizationId).toHaveBeenLastCalledWith(null);
    });

    it('invalidates pending requests when another tab clears authentication', async () => {
      const refresh = deferred<AuthContextResponse>();
    (apiLib.apiGetAuthContext as jest.Mock)
        .mockResolvedValueOnce(mockContext)
        .mockImplementationOnce(() => refresh.promise);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.activeOrganization?.id).toBe('org-123'));

      let pendingRefresh!: Promise<AuthContextResponse | null>;
      act(() => {
        pendingRefresh = result.current!.refreshContext();
        window.dispatchEvent(new StorageEvent('storage', { key: 'auth_clear_event' }));
      });
      await act(async () => {
        refresh.resolve(contextFor('org-late'));
        await pendingRefresh;
      });

      expect(result.current?.user).toBeNull();
      expect(result.current?.activeOrganization).toBeNull();
    });

    it('does not let a pending organization switch restore state after logout', async () => {
      const switchingResponse = deferred<AuthContextResponse>();
      (apiLib.apiPost as jest.Mock).mockImplementation((url: string) => {
        if (url === '/auth/switch-organization') return switchingResponse.promise;
        return Promise.resolve({ success: true });
      });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.activeOrganization?.id).toBe('org-123'));

      let switching!: Promise<void>;
      act(() => {
        switching = result.current!.switchOrganization('org-b');
      });
      let logoutPromise!: Promise<void>;
      act(() => {
        logoutPromise = result.current!.logout();
      });
      expect(result.current?.user).toBeNull();
      expect(result.current?.activeOrganization).toBeNull();
      expect(apiLib.apiPost).not.toHaveBeenCalledWith('/auth/logout', undefined, expect.anything());

      await act(async () => {
        switchingResponse.resolve(contextFor('org-b'));
        await Promise.all([switching, logoutPromise]);
      });

      expect(result.current?.user).toBeNull();
      expect(result.current?.activeOrganization).toBeNull();
      expect(apiLib.setActiveOrganizationId).toHaveBeenLastCalledWith(null);
      expect(apiLib.apiPost).toHaveBeenLastCalledWith('/auth/logout', undefined, {
        skipAuthRedirect: true,
        silent: true,
        suppressStatuses: [401],
      });
    });

    it('does not restore an older context under React Strict Mode', async () => {
      const stale = deferred<AuthContextResponse>();
      const current = deferred<AuthContextResponse>();
      (apiLib.apiGetAuthContext as jest.Mock).mockResolvedValueOnce(mockContext);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>
          <AuthProvider>{children}</AuthProvider>
        </React.StrictMode>
      );
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });
      await waitFor(() => expect(result.current?.isLoading).toBe(false));

    (apiLib.apiGetAuthContext as jest.Mock)
        .mockImplementationOnce(() => stale.promise)
        .mockImplementationOnce(() => current.promise);
      let staleRefresh!: Promise<AuthContextResponse | null>;
      let currentRefresh!: Promise<AuthContextResponse | null>;
      act(() => {
        staleRefresh = result.current!.refreshContext();
        currentRefresh = result.current!.refreshContext();
      });

      await act(async () => {
        current.resolve(contextFor('org-current'));
        await currentRefresh;
      });
      await waitFor(() => expect(result.current?.activeOrganization?.id).toBe('org-current'));

      await act(async () => {
        stale.resolve(contextFor('org-stale'));
        await staleRefresh;
      });
      expect(result.current?.activeOrganization?.id).toBe('org-current');
    });
  });
});
