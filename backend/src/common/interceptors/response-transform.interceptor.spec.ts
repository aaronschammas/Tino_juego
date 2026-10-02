import { ResponseTransformInterceptor } from './response-transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { SuccessResponseDto } from './api-response.dto';
import { of } from 'rxjs';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor;
  let mockContext: any;
  let mockCallHandler: any;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  });

  describe('intercept', () => {
    it('should return SuccessResponseDto as-is if data is already wrapped', (done) => {
      // Arrange
      const successResponse = new SuccessResponseDto({ id: 'test-123' });
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(successResponse)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBe(successResponse);
        done();
      });
    });

    it('should wrap plain data in SuccessResponseDto', (done) => {
      // Arrange
      const data = { id: 'test-123', name: 'Test' };
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(data)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toEqual(data);
        done();
      });
    });

    it('should extract _meta property from data', (done) => {
      // Arrange
      const data = {
        items: [{ id: '1' }, { id: '2' }],
        _meta: { page: 1, limit: 10, total: 20 },
      };
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(data)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toEqual({ items: [{ id: '1' }, { id: '2' }] });
        expect(result.meta).toEqual({ page: 1, limit: 10, total: 20 });
        done();
      });
    });

    it('should handle null data', (done) => {
      // Arrange
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(null)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toBeNull();
        done();
      });
    });

    it('should handle array data', (done) => {
      // Arrange
      const data = [{ id: '1' }, { id: '2' }];
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(data)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toEqual(data);
        done();
      });
    });

    it('should handle string data', (done) => {
      // Arrange
      const data = 'Success message';
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(data)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toBe('Success message');
        done();
      });
    });

    it('should handle numeric data', (done) => {
      // Arrange
      const data = 42;
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of(data)),
      } as unknown as CallHandler;

      // Act
      const observable = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      observable.subscribe((result) => {
        expect(result).toBeInstanceOf(SuccessResponseDto);
        expect(result.data).toBe(42);
        done();
      });
    });
  });
});
