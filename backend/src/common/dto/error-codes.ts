/**
 * Standard Error Codes for API Responses
 * Ensures consistent error handling across the system
 */

export enum ErrorCode {
  // Auth Errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Permission Errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ORG_OWNER_REQUIRED = 'ORG_OWNER_REQUIRED',
  
  // Not Found Errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  INVITE_NOT_FOUND = 'INVITE_NOT_FOUND',
  
  // Validation Errors (400)
  BAD_REQUEST = 'BAD_REQUEST',
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  
  // Conflict Errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_ALREADY_IN_ORG = 'USER_ALREADY_IN_ORG',
  INVITE_ALREADY_EXISTS = 'INVITE_ALREADY_EXISTS',
  
  // Server Errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Multi-tenant Errors
  CROSS_ORG_ACCESS = 'CROSS_ORG_ACCESS',
  ORG_INACTIVE = 'ORG_INACTIVE',
  USER_PENDING = 'USER_PENDING',
  USER_WITHOUT_ORGANIZATION = 'USER_WITHOUT_ORGANIZATION',
  INVALID_ORG_CONTEXT = 'INVALID_ORG_CONTEXT',
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Auth
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCode.INVALID_TOKEN]: 'Invalid authentication token',
  [ErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired',
  
  // Permission
  [ErrorCode.FORBIDDEN]: 'Access forbidden',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this action',
  [ErrorCode.ORG_OWNER_REQUIRED]: 'Only organization owners can perform this action',
  
  // Not Found
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.USER_NOT_FOUND]: 'User not found',
  [ErrorCode.ORGANIZATION_NOT_FOUND]: 'Organization not found',
  [ErrorCode.PROJECT_NOT_FOUND]: 'Project not found',
  [ErrorCode.INVITE_NOT_FOUND]: 'Invitation not found or invalid token',
  
  // Validation
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  
  // Conflict
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.DUPLICATE_ENTRY]: 'Duplicate entry',
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 'Email already registered',
  [ErrorCode.USER_ALREADY_IN_ORG]: 'User already belongs to this organization',
  [ErrorCode.INVITE_ALREADY_EXISTS]: 'Pending invitation already exists for this email',
  
  // Server
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred',
  
  // Multi-tenant
  [ErrorCode.CROSS_ORG_ACCESS]: 'Cannot access resources from another organization',
  [ErrorCode.ORG_INACTIVE]: 'Organization is inactive',
  [ErrorCode.USER_PENDING]: 'User account is pending activation',
  [ErrorCode.USER_WITHOUT_ORGANIZATION]: 'User has no organization assigned',
  [ErrorCode.INVALID_ORG_CONTEXT]: 'Invalid organization context',
};
