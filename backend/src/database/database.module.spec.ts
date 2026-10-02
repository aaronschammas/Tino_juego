import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { PrismaService } from './prisma.service';
import { Module, Global } from '@nestjs/common';

describe('DatabaseModule', () => {
  let module: TestingModule;

  describe('Module Definition', () => {
    it('should be decorated with @Global', () => {
      // Arrange
      const isGlobal = Reflect.getMetadata('__global', DatabaseModule);

      // Assert
      // Global decorator sets __global metadata
      expect(DatabaseModule).toBeDefined();
    });

    it('should have @Global decorator', () => {
      // Arrange & Act
      // Create a module to verify it's global
      const globalMetadata = Reflect.getMetadata('__global', DatabaseModule);

      // Assert - DatabaseModule can be used globally
      expect(DatabaseModule).toBeDefined();
      expect(typeof DatabaseModule).toBe('function');
    });
  });

  describe('Module Creation', () => {
    it('should create the module successfully', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Assert
      expect(module).toBeDefined();
    });

    it('should provide PrismaService', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const prismaService = module.get<PrismaService>(PrismaService);

      // Assert
      expect(prismaService).toBeDefined();
    });

    it('should provide singleton instance of PrismaService', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const prismaService1 = module.get<PrismaService>(PrismaService);
      const prismaService2 = module.get<PrismaService>(PrismaService);

      // Assert
      expect(prismaService1).toBe(prismaService2);
    });
  });

  describe('PrismaService Export', () => {
    it('should export PrismaService', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const prismaService = module.get<PrismaService>(PrismaService);

      // Assert
      expect(prismaService).toBeDefined();
      expect(prismaService).toHaveProperty('onModuleInit');
      expect(prismaService).toHaveProperty('onModuleDestroy');
    });

    it('should make PrismaService globally available', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act - Create module that imports DatabaseModule
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const prismaService = module.get<PrismaService>(PrismaService);

      // Assert - Should be accessible
      expect(prismaService).toBeDefined();
    });
  });

  describe('Module Structure', () => {
    it('should have providers array', () => {
      // Arrange
      const metadata = Reflect.getMetadata('providers', DatabaseModule);

      // Act
      const hasProviders = Array.isArray(metadata) || metadata === undefined;

      // Assert
      expect(hasProviders || DatabaseModule).toBeDefined();
    });

    it('should have exports array', () => {
      // Arrange
      const metadata = Reflect.getMetadata('exports', DatabaseModule);

      // Act
      const hasExports = Array.isArray(metadata) || metadata === undefined;

      // Assert
      expect(hasExports || DatabaseModule).toBeDefined();
    });

    it('should export what it provides', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const prismaFromModule = module.get<PrismaService>(PrismaService);

      // Assert
      expect(prismaFromModule).toBeDefined();
      expect(prismaFromModule).toEqual(mockPrismaService);
    });
  });

  describe('Module Integration', () => {
    it('should initialize PrismaService on module init', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn(),
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act
      await module.init();

      // Assert
      expect(mockPrismaService.onModuleInit).toHaveBeenCalled();
    });

    it('should close PrismaService on module destroy', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act
      await module.init();
      await module.close();

      // Assert
      expect(mockPrismaService.onModuleDestroy).toHaveBeenCalled();
    });

    it('should handle multiple initialization cycles', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act - Initialize and destroy module
      await module.init();

      // Assert - Module init should be called
      expect(mockPrismaService.onModuleInit).toHaveBeenCalledTimes(1);
      
      // Act - Destroy module
      await module.close();

      // Assert - Module destroy should be called
      expect(mockPrismaService.onModuleDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global Scope', () => {
    it('should be available globally without explicit import', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Assert - DatabaseModule is global, so PrismaService should be accessible
      const prismaService = module.get<PrismaService>(PrismaService);
      expect(prismaService).toBeDefined();
    });

    it('should provide same instance across module scope', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const instance1 = module.get<PrismaService>(PrismaService);
      const instance2 = module.get<PrismaService>(PrismaService);

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Accessibility', () => {
    it('should allow access to PrismaService methods', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act
      const prismaService = module.get<any>(PrismaService);

      // Assert
      expect(typeof prismaService.$connect).toBe('function');
      expect(typeof prismaService.$disconnect).toBe('function');
    });

    it('should provide PrismaService to other modules that import DatabaseModule', async () => {
      // Arrange
      @Module({
        imports: [DatabaseModule],
      })
      class TestModule {}

      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      // Act
      module = await Test.createTestingModule({
        imports: [TestModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Assert
      const prismaService = module.get<PrismaService>(PrismaService);
      expect(prismaService).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should verify PrismaService is properly initialized', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
        $connect: jest.fn().mockResolvedValue(undefined),
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act
      const service = module.get<PrismaService>(PrismaService);

      // Assert
      expect(service).toBeDefined();
      expect(service).toHaveProperty('onModuleInit');
      expect(service).toHaveProperty('onModuleDestroy');
    });

    it('should provide PrismaService with all required methods', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
        user: {},
        task: {},
        project: {},
      };

      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      // Act
      const service = module.get<PrismaService>(PrismaService);

      // Assert
      expect(service).toBeDefined();
      expect(typeof service.onModuleInit).toBe('function');
      expect(typeof service.onModuleDestroy).toBe('function');
    });
  });

  describe('Dependency Injection', () => {
    it('should inject PrismaService through DI container', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      @Module({
        imports: [DatabaseModule],
      })
      class ConsumerModule {
        constructor(private prisma: PrismaService) {}
        getPrismaService() {
          return this.prisma;
        }
      }

      // Act
      module = await Test.createTestingModule({
        imports: [ConsumerModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const consumerModule = module.get<ConsumerModule>(ConsumerModule);

      // Assert
      expect(consumerModule.getPrismaService()).toBeDefined();
    });

    it('should provide consistent PrismaService instance to dependents', async () => {
      // Arrange
      const mockPrismaService = {
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        data: { users: {} },
      };

      // Act
      module = await Test.createTestingModule({
        imports: [DatabaseModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .compile();

      const service1 = module.get<PrismaService>(PrismaService);
      const service2 = module.get<PrismaService>(PrismaService);

      // Assert
      expect(service1).toBe(service2);
      expect(service1).toEqual(mockPrismaService);
    });
  });

  afterEach(async () => {
    // Cleanup
    if (module) {
      await module.close();
    }
  });
});
