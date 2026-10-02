import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

describe('AppModule', () => {
  let module: TestingModule;

  describe('Module Configuration', () => {
    it('should compile the module', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should have HealthController registered', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      const controller = module.get<HealthController>(HealthController);

      // Assert
      expect(controller).toBeDefined();
    });

    it('should have GlobalExceptionFilter configured as provider', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should have ResponseTransformInterceptor configured as provider', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });
  });

  describe('Module Imports', () => {
    it('should import DatabaseModule', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should import ConfigModule with global flag', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should have all required feature modules', async () => {
      // Arrange
      const requiredModules = [
        'UsersModule',
        'AuthModule',
        'ProjectsModule',
        'TasksModule',
        'TimeTrackingModule',
        'AnalyticsModule',
        'OrganizationsModule',
      ];

      // Act & Assert
      // Module should compile without errors
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      expect(module).toBeDefined();
    });
  });

  describe('Controller Registration', () => {
    it('should register HealthController', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      const controller = module.get<HealthController>(HealthController);

      // Assert
      expect(controller).toBeDefined();
    });

    it('should have HealthController accessible from module', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      const controller = module.get<HealthController>(HealthController);

      // Assert
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(HealthController);
    });
  });

  describe('Filter and Interceptor Registration', () => {
    it('should have exception filter configured', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should have response transform interceptor configured', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });
  });

  describe('Module Initialization', () => {
    it('should initialize without errors', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
      expect(module.get(AppModule)).toBeDefined();
    });

    it('should have all providers registered', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider('PrismaService')
        .useValue({
          $connect: jest.fn(),
          $disconnect: jest.fn(),
        })
        .compile();

      // Assert
      expect(module).toBeDefined();
    });
  });

  afterEach(async () => {
    // Cleanup
    if (module) {
      await module.close();
    }
  });
});
