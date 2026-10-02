import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponseDto } from '../dto/api-response.dto';
import { ErrorCode, ERROR_MESSAGES } from '../dto/error-codes';

/**
 * Global Exception Filter
 * Handles all exceptions and returns standardized error responses
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCode.INTERNAL_ERROR;
    let message = ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
    let details: Record<string, any> | undefined;

    // Log request info
    const requestId = request.id || `req-${Date.now()}`;
    const userId = request.user?.id;
    const organizationId = request.user?.organizationId;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      let customErrorCode: ErrorCode | undefined;

      if (typeof exceptionResponse === 'object') {
        const { code: exCode, message: exMsg, ...rest } = exceptionResponse as any;
        if (typeof exCode === 'string') {
          customErrorCode = exCode as ErrorCode;
          errorCode = customErrorCode;
        }
        message = exMsg || message;
        
        // Check if it's a validation error
        if ('error' in rest && status === HttpStatus.BAD_REQUEST) {
          errorCode = ErrorCode.VALIDATION_FAILED;
          details = rest;
        }
      }

      // Map HTTP status to error codes
      if (!customErrorCode) {
        switch (status) {
          case HttpStatus.UNAUTHORIZED:
            errorCode = ErrorCode.UNAUTHORIZED;
            break;
          case HttpStatus.FORBIDDEN:
            errorCode = ErrorCode.FORBIDDEN;
            break;
          case HttpStatus.NOT_FOUND:
            errorCode = ErrorCode.NOT_FOUND;
            break;
          case HttpStatus.CONFLICT:
            errorCode = ErrorCode.CONFLICT;
            break;
          case HttpStatus.BAD_REQUEST:
            errorCode = ErrorCode.BAD_REQUEST;
            break;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Log stack trace for actual errors
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        {
          requestId,
          userId,
          organizationId,
          path: request.path,
          method: request.method,
        },
      );
    }

    const errorResponse = new ErrorResponseDto(errorCode, message, details);

    // Log error for monitoring
    this.logger.warn(`Error ${status}:`, {
      requestId,
      userId,
      organizationId,
      path: request.path,
      method: request.method,
      statusCode: status,
      errorCode,
      message,
    });

    response.status(status).json({
      error: {
        code: errorCode,
        message,
        ...(details && { details }),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
