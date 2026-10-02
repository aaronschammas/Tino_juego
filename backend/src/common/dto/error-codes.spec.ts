import { ErrorCode, ERROR_MESSAGES } from './error-codes';

describe('Error Codes', () => {
  describe('ErrorCode Enum', () => {
    // Auth Errors
    it('should have UNAUTHORIZED error code', () => {
      expect(ErrorCode.UNAUTHORIZED).toBeDefined();
    });

    it('should have INVALID_TOKEN error code', () => {
      expect(ErrorCode.INVALID_TOKEN).toBeDefined();
    });

    it('should have TOKEN_EXPIRED error code', () => {
      expect(ErrorCode.TOKEN_EXPIRED).toBeDefined();
    });

    // Permission Errors
    it('should have FORBIDDEN error code', () => {
      expect(ErrorCode.FORBIDDEN).toBeDefined();
    });

    it('should have INSUFFICIENT_PERMISSIONS error code', () => {
      expect(ErrorCode.INSUFFICIENT_PERMISSIONS).toBeDefined();
    });

    it('should have ORG_OWNER_REQUIRED error code', () => {
      expect(ErrorCode.ORG_OWNER_REQUIRED).toBeDefined();
    });

    // Not Found Errors
    it('should have NOT_FOUND error code', () => {
      expect(ErrorCode.NOT_FOUND).toBeDefined();
    });

    it('should have RESOURCE_NOT_FOUND error code', () => {
      expect(ErrorCode.RESOURCE_NOT_FOUND).toBeDefined();
    });

    it('should have USER_NOT_FOUND error code', () => {
      expect(ErrorCode.USER_NOT_FOUND).toBeDefined();
    });

    it('should have ORGANIZATION_NOT_FOUND error code', () => {
      expect(ErrorCode.ORGANIZATION_NOT_FOUND).toBeDefined();
    });

    it('should have PROJECT_NOT_FOUND error code', () => {
      expect(ErrorCode.PROJECT_NOT_FOUND).toBeDefined();
    });

    it('should have INVITE_NOT_FOUND error code', () => {
      expect(ErrorCode.INVITE_NOT_FOUND).toBeDefined();
    });

    // Validation Errors
    it('should have BAD_REQUEST error code', () => {
      expect(ErrorCode.BAD_REQUEST).toBeDefined();
    });

    it('should have INVALID_INPUT error code', () => {
      expect(ErrorCode.INVALID_INPUT).toBeDefined();
    });

    it('should have VALIDATION_FAILED error code', () => {
      expect(ErrorCode.VALIDATION_FAILED).toBeDefined();
    });

    // Conflict Errors
    it('should have CONFLICT error code', () => {
      expect(ErrorCode.CONFLICT).toBeDefined();
    });

    it('should have DUPLICATE_ENTRY error code', () => {
      expect(ErrorCode.DUPLICATE_ENTRY).toBeDefined();
    });

    it('should have EMAIL_ALREADY_EXISTS error code', () => {
      expect(ErrorCode.EMAIL_ALREADY_EXISTS).toBeDefined();
    });

    it('should have USER_ALREADY_IN_ORG error code', () => {
      expect(ErrorCode.USER_ALREADY_IN_ORG).toBeDefined();
    });

    it('should have INVITE_ALREADY_EXISTS error code', () => {
      expect(ErrorCode.INVITE_ALREADY_EXISTS).toBeDefined();
    });

    // Server Errors
    it('should have INTERNAL_ERROR error code', () => {
      expect(ErrorCode.INTERNAL_ERROR).toBeDefined();
    });

    it('should have DATABASE_ERROR error code', () => {
      expect(ErrorCode.DATABASE_ERROR).toBeDefined();
    });

    // Multi-tenant Errors
    it('should have CROSS_ORG_ACCESS error code', () => {
      expect(ErrorCode.CROSS_ORG_ACCESS).toBeDefined();
    });

    it('should have ORG_INACTIVE error code', () => {
      expect(ErrorCode.ORG_INACTIVE).toBeDefined();
    });

    it('should have USER_PENDING error code', () => {
      expect(ErrorCode.USER_PENDING).toBeDefined();
    });

    it('should have USER_WITHOUT_ORGANIZATION error code', () => {
      expect(ErrorCode.USER_WITHOUT_ORGANIZATION).toBeDefined();
    });

    it('should have INVALID_ORG_CONTEXT error code', () => {
      expect(ErrorCode.INVALID_ORG_CONTEXT).toBeDefined();
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have error message for UNAUTHORIZED', () => {
      expect(ERROR_MESSAGES[ErrorCode.UNAUTHORIZED]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.UNAUTHORIZED]).toBe('string');
    });

    it('should have error message for INVALID_TOKEN', () => {
      expect(ERROR_MESSAGES[ErrorCode.INVALID_TOKEN]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INVALID_TOKEN]).toBe('string');
    });

    it('should have error message for TOKEN_EXPIRED', () => {
      expect(ERROR_MESSAGES[ErrorCode.TOKEN_EXPIRED]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.TOKEN_EXPIRED]).toBe('string');
    });

    it('should have error message for FORBIDDEN', () => {
      expect(ERROR_MESSAGES[ErrorCode.FORBIDDEN]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.FORBIDDEN]).toBe('string');
    });

    it('should have error message for INSUFFICIENT_PERMISSIONS', () => {
      expect(ERROR_MESSAGES[ErrorCode.INSUFFICIENT_PERMISSIONS]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INSUFFICIENT_PERMISSIONS]).toBe('string');
    });

    it('should have error message for ORG_OWNER_REQUIRED', () => {
      expect(ERROR_MESSAGES[ErrorCode.ORG_OWNER_REQUIRED]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.ORG_OWNER_REQUIRED]).toBe('string');
    });

    it('should have error message for NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.NOT_FOUND]).toBe('string');
    });

    it('should have error message for RESOURCE_NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.RESOURCE_NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.RESOURCE_NOT_FOUND]).toBe('string');
    });

    it('should have error message for USER_NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.USER_NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.USER_NOT_FOUND]).toBe('string');
    });

    it('should have error message for ORGANIZATION_NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.ORGANIZATION_NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.ORGANIZATION_NOT_FOUND]).toBe('string');
    });

    it('should have error message for PROJECT_NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.PROJECT_NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.PROJECT_NOT_FOUND]).toBe('string');
    });

    it('should have error message for INVITE_NOT_FOUND', () => {
      expect(ERROR_MESSAGES[ErrorCode.INVITE_NOT_FOUND]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INVITE_NOT_FOUND]).toBe('string');
    });

    it('should have error message for BAD_REQUEST', () => {
      expect(ERROR_MESSAGES[ErrorCode.BAD_REQUEST]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.BAD_REQUEST]).toBe('string');
    });

    it('should have error message for INVALID_INPUT', () => {
      expect(ERROR_MESSAGES[ErrorCode.INVALID_INPUT]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INVALID_INPUT]).toBe('string');
    });

    it('should have error message for VALIDATION_FAILED', () => {
      expect(ERROR_MESSAGES[ErrorCode.VALIDATION_FAILED]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.VALIDATION_FAILED]).toBe('string');
    });

    it('should have error message for CONFLICT', () => {
      expect(ERROR_MESSAGES[ErrorCode.CONFLICT]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.CONFLICT]).toBe('string');
    });

    it('should have error message for DUPLICATE_ENTRY', () => {
      expect(ERROR_MESSAGES[ErrorCode.DUPLICATE_ENTRY]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.DUPLICATE_ENTRY]).toBe('string');
    });

    it('should have error message for EMAIL_ALREADY_EXISTS', () => {
      expect(ERROR_MESSAGES[ErrorCode.EMAIL_ALREADY_EXISTS]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.EMAIL_ALREADY_EXISTS]).toBe('string');
    });

    it('should have error message for USER_ALREADY_IN_ORG', () => {
      expect(ERROR_MESSAGES[ErrorCode.USER_ALREADY_IN_ORG]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.USER_ALREADY_IN_ORG]).toBe('string');
    });

    it('should have error message for INVITE_ALREADY_EXISTS', () => {
      expect(ERROR_MESSAGES[ErrorCode.INVITE_ALREADY_EXISTS]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INVITE_ALREADY_EXISTS]).toBe('string');
    });

    it('should have error message for INTERNAL_ERROR', () => {
      expect(ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]).toBe('string');
    });

    it('should have error message for DATABASE_ERROR', () => {
      expect(ERROR_MESSAGES[ErrorCode.DATABASE_ERROR]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.DATABASE_ERROR]).toBe('string');
    });

    it('should have error message for CROSS_ORG_ACCESS', () => {
      expect(ERROR_MESSAGES[ErrorCode.CROSS_ORG_ACCESS]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.CROSS_ORG_ACCESS]).toBe('string');
    });

    it('should have error message for ORG_INACTIVE', () => {
      expect(ERROR_MESSAGES[ErrorCode.ORG_INACTIVE]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.ORG_INACTIVE]).toBe('string');
    });

    it('should have error message for USER_PENDING', () => {
      expect(ERROR_MESSAGES[ErrorCode.USER_PENDING]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.USER_PENDING]).toBe('string');
    });

    it('should have error message for USER_WITHOUT_ORGANIZATION', () => {
      expect(ERROR_MESSAGES[ErrorCode.USER_WITHOUT_ORGANIZATION]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.USER_WITHOUT_ORGANIZATION]).toBe('string');
    });

    it('should have error message for INVALID_ORG_CONTEXT', () => {
      expect(ERROR_MESSAGES[ErrorCode.INVALID_ORG_CONTEXT]).toBeDefined();
      expect(typeof ERROR_MESSAGES[ErrorCode.INVALID_ORG_CONTEXT]).toBe('string');
    });

    it('should have non-empty strings for all error messages', () => {
      Object.values(ERROR_MESSAGES).forEach((message) => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Code Consistency', () => {
    it('should have matching error codes and messages', () => {
      Object.values(ErrorCode).forEach((code) => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
      });
    });

    it('should not have orphaned error messages', () => {
      Object.keys(ERROR_MESSAGES).forEach((key) => {
        // Check if the key exists in the enum
        const found = Object.values(ErrorCode).includes(key as ErrorCode);
        expect(found).toBe(true);
      });
    });
  });
});
