import { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

describe('CurrentUser Decorator', () => {
  function getParamDecoratorFactory(decorator: Function) {
    class Test {
      test(@decorator() value: any) {}
    }
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
    return args[Object.keys(args)[0]].factory;
  }

  it('should return the user from the request', () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockRequest = { user: mockUser };
    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
    const factory = getParamDecoratorFactory(CurrentUser);

    // Act
    const result = factory(null, mockExecutionContext);

    // Assert
    expect(result).toBe(mockUser);
    expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
  });

  it('should return undefined if user is not present in request', () => {
    // Arrange
    const mockRequest = {};
    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
    const factory = getParamDecoratorFactory(CurrentUser);

    // Act
    const result = factory(null, mockExecutionContext);

    // Assert
    expect(result).toBeUndefined();
  });
});
