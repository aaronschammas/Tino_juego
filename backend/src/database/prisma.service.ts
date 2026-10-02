import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Construct PrismaClient with an explicit options object to satisfy
    // Prisma v7 runtime requirement.
    super({});
  }

  /**
   * Se conecta a la base de datos cuando el módulo se inicializa.
   * Si la conexión falla (por ejemplo, debido a un "cold start" de Neon DB),
   * realiza hasta 3 intentos con una pausa de 3 segundos entre ellos.
   */
  async onModuleInit() {
    const maxRetries = 3;
    const delayMs = process.env.NODE_ENV === 'test' ? 0 : 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        console.log('✅ Prisma conectado a la base de datos');
        return;
      } catch (error) {
        console.error(
          `❌ [Intento ${attempt}/${maxRetries}] Error al conectar a la base de datos:`,
          error instanceof Error ? error.message : error,
        );
        if (attempt < maxRetries) {
          if (delayMs > 0) {
            console.log(`Reintentando en ${delayMs / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Cierra la conexión cuando la aplicación se apaga
   */
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma desconectado');
  }
}
