/**
 * Modulo chico con el resumen de novedades de Trello. Esta separado de
 * `IntegrationsModule` para que WhatsApp lo pueda usar sin importar todo el
 * modulo de integraciones (y sin dependencias circulares).
 * `PrismaService` llega porque `DatabaseModule` es global.
 */
import { Module } from '@nestjs/common';
import { IntegrationActivityService } from './integration-activity.service';

@Module({
  providers: [IntegrationActivityService],
  exports: [IntegrationActivityService],
})
export class IntegrationActivityModule {}
