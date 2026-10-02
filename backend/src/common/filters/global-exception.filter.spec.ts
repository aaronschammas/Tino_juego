import { GlobalExceptionFilter } from './global-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode } from '../dto/error-codes';
import { Response } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockArgumentsHost: any;
  let mockResponse: any;
  let mockRequest: any;
  let loggerSpy: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    mockRequest = {
      id: 'req-123',
      user: { id: 'user-123', organizationId: 'org-123' },
      path: '/api/test',
      method: 'GET',
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  describe('catch', () => {
    it('should generate req ID when request.id is missing', () => {
      mockRequest.id = undefined;
      const exception = new HttpException('Test', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });

    it('should handle exceptionResponse that is a string instead of an object', () => {
      const exception = new HttpException('Simple String Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should handle customErrorCode as a string code', () => {
      const exception = new HttpException(
        {
          code: 'CUSTOM_CODE',
          message: 'My message',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'CUSTOM_CODE',
            message: 'My message',
          }),
        }),
      );
    });

    it('should fall back to standard HTTP status mapping when customErrorCode is missing', () => {
      // 401 Unauthorized
      let exception = new HttpException('Error', HttpStatus.UNAUTHORIZED);
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.UNAUTHORIZED,
          }),
        }),
      );

      // 403 Forbidden
      exception = new HttpException('Error', HttpStatus.FORBIDDEN);
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.FORBIDDEN,
          }),
        }),
      );

      // 404 Not Found
      exception = new HttpException('Error', HttpStatus.NOT_FOUND);
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
          }),
        }),
      );

      // 409 Conflict
      exception = new HttpException('Error', HttpStatus.CONFLICT);
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.CONFLICT,
          }),
        }),
      );

      // 400 Bad Request
      exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.BAD_REQUEST,
          }),
        }),
      );
    });

    it('should handle generic Error exception', () => {
      // Arrange
      const exception = new Error('Database connection failed');

      // Act
      filter.catch(exception, mockArgumentsHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Database connection failed',
          }),
          meta: expect.objectContaining({
            requestId: 'req-123',
            timestamp: expect.any(String),
          }),
        }),
      );
    });

    it('should include request details in response', () => {
      // Arrange
      const exception = new HttpException(
        'Test error',
        HttpStatus.BAD_REQUEST,
      );

      // Act
      filter.catch(exception, mockArgumentsHost);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            requestId: 'req-123',
            timestamp: expect.any(String),
          }),
        }),
      );
    });

    it('should handle exception without user info', () => {
      // Arrange
      mockRequest.user = undefined;
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );

      // Act
      filter.catch(exception, mockArgumentsHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle exception with validation details', () => {
      // Arrange
      const exception = new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          error: {
            field: 'email',
            constraint: 'isEmail',
          },
        },
        HttpStatus.BAD_REQUEST,
      );

      // Act
      filter.catch(exception, mockArgumentsHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.BAD_REQUEST,
            message: 'Validation failed',
            details: expect.any(Object),
          }),
        }),
      );
    });

    it('should default to 500 for unknown exceptions', () => {
      // Arrange
      const exception = { some: 'unknown exception' };

      // Act
      filter.catch(exception, mockArgumentsHost);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });
});
