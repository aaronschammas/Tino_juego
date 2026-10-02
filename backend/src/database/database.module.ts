import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule
 * 
 * Módulo global que centraliza todo lo relacionado con la base de datos.
 * Al ser @Global(), no necesita ser importado en otros módulos.
 * 
 * Ventajas:
 * - Una sola instancia de PrismaService en toda la app
 * - Inyección limpia en cualquier servicio
 * - Fácil de mockear en tests
 * - Desacoplamiento: cambiar Prisma por otra DB sería más sencillo
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
