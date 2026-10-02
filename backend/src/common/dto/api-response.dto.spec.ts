import {
  SuccessResponseDto,
  ErrorResponseDto,
  PaginatedResponseDto,
  ApiResponse,
  ApiError,
} from './api-response.dto';

describe('API Response DTOs', () => {
  describe('SuccessResponseDto', () => {
    it('should create success response with data', () => {
      // Arrange & Act
      const data = { id: '123', name: 'Test' };
      const response = new SuccessResponseDto(data);

      // Assert
      expect(response.data).toEqual(data);
      expect(response).toHaveProperty('data');
    });

    it('should handle null data', () => {
      // Arrange & Act
      const response = new SuccessResponseDto(null);

      // Assert
      expect(response.data).toBeNull();
    });

    it('should handle undefined data', () => {
      // Arrange & Act
      const response = new SuccessResponseDto(undefined);

      // Assert
      expect(response.data).toBeUndefined();
    });

    it('should preserve data type for objects', () => {
      // Arrange
      const data = { id: '456', email: 'test@test.com', role: 'ADMIN' };

      // Act
      const response = new SuccessResponseDto(data);

      // Assert
      expect(response.data).toEqual(data);
      expect(typeof response.data).toBe('object');
    });

    it('should handle array data', () => {
      // Arrange
      const data = [{ id: '1' }, { id: '2' }];

      // Act
      const response = new SuccessResponseDto(data);

      // Assert
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBe(2);
    });

    it('should support metadata', () => {
      // Arrange
      const data = { items: [1, 2, 3] };
      const response = new SuccessResponseDto(data, {
        page: 1,
        limit: 10,
        total: 3,
      });

      // Assert
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual({
        page: 1,
        limit: 10,
        total: 3,
      });
    });

    it('should have no meta when not provided', () => {
      // Arrange & Act
      const data = { id: '789' };
      const response = new SuccessResponseDto(data);

      // Assert
      expect(response.meta).toBeUndefined();
    });
  });

  describe('ErrorResponseDto', () => {
    it('should create error response with error details', () => {
      // Arrange & Act
      const response = new ErrorResponseDto(
        'INVALID_INPUT',
        'Input validation failed',
        { field: 'email' },
      );

      // Assert
      expect(response.error.code).toBe('INVALID_INPUT');
      expect(response.error.message).toBe('Input validation failed');
      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('should handle error without details', () => {
      // Arrange & Act
      const response = new ErrorResponseDto('NOT_FOUND', 'Resource not found');

      // Assert
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.error.message).toBe('Resource not found');
      expect(response.error.details).toBeUndefined();
    });

    it('should preserve error code', () => {
      // Arrange & Act
      const response = new ErrorResponseDto('UNAUTHORIZED', 'Not authorized');

      // Assert
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    it('should preserve error message', () => {
      // Arrange
      const message = 'Database connection error';

      // Act
      const response = new ErrorResponseDto('DB_ERROR', message);

      // Assert
      expect(response.error.message).toBe(message);
    });

    it('should structure error object correctly', () => {
      // Arrange & Act
      const response = new ErrorResponseDto(
        'VALIDATION_ERROR',
        'Validation failed',
        { field: 'username', reason: 'too short' },
      );

      // Assert
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(response.error).toHaveProperty('details');
    });
  });

  describe('PaginatedResponseDto', () => {
    it('should create paginated response with all data', () => {
      // Arrange
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      // Act
      const response = new PaginatedResponseDto(items, 1, 10, 2);

      // Assert
      expect(response.data).toEqual(items);
      expect(response.meta.page).toBe(1);
      expect(response.meta.pageSize).toBe(10);
      expect(response.meta.total).toBe(2);
    });

    it('should calculate totalPages correctly', () => {
      // Arrange
      const items = Array(15).fill({ id: '1' });

      // Act
      const response = new PaginatedResponseDto(items, 1, 10, 15);

      // Assert
      expect(response.meta.totalPages).toBe(2);
    });

    it('should handle single page result', () => {
      // Arrange
      const items = [{ id: '1' }];

      // Act
      const response = new PaginatedResponseDto(items, 1, 10, 1);

      // Assert
      expect(response.meta.totalPages).toBe(1);
      expect(response.data.length).toBe(1);
    });

    it('should handle empty data array', () => {
      // Arrange & Act
      const response = new PaginatedResponseDto([], 1, 10, 0);

      // Assert
      expect(response.data).toEqual([]);
      expect(response.meta.totalPages).toBe(0);
    });

    it('should handle multiple pages', () => {
      // Arrange
      const items = Array(30).fill({ id: '1' });

      // Act
      const response = new PaginatedResponseDto(items, 2, 10, 30);

      // Assert
      expect(response.meta.page).toBe(2);
      expect(response.meta.totalPages).toBe(3);
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with required fields', () => {
      // Arrange & Act
      const error = new ApiError('ERROR_CODE', 'Error message');

      // Assert
      expect(error.code).toBe('ERROR_CODE');
      expect(error.message).toBe('Error message');
      expect(error.details).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
    });

    it('should create ApiError with all fields', () => {
      // Arrange & Act
      const error = new ApiError(
        'VALIDATION_ERROR',
        'Validation failed',
        { field: 'email' },
        400,
      );

      // Assert
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ApiResponse', () => {
    it('should create ApiResponse with data only', () => {
      // Arrange & Act
      const response = new ApiResponse({ id: '123' });

      // Assert
      expect(response.data).toEqual({ id: '123' });
      expect(response.meta).toBeUndefined();
      expect(response.error).toBeUndefined();
    });

    it('should create ApiResponse with data and meta', () => {
      // Arrange & Act
      const response = new ApiResponse(
        { id: '123' },
        { timestamp: '2023-01-01' },
      );

      // Assert
      expect(response.data).toEqual({ id: '123' });
      expect(response.meta).toEqual({ timestamp: '2023-01-01' });
    });

    it('should create ApiResponse with error', () => {
      // Arrange & Act
      const error = new ApiError('NOT_FOUND', 'Not found', undefined, 404);
      const response = new ApiResponse(undefined, undefined, error);

      // Assert
      expect(response.error).toEqual(error);
      expect(response.data).toBeUndefined();
    });

    it('should handle all fields together', () => {
      // Arrange & Act
      const error = new ApiError('ERROR', 'Error occurred');
      const response = new ApiResponse(
        { result: 'data' },
        { count: 1 },
        error,
      );

      // Assert
      expect(response.data).toEqual({ result: 'data' });
      expect(response.meta).toEqual({ count: 1 });
      expect(response.error).toEqual(error);
    });
  });
});
