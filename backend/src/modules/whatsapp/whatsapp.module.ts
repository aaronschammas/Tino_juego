/**
 * Módulo de WhatsApp: el mismo chat de Tino Mobile, pero por WhatsApp y solo para
 * los dueños de la organización.
 *
 * Reutiliza `AssistantService` entero, así que las consultas y los permisos son
 * exactamente los del chat de la app. Lo único propio de este módulo es el canal:
 * recibir el mensaje de Meta, saber de quién es y responder en formato WhatsApp.
 *
 * Qué lo compone:
 * - `WhatsAppWebhookController`: los endpoints públicos que llama Meta.
 * - `WhatsAppLinkController`: los endpoints con sesión que usa el perfil.
 * - `WhatsAppService`: decide qué responder a cada mensaje.
 * - `WhatsAppLinkService`: vincula y desvincula, y guarda el "Sí / No" de la
 *   organización.
 * - `WhatsAppClientService`: envía los mensajes a la Graph API de Meta.
 * - `WhatsAppDigestService`: el resumen diario de Trello para el owner. Se
 *   exporta para que `IntegrationsModule` lo dispare desde Cloud Scheduler, y
 *   usa `IntegrationActivityModule` (no todo el módulo de integraciones) para no
 *   crear una dependencia circular.
 * - `whatsapp-menu.ts`, `whatsapp-formatter.ts`, `whatsapp-signature.ts`,
 *   `whatsapp.config.ts` y `whatsapp.types.ts`: menú, formato de respuesta,
 *   validación de la firma, variables de entorno y tipos del webhook.
 *
 * `PrismaService` llega solo porque `DatabaseModule` es global.
 */
import { Module } from '@nestjs/common';
import { ActiveOrganizationModule } from 'src/common/active-organization/active-organization.module';
import { AssistantModule } from '../assistant/assistant.module';
import { IntegrationActivityModule } from '../integrations/activity/integration-activity.module';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppLinkController } from './whatsapp-link.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppLinkService } from './whatsapp-link.service';
import { WhatsAppClientService } from './whatsapp-client.service';
import { WhatsAppDigestService } from './whatsapp-digest.service';

@Module({
  imports: [
    ActiveOrganizationModule,
    AssistantModule,
    IntegrationActivityModule,
  ],
  controllers: [WhatsAppWebhookController, WhatsAppLinkController],
  providers: [
    WhatsAppService,
    WhatsAppLinkService,
    WhatsAppClientService,
    WhatsAppDigestService,
  ],
  exports: [WhatsAppLinkService, WhatsAppDigestService],
})
export class WhatsAppModule {}
