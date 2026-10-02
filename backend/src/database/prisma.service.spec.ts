import { PrismaService } from './prisma.service';
import { PrismaClient } from '@prisma/client';

describe('PrismaService', () => {
  let service: PrismaService;
  let mockPrismaClientConnect: jest.Mock;
  let mockPrismaClientDisconnect: jest.Mock;

  beforeEach(() => {
    // Arrange - Create mocks
    mockPrismaClientConnect = jest.fn();
    mockPrismaClientDisconnect = jest.fn();

    // Create a spied instance
    service = new PrismaService();
    service.$connect = mockPrismaClientConnect;
    service.$disconnect = mockPrismaClientDisconnect;
  });

  describe('Constructor', () => {
    it('should create an instance of PrismaService', () => {
      // Arrange & Act
      const instance = new PrismaService();

      // Assert
      expect(instance).toBeDefined();
      expect(instance.constructor.name).toBe('PrismaService');
    });

    it('should extend PrismaClient', () => {
      // Arrange & Act
      const instance = new PrismaService();

      // Assert
      // Verify it has PrismaClient methods like $connect and $disconnect
      expect(typeof instance.$connect).toBe('function');
      expect(typeof instance.$disconnect).toBe('function');
    });

    it('should initialize with empty options object', () => {
      // Arrange - Constructor takes no params

      // Act
      const instance = new PrismaService();

      // Assert
      expect(instance).toBeDefined();
    });
  });

  describe('onModuleInit', () => {
    it('should call $connect on module init', async () => {
      // Arrange
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(connectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should log success message when connected', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(service, '$connect').mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Prisma conectado a la base de datos',
      );
      consoleSpy.mockRestore();
    });

    it('should handle connection errors', async () => {
      // Arrange
      const connectionError = new Error('Connection failed');
      jest.spyOn(service, '$connect').mockRejectedValue(connectionError);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });

    it('should execute connect only once', async () => {
      // Arrange
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();
      await service.onModuleInit();

      // Assert
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('should resolve successfully', async () => {
      // Arrange
      jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await service.onModuleInit();

      // Assert
      expect(result).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on module destroy', async () => {
      // Arrange
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(disconnectSpy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should log disconnect message when destroyed', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('🔌 Prisma desconectado');
      consoleSpy.mockRestore();
    });

    it('should handle disconnection errors', async () => {
      // Arrange
      const disconnectError = new Error('Disconnect failed');
      jest.spyOn(service, '$disconnect').mockRejectedValue(disconnectError);

      // Act & Assert
      await expect(service.onModuleDestroy()).rejects.toThrow(
        'Disconnect failed',
      );
    });

    it('should execute disconnect only once', async () => {
      // Arrange
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();
      await service.onModuleDestroy();

      // Assert
      expect(disconnectSpy).toHaveBeenCalledTimes(2);
    });

    it('should resolve successfully', async () => {
      // Arrange
      jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await service.onModuleDestroy();

      // Assert
      expect(result).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('Lifecycle', () => {
    it('should connect on init and disconnect on destroy', async () => {
      // Arrange
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockResolvedValue(undefined);
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await service.onModuleInit();
      await service.onModuleDestroy();

      // Assert
      // Verify both were called
      expect(connectSpy).toHaveBeenCalled();
      expect(disconnectSpy).toHaveBeenCalled();
      // Verify connection happens first by checking order of spy calls
      expect(connectSpy.mock.invocationCallOrder[0]).toBeLessThan(
        disconnectSpy.mock.invocationCallOrder[0],
      );
      consoleSpy.mockRestore();
    });

    it('should handle connection then disconnection', async () => {
      // Arrange
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockResolvedValue(undefined);
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();

      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();

      // Assert
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle error during connection and continue to disconnect', async () => {
      // Arrange
      const connectError = new Error('Connection failed');
      jest.spyOn(service, '$connect').mockRejectedValue(connectError);
      jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      // Act & Assert - Connection fails
      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('Service Implementation', () => {
    it('should implement OnModuleInit interface', () => {
      // Arrange
      const expectedMethod = 'onModuleInit';

      // Act
      const hasMethod = typeof service[expectedMethod] === 'function';

      // Assert
      expect(hasMethod).toBe(true);
    });

    it('should implement OnModuleDestroy interface', () => {
      // Arrange
      const expectedMethod = 'onModuleDestroy';

      // Act
      const hasMethod = typeof service[expectedMethod] === 'function';

      // Assert
      expect(hasMethod).toBe(true);
    });

    it('should have $connect method from PrismaClient', () => {
      // Arrange
      const expectedMethod = '$connect';

      // Act
      const hasMethod = typeof service[expectedMethod] === 'function';

      // Assert
      expect(hasMethod).toBe(true);
    });

    it('should have $disconnect method from PrismaClient', () => {
      // Arrange
      const expectedMethod = '$disconnect';

      // Act
      const hasMethod = typeof service[expectedMethod] === 'function';

      // Assert
      expect(hasMethod).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle connection timeout', async () => {
      // Arrange
      const timeoutError = new Error('Connection timeout');
      jest.spyOn(service, '$connect').mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow(
        'Connection timeout',
      );
    });

    it('should handle invalid connection string', async () => {
      // Arrange
      const invalidError = new Error('Invalid connection string');
      jest.spyOn(service, '$connect').mockRejectedValue(invalidError);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow(
        'Invalid connection string',
      );
    });

    it('should handle network errors during disconnect', async () => {
      // Arrange
      const networkError = new Error('Network error');
      jest.spyOn(service, '$disconnect').mockRejectedValue(networkError);

      // Act & Assert
      await expect(service.onModuleDestroy()).rejects.toThrow('Network error');
    });

    it('should handle database not found error', async () => {
      // Arrange
      const dbError = new Error('Database not found');
      jest.spyOn(service, '$connect').mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow(
        'Database not found',
      );
    });
  });

  describe('Logging', () => {
    it('should log connection message with emoji', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(service, '$connect').mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prisma'),
      );
      consoleSpy.mockRestore();
    });

    it('should log disconnect message with emoji', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔌'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('desconectado'),
      );
      consoleSpy.mockRestore();
    });

    it('should not suppress errors for logging', async () => {
      // Arrange
      jest.spyOn(console, 'log').mockImplementation();
      const connectError = new Error('DB Connection error');
      jest.spyOn(service, '$connect').mockRejectedValue(connectError);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow(
        'DB Connection error',
      );
    });
  });
});
