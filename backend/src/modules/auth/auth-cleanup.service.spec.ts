import { Test, TestingModule } from '@nestjs/testing';
import { AuthCleanupService } from './auth-cleanup.service';
import { PrismaService } from 'src/database/prisma.service';

describe('AuthCleanupService', () => {
    let service: AuthCleanupService;

    const mockPrismaService = {
        authSession: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthCleanupService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<AuthCleanupService>(AuthCleanupService);
    });

    describe('runCleanup', () => {
        it('devuelve cero cuando no hay sesiones que limpiar', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            const result = await service.runCleanup();

            expect(result.expiredDeleted).toBe(0);
            expect(result.revokedDeleted).toBe(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('borra sesiones expiradas y retorna el conteo correcto', async () => {
            const expiredIds = [{ id: 'exp-1' }, { id: 'exp-2' }];

            // Primera llamada: sesiones expiradas. Segunda: revocadas (ninguna).
            mockPrismaService.authSession.findMany
                .mockResolvedValueOnce(expiredIds)   // deleteExpiredSessions batch 1
                .mockResolvedValueOnce([])            // deleteExpiredSessions fin
                .mockResolvedValueOnce([]);           // deleteOldRevokedSessions (ninguna)

            mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.runCleanup();

            expect(result.expiredDeleted).toBe(2);
            expect(result.revokedDeleted).toBe(0);
        });

        it('borra sesiones revocadas antiguas y retorna el conteo correcto', async () => {
            const revokedIds = [{ id: 'rev-1' }];
            let revokedCallCount = 0;

            // mockImplementation distingue por argumento, no por orden de llamada.
            // Esto es necesario porque Promise.all ejecuta ambas ramas en paralelo
            // y los mockResolvedValueOnce secuenciales se consumen en orden de llegada,
            // no por rama, lo que produce resultados no deterministas.
            mockPrismaService.authSession.findMany.mockImplementation((args: any) => {
                if (args.where.expiresAt) return Promise.resolve([]);
                if (args.where.revokedAt) {
                    revokedCallCount++;
                    return Promise.resolve(revokedCallCount === 1 ? revokedIds : []);
                }
                return Promise.resolve([]);
            });

            mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 1 });

            const result = await service.runCleanup();

            expect(result.expiredDeleted).toBe(0);
            expect(result.revokedDeleted).toBe(1);
        });

        it('acumula correctamente el total en múltiples batches', async () => {
            // Simulamos que hay más filas que el batch size (500)
            // generando dos batches llenos y luego uno vacío.
            const batch = Array.from({ length: 500 }, (_, i) => ({ id: `id-${i}` }));
            let expiredCallCount = 0;

            // mockImplementation distingue por argumento para ser robusto ante
            // la ejecución paralela de Promise.all: cada rama recibe siempre
            // el valor correcto sin importar el orden de resolución de microtasks.
            mockPrismaService.authSession.findMany.mockImplementation((args: any) => {
                if (args.where.expiresAt) {
                    expiredCallCount++;
                    return Promise.resolve(expiredCallCount <= 2 ? batch : []);
                }
                if (args.where.revokedAt) return Promise.resolve([]);
                return Promise.resolve([]);
            });

            mockPrismaService.authSession.deleteMany
                .mockResolvedValueOnce({ count: 500 })
                .mockResolvedValueOnce({ count: 500 });

            const result = await service.runCleanup();

            expect(result.expiredDeleted).toBe(1000);
            expect(result.revokedDeleted).toBe(0);
            expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledTimes(2);
        });

        it('ejecuta expiradas y revocadas en paralelo (Promise.all)', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            await service.runCleanup();

            // findMany debe llamarse al menos dos veces (una por cada rama)
            expect(mockPrismaService.authSession.findMany).toHaveBeenCalledTimes(2);
        });

        it('filtra expiradas con expiresAt menor a la fecha actual', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            const before = new Date();
            await service.runCleanup();
            const after = new Date();

            const callArgs = mockPrismaService.authSession.findMany.mock.calls[0][0];
            const ltDate: Date = callArgs.where.expiresAt.lt;

            expect(ltDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(ltDate.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('filtra revocadas con revokedAt menor al cutoff de retención (7 días)', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            const before = Date.now();
            await service.runCleanup();
            const after = Date.now();

            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            // findMany[1] es la llamada de deleteOldRevokedSessions
            const callArgs = mockPrismaService.authSession.findMany.mock.calls[1][0];
            const ltDate: Date = callArgs.where.revokedAt.lt;

            expect(ltDate.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs);
            expect(ltDate.getTime()).toBeLessThanOrEqual(after - sevenDaysMs);
        });

        it('devuelve durationMs como número no negativo', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            const result = await service.runCleanup();

            expect(typeof result.durationMs).toBe('number');
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('scheduledCleanup', () => {
        it('llama a runCleanup y loggea el resultado sin tirar error', async () => {
            mockPrismaService.authSession.findMany.mockResolvedValue([]);

            await expect(service.scheduledCleanup()).resolves.toBeUndefined();
        });
    });
});
