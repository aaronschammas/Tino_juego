/**
 * auth.ts - Authentication Storage Utility Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import * as authModule from './auth';
import { User } from '@/types/user';
import Cookies from 'js-cookie';

// Mock js-cookie
jest.mock('js-cookie');
const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;

describe('Authentication Storage Utilities', () => {
  const mockToken = 'mock_jwt_token_12345';
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Leonardo',
    lastname: 'Morabito',
    role: 'USER',
    isActive: true,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getToken', () => {
    test('calls Cookies.get with correct key', () => {
      // Arrange
      (mockedCookies.get as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = authModule.getToken();

      // Assert
      expect(mockedCookies.get).toHaveBeenCalledWith('auth_token');
      expect(result).toBe(mockToken);
    });

    test('returns null when Cookies.get returns undefined', () => {
      // Arrange
      (mockedCookies.get as jest.Mock).mockReturnValue(undefined);

      // Act
      const result = authModule.getToken();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setToken', () => {
    test('is a no-op as tokens are now handled by server', () => {
      // Act
      authModule.setToken(mockToken);

      // Assert
      expect(mockedCookies.set).not.toHaveBeenCalled();
    });
  });

  describe('clearToken', () => {
    test('calls Cookies.remove with correct key and path', () => {
      // Act
      authModule.clearToken();

      // Assert
      expect(mockedCookies.remove).toHaveBeenCalledWith('auth_token', { path: '/' });
    });
  });

  describe('getStoredUser', () => {
    test('returns null when no user is stored', () => {
      // Arrange
      (mockedCookies.get as jest.Mock).mockReturnValue(undefined);

      // Act
      const result = authModule.getStoredUser();

      // Assert
      expect(result).toBeNull();
    });

    test('returns parsed user from cookies', () => {
      // Arrange
      const userJson = JSON.stringify(mockUser);
      (mockedCookies.get as jest.Mock).mockReturnValue(userJson);

      // Act
      const result = authModule.getStoredUser();

      // Assert
      expect(result).toEqual(mockUser);
    });

    test('returns null when stored JSON is invalid', () => {
      // Arrange
      (mockedCookies.get as jest.Mock).mockReturnValue('invalid json {');

      // Act
      const result = authModule.getStoredUser();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setStoredUser', () => {
    test('calls Cookies.set with stringified user and security options', () => {
      // Act
      authModule.setStoredUser(mockUser);

      // Assert
      expect(mockedCookies.set).toHaveBeenCalledWith(
        'auth_user',
        JSON.stringify(mockUser),
        expect.objectContaining({
          secure: true,
          sameSite: 'strict',
        })
      );
    });
  });

  describe('clearStoredUser', () => {
    test('calls Cookies.remove with correct key', () => {
      // Act
      authModule.clearStoredUser();

      // Assert
      expect(mockedCookies.remove).toHaveBeenCalledWith('auth_user', { path: '/' });
    });
  });

  describe('clearAllAuth', () => {
    test('clears token, user and timer settings', () => {
      // Arrange
      const mockRemoveItem = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation();
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
      localStorage.setItem('tino_timer_target_minutes_timer-1', '45');

      // Act
      authModule.clearAllAuth();

      // Assert cookies cleared
      expect(mockedCookies.remove).toHaveBeenCalledWith('auth_token', { path: '/' });
      expect(mockedCookies.remove).toHaveBeenCalledWith('auth_user', { path: '/' });
      expect(mockedCookies.remove).toHaveBeenCalledWith('tino_timer_target_minutes', { path: '/' });

      // Assert localStorage fallback cleared
      expect(mockRemoveItem).toHaveBeenCalledWith('auth_token');
      expect(mockRemoveItem).toHaveBeenCalledWith('auth_user');
      expect(mockRemoveItem).toHaveBeenCalledWith('tino_timer_target_minutes');
      expect(mockRemoveItem).toHaveBeenCalledWith('tino_timer_target_minutes_timer-1');
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:cleared' }));

      mockRemoveItem.mockRestore();
      dispatchSpy.mockRestore();
    });
  });

  describe('isOrgOwner', () => {
    test('returns true when the requesting user is SUPERADMIN, regardless of org role', () => {
      // Arrange
      const superAdmin: User = { ...mockUser, role: 'SUPERADMIN' };

      // Act
      const result = authModule.isOrgOwner(superAdmin, 'ORG_MEMBER');

      // Assert
      expect(result).toBe(true);
    });

    test('returns true when the org membership role is ORG_OWNER', () => {
      // Act
      const result = authModule.isOrgOwner(mockUser, 'ORG_OWNER');

      // Assert
      expect(result).toBe(true);
    });

    test('returns false for a regular member', () => {
      // Act
      const result = authModule.isOrgOwner(mockUser, 'ORG_MEMBER');

      // Assert
      expect(result).toBe(false);
    });

    test('returns false when the org role has not been resolved yet', () => {
      // Act
      const result = authModule.isOrgOwner(mockUser, null);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canManageProject', () => {
    const project = { ownerId: 'owner-1' };

    test('returns true for an org owner even if they do not own the project', () => {
      // Act
      const result = authModule.canManageProject(mockUser, 'ORG_OWNER', project);

      // Assert
      expect(result).toBe(true);
    });

    test('returns true for the project owner even without an org role', () => {
      // Arrange
      const owner: User = { ...mockUser, id: 'owner-1' };

      // Act
      const result = authModule.canManageProject(owner, 'ORG_MEMBER', project);

      // Assert
      expect(result).toBe(true);
    });

    test('returns false for a member who neither owns the project nor the org', () => {
      // Act
      const result = authModule.canManageProject(mockUser, 'ORG_MEMBER', project);

      // Assert
      expect(result).toBe(false);
    });

    test('returns false when the project is not loaded yet', () => {
      // Act
      const result = authModule.canManageProject(mockUser, 'ORG_MEMBER', null);

      // Assert
      expect(result).toBe(false);
    });
  });
});
