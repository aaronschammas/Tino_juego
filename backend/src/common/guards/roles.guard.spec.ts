import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: any;
  let mockContext: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      // Arrange
      reflector.getAllAndOverride.mockReturnValue(null);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow access when user has required role', () => {
      // Arrange
      const requiredRoles = ['ADMIN', 'MANAGER'];
      const user = { id: 'user-123', role: 'ADMIN' };
      const request = { user };

      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should deny access when user does not have required role', () => {
      // Arrange
      const requiredRoles = ['ADMIN'];
      const user = { id: 'user-123', role: 'USER' };
      const request = { user };

      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Insufficient permissions',
      );
    });

    it('should allow access when user has one of multiple required roles', () => {
      // Arrange
      const requiredRoles = ['ADMIN', 'MANAGER', 'OWNER'];
      const user = { id: 'user-123', role: 'MANAGER' };
      const request = { user };

      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access when user role does not match any required role', () => {
      // Arrange
      const requiredRoles = ['ADMIN', 'MANAGER'];
      const user = { id: 'user-123', role: 'USER' };
      const request = { user };

      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow access for SUPERADMIN user when ADMIN is required', () => {
      // Arrange
      const requiredRoles = ['ADMIN'];
      const user = { id: 'user-123', role: 'SUPERADMIN' };
      const request = { user };

      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      mockContext.switchToHttp().getRequest.mockReturnValue(request);

      // Act
      const result = guard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });
});
