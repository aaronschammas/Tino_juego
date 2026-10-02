/**
 * useRequireAuth.ts - useRequireAuth Hook Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRequireAuth } from './useRequireAuth';
import * as useAuthModule from './useAuth';
import { useRouter } from 'next/navigation';

// Mock the modules
jest.mock('./useAuth');
jest.mock('next/navigation');

describe('useRequireAuth Hook', () => {
  let mockRouter: any;
  let mockUseAuth: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    };
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue(mockRouter);
    mockUseAuth = jest.spyOn(useAuthModule, 'useAuth') as jest.Mock;
  });

  describe('Authentication required', () => {
    it('should redirect to login when user is not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      delete (window as any).location;
      (window as any).location = {
        pathname: '/dashboard',
        search: '',
      };

      // Act
      renderHook(() => useRequireAuth());

      // Assert
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          expect.stringContaining('/login')
        );
      });
    });

    it('should include current pathname in redirect', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      delete (window as any).location;
      (window as any).location = {
        pathname: '/projects/123',
        search: '',
      };

      // Act
      renderHook(() => useRequireAuth());

      // Assert
      await waitFor(() => {
        const callArg = mockRouter.replace.mock.calls[0][0];
        expect(callArg).toContain('%2Fprojects%2F123');
      });
    });

    it('should include search params in redirect', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      delete (window as any).location;
      (window as any).location = {
        pathname: '/dashboard',
        search: '?tab=overview',
      };

      // Act
      renderHook(() => useRequireAuth());

      // Assert
      await waitFor(() => {
        const callArg = mockRouter.replace.mock.calls[0][0];
        expect(callArg).toContain('%3Ftab%3Doverview');
      });
    });
  });

  describe('Authenticated user', () => {
    it('should not redirect when user is authenticated', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Leonardo',
        lastname: 'Morabito',
        role: 'USER',
        isActive: true,
      };
      mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });

      // Act
      renderHook(() => useRequireAuth());

      // Assert
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should return user data when authenticated', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Leonardo',
        lastname: 'Morabito',
        role: 'USER',
        isActive: true,
      };
      mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });

      // Act
      const { result } = renderHook(() => useRequireAuth());

      // Assert
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Loading state', () => {
    it('should not redirect while loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });

      // Act
      renderHook(() => useRequireAuth());

      // Assert
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should return isLoading state', () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });

      // Act
      const { result } = renderHook(() => useRequireAuth());

      // Assert
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Redirect prevention', () => {
    it('should only redirect once', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      delete (window as any).location;
      (window as any).location = {
        pathname: '/dashboard',
        search: '',
      };

      // Act
      const { rerender } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      });

      // Re-render should not trigger additional redirect
      rerender();

      // Assert - still only one call
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    });
  });
});
