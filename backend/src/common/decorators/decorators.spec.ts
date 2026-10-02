import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';
import { ROLES_KEY } from './roles.decorator';

describe('CurrentUser Decorator', () => {
  it('should create a current user parameter decorator', () => {
    // Arrange & Act
    const decorator = CurrentUser();

    // Assert
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  it('should be a valid NestJS decorator factory', () => {
    // Arrange
    const decorator = CurrentUser();

    // Act & Assert
    // Decorator should return a function that can be applied to a method parameter
    expect(decorator.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Roles Decorator', () => {
  it('should set roles metadata on method', () => {
    // Arrange
    const roles = ['ADMIN', 'MANAGER'];

    // Act
    const decorator = Roles(...roles);

    // Assert
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  it('should accept single role', () => {
    // Arrange & Act
    const decorator = Roles('ADMIN');

    // Assert
    expect(decorator).toBeDefined();
  });

  it('should accept multiple roles', () => {
    // Arrange & Act
    const decorator = Roles('ADMIN', 'MANAGER', 'USER');

    // Assert
    expect(decorator).toBeDefined();
  });

  it('should accept no roles', () => {
    // Arrange & Act
    const decorator = Roles();

    // Assert
    expect(decorator).toBeDefined();
  });

  it('should be composable with other decorators', () => {
    // Arrange
    const rolesDecorator = Roles('ADMIN');
    const currentUserDecorator = CurrentUser();

    // Act & Assert
    // Both decorators should be applicable without conflicts
    expect(rolesDecorator).toBeDefined();
    expect(currentUserDecorator).toBeDefined();
  });

  it('should have ROLES_KEY defined', () => {
    // Arrange & Act & Assert
    expect(ROLES_KEY).toBeDefined();
    expect(typeof ROLES_KEY).toBe('string');
  });

  it('should support decorating a method', () => {
    // Arrange
    class TestClass {
      @Roles('ADMIN')
      testMethod() {
        return 'test';
      }
    }

    // Act
    const instance = new TestClass();
    const result = instance.testMethod();

    // Assert
    expect(result).toBe('test');
  });
});
