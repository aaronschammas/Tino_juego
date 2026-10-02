/**
 * api.ts - API Client Utility Tests
 * AAA Pattern: Arrange, Act, Assert
 */

import { ApiClientError } from './api';

describe('ApiClientError', () => {
  describe('Constructor and properties', () => {
    it('should create error with message only', () => {
      // Arrange
      const message = 'Network error occurred';

      // Act
      const error = new ApiClientError(message);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(message);
      expect(error.name).toBe('ApiClientError');
      expect(error.status).toBeUndefined();
    });

    it('should create error with message and status code', () => {
      // Arrange
      const message = 'Not found';
      const status = 404;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.message).toBe(message);
      expect(error.status).toBe(404);
      expect(error.name).toBe('ApiClientError');
    });

    it('should create error with code and details metadata', () => {
      const error = new ApiClientError('Organization missing', 403, 'USER_WITHOUT_ORGANIZATION', { userId: 'u1' });

      expect(error.code).toBe('USER_WITHOUT_ORGANIZATION');
      expect(error.details).toEqual({ userId: 'u1' });
    });

    it('should inherit from Error class', () => {
      // Arrange & Act
      const error = new ApiClientError('Test error', 500);

      // Assert
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiClientError).toBe(true);
    });

    it('should handle 401 Unauthorized status', () => {
      // Arrange
      const message = 'Unauthorized';
      const status = 401;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden status', () => {
      // Arrange
      const message = 'Access forbidden';
      const status = 403;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(403);
    });

    it('should handle 500 Internal Server Error status', () => {
      // Arrange
      const message = 'Internal server error';
      const status = 500;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(500);
    });

    it('should handle 502 Bad Gateway status', () => {
      // Arrange
      const message = 'Bad gateway';
      const status = 502;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(502);
    });

    it('should handle 503 Service Unavailable status', () => {
      // Arrange
      const message = 'Service unavailable';
      const status = 503;

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(503);
    });
  });

  describe('Error properties', () => {
    it('should have stack trace for debugging', () => {
      // Arrange & Act
      const error = new ApiClientError('Test error');

      // Assert
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ApiClientError');
    });

    it('should maintain error message through stack trace', () => {
      // Arrange & Act
      const message = 'Detailed error message';
      const error = new ApiClientError(message, 400);

      // Assert
      expect(error.message).toBe(message);
      expect(error.toString()).toContain('ApiClientError');
      expect(error.toString()).toContain(message);
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle empty message', () => {
      // Arrange
      const message = '';

      // Act
      const error = new ApiClientError(message, 400);

      // Assert
      expect(error.message).toBe('');
      expect(error.status).toBe(400);
    });

    it('should handle special characters in message', () => {
      // Arrange
      const message = 'Error: Invalid "token" format & character validation failed';

      // Act
      const error = new ApiClientError(message, 422);

      // Assert
      expect(error.message).toBe(message);
    });

    it('should handle very long message', () => {
      // Arrange
      const message = 'A'.repeat(1000);

      // Act
      const error = new ApiClientError(message);

      // Assert
      expect(error.message).toBe(message);
      expect(error.message.length).toBe(1000);
    });

    it('should handle network timeout scenario', () => {
      // Arrange
      const message = 'Request timeout after 30000ms';
      const status = 408; // Request Timeout

      // Act
      const error = new ApiClientError(message, status);

      // Assert
      expect(error.status).toBe(408);
      expect(error.message).toContain('timeout');
    });
  });

  describe('Error thrown behavior', () => {
    it('should be throwable and catchable', () => {
      // Arrange
      const error = new ApiClientError('Test error', 500);

      // Act & Assert
      expect(() => {
        throw error;
      }).toThrow(ApiClientError);
    });

    it('should preserve error data when thrown and caught', () => {
      // Arrange
      const originalMessage = 'Original error message';
      const originalStatus = 404;
      let caughtError: ApiClientError | null = null;

      // Act
      try {
        throw new ApiClientError(originalMessage, originalStatus);
      } catch (e) {
        caughtError = e as ApiClientError;
      }

      // Assert
      expect(caughtError?.message).toBe(originalMessage);
      expect(caughtError?.status).toBe(originalStatus);
    });

    it('should work with Promise rejection', async () => {
      // Arrange
      const error = new ApiClientError('Promise rejection test', 500);

      // Act & Assert
      await expect(Promise.reject(error)).rejects.toThrow('Promise rejection test');
    });
  });

  describe('Error comparison', () => {
    it('should create unique error instances', () => {
      // Arrange
      const error1 = new ApiClientError('Error 1', 400);
      const error2 = new ApiClientError('Error 1', 400);

      // Act & Assert
      expect(error1).not.toBe(error2); // Different instances
      expect(error1.message).toBe(error2.message); // Same message
      expect(error1.status).toBe(error2.status); // Same status
    });

    it('should match specific error type', () => {
      // Arrange
      const error = new ApiClientError('Test', 400);

      // Act
      const isApiError = error.name === 'ApiClientError';
      const isError = error instanceof Error;
      const isApiClientError = error instanceof ApiClientError;

      // Assert
      expect(isApiError).toBe(true);
      expect(isError).toBe(true);
      expect(isApiClientError).toBe(true);
    });
  });

  describe('API Methods (Integration-like with mocks)', () => {
    let mockAxios: any;
    
    beforeEach(() => {
      // Access private apiClient if needed or mock the exported functions
      // The easiest way is to mock axios since ApiClient uses it
    });

    it('should expose API methods', () => {
      const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = require('./api');
      expect(apiGet).toBeDefined();
      expect(apiPost).toBeDefined();
      expect(apiPut).toBeDefined();
      expect(apiPatch).toBeDefined();
      expect(apiDelete).toBeDefined();
    });
  });

  describe('Cache Logic', () => {
    const { apiGetCached, invalidateApiCache, clearApiCache } = require('./api');
    
    beforeEach(() => {
      clearApiCache();
    });

    it('should clear cache', () => {
      invalidateApiCache();
      // Verify internal state if possible or just ensure it doesn't crash
    });

    it('should handle multiple matchers in invalidateApiCache', () => {
      invalidateApiCache(['/orgs', '/users']);
    });
  });
});

