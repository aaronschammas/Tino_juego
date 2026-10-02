import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';

export interface CleanupResult {
    expiredDeleted: number;
    revokedDeleted: number;
    durationMs: number;
}

@Injectable()
export class AuthCleanupService {
    private readonly logger = new Logger(AuthCleanupService.name);

    /** Días que se retienen sesiones revocadas para auditoría antes de borrarlas */
    private readonly REVOKED_RETENTION_DAYS = 7;

    /** Máximo de filas borradas por batch para evitar locks largos en la tabla */
    private readonly BATCH_SIZE = 500;

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Corre todos los días a las 03:00 UTC.
     * Horario de bajo tráfico para minimizar contención en DB.
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async scheduledCleanup(): Promise<void> {
        this.logger.log('Auth session cleanup iniciado (scheduled)');
        const result = await this.runCleanup();
        this.logger.log(
            `Cleanup completado — expiradas: ${result.expiredDeleted}, ` +
            `revocadas: ${result.revokedDeleted}, ` +
            `duración: ${result.durationMs}ms`,
        );
    }

    /**
     * Ejecuta el cleanup completo. Puede llamarse manualmente desde un
     * endpoint admin o desde tests de integración.
     */
    async runCleanup(): Promise<CleanupResult> {
        const start = Date.now();

        const [expiredDeleted, revokedDeleted] = await Promise.all([
            this.deleteExpiredSessions(),
            this.deleteOldRevokedSessions(),
        ]);

        return {
            expiredDeleted,
            revokedDeleted,
            durationMs: Date.now() - start,
        };
    }

    /**
     * Borra en batches las sesiones cuyo `expiresAt` ya pasó.
     * Una sesión expirada no tiene valor de auditoría y puede eliminarse
     * inmediatamente.
     */
    private async deleteExpiredSessions(): Promise<number> {
        const now = new Date();
        let totalDeleted = 0;

        while (true) {
            // Prisma no soporta DELETE con LIMIT nativo,
            // por eso buscamos los IDs primero y luego borramos.
            const targets = await this.prisma.authSession.findMany({
                where: { expiresAt: { lt: now } },
                select: { id: true },
                take: this.BATCH_SIZE,
            });

            if (targets.length === 0) break;

            const { count } = await this.prisma.authSession.deleteMany({
                where: { id: { in: targets.map((s) => s.id) } },
            });

            totalDeleted += count;

            // Si el batch fue menor que el límite, no quedan más filas
            if (targets.length < this.BATCH_SIZE) break;

            // Pausa entre batches para no saturar el pool de conexiones
            await this.sleep(50);
        }

        return totalDeleted;
    }

    /**
     * Borra en batches las sesiones revocadas que superaron el período de
     * retención. Las revocadas recientes se conservan para auditoría de
     * seguridad (ej: rastrear logout de un dispositivo comprometido).
     */
    private async deleteOldRevokedSessions(): Promise<number> {
        const retentionCutoff = new Date(
            Date.now() - this.REVOKED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        );
        let totalDeleted = 0;

        while (true) {
            const targets = await this.prisma.authSession.findMany({
                where: {
                    revokedAt: {
                        not: null,
                        lt: retentionCutoff,
                    },
                },
                select: { id: true },
                take: this.BATCH_SIZE,
            });

            if (targets.length === 0) break;

            const { count } = await this.prisma.authSession.deleteMany({
                where: { id: { in: targets.map((s) => s.id) } },
            });

            totalDeleted += count;

            if (targets.length < this.BATCH_SIZE) break;

            await this.sleep(50);
        }

        return totalDeleted;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
