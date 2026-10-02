import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './database/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('should return health status ok', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result).toEqual({ status: 'ok' });
    });

    it('should return object with status property', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('ok');
    });

    it('should always return same status', () => {
      // Act
      const result1 = controller.getHealth();
      const result2 = controller.getHealth();

      // Assert
      expect(result1).toEqual(result2);
    });
  });

  describe('getReadiness', () => {
    it('should return ready when the database responds', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(controller.getReadiness()).resolves.toEqual({
        status: 'ready',
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return a generic 503 when the database is unavailable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('internal database error'));

      const error = await controller.getReadiness().catch((reason) => reason);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).toMatchObject({
        status: 503,
        message: 'Service temporarily unavailable',
      });
      expect(JSON.stringify(error)).not.toContain('internal database error');
    });
  });
});

